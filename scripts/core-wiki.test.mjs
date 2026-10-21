import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { GitWiki } from "../providers/wiki.ts";
test("성공·실패 학습을 Git에 멱등 기록하고 draft와 분리해 재검색한다", () => {
  const root = mkdtempSync(join(tmpdir(), "oms-wiki-"));
  try {
    const wiki = new GitWiki(root, { maxEntries: 100, maxEntryBytes: 10000 });
    const record = {
      incidentId: "demo",
      episode: 1,
      revision: 1,
      failureClass: "worker-error",
      severity: "P1",
      outcome: "verified",
      runbook: { id: "recover-demo-worker", version: "1.0.0", digest: "a".repeat(64) },
    };
    const first = wiki.record(record);
    assert.equal(wiki.record(record), first);
    const replay = new GitWiki(root, { maxEntries: 100, maxEntryBytes: 10000 });
    assert.equal(replay.search("worker-error").length, 1);
    assert.equal(replay.search("worker-error")[0].outcome, "verified");
    replay.draft({ id: "draft-recovery", proposal: "아직 실행하지 않는 수정안" });
    assert.equal(replay.search("worker-error").length, 1);
    assert.equal(
      execFileSync("git", ["-C", root, "rev-list", "--count", "HEAD"], { encoding: "utf8" }).trim(),
      "2",
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
test("전용 owner repo만 운용하며 다른 staged 파일을 커밋하지 않는다", () => {
  const root = mkdtempSync(join(tmpdir(), "oms-owned-wiki-")),
    foreign = mkdtempSync(join(tmpdir(), "oms-foreign-wiki-"));
  try {
    execFileSync("git", ["-C", foreign, "init", "-q"]);
    assert.throws(
      () => new GitWiki(foreign, { maxEntries: 100, maxEntryBytes: 10000 }),
      /wiki_not_owned/,
    );
    const wiki = new GitWiki(root, { maxEntries: 100, maxEntryBytes: 10000 });
    writeFileSync(join(root, "unrelated.txt"), "synthetic staged file");
    execFileSync("git", ["-C", root, "add", "unrelated.txt"]);
    wiki.record({
      incidentId: "demo",
      episode: 1,
      revision: 1,
      failureClass: "worker-error",
      severity: "P2",
      outcome: "blocked",
    });
    assert.equal(
      execFileSync("git", ["-C", root, "diff", "--cached", "--name-only"], {
        encoding: "utf8",
      }).trim(),
      "unrelated.txt",
    );
    assert.ok(
      !execFileSync("git", ["-C", root, "show", "--format=", "--name-only", "HEAD"], {
        encoding: "utf8",
      }).includes("unrelated.txt"),
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
    rmSync(foreign, { recursive: true, force: true });
  }
});
