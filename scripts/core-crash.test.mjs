import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { harness } from "./core-harness.mjs";
for (const stage of ["after_intent", "after_execute", "model_pending"])
  test(`강제종료 ${stage} 뒤에는 효과·사용량을 대조하고 재실행하지 않는다`, async () => {
    const workspace = mkdtempSync(join(tmpdir(), "oms-crash-"));
    let h;
    try {
      const result = await new Promise((resolve, reject) => {
        const child = spawn(
          process.execPath,
          [
            "--experimental-strip-types",
            fileURLToPath(new URL("./core-crash-child.mjs", import.meta.url)),
            workspace,
            stage,
          ],
          { stdio: "ignore" },
        );
        const timer = setTimeout(() => {
          child.kill("SIGKILL");
          reject(new Error("crash_fixture_timeout"));
        }, 10000);
        child.on("error", reject);
        child.on("exit", (code, signal) => {
          clearTimeout(timer);
          resolve({ code, signal });
        });
      });
      assert.equal(result.signal, "SIGKILL");
      h = await harness({ workspace, recoverStaleLock: true, policy: { maxRunsPerPeriod: 1 } });
      h.clock.value = 11001;
      await h.engine.recover();
      h.clock.value += 1001;
      await h.engine.tick();
      const state = h.store.state,
        effects = JSON.parse(readFileSync(join(workspace, "worker.json"), "utf8")).effects;
      assert.equal(effects, stage === "after_execute" ? 1 : 0);
      assert.equal(h.investigator.calls, 0);
      if (stage === "after_execute") {
        assert.equal(Object.values(state.effects)[0].state, "verified");
        assert.equal(Object.values(state.incidents)[0].status, "resolved");
        assert.equal(Object.values(state.incidents)[0].investigation, "completed");
        assert.equal(h.wiki.search("worker-error").length, 1);
      } else if (stage === "after_intent") {
        assert.equal(Object.values(state.effects)[0].state, "outcome_unknown");
        assert.equal(Object.values(state.incidents)[0].status, "open");
      } else {
        assert.equal(Object.keys(state.effects).length, 0);
        assert.equal(Object.values(state.budgets)[0].reserved, 1);
      }
    } finally {
      if (h) await h.close();
      else rmSync(workspace, { recursive: true, force: true });
    }
  });
