import { test } from "node:test";
import assert from "node:assert/strict";
import { harness } from "./core-harness.mjs";
test("P1 복구·독립 probe·wiki가 이어지고 다음 사건은 경험을 재검색한다", async () => {
  const h = await harness();
  try {
    await h.engine.ingest(h.observation());
    const incident = Object.values(h.store.state.incidents)[0];
    assert.equal(incident.recovery, "verified");
    assert.equal(incident.status, "resolved");
    assert.equal(Object.keys(h.store.state.outbox).length, 0);
    assert.equal(h.wiki.search("worker-error").length, 1);
    h.worker.degrade();
    h.clock.value += 100;
    await h.engine.ingest(h.observation({ eventId: "event-2", sourceRevision: "revision-2" }));
    assert.equal(h.investigator.calls, 2);
    assert.equal(h.investigator.contexts[1].knowledge.length, 1);
    assert.equal(Object.values(h.store.state.incidents)[0].episode, 2);
    assert.equal((await h.probe("demo-worker")).health, "healthy");
  } finally {
    await h.close();
  }
});
