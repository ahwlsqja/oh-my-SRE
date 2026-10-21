import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, appendFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openJournal } from "../storage/journal.ts";
test("단일 owner가 flush한 상태만 재생하고 손상 tail을 거부한다", () => {
  const dir = mkdtempSync(join(tmpdir(), "oms-journal-test-"));
  try {
    const j = openJournal(dir, { count: 0 }, { maxBytes: 100000 });
    assert.throws(() => openJournal(dir, { count: 0 }, { maxBytes: 100000 }), /owner_locked/);
    j.transaction((s) => {
      s.count++;
    });
    assert.equal(j.state.count, 1);
    j.close();
    const replay = openJournal(dir, { count: 0 }, { maxBytes: 100000 });
    assert.equal(replay.state.count, 1);
    replay.close();
    appendFileSync(join(dir, "journal.jsonl"), '{"incomplete":');
    assert.throws(() => openJournal(dir, { count: 0 }, { maxBytes: 100000 }), /corrupt_journal/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
