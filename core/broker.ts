import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { Journal } from "../storage/journal.ts";
import { digest } from "../storage/journal.ts";
import type { EngineState, Probe, ToolCall, Effect } from "./contracts.ts";
import type { Policy } from "./policy.ts";
import { ensure, keys } from "./policy.ts";
import type { Registry } from "./registry.ts";
const run = promisify(execFile);
export interface BrokerOptions {
  store: Journal<EngineState>;
  registry: Registry;
  policy: Policy;
  workspace: string;
  probe: Probe;
  now?: () => number;
  fault?: (stage: "after_intent" | "after_execute") => void;
}
export class Broker {
  options: BrokerOptions;
  constructor(options: BrokerOptions) {
    this.options = options;
  }
  async execute(request: {
    incidentId: string;
    revision: number;
    runId: string;
    call: ToolCall;
  }): Promise<Effect> {
    const { store, registry, policy, workspace, probe } = this.options,
      now = this.options.now ?? Date.now;
    ensure(request.call?.name === "runbook.execute", "unknown_tool");
    keys(request.call, ["name", "arguments"], "invalid_tool_call");
    keys(request.call.arguments, ["id", "version", "digest", "parameters"], "invalid_tool_call");
    const args = request.call.arguments,
      book = registry.get(args.id);
    registry.validateArgs(book, args.parameters);
    ensure(book.version === args.version && book.digest === args.digest, "runbook_digest_mismatch");
    ensure(
      policy.allowedRunbooks.some(
        (a) =>
          a.id === book.id &&
          a.version === book.version &&
          a.digest === book.digest &&
          a.effect === book.effect &&
          a.target === book.target,
      ),
      "action_not_allowed",
    );
    const incident = store.state.incidents[request.incidentId];
    ensure(
      incident &&
        typeof incident.activeRunDeadlineAt === "number" &&
        incident.activeRunDeadlineAt > now(),
      "action_deadline",
    );
    ensure(
      incident &&
        incident.revision === request.revision &&
        incident.activeRunId === request.runId &&
        incident.resourceKey === book.target,
      "stale_action_context",
    );
    const id = digest({
      incident: incident.id,
      revision: incident.revision,
      runbook: args.id,
      version: args.version,
      digest: args.digest,
      parameters: args.parameters,
    });
    const prior = store.state.effects[id];
    if (prior) return prior;
    ensure(
      !Object.values(store.state.effects).some(
        (e) => e.resourceKey === incident.resourceKey && e.state !== "verified",
      ),
      "effect_pending",
    );
    const before = await probe(incident.resourceKey);
    ensure(
      before.resourceKey === incident.resourceKey &&
        before.health === "degraded" &&
        before.observedAt <= now() &&
        before.observedAt >= now() - book.timeoutMs,
      "precondition_unverified",
    );
    // await 이후 사건 revision·권한을 다시 대조한다.
    ensure(
      store.state.incidents[incident.id].revision === incident.revision &&
        store.state.incidents[incident.id].activeRunId === request.runId,
      "stale_action_context",
    );
    registry.get(book.id);
    ensure(store.state.incidents[incident.id].activeRunDeadlineAt! > now(), "action_deadline");
    const effect: Effect = {
      id,
      incidentId: incident.id,
      revision: incident.revision,
      resourceKey: incident.resourceKey,
      state: "executing",
      runbookRef: { id: book.id, version: book.version, digest: book.digest },
      startedAt: now(),
    };
    let reserved = false;
    store.transaction((s) => {
      if (s.effects[id]) return;
      ensure(
        s.incidents[incident.id].revision === incident.revision &&
          s.incidents[incident.id].activeRunId === request.runId,
        "stale_action_context",
      );
      ensure(
        !Object.values(s.effects).some(
          (e) => e.resourceKey === incident.resourceKey && e.state !== "verified",
        ),
        "effect_pending",
      );
      s.effects[id] = effect;
      s.audit.push({
        at: now(),
        kind: "action_intent",
        incidentId: incident.id,
        detail: policy.revision,
      });
      reserved = true;
    });
    if (!reserved) return store.state.effects[id];
    this.options.fault?.("after_intent");
    try {
      await run(process.execPath, [book.script, JSON.stringify(args.parameters)], {
        cwd: workspace,
        env: { OMS_DEMO_WORKSPACE: workspace, OMS_OPERATION_ID: id },
        timeout: Math.min(book.timeoutMs, Math.max(1, incident.activeRunDeadlineAt! - now())),
        maxBuffer: 16384,
      });
    } catch {
      store.transaction((s) => {
        s.effects[id].state = "outcome_unknown";
      });
      return store.state.effects[id];
    }
    this.options.fault?.("after_execute");
    await this.reconcile(id);
    return store.state.effects[id];
  }
  async reconcile(id?: string): Promise<void> {
    const { store, probe } = this.options,
      now = this.options.now ?? Date.now;
    for (const effect of Object.values(store.state.effects).filter(
      (e) => (!id || e.id === id) && e.state !== "verified",
    )) {
      let verified = false;
      try {
        const p = await probe(effect.resourceKey);
        verified =
          p.resourceKey === effect.resourceKey &&
          p.health === "healthy" &&
          p.lastOperation === effect.id &&
          p.observedAt >= effect.startedAt &&
          p.observedAt <= now();
      } catch {
        /* 관측 실패는 결과 불명 상태로 보존한다. */
      }
      store.transaction((s) => {
        s.effects[effect.id].state = verified ? "verified" : "outcome_unknown";
        if (verified) s.effects[effect.id].verifiedAt = now();
        s.audit.push({
          at: now(),
          kind: verified ? "recovery_verified" : "effect_unknown",
          incidentId: effect.incidentId,
          detail: effect.id,
        });
      });
    }
  }
}
