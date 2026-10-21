import type { Severity } from "./policy.ts";
export interface Observation {
  providerId: string;
  eventId: string;
  sourceRevision: string;
  resourceKey: string;
  failureClass: string;
  sourceSeverity: string;
  observedAt: number;
  expiresAt: number;
  evidenceState: "complete" | "partial" | "missing" | "failed";
  semanticDigest: string;
}
export interface ToolCall {
  name: "runbook.execute";
  arguments: { id: string; version: string; digest: string; parameters: Record<string, unknown> };
}
export interface Investigation {
  basedOnRevision: number;
  outcome: "completed" | "failed";
  toolCalls: ToolCall[];
  usageUnits: number;
}
export interface RunContext {
  runId: string;
  incidentId: string;
  revision: number;
  resourceKey: string;
  failureClass: string;
  severity: Severity;
  observation: Observation;
  knowledge: {
    incidentId: string;
    failureClass: string;
    outcome: string;
    runbookRef?: { id: string; version: string; digest: string };
    evidenceRefs: string[];
  }[];
  tools: { name: string; description: string; inputSchema: Record<string, unknown> }[];
  deadlineAt: number;
}
export interface Investigator {
  kind: "fixture";
  investigate(context: RunContext, signal: AbortSignal): Promise<Investigation>;
}
export interface ProbeResult {
  resourceKey: string;
  observedAt: number;
  health: "healthy" | "degraded" | "unknown";
  lastOperation?: string;
}
export type Probe = (resourceKey: string) => Promise<ProbeResult>;
export interface Incident {
  id: string;
  resourceKey: string;
  failureClass: string;
  episode: number;
  revision: number;
  severity: Severity;
  evidenceState: string;
  semanticDigest: string;
  status: "open" | "resolved";
  investigation: string;
  attempts: number;
  attemptPeriod: number;
  periodAttempts: number;
  dueAt: number;
  evidenceExpiresAt: number;
  observation: Observation;
  activeRunId?: string;
  activeRunDeadlineAt?: number;
  lastRunRevision?: number;
  recovery: "unverified" | "verified";
  runbookRef?: { id: string; version: string; digest: string };
  knowledgeHits: number;
}
export interface Effect {
  id: string;
  incidentId: string;
  revision: number;
  resourceKey: string;
  state: "executing" | "outcome_unknown" | "verified";
  runbookRef: { id: string; version: string; digest: string };
  startedAt: number;
  verifiedAt?: number;
  proofDigest?: string;
}
export interface Page {
  key: string;
  incidentId: string;
  episode: number;
  state: "pending" | "acked";
  revision: number;
  ackedBy?: string;
  recoveryUpdate: boolean;
}
export interface EngineState {
  version: 1;
  incidents: Record<string, Incident>;
  seen: string[];
  effects: Record<string, Effect>;
  outbox: Record<string, Page>;
  budgets: Record<string, { reserved: number; spent: number }>;
  audit: { at: number; kind: string; incidentId?: string; detail: string }[];
}
export const emptyState = (): EngineState => ({
  version: 1,
  incidents: {},
  seen: [],
  effects: {},
  outbox: {},
  budgets: {},
  audit: [],
});
