import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { Broker } from "../core/broker.ts";
import { loadRegistry } from "../core/registry.ts";
import { openJournal } from "../storage/journal.ts";
import { emptyState } from "../core/contracts.ts";
test("broker가 사전 허용 script를 한 번 적용하고 새 probe로 검증한다", async () => {
  const workspace = mkdtempSync(join(tmpdir(), "oms-broker-")),
    registry = loadRegistry(fileURLToPath(new URL("../runbooks", import.meta.url))),
    book = registry.get("recover-demo-worker");
  writeFileSync(join(workspace, "worker.json"), JSON.stringify({ health: "degraded", effects: 0 }));
  const store = openJournal(join(workspace, "state"), emptyState(), { maxBytes: 1000000 });
  store.transaction((s) => {
    s.incidents.demo = {
      id: "demo",
      resourceKey: "demo-worker",
      revision: 1,
      activeRunId: "run-1",
    };
  });
  const policy = {
    revision: "demo-v1",
    allowedRunbooks: [
      {
        id: book.id,
        version: book.version,
        digest: book.digest,
        effect: book.effect,
        target: book.target,
      },
    ],
  };
  let probes = 0;
  const probe = async () => {
    probes++;
    return {
      ...JSON.parse(readFileSync(join(workspace, "worker.json"), "utf8")),
      resourceKey: "demo-worker",
      observedAt: Date.now(),
    };
  };
  const broker = new Broker({ store, registry, policy, workspace, probe });
  const request = {
    incidentId: "demo",
    revision: 1,
    runId: "run-1",
    call: {
      name: "runbook.execute",
      arguments: {
        id: book.id,
        version: book.version,
        digest: book.digest,
        parameters: { workerId: "demo-worker" },
      },
    },
  };
  try {
    const concurrent = await Promise.all([broker.execute(request), broker.execute(request)]);
    assert.ok(concurrent.some((result) => result.state === "verified"));
    assert.equal(store.state.audit.filter((row) => row.kind === "action_intent").length, 1);
    assert.equal((await broker.execute(request)).state, "verified");
    assert.equal(JSON.parse(readFileSync(join(workspace, "worker.json"), "utf8")).effects, 1);
    assert.ok(probes >= 2);
    await assert.rejects(
      broker.execute({
        ...request,
        call: {
          ...request.call,
          arguments: { ...request.call.arguments, parameters: { workerId: "other" } },
        },
      }),
      /invalid_args/,
    );
    await assert.rejects(
      new Broker({
        store,
        registry,
        policy: { ...policy, allowedRunbooks: [] },
        workspace,
        probe,
      }).execute(request),
      /action_not_allowed/,
    );
  } finally {
    store.close();
    rmSync(workspace, { recursive: true, force: true });
  }
});
