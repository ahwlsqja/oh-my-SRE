import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
test("CLI는 로컬 실행 근거·projection·wiki를 남기고 재시작 때 중복 실행하지 않는다", () => {
  const root = mkdtempSync(join(tmpdir(), "oms-cli-"));
  const script = fileURLToPath(new URL("./engine-demo.mjs", import.meta.url));
  try {
    const result = JSON.parse(
      execFileSync(process.execPath, ["--experimental-strip-types", script, "--workspace", root], {
        encoding: "utf8",
        timeout: 15000,
      }),
    );
    assert.equal(result.kind, "local_demo_receipt");
    assert.equal(result.p1Recovery, "verified");
    assert.equal(result.wikiReuse, true);
    assert.equal(result.p2Suppressed, true);
    assert.equal(result.p0PageIntents, 1);
    assert.equal(result.p0InvestigationContinued, true);
    assert.equal(result.liveModelCalls, 0);
    const projection = JSON.parse(readFileSync(join(root, "engine-projection.json"), "utf8"));
    assert.equal(projection.scope, "local_demo");
    assert.ok(projection.incidents.some((row) => row.severity === "P0" && row.status === "open"));
    assert.ok(
      projection.incidents.every(
        (row) => row.observation === undefined && row.activeRunId === undefined,
      ),
    );
    const resumed = JSON.parse(
      execFileSync(
        process.execPath,
        ["--experimental-strip-types", script, "--workspace", root, "--scenario", "resume"],
        { encoding: "utf8", timeout: 15000 },
      ),
    );
    assert.equal(resumed.duplicateEffects, 0);
    assert.equal(resumed.modelRuns, 0);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
