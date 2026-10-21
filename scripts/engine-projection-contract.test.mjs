import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp, writeFile, symlink, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer, request } from "node:http";
import * as provider from "../server/engine-provider.mjs";

const fixture = () => ({
  kind: "local_engine",
  scope: "local_demo",
  investigator: "fixture",
  observedAt: "2026-01-01T12:00:00.000Z",
  incidents: [
    {
      id: "a".repeat(64),
      resourceKey: "synthetic-worker",
      failureClass: "synthetic_failure",
      episode: 1,
      revision: 2,
      severity: "P0",
      evidenceState: "complete",
      status: "open",
      investigation: "investigating",
      attempts: 2,
      periodAttempts: 1,
      dueAt: 1767268800000,
      recovery: "unverified",
      knowledgeHits: 0,
    },
  ],
  pages: [
    {
      key: "b".repeat(64),
      incidentId: "a".repeat(64),
      episode: 1,
      state: "pending",
      revision: 2,
      recoveryUpdate: false,
    },
  ],
  effects: [
    {
      id: "c".repeat(64),
      incidentId: "a".repeat(64),
      revision: 2,
      resourceKey: "synthetic-worker",
      state: "outcome_unknown",
      runbookRef: { id: "synthetic-restart", version: "1", digest: "d".repeat(64) },
      startedAt: 1767268800000,
      reconcileDueAt: 1767268860000,
    },
  ],
  budgets: { 1767268800000: { reserved: 1, spent: 2 } },
  auditCount: 5,
});

test("고정 projection은 허용 필드·타입·범위만 통과한다", () => {
  assert.equal(
    typeof provider.validateEngineProjection,
    "function",
    "strict engine projection 검증 필요",
  );
  assert.deepEqual(provider.validateEngineProjection(fixture()), fixture());
  const mutations = [
    (x) => {
      x.raw = "synthetic-private";
    },
    (x) => {
      x.kind = "remote_engine";
    },
    (x) => {
      x.scope = "production";
    },
    (x) => {
      x.investigator = "unknown";
    },
    (x) => {
      x.observedAt = "invalid";
    },
    (x) => {
      x.incidents[0].credential = "synthetic-private";
    },
    (x) => {
      x.incidents[0].episode = 0;
    },
    (x) => {
      x.incidents[0].dueAt = -1;
    },
    (x) => {
      x.incidents[0].severity = "P9";
    },
    (x) => {
      x.incidents[0].evidenceState = "healthy";
    },
    (x) => {
      x.incidents[0].runbookRef = { id: "fake", version: "1", digest: "bad" };
    },
    (x) => {
      x.incidents[0].failureCode = "raw error";
    },
    (x) => {
      x.pages[0].revision = 1.5;
    },
    (x) => {
      x.pages[0].ackedBy = { raw: "fake" };
    },
    (x) => {
      x.effects[0].runbookRef.path = "/synthetic";
    },
    (x) => {
      x.effects[0].proofDigest = "invalid";
    },
    (x) => {
      x.effects[0].verifiedAt = null;
    },
    (x) => {
      x.budgets["private"] = { reserved: 0, spent: 0 };
    },
    (x) => {
      x.budgets["1767268800000"].usd = 1;
    },
    (x) => {
      x.auditCount = -1;
    },
  ];
  for (const mutate of mutations) {
    const value = fixture();
    mutate(value);
    assert.throws(() => provider.validateEngineProjection(value), /^Error: engine_unavailable$/);
  }
});

test("저장소 밖 상한 이내 일반 파일만 읽고 경로·원문 오류는 숨긴다", async () => {
  assert.equal(typeof provider.readEngineFile, "function", "bounded engine file 읽기 필요");
  const root = await mkdtemp(join(tmpdir(), "oms-synthetic-engine-"));
  const file = join(root, "engine.json");
  try {
    await writeFile(file, JSON.stringify(fixture()), { mode: 0o600 });
    assert.deepEqual(await provider.readEngineFile(file, process.cwd()), fixture());
    await symlink(file, join(root, "link.json"));
    for (const path of [
      undefined,
      "relative.json",
      root,
      join(root, "link.json"),
      join(process.cwd(), "package.json"),
    ]) {
      await assert.rejects(
        provider.readEngineFile(path, process.cwd()),
        /^Error: engine_unavailable$/,
      );
    }
    for (const content of [
      " ".repeat(131073),
      "synthetic-private-invalid-json",
      JSON.stringify({ ...fixture(), raw: "fake" }),
    ]) {
      await writeFile(file, content);
      await assert.rejects(
        provider.readEngineFile(file, process.cwd()),
        /^Error: engine_unavailable$/,
      );
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("engine endpoint는 실제 포트의 동일 로컬 Host·Origin GET만 허용한다", async () => {
  assert.equal(typeof provider.createEngineMiddleware, "function", "로컬 engine GET endpoint 필요");
  const root = await mkdtemp(join(tmpdir(), "oms-synthetic-engine-"));
  const file = join(root, "engine.json");
  await writeFile(file, JSON.stringify(fixture()), { mode: 0o600 });
  const server = createServer();
  server.on(
    "request",
    provider.createEngineMiddleware({
      path: file,
      root: process.cwd(),
      getPort: () => server.address().port,
    }),
  );
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;
  const url = `http://127.0.0.1:${port}/api/engine`;
  const status = (headers) =>
    new Promise((resolve, reject) => {
      const req = request(url, { headers }, (res) => {
        res.resume();
        resolve(res.statusCode);
      });
      req.on("error", reject);
      req.end();
    });
  try {
    const response = await fetch(url, { headers: { origin: `http://127.0.0.1:${port}` } });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), fixture());
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.equal(response.headers.get("access-control-allow-origin"), null);
    assert.equal(
      await status({ host: `localhost:${port}`, origin: `http://localhost:${port}` }),
      200,
    );
    for (const headers of [
      { origin: "https://example.invalid" },
      { origin: `http://localhost:${port}` },
      { host: `example.invalid:${port}` },
      { host: "localhost:1" },
      { "sec-fetch-site": "cross-site" },
    ]) {
      assert.equal(await status(headers), 403, JSON.stringify(headers));
    }
    assert.equal((await fetch(url, { method: "POST" })).status, 405);
    assert.equal((await fetch(`${url}?file=other`)).status, 400);
    await rm(file);
    const unavailable = await fetch(url);
    assert.equal(unavailable.status, 503);
    assert.deepEqual(await unavailable.json(), { error: "engine_unavailable" });
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await rm(root, { recursive: true, force: true });
  }
});
