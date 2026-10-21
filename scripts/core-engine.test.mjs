import { test } from "node:test";
import assert from "node:assert/strict";
import { harness } from "./core-harness.mjs";
import { digest } from "../storage/journal.ts";
test("모델 HTTP 오류 코드는 값 노출 없이 실패 지식에 보존한다", async () => {
  const h = await harness({
    investigator: {
      kind: "openai_responses",
      async investigate() {
        throw new Error("model_http_429");
      },
    },
  });
  try {
    await h.engine.ingest(h.observation());
    assert.equal(h.wiki.search("worker-error")[0].failureCode, "model_http_429");
    assert.equal(Object.values(h.store.state.budgets)[0].reserved, 1);
  } finally {
    await h.close();
  }
});
test("실제 거부된 조사의 실패 코드와 런북이 영구 지식으로 다음 입력에 도달한다", async () => {
  const h = await harness();
  try {
    h.investigator.call.arguments.parameters.workerId = "not-allowed";
    await h.engine.ingest(h.observation());
    const failed = h.wiki.search("worker-error");
    assert.ok(
      failed.some(
        (row) =>
          row.outcome === "blocked" &&
          row.failureCode === "invalid_args" &&
          row.runbook.id === h.book.id,
      ),
    );
    h.investigator.call.arguments.parameters.workerId = "demo-worker";
    h.clock.value += 100;
    await h.engine.ingest(
      h.observation({ eventId: "fixed-attempt", semanticDigest: digest("new-proof") }),
    );
    assert.ok(
      h.investigator.contexts[1].knowledge.some(
        (row) => row.failureCode === "invalid_args" && row.evidenceRefs.length > 0,
      ),
    );
    assert.equal(Object.values(h.store.state.incidents)[0].recovery, "verified");
  } finally {
    await h.close();
  }
});
test("같은 원천의 과거 관측은 최신 P0·revision·dueAt를 되감지 않는다", async () => {
  const h = await harness({ action: false });
  try {
    await h.engine.ingest(h.observation({ sourceSeverity: "critical" }));
    const before = Object.values(h.store.state.incidents)[0];
    const result = await h.engine.ingest(
      h.observation({
        eventId: "older-event",
        observedAt: h.now() - 1000,
        sourceSeverity: "minor",
        semanticDigest: digest("old"),
      }),
    );
    assert.equal(result.outcome, "out_of_order");
    const after = Object.values(h.store.state.incidents)[0];
    assert.equal(after.severity, "P0");
    assert.equal(after.revision, before.revision);
    assert.equal(after.dueAt, before.dueAt);
    assert.equal(after.observation.observedAt, before.observation.observedAt);
    assert.equal(h.investigator.calls, 1);
  } finally {
    await h.close();
  }
});
test("시도 상한은 같은 기간 재시작으로 우회하지 않고 다음 기간 dueAt에 재개한다", async () => {
  let h = await harness({ action: false, policy: { maxAttemptsPerIncidentPerPeriod: 1 } });
  try {
    await h.engine.ingest(h.observation());
    const workspace = h.workspace,
      at = h.clock.value;
    h.clock.value += 1001;
    await h.engine.tick();
    assert.equal(h.investigator.calls, 1);
    await h.close(false);
    h = await harness({ workspace, action: false, policy: { maxAttemptsPerIncidentPerPeriod: 1 } });
    h.clock.value = at + 1002;
    await h.engine.tick();
    assert.equal(h.investigator.calls, 0);
    h.clock.value = Math.floor(at / h.policy.periodMs) * h.policy.periodMs + h.policy.periodMs + 1;
    await h.engine.tick();
    assert.equal(h.investigator.calls, 1);
    assert.equal(Object.values(h.store.state.incidents)[0].attempts, 2);
  } finally {
    await h.close();
  }
});

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
    h.wiki.record({
      incidentId: "prior-failure",
      episode: 1,
      revision: 1,
      failureClass: "worker-error",
      severity: "P1",
      outcome: "failed",
      runbook: { id: h.book.id, version: h.book.version, digest: h.book.digest },
      evidenceRefs: ["synthetic-failure-proof"],
    });
    await h.engine.ingest(h.observation());
    const incident = Object.values(h.store.state.incidents)[0];
    assert.equal(incident.recovery, "verified");
    assert.equal(incident.status, "resolved");
    assert.equal(Object.keys(h.store.state.outbox).length, 0);
    assert.equal(h.wiki.search("worker-error").length, 2);
    const firstContext = h.investigator.contexts[0];
    assert.equal(firstContext.failureClass, "worker-error");
    assert.equal(firstContext.severity, "P1");
    assert.equal(firstContext.observation.providerId, "demo-probe");
    assert.ok(firstContext.tools.length > 0);
    assert.equal(firstContext.knowledge[0].outcome, "failed");
    h.investigator.call = undefined;
    h.worker.degrade();
    h.clock.value += 100;
    await h.engine.ingest(h.observation({ eventId: "event-2", sourceRevision: "revision-2" }));
    assert.equal(h.investigator.calls, 2);
    assert.equal(h.investigator.contexts[1].knowledge.length, 2);
    assert.ok(
      h.investigator.contexts[1].knowledge.some(
        (item) =>
          item.outcome === "verified" &&
          item.runbookRef.id === h.book.id &&
          item.evidenceRefs.length > 0,
      ),
    );
    assert.equal(Object.values(h.store.state.incidents)[0].episode, 2);
    assert.equal((await h.probe("demo-worker")).health, "healthy");
  } finally {
    await h.close();
  }
});
