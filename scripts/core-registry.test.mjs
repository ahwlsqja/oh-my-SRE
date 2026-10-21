import { test } from "node:test";
import assert from "node:assert/strict";
import {
  mkdtempSync,
  cpSync,
  appendFileSync,
  rmSync,
  mkdirSync,
  renameSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadRegistry, bundleDigest } from "../core/registry.ts";
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
test("manifest의 다른 entrypoint와 helper도 같은 bundle hash로 고정한다", () => {
  const dir = mkdtempSync(join(tmpdir(), "oms-generic-registry-"));
  try {
    cpSync(root, dir, { recursive: true });
    const book = join(dir, "recover-demo-worker");
    mkdirSync(join(book, "actions"));
    renameSync(join(book, "scripts/recover.mjs"), join(book, "actions/fix.mjs"));
    writeFileSync(join(book, "actions/helper.mjs"), "export const helper = true;\n");
    const manifest = JSON.parse(readFileSync(join(book, "manifest.json"), "utf8"));
    manifest.entrypoint = "actions/fix.mjs";
    writeFileSync(join(book, "manifest.json"), JSON.stringify(manifest));
    const registry = JSON.parse(readFileSync(join(dir, "registry.json"), "utf8"));
    assert.doesNotThrow(() => bundleDigest(book));
    registry.entries[0].digest = bundleDigest(book);
    writeFileSync(join(dir, "registry.json"), JSON.stringify(registry));
    assert.ok(loadRegistry(dir).get("recover-demo-worker").script.endsWith("actions/fix.mjs"));
    appendFileSync(join(book, "actions/helper.mjs"), "// 변경\n");
    assert.throws(() => loadRegistry(dir), /runbook_digest_mismatch/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
