import type { IncomingMessage, ServerResponse } from "node:http";

type RunbookRef = { id: string; version: string; digest: string };
export type EngineIncident = {
  id: string;
  resourceKey: string;
  failureClass: string;
  episode: number;
  revision: number;
  severity: "P0" | "P1" | "P2" | "unknown";
  evidenceState: "complete" | "partial" | "missing" | "failed" | "stale";
  status: "open" | "resolved";
  investigation: string;
  attempts: number;
  periodAttempts: number;
  dueAt: number;
  recovery: "unverified" | "verified";
  knowledgeHits: number;
  runbookRef?: RunbookRef;
  failureCode?: string;
};
export type EngineProjection = {
  kind: "local_engine";
  scope: "local_demo";
  investigator: "fixture" | "openai_responses";
  observedAt: string;
  incidents: EngineIncident[];
  pages: {
    key: string;
    incidentId: string;
    episode: number;
    state: "pending" | "acked";
    revision: number;
    ackedBy?: string;
    recoveryUpdate: boolean;
  }[];
  effects: {
    id: string;
    incidentId: string;
    revision: number;
    resourceKey: string;
    state: "executing" | "outcome_unknown" | "verified";
    runbookRef: RunbookRef;
    startedAt: number;
    verifiedAt?: number;
    proofDigest?: string;
    reconcileDueAt?: number;
  }[];
  budgets: Record<string, { reserved: number; spent: number }>;
  auditCount: number;
};

export function validateEngineProjection(value: unknown): EngineProjection;
export function readEngineFile(path: string | undefined, root: string): Promise<EngineProjection>;
export function createEngineMiddleware(options: {
  path: string | undefined;
  root: string;
  getPort: () => number | undefined;
}): (req: IncomingMessage, res: ServerResponse, next?: () => void) => Promise<void>;
