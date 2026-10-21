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
  const snapshot = validateSnapshot(input, now);
  return {
    version: 1,
    capturedAt: snapshot.capturedAt,
    overall: "partial",
    receipts: snapshot.receipts.map((receipt) => {
      const expiry = Date.parse(receipt.observedAt) + receipt.ttlSeconds * 1000;
      return {
        ...receipt,
        status:
          now >= expiry
            ? "stale"
            : receipt.verdict === "verified" && receipt.coverage === "incomplete"
              ? "partial"
              : receipt.verdict,
        expiresAt: new Date(expiry).toISOString(),
      };
    }),
  };
}

function requireValid(condition: unknown): asserts condition {
  if (!condition) throw new Error("invalid_receipt");
}
function object(value: unknown, keys: readonly string[]): Record<string, unknown> {
  requireValid(value !== null && typeof value === "object" && !Array.isArray(value));
  requireValid(Object.keys(value).every((key) => keys.includes(key)));
  return value as Record<string, unknown>;
}
function timestamp(value: unknown): number {
  requireValid(
    typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value),
  );
  const parsed = Date.parse(value);
  requireValid(Number.isFinite(parsed) && new Date(parsed).toISOString() === value);
  return parsed;
}
export function validateSnapshot(input: unknown, now = Date.now()): Snapshot {
  const top = object(input, ["version", "capturedAt", "receipts"]);
  requireValid(top.version === 1);
  const captured = timestamp(top.capturedAt);
  requireValid(captured <= now);
  requireValid(
    Array.isArray(top.receipts) && top.receipts.length >= 1 && top.receipts.length <= 32,
  );
  for (const entry of top.receipts) {
    const row = object(entry, [
      "sourceKind",
      "claim",
      "verdict",
      "observedAt",
      "ttlSeconds",
      "scopeDigest",
      "evidenceDigest",
      "coverage",
      "limitations",
      "counters",
    ]);
    requireValid(
      sourceKinds.includes(row.sourceKind as Receipt["sourceKind"]) &&
        claims.includes(row.claim as Receipt["claim"]),
    );
    requireValid(["verified", "partial", "unknown", "failed"].includes(row.verdict as string));
    requireValid(timestamp(row.observedAt) <= captured);
    requireValid(
      Number.isInteger(row.ttlSeconds) &&
        (row.ttlSeconds as number) >= 1 &&
        (row.ttlSeconds as number) <= 86400,
    );
    for (const digest of [row.scopeDigest, row.evidenceDigest])
      requireValid(typeof digest === "string" && /^[a-f0-9]{64}$/.test(digest));
    requireValid(row.coverage === "scoped" || row.coverage === "incomplete");
    requireValid(
      Array.isArray(row.limitations) &&
        row.limitations.length <= limitations.length &&
        row.limitations.every((item) => limitations.includes(item)),
    );
    const counters = object(row.counters, counterKeys);
    requireValid(
      Object.values(counters).every(
        (value) => Number.isSafeInteger(value) && (value as number) >= 0,
      ),
    );
  }
  return structuredClone(input) as Snapshot;
}
