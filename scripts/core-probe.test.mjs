import { test } from "node:test";
import assert from "node:assert/strict";
import { harness } from "./core-harness.mjs";
import { readFileSync } from "node:fs";
import { join } from "node:path";
test("unknown 효과는 재시작 없이 dueAt의 새 probe로 닫고 script를 재실행하지 않는다", async () => {
  const h = await harness();
  try {
    let ready = false,
      reads = 0;
    const probe = h.broker.options.probe;
    h.broker.options.probe = async (...args) => {
      reads++;
      const value = await probe(...args);
      return !ready && value.health === "healthy" ? { ...value, health: "degraded" } : value;
    };
    await h.engine.ingest(h.observation());
    assert.equal(Object.values(h.store.state.effects)[0].state, "outcome_unknown");
    const count = reads;
    await h.engine.tick();
    assert.equal(reads, count);
    ready = true;
    h.clock.value += 1001;
    await h.engine.tick();
    assert.equal(Object.values(h.store.state.incidents)[0].status, "resolved");
    assert.equal(Object.values(h.store.state.effects)[0].state, "verified");
    assert.equal(h.investigator.calls, 1);
    assert.equal(JSON.parse(readFileSync(join(h.workspace, "worker.json"), "utf8")).effects, 1);
    assert.ok(h.wiki.search("worker-error").some((row) => row.outcome === "verified"));
  } finally {
    await h.close();
  }
});
test("무응답 probe도 마감 안에 끝나며 unknown을 보존한다", async () => {
  const h = await harness({ action: false, policy: { runDeadlineMs: 20 } });
  try {
    await h.engine.ingest(h.observation());
    const incident = Object.values(h.store.state.incidents)[0];
    h.store.transaction((s) => {
      s.incidents[incident.id].activeRunId = "bounded-probe";
      s.incidents[incident.id].activeRunDeadlineAt = h.now() + 20;
    });
    h.broker.options.probe = async () => new Promise(() => {});
    const call = {
      name: "runbook.execute",
      arguments: {
        id: h.book.id,
        version: h.book.version,
        digest: h.book.digest,
        parameters: { workerId: "demo-worker" },
      },
    };
    await assert.rejects(
      Promise.race([
        h.broker.execute({
          incidentId: incident.id,
          revision: incident.revision,
          runId: "bounded-probe",
          call,
        }),
        new Promise((_, reject) => setTimeout(() => reject(new Error("unbounded_probe")), 200)),
      ]),
      /probe_timeout/,
    );
    h.store.transaction((s) => {
      s.effects["a".repeat(64)] = {
        id: "a".repeat(64),
        incidentId: incident.id,
        revision: incident.revision,
        resourceKey: "demo-worker",
        state: "outcome_unknown",
        runbookRef: { id: h.book.id, version: h.book.version, digest: h.book.digest },
        startedAt: h.now(),
      };
    });
    await Promise.race([
      h.broker.reconcile(),
      new Promise((_, reject) => setTimeout(() => reject(new Error("unbounded_reconcile")), 200)),
    ]);
    assert.equal(Object.values(h.store.state.effects)[0].state, "outcome_unknown");
  } finally {
    await h.close();
  }
});
