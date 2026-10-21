import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
test("예제 script는 고정 workerId 밖의 인자를 거부한다", () => {
  assert.throws(() =>
    execFileSync(
      process.execPath,
      [
        fileURLToPath(new URL("../scripts/recover.mjs", import.meta.url)),
        JSON.stringify({ workerId: "other" }),
      ],
      { stdio: "ignore" },
    ),
  );
});
