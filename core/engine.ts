import { randomUUID } from "node:crypto";
import type { Journal } from "../storage/journal.ts";
import { digest } from "../storage/journal.ts";
import { validatePolicy, ensure, identifier, keys, type Policy } from "./policy.ts";
import type {
  EngineState,
  Observation,
  Incident,
  Investigator,
  Investigation,
} from "./contracts.ts";
import type { Broker } from "./broker.ts";
import type { GitWiki } from "../providers/wiki.ts";
import { deriveExports, callDerivedTool } from "./tool-exports.ts";
import type { RunContext } from "./contracts.ts";
export interface EngineOptions {
  store: Journal<EngineState>;
  policy: Policy;
  investigator: Investigator;
  wiki: GitWiki;
  broker: Broker;
  now?: () => number;
}
export class Engine {
  options: EngineOptions;
  policy: Policy;
  constructor(options: EngineOptions) {
    this.options = options;
    this.policy = validatePolicy(options.policy);
  }
  now() {
    return (this.options.now ?? Date.now)();
  }
  async ingest(input: unknown) {
    const x = keys(
      input,
      [
        "providerId",
        "eventId",
        "sourceRevision",
        "resourceKey",
        "failureClass",
        "sourceSeverity",
        "observedAt",
        "expiresAt",
        "evidenceState",
        "semanticDigest",
      ],
      "invalid_observation",
    );
    for (const key of [
      "providerId",
      "eventId",
      "sourceRevision",
      "resourceKey",
      "failureClass",
      "sourceSeverity",
    ])
      ensure(identifier(x[key]), "invalid_observation");
    ensure(this.policy.trustedProviders.includes(x.providerId as string), "untrusted_provider");
    ensure(
      Number.isSafeInteger(x.observedAt) &&
        Number.isSafeInteger(x.expiresAt) &&
        (x.observedAt as number) <= this.now() &&
        (x.expiresAt as number) > (x.observedAt as number),
      "invalid_observation",
    );
    ensure(
      ["complete", "partial", "missing", "failed"].includes(x.evidenceState as string) &&
        typeof x.semanticDigest === "string" &&
        /^[a-f0-9]{64}$/.test(x.semanticDigest),
      "invalid_observation",
    );
    const observation = input as Observation,
      { store } = this.options;
    const seen = digest([
      this.policy.installationId,
      observation.providerId,
      observation.eventId,
      observation.sourceRevision,
    ]);
    if (store.state.seen.includes(seen)) return { outcome: "duplicate" };
    const id = digest([
        this.policy.installationId,
        observation.resourceKey,
        observation.failureClass,
      ]),
      fresh = observation.expiresAt > this.now() && observation.evidenceState === "complete";
    store.transaction((s) => {
      s.seen.push(seen);
      let incident = s.incidents[id];
      const evidence = fresh
        ? "complete"
        : observation.expiresAt <= this.now()
          ? "stale"
          : observation.evidenceState;
      const severity = fresh
        ? (this.policy.severityMap[observation.sourceSeverity] ?? "unknown")
        : (incident?.severity ?? "unknown");
      const renewed = incident?.status === "resolved" && fresh;
      if (!incident || renewed) {
        incident = {
          id,
          resourceKey: observation.resourceKey,
          failureClass: observation.failureClass,
          episode: (incident?.episode ?? 0) + 1,
          revision: (incident?.revision ?? 0) + 1,
          severity,
          evidenceState: evidence,
          semanticDigest: observation.semanticDigest,
          status: "open",
          investigation: "queued",
          attempts: incident?.attempts ?? 0,
          attemptPeriod:
            incident?.attemptPeriod ??
            Math.floor(this.now() / this.policy.periodMs) * this.policy.periodMs,
          periodAttempts: incident?.periodAttempts ?? 0,
          dueAt: this.now(),
          evidenceExpiresAt: observation.expiresAt,
          observation: structuredClone(observation),
          recovery: "unverified",
          knowledgeHits: 0,
        };
        s.incidents[id] = incident;
      } else {
        const changed =
          incident.semanticDigest !== observation.semanticDigest ||
          incident.evidenceState !== evidence ||
          incident.severity !== severity;
        if (changed) {
          incident.revision++;
          incident.dueAt = this.now();
          incident.investigation = incident.activeRunId ? "running" : "queued";
        }
        incident.semanticDigest = observation.semanticDigest;
        incident.evidenceState = evidence;
        incident.severity = severity;
        incident.evidenceExpiresAt = observation.expiresAt;
        incident.observation = structuredClone(observation);
      }
      if (incident.severity === "P0" && incident.status === "open") {
        const key = digest([id, incident.episode, "page"]);
        if (!s.outbox[key])
          s.outbox[key] = {
            key,
            incidentId: id,
            episode: incident.episode,
            state: "pending",
            revision: incident.revision,
            recoveryUpdate: false,
          };
      }
      s.audit.push({ at: this.now(), kind: "observation", incidentId: id, detail: evidence });
    });
    await this.run(id);
    return { outcome: "accepted", incidentId: id };
  }
  async run(id: string): Promise<void> {
    const { store, wiki, investigator, broker } = this.options,
      now = this.now(),
      period = String(Math.floor(now / this.policy.periodMs) * this.policy.periodMs);
    let context: RunContext | undefined;
    const current = store.state.incidents[id];
    if (!current || current.status !== "open" || current.activeRunId || current.dueAt > now) return;
    const knowledge = wiki.search(current.failureClass).map((value) => ({
      incidentId: value.incidentId,
      failureClass: value.failureClass,
      outcome: value.outcome,
      runbookRef: value.runbook,
      evidenceRefs: value.evidenceRefs ?? [digest(value)],
    }));
    store.transaction((s) => {
      const incident = s.incidents[id];
      if (incident.activeRunId || incident.status !== "open" || incident.dueAt > now) return;
      if (incident.evidenceState !== "complete" || incident.evidenceExpiresAt <= now) {
        incident.evidenceState =
          incident.evidenceExpiresAt <= now ? "stale" : incident.evidenceState;
        incident.investigation = "waiting_observation";
        incident.dueAt = now + this.policy.persistenceMs;
        return;
      }
      if (
        Object.values(s.effects).some(
          (e) => e.resourceKey === incident.resourceKey && e.state !== "verified",
        )
      ) {
        incident.investigation = "effect_unknown";
        return;
      }
      if (incident.attemptPeriod !== Number(period)) {
        incident.attemptPeriod = Number(period);
        incident.periodAttempts = 0;
      }
      if (incident.periodAttempts >= this.policy.maxAttemptsPerIncidentPerPeriod) {
        incident.investigation = "attempt_paused";
        incident.dueAt = Number(period) + this.policy.periodMs;
        return;
      }
      const budget = s.budgets[period] ?? { reserved: 0, spent: 0 };
      s.budgets[period] = budget;
      if (budget.reserved + budget.spent >= this.policy.maxRunsPerPeriod) {
        incident.investigation = "budget_paused";
        incident.dueAt = Number(period) + this.policy.periodMs;
        return;
      }
      budget.reserved++;
      incident.attempts++;
      incident.periodAttempts++;
      incident.activeRunId = randomUUID();
      incident.activeRunDeadlineAt = now + this.policy.runDeadlineMs;
      incident.investigation = "running";
      incident.knowledgeHits = knowledge.length;
      incident.dueAt = now + this.policy.persistenceMs;
      context = {
        runId: incident.activeRunId,
        incidentId: id,
        revision: incident.revision,
        resourceKey: incident.resourceKey,
        failureClass: incident.failureClass,
        severity: incident.severity,
        observation: structuredClone(incident.observation),
        tools: deriveExports(broker.options.registry, this.policy).tools,
        knowledge,
        deadlineAt: now + this.policy.runDeadlineMs,
      };
      s.audit.push({
        at: now,
        kind: "investigation_reserved",
        incidentId: id,
        detail: investigator.kind,
      });
    });
    if (!context) return;
    const runContext = context,
      controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined, result: Investigation;
    try {
      const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          controller.abort();
          reject(new Error("investigation_timeout"));
        }, this.policy.runDeadlineMs);
      });
      result = await Promise.race([
        investigator.investigate(runContext, controller.signal),
        timeout,
      ]);
      const parsed = keys(
        result,
        ["basedOnRevision", "outcome", "toolCalls", "usageUnits"],
        "invalid_investigation",
      );
      ensure(
        Number.isSafeInteger(parsed.basedOnRevision) &&
          ["completed", "failed"].includes(parsed.outcome as string) &&
          parsed.usageUnits === 1 &&
          Array.isArray(parsed.toolCalls) &&
          parsed.toolCalls.length <= 1,
        "invalid_investigation",
      );
      store.transaction((s) => {
        s.budgets[period].reserved--;
        s.budgets[period].spent++;
      });
      if (
        result.basedOnRevision !== runContext.revision ||
        store.state.incidents[id].revision !== runContext.revision
      ) {
        store.transaction((s) => {
          s.incidents[id].investigation = "stale_result";
          s.incidents[id].dueAt = this.now();
        });
        return;
      }
      if (result.outcome !== "completed") throw new Error("investigation_failed");
      for (const call of result.toolCalls) {
        const effect = await callDerivedTool(
          broker,
          {
            incidentId: id,
            revision: runContext.revision,
            runId: runContext.runId,
          },
          call.name,
          call.arguments,
        );
        if (effect.state === "verified") this.finishVerified();
        else
          store.transaction((s) => {
            s.incidents[id].investigation = "effect_unknown";
          });
      }
      store.transaction((s) => {
        if (s.incidents[id].investigation === "running")
          s.incidents[id].investigation = "completed";
        s.incidents[id].lastRunRevision = runContext.revision;
      });
      this.syncKnowledge();
    } catch (error) {
      store.transaction((s) => {
        if (s.incidents[id].activeRunId === runContext.runId) {
          s.incidents[id].investigation = controller.signal.aborted ? "timed_out" : "blocked";
          s.audit.push({
            at: this.now(),
            kind: "investigation_stopped",
            incidentId: id,
            detail:
              error instanceof Error && /^[a-z_]+$/.test(error.message)
                ? error.message
                : "provider_failed",
          });
        }
      });
    } finally {
      if (timer) clearTimeout(timer);
      store.transaction((s) => {
        if (s.incidents[id].activeRunId === runContext.runId) delete s.incidents[id].activeRunId;
      });
    }
  }
  finishVerified() {
    this.options.store.transaction((s) => {
      for (const effect of Object.values(s.effects)) {
        const incident = s.incidents[effect.incidentId];
        if (effect.state !== "verified" || !incident || incident.revision !== effect.revision)
          continue;
        incident.status = "resolved";
        incident.recovery = "verified";
        incident.runbookRef = effect.runbookRef;
        for (const page of Object.values(s.outbox))
          if (page.incidentId === incident.id && page.episode === incident.episode)
            page.recoveryUpdate = true;
      }
    });
  }
  syncKnowledge() {
    for (const incident of Object.values(this.options.store.state.incidents)) {
      if (incident.status === "resolved")
        this.options.wiki.record({
          incidentId: incident.id,
          episode: incident.episode,
          revision: incident.revision,
          failureClass: incident.failureClass,
          severity: incident.severity,
          outcome: incident.recovery,
          runbook: incident.runbookRef,
          evidenceRefs: [
            digest(incident.observation),
            ...Object.values(this.options.store.state.effects)
              .filter(
                (effect) =>
                  effect.incidentId === incident.id &&
                  effect.revision === incident.revision &&
                  effect.proofDigest,
              )
              .map((effect) => effect.proofDigest!),
          ],
        });
    }
  }
  async tick() {
    for (const incident of Object.values(this.options.store.state.incidents))
      await this.run(incident.id);
  }
  ack(key: string, actor: string) {
    ensure(identifier(actor), "invalid_actor");
    this.options.store.transaction((s) => {
      ensure(s.outbox[key], "unknown_page");
      s.outbox[key].state = "acked";
      s.outbox[key].ackedBy = actor;
    });
  }
  async recover() {
    await this.options.broker.reconcile();
    this.finishVerified();
    this.options.store.transaction((s) => {
      for (const incident of Object.values(s.incidents))
        if (incident.activeRunId) {
          delete incident.activeRunId;
          incident.investigation =
            incident.status === "resolved"
              ? "completed"
              : Object.values(s.effects).some(
                    (effect) => effect.incidentId === incident.id && effect.state !== "verified",
                  )
                ? "effect_unknown"
                : "interrupted_usage_unknown";
          delete incident.activeRunDeadlineAt;
          incident.dueAt = this.now() + this.policy.persistenceMs;
        }
    });
    this.syncKnowledge();
  }
  projection() {
    const state = this.options.store.state;
    return {
      kind: "local_engine" as const,
      investigator: "fixture" as const,
      observedAt: new Date(this.now()).toISOString(),
      incidents: Object.values(state.incidents),
      pages: Object.values(state.outbox),
      effects: Object.values(state.effects),
      budgets: state.budgets,
      auditCount: state.audit.length,
    };
  }
}
