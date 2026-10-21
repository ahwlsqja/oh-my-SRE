export const sourceKinds = [
  "deployment_readback",
  "collector_readback",
  "clickhouse_scoped_aggregate",
  "product_overview_http",
  "sre_operations_overview_http",
] as const;
export const claims = [
  "deployment_binding",
  "collector_acceptance",
  "raw_overview_cohort",
  "flink_fact_cohort",
  "product_overview_response",
  "sre_operations_projection",
] as const;
export const limitations = [
  "service_health_unverified",
  "recovery_unverified",
  "cohort_incomplete",
  "physical_row_semantics",
  "flink_unverified",
  "product_response_unverified",
  "authentication_required",
  "history_unavailable",
  "unique_observations_unverified",
  "scope_only",
] as const;
export const counterKeys = [
  "checksPassed",
  "accepted",
  "ok",
  "empty",
  "partial",
  "unknown",
  "rows",
  "events",
  "sessions",
  "pageviews",
  "fragments",
  "starts",
  "httpStatus",
] as const;
type Status = "verified" | "partial" | "unknown" | "failed" | "stale";
export type Receipt = {
  sourceKind: (typeof sourceKinds)[number];
  claim: (typeof claims)[number];
  verdict: Exclude<Status, "stale">;
  observedAt: string;
  ttlSeconds: number;
  scopeDigest: string;
  evidenceDigest: string;
  coverage: "scoped" | "incomplete";
  limitations: (typeof limitations)[number][];
  counters: Partial<Record<(typeof counterKeys)[number], number>>;
};
export type Snapshot = { version: 1; capturedAt: string; receipts: Receipt[] };
export type SnapshotView = Omit<Snapshot, "receipts"> & {
  overall: "partial";
  receipts: (Receipt & { status: Status; expiresAt: string })[];
};

export function projectSnapshot(input: unknown, now = Date.now()): SnapshotView {
  const snapshot = input as Snapshot;
  return {
    version: 1,
    capturedAt: snapshot.capturedAt,
    overall: "partial",
    receipts: snapshot.receipts.map((receipt) => {
      const expiry = Date.parse(receipt.observedAt) + receipt.ttlSeconds * 1000;
      return {
        ...receipt,
        status: now >= expiry ? "stale" : receipt.verdict,
        expiresAt: new Date(expiry).toISOString(),
      };
    }),
  };
}
