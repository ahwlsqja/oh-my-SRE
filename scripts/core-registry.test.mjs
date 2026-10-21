import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, cpSync, appendFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadRegistry } from "../core/registry.ts";
const root = fileURLToPath(new URL("../runbooks", import.meta.url));
test("승격된 hash와 고정 인자만 실행 후보로 로드한다", () => {
  const registry = loadRegistry(root),
    book = registry.get("recover-demo-worker");
  assert.match(book.digest, /^[a-f0-9]{64}$/);
  registry.validateArgs(book, { workerId: "demo-worker" });
  assert.throws(() => registry.validateArgs(book, { workerId: "../other" }), /invalid_args/);
  assert.throws(
    () => registry.validateArgs(book, { workerId: "demo-worker", shell: "anything" }),
    /invalid_args/,
  );
  assert.throws(() => registry.get("draft-worker"), /unregistered_runbook/);
  const dir = mkdtempSync(join(tmpdir(), "oms-registry-"));
  try {
    cpSync(root, dir, { recursive: true });
    appendFileSync(join(dir, "recover-demo-worker/scripts/recover.mjs"), "\n// 변경\n");
    assert.throws(() => loadRegistry(dir), /runbook_digest_mismatch/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
