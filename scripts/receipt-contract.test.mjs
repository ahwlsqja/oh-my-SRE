import assert from "node:assert/strict";
import { test } from "node:test";
import { projectSnapshot } from "../src/providers/receipt.ts";

const now = Date.parse("2026-01-01T12:00:00.000Z");
export const fixture = () => ({
  version: 1,
  capturedAt: "2026-01-01T12:00:00.000Z",
  receipts: [
    {
      sourceKind: "deployment_readback",
      claim: "deployment_binding",
      verdict: "verified",
      observedAt: "2026-01-01T11:59:00.000Z",
      ttlSeconds: 300,
      scopeDigest: "a".repeat(64),
      evidenceDigest: "b".repeat(64),
      coverage: "scoped",
      limitations: ["service_health_unverified"],
      counters: { checksPassed: 5 },
    },
  ],
});

test("확인된 배포 단계가 전체 정상으로 승격되지 않고 원래 시각에서 만료한다", () => {
  const input = fixture();
  const view = projectSnapshot(input, now);
  assert.equal(view.overall, "partial");
  assert.equal(view.receipts[0].status, "verified");
  assert.equal(view.receipts[0].expiresAt, "2026-01-01T12:04:00.000Z");
  input.capturedAt = "2026-01-01T12:10:00.000Z";
  const reread = projectSnapshot(input, now + 600_000);
  assert.equal(reread.receipts[0].status, "stale");
  assert.equal(reread.receipts[0].expiresAt, view.receipts[0].expiresAt);
});

test("비공개 원문이 섞인 알 수 없는 필드와 잘못된 스키마를 거부한다", () => {
  const mutations = [
    (x) => {
      x.secret = "synthetic-only";
    },
    (x) => {
      x.receipts[0].url = "https://example.invalid";
    },
    (x) => {
      x.receipts[0].counters.privateId = 1;
    },
    (x) => {
      x.receipts[0].ttlSeconds = 86401;
    },
    (x) => {
      x.receipts[0].ttlSeconds = 0;
    },
    (x) => {
      x.receipts[0].observedAt = "2026-01-01T12:01:00.000Z";
    },
    (x) => {
      x.capturedAt = "2026-01-01T12:01:00.000Z";
    },
    (x) => {
      x.receipts[0].scopeDigest = "private-id";
    },
    (x) => {
      x.receipts[0].counters.rows = -1;
    },
    (x) => {
      x.receipts[0].sourceKind = "other";
    },
    (x) => {
      x.receipts[0].limitations = ["arbitrary text"];
    },
    (x) => {
      x.receipts = [];
    },
  ];
  for (const mutate of mutations) {
    const input = fixture();
    mutate(input);
    assert.throws(() => projectSnapshot(input, now), /invalid_receipt/);
  }
  for (const input of [null, [], {}, "invalid"])
    assert.throws(() => projectSnapshot(input, now), /invalid_receipt/);
});

test("불완전 coverage는 단계 확인으로 승격되지 않는다", () => {
  const input = fixture();
  input.receipts[0].coverage = "incomplete";
  assert.equal(projectSnapshot(input, now).receipts[0].status, "partial");
});
