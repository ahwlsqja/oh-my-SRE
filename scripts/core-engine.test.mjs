import { test } from "node:test";
import assert from "node:assert/strict";
import { harness } from "./core-harness.mjs";
import { digest } from "../storage/journal.ts";

test("P2 중복과 같은 의미 poll은 억제하고 dueAt·기간 예산을 지킨다", async () => {
  const h = await harness({ action: false, policy: { maxRunsPerPeriod: 1 } });
  try {
    await h.engine.ingest(h.observation({ sourceSeverity: "minor" }));
    await h.engine.ingest(h.observation({ sourceSeverity: "minor" }));
    await h.engine.ingest(h.observation({ eventId: "event-2", sourceSeverity: "minor" }));
    assert.equal(h.investigator.calls, 1);
    h.clock.value += 1001;
    await h.engine.tick();
    assert.equal(h.investigator.calls, 1);
    assert.equal(Object.values(h.store.state.incidents)[0].investigation, "budget_paused");
    assert.equal(Object.keys(h.store.state.outbox).length, 0);
    h.clock.value =
      Math.floor(h.clock.value / h.policy.periodMs) * h.policy.periodMs + h.policy.periodMs;
    await h.engine.tick();
    assert.equal(h.investigator.calls, 2);
    await h.engine.ingest(
      h.observation({
        eventId: "event-3",
        semanticDigest: digest("worse"),
        sourceSeverity: "minor",
      }),
    );
    assert.equal(h.investigator.calls, 2);
    assert.equal(Object.values(h.store.state.incidents)[0].severity, "P2");
  } finally {
    await h.close();
  }
});

test("확정 P0는 소진된 모델 예산과 무관하게 page를 묶고 ACK 뒤 재조사한다", async () => {
  const h = await harness({ action: false, policy: { maxRunsPerPeriod: 1 } });
  try {
    await h.engine.ingest(h.observation({ sourceSeverity: "minor" }));
    await h.engine.ingest(
      h.observation({
        eventId: "critical-1",
        sourceSeverity: "critical",
        semanticDigest: digest("outage"),
      }),
    );
    const pages = Object.values(h.store.state.outbox);
    assert.equal(pages.length, 1);
    assert.equal(h.investigator.calls, 1);
    h.engine.ack(pages[0].key, "demo-operator");
    await h.engine.ingest(
      h.observation({
        eventId: "critical-2",
        sourceSeverity: "critical",
        semanticDigest: digest("outage"),
      }),
    );
    assert.equal(Object.keys(h.store.state.outbox).length, 1);
    h.clock.value =
      Math.floor(h.clock.value / h.policy.periodMs) * h.policy.periodMs + h.policy.periodMs;
    await h.engine.tick();
    assert.equal(h.investigator.calls, 2);
    assert.equal(Object.values(h.store.state.outbox)[0].state, "acked");
    assert.equal(Object.values(h.store.state.incidents)[0].status, "open");
    await h.engine.ingest(
      h.observation({ eventId: "missing-1", sourceSeverity: "minor", evidenceState: "missing" }),
    );
    assert.equal(Object.values(h.store.state.incidents)[0].severity, "P0");
    assert.equal(Object.values(h.store.state.incidents)[0].recovery, "unverified");
  } finally {
    await h.close();
  }
});

test("늦은 모델 결과는 새 revision의 효과를 실행하지 않는다", async () => {
  let release;
  let calls = 0;
  const investigator = {
    kind: "fixture",
    async investigate(ctx) {
      calls++;
      if (calls === 1)
        return new Promise((resolve) => {
          release = () =>
            resolve({
              basedOnRevision: ctx.revision,
              outcome: "completed",
              toolCalls: [],
              usageUnits: 1,
            });
        });
      return { basedOnRevision: ctx.revision, outcome: "completed", toolCalls: [], usageUnits: 1 };
    },
  };
  const h = await harness({ investigator });
  try {
    const running = h.engine.ingest(h.observation());
    await new Promise((resolve) => setImmediate(resolve));
    await h.engine.ingest(
      h.observation({ eventId: "new-input", semanticDigest: digest("changed") }),
    );
    release();
    await running;
    assert.equal(Object.values(h.store.state.incidents)[0].investigation, "stale_result");
    assert.equal(Object.keys(h.store.state.effects).length, 0);
    await h.engine.tick();
    assert.equal(calls, 2);
  } finally {
    await h.close();
  }
});
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
