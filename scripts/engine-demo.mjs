import {
  mkdtempSync,
  mkdirSync,
  existsSync,
  readdirSync,
  writeFileSync,
  readFileSync,
  realpathSync,
  chmodSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, relative, isAbsolute } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import assert from "node:assert/strict";
import { harness } from "./core-harness.mjs";
import { deriveExports } from "../core/tool-exports.ts";
import { safeErrorCode } from "../core/errors.ts";
const args = process.argv.slice(2);
let workspace,
  scenario = "demo",
  recoverStaleLock = false;
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--workspace") workspace = args[++i];
  else if (args[i] === "--scenario") scenario = args[++i];
  else if (args[i] === "--recover-stale-lock") recoverStaleLock = true;
  else throw new Error("invalid_cli_argument");
}
if (!["demo", "resume", "crash-after-intent", "crash-after-execute"].includes(scenario))
  throw new Error("invalid_demo_scenario");
workspace = workspace ? resolve(workspace) : mkdtempSync(join(tmpdir(), "oh-my-sre-engine-"));
mkdirSync(workspace, { recursive: true, mode: 0o700 });
const root = realpathSync(fileURLToPath(new URL("..", import.meta.url))),
  location = relative(root, realpathSync(workspace));
if (!location || (!location.startsWith("..") && !isAbsolute(location)))
  throw new Error("demo_workspace_must_be_external");
const marker = join(workspace, ".oms-demo-owner.json");
if (!existsSync(marker)) {
  if (readdirSync(workspace).length) throw new Error("demo_workspace_not_owned");
  writeFileSync(marker, JSON.stringify({ kind: "oh-my-sre-local-demo", version: 1 }), {
    flag: "wx",
    mode: 0o600,
  });
}
const owner = JSON.parse(readFileSync(marker, "utf8"));
if (owner.kind !== "oh-my-sre-local-demo" || owner.version !== 1)
  throw new Error("demo_workspace_not_owned");
chmodSync(workspace, 0o700);
const sourceRevision = execFileSync("git", ["-C", root, "rev-parse", "HEAD"], {
  encoding: "utf8",
}).trim();
const write = (name, value) =>
  writeFileSync(join(workspace, name), JSON.stringify(value, null, 2) + "\n", { mode: 0o600 });
let h;
try {
  h = await harness({
    workspace,
    recoverStaleLock,
    fault: (stage) => {
      if (
        (scenario === "crash-after-intent" && stage === "after_intent") ||
        (scenario === "crash-after-execute" && stage === "after_execute")
      )
        process.kill(process.pid, "SIGKILL");
    },
  });
  const effects = () => JSON.parse(readFileSync(join(workspace, "worker.json"), "utf8")).effects;
  const before = effects();
  let receipt;
  if (scenario === "resume") {
    await h.engine.recover();
    receipt = {
      kind: "local_resume_receipt",
      duplicateEffects: effects() - before,
      modelRuns: h.investigator.calls,
      effects: effects(),
      unknownEffects: Object.values(h.store.state.effects).filter(
        (e) => e.state === "outcome_unknown",
      ).length,
      verifiedEffects: Object.values(h.store.state.effects).filter((e) => e.state === "verified")
        .length,
    };
    assert.equal(receipt.duplicateEffects, 0);
    assert.equal(receipt.modelRuns, 0);
  } else if (scenario.startsWith("crash-")) {
    write("crash-plan.json", { kind: "local_crash_fixture", scenario, sourceRevision });
    await h.engine.ingest(h.observation());
    throw new Error("crash_fixture_did_not_stop");
  } else {
    if (Object.keys(h.store.state.incidents).length)
      throw new Error("demo_requires_fresh_workspace");
    await h.engine.ingest(h.observation());
    assert.equal(Object.values(h.store.state.incidents)[0].recovery, "verified");
    h.worker.degrade();
    h.investigator.call = undefined;
    h.clock.value += 100;
    await h.engine.ingest(
      h.observation({ eventId: "worker-repeat", sourceRevision: "repeat-proof" }),
    );
    const wikiReuse = h.investigator.contexts[1].knowledge.some(
      (k) => k.outcome === "verified" && k.runbookRef?.id === h.book.id,
    );
    assert.equal((await h.probe("demo-worker")).health, "healthy");
    const beforeP2 = h.investigator.calls,
      p2 = h.observation({
        eventId: "p2-latency",
        failureClass: "latency-warning",
        sourceSeverity: "minor",
      });
    await h.engine.ingest(p2);
    await h.engine.ingest(p2);
    await h.engine.ingest({ ...p2, eventId: "p2-same-poll" });
    const p2Suppressed = h.investigator.calls - beforeP2 === 1;
    await h.engine.ingest(
      h.observation({
        eventId: "p0-outage",
        failureClass: "critical-function",
        sourceSeverity: "critical",
      }),
    );
    const page = Object.values(h.store.state.outbox)[0];
    h.engine.ack(page.key, "demo-operator");
    const beforeP0 = h.investigator.contexts.filter(
      (c) => c.failureClass === "critical-function",
    ).length;
    h.clock.value += 1100;
    await h.engine.tick();
    const p0InvestigationContinued =
      h.investigator.contexts.filter((c) => c.failureClass === "critical-function").length >
      beforeP0;
    receipt = {
      kind: "local_demo_receipt",
      p1Recovery: "verified",
      wikiReuse,
      p2Suppressed,
      p0PageIntents: Object.keys(h.store.state.outbox).length,
      p0InvestigationContinued,
      actualScriptEffects: effects(),
      modelRuns: h.investigator.calls,
      wikiEntries: h.wiki.search("worker-error").length,
    };
    assert.ok(wikiReuse && p2Suppressed && p0InvestigationContinued);
    assert.equal(receipt.p0PageIntents, 1);
  }
  const exports = deriveExports(h.registry, h.policy),
    directory = join(workspace, "exports");
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  writeFileSync(
    join(directory, "tools.json"),
    JSON.stringify({ kind: exports.kind, tools: exports.tools }, null, 2),
    { mode: 0o600 },
  );
  for (const skill of exports.skills) {
    const path = join(directory, skill.id);
    mkdirSync(path, { recursive: true, mode: 0o700 });
    writeFileSync(join(path, "SKILL.md"), skill.content, { mode: 0o600 });
  }
  write("engine-projection.json", h.engine.projection());
  const final = {
    ...receipt,
    sourceRevision,
    workspace,
    projectionPath: join(workspace, "engine-projection.json"),
    investigator: "fixture",
    liveModelCalls: 0,
    externalNotifications: 0,
    clock: "synthetic",
    mcp: "metadata_only",
    observedAt: new Date().toISOString(),
  };
  write(scenario === "resume" ? "resume-receipt.json" : "demo-receipt.json", final);
  console.log(JSON.stringify(final));
} catch (error) {
  console.error(
    safeErrorCode(error) === "provider_failed" ? "engine_demo_failed" : safeErrorCode(error),
  );
  process.exitCode = 1;
} finally {
  if (h) await h.close(false);
}
