import { harness } from "./core-harness.mjs";
const [workspace, stage] = process.argv.slice(2);
if (!workspace || !["after_intent", "after_execute", "model_pending"].includes(stage))
  throw new Error("invalid_crash_fixture");
const investigator =
  stage === "model_pending"
    ? {
        kind: "fixture",
        async investigate() {
          process.kill(process.pid, "SIGKILL");
          return new Promise(() => {});
        },
      }
    : undefined;
const h = await harness({
  workspace,
  investigator,
  fault: (at) => {
    if (at === stage) process.kill(process.pid, "SIGKILL");
  },
});
h.clock.value = 10000;
await h.engine.ingest(h.observation());
await h.close(false);
