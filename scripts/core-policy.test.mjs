import { test } from "node:test";
import assert from "node:assert/strict";
import { validatePolicy } from "../core/policy.ts";

export const policyFixture = () => ({
  version: 1,
  installationId: "demo-installation",
  revision: "demo-v1",
  trustedProviders: ["demo-probe"],
  severityMap: { critical: "P0", major: "P1", minor: "P2" },
  periodMs: 60000,
  maxRunsPerPeriod: 8,
  maxAttemptsPerIncidentPerPeriod: 3,
  persistenceMs: 1000,
  runDeadlineMs: 1000,
  allowedRunbooks: [
    {
      id: "recover-demo-worker",
      version: "1.0.0",
      digest: "a".repeat(64),
      effect: "demo.worker.recover",
      target: "demo-worker",
    },
  ],
});
test("명시한 신뢰 원천·예산·런북 허용만 받아들인다", () => {
  const input = policyFixture();
  assert.deepEqual(validatePolicy(input), input);
  for (const change of [
    (x) => (x.secret = "synthetic"),
    (x) => (x.maxRunsPerPeriod = 0),
    (x) => (x.runDeadlineMs = -1),
    (x) => (x.severityMap.critical = "healthy"),
    (x) => (x.allowedRunbooks[0].digest = "latest"),
    (x) => (x.trustedProviders = []),
  ]) {
    const bad = policyFixture();
    change(bad);
    assert.throws(() => validatePolicy(bad), /invalid_policy/);
  }
});
