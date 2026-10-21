import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { openJournal, digest } from "../storage/journal.ts";
import { emptyState } from "../core/contracts.ts";
import { loadRegistry } from "../core/registry.ts";
import { validatePolicy } from "../core/policy.ts";
import { Broker } from "../core/broker.ts";
import { Engine } from "../core/engine.ts";
import { GitWiki } from "../providers/wiki.ts";
import { FixtureInvestigator } from "../providers/fixture-investigator.ts";
import { startDemoWorker, demoHttpProbe } from "../providers/demo-worker.ts";
export async function harness(options = {}) {
  const workspace = options.workspace ?? mkdtempSync(join(tmpdir(), "oms-core-")),
    worker = await startDemoWorker(workspace),
    registry = loadRegistry(fileURLToPath(new URL("../runbooks", import.meta.url))),
    book = registry.get("recover-demo-worker"),
    clock = { value: Date.now() },
    now = () => clock.value;
  const policy = validatePolicy({
    version: 1,
    installationId: "demo-installation",
    revision: "demo-v1",
    trustedProviders: ["demo-probe"],
    severityMap: { critical: "P0", major: "P1", minor: "P2" },
    periodMs: 60000,
    maxRunsPerPeriod: 8,
    maxAttemptsPerIncident: 5,
    persistenceMs: 1000,
    runDeadlineMs: 1000,
    allowedRunbooks: [
      {
        id: book.id,
        version: book.version,
        digest: book.digest,
        effect: book.effect,
        target: book.target,
      },
    ],
    ...options.policy,
  });
  const store = openJournal(join(workspace, "state"), emptyState(), {
      maxBytes: 16000000,
      recoverStaleLock: options.recoverStaleLock,
    }),
    probe = demoHttpProbe(worker.url, { timeoutMs: 1000, maxBytes: 4096, now }),
    wiki = new GitWiki(join(workspace, "wiki"), { maxEntries: 100, maxEntryBytes: 10000 }),
    investigator =
      options.investigator ??
      new FixtureInvestigator(
        options.action === false
          ? undefined
          : {
              name: "runbook.execute",
              arguments: {
                id: book.id,
                version: book.version,
                digest: book.digest,
                parameters: { workerId: "demo-worker" },
              },
            },
      ),
    broker = new Broker({ store, registry, policy, workspace, probe, now, fault: options.fault }),
    engine = new Engine({ store, policy, investigator, wiki, broker, now });
  const observation = (changes = {}) => ({
    providerId: "demo-probe",
    eventId: "event-1",
    sourceRevision: "revision-1",
    resourceKey: "demo-worker",
    failureClass: "worker-error",
    sourceSeverity: "major",
    observedAt: clock.value,
    expiresAt: clock.value + 300000,
    evidenceState: "complete",
    semanticDigest: digest("degraded"),
    ...changes,
  });
  return {
    workspace,
    worker,
    registry,
    book,
    clock,
    now,
    policy,
    store,
    probe,
    wiki,
    investigator,
    broker,
    engine,
    observation,
    async close(remove = true) {
      store.close();
      await worker.close();
      if (remove) rmSync(workspace, { recursive: true, force: true });
    },
  };
}
