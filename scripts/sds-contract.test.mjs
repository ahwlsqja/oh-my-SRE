import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";

const read = (path) => JSON.parse(readFileSync(path, "utf8"));
test("원본 OpenCode 파일과 글꼴의 출처·무수정 해시가 일치한다", () => {
  for (const file of read("docs/sds/upstream-manifest.json").files) {
    assert.equal(
      createHash("sha256").update(readFileSync(file.local)).digest("hex"),
      file.sha256,
      file.local,
    );
  }
});
test("미확인·예산 도달은 성공과 별도 의미를 유지하며 웹·TUI 명칭이 일치한다", () => {
  const spec = read("src/sds/tokens.json");
  const terminal = read("src/sds/generated/terminal-theme.json");
  assert.deepEqual(terminal.statuses, spec.statuses);
  assert.notEqual(spec.statuses.observation_gap.role, "success");
  assert.notEqual(spec.statuses.budget_paused.role, "success");
  assert.match(spec.priorities.P0.requires, /독립/);
  for (const scheme of ["light", "dark"]) {
    for (const color of Object.values(terminal[scheme])) assert.match(color, /^#[0-9a-f]{6}$/);
    assert.notEqual(terminal[scheme].text, terminal[scheme].canvas);
  }
  assert.notEqual(terminal.light.canvas, terminal.dark.canvas);
  assert.equal(terminal.renderer, "미구현");
});
