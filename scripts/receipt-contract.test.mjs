import assert from "node:assert/strict";
import { test } from "node:test";
import { projectSnapshot } from "../src/providers/receipt.ts";
import { createReceiptMiddleware, readReceiptFile } from "../server/receipt-provider.mjs";
import { mkdtemp, writeFile, symlink, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer, request } from "node:http";

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
      x.receipts[0].claim = "product_overview_response";
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

test("Fact 후보 대응은 전체 Flink 검증과 별도 claim으로 보존한다", () => {
  const input = fixture();
  input.receipts[0].sourceKind = "clickhouse_scoped_aggregate";
  input.receipts[0].claim = "fact_candidate_membership";
  input.receipts[0].coverage = "incomplete";
  assert.equal(projectSnapshot(input, now).receipts[0].claim, "fact_candidate_membership");
});

test("Raw 적재원장 연결은 원천 전달 증명과 별도 claim으로 보존한다", () => {
  const input = fixture();
  input.receipts[0].sourceKind = "clickhouse_scoped_aggregate";
  input.receipts[0].claim = "raw_load_boundary_membership";
  input.receipts[0].coverage = "incomplete";
  input.receipts[0].counters = { rawBoundaries: 3, loadedBoundaries: 3 };
  assert.equal(projectSnapshot(input, now).receipts[0].claim, "raw_load_boundary_membership");
});

test("저장소 밖 고정 일반 파일만 상한 내에서 읽고 원문 오류를 숨긴다", async () => {
  const root = await mkdtemp(join(tmpdir(), "oms-synthetic-"));
  const file = join(root, "receipt.json");
  try {
    await writeFile(file, JSON.stringify(fixture()));
    assert.deepEqual(await readReceiptFile(file, process.cwd(), now), fixture());
    await writeFile(file, " ".repeat(131073));
    await assert.rejects(readReceiptFile(file, process.cwd(), now), /receipt_unavailable/);
    await writeFile(file, "invalid-json");
    await assert.rejects(readReceiptFile(file, process.cwd(), now), /^Error: receipt_unavailable$/);
    await symlink(file, join(root, "link.json"));
    await assert.rejects(
      readReceiptFile(join(root, "link.json"), process.cwd(), now),
      /receipt_unavailable/,
    );
    for (const path of [undefined, "relative.json", root, join(process.cwd(), "package.json")]) {
      await assert.rejects(
        readReceiptFile(path, process.cwd(), now),
        /^Error: receipt_unavailable$/,
      );
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("endpoint는 동일 로컬 Host/Origin의 GET만 허용한다", async () => {
  const root = await mkdtemp(join(tmpdir(), "oms-synthetic-"));
  const file = join(root, "receipt.json");
  await writeFile(file, JSON.stringify(fixture()));
  const server = createServer();
  server.on(
    "request",
    createReceiptMiddleware({
      path: file,
      root: process.cwd(),
      getPort: () => server.address().port,
      now: () => now,
    }),
  );
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;
  const url = `http://127.0.0.1:${port}/api/receipts`;
  try {
    const ok = await fetch(url, { headers: { origin: `http://127.0.0.1:${port}` } });
    assert.equal(ok.status, 200);
    assert.deepEqual(await ok.json(), fixture());
    assert.equal(ok.headers.get("cache-control"), "no-store");
    assert.equal(ok.headers.get("access-control-allow-origin"), null);
    for (const headers of [
      { origin: "https://example.invalid" },
      { host: `example.invalid:${port}` },
      { host: "localhost:1" },
      { "sec-fetch-site": "cross-site" },
    ]) {
      const status = await new Promise((resolve, reject) => {
        const req = request(url, { headers }, (res) => {
          res.resume();
          resolve(res.statusCode);
        });
        req.on("error", reject);
        req.end();
      });
      assert.equal(status, 403, JSON.stringify(headers));
    }
    assert.equal((await fetch(url, { method: "POST" })).status, 405);
    assert.equal((await fetch(`${url}?file=other`)).status, 400);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await rm(root, { recursive: true, force: true });
  }
});
