import { readFileSync, writeFileSync, renameSync, openSync, fsyncSync, closeSync } from "node:fs";
import { join } from "node:path";
const args = JSON.parse(process.argv[2] ?? "null");
if (!args || Object.keys(args).length !== 1 || args.workerId !== "demo-worker")
  throw new Error("invalid_args");
const workspace = process.env.OMS_DEMO_WORKSPACE,
  operation = process.env.OMS_OPERATION_ID;
if (!workspace || !/^[a-f0-9]{64}$/.test(operation ?? ""))
  throw new Error("missing_operator_context");
const path = join(workspace, "worker.json"),
  current = JSON.parse(readFileSync(path, "utf8"));
if (current.lastOperation === operation) process.exit(0);
const temporary = join(workspace, "worker.next");
writeFileSync(
  temporary,
  JSON.stringify({
    health: "healthy",
    lastOperation: operation,
    effects: (current.effects ?? 0) + 1,
  }),
  { mode: 0o600 },
);
const fd = openSync(temporary, "r");
try {
  fsyncSync(fd);
} finally {
  closeSync(fd);
}
renameSync(temporary, path);
const directory = openSync(workspace, "r");
try {
  fsyncSync(directory);
} finally {
  closeSync(directory);
}
