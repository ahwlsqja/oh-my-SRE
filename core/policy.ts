export type Severity = "P0" | "P1" | "P2" | "unknown";
export interface RunbookAllowance {
  id: string;
  version: string;
  digest: string;
  effect: string;
  target: string;
}
export interface Policy {
  version: 1;
  installationId: string;
  revision: string;
  trustedProviders: string[];
  severityMap: Record<string, Exclude<Severity, "unknown">>;
  periodMs: number;
  maxRunsPerPeriod: number;
  maxAttemptsPerIncident: number;
  persistenceMs: number;
  runDeadlineMs: number;
  allowedRunbooks: RunbookAllowance[];
}
export function ensure(value: unknown, reason = "invalid_policy"): asserts value {
  if (!value) throw new Error(reason);
}
export function keys(
  value: unknown,
  allowed: string[],
  reason = "invalid_policy",
): Record<string, unknown> {
  ensure(value && typeof value === "object" && !Array.isArray(value), reason);
  ensure(
    Object.keys(value).every((key) => allowed.includes(key)),
    reason,
  );
  return value as Record<string, unknown>;
}
export const identifier = (value: unknown): value is string =>
  typeof value === "string" && /^[a-z][a-z0-9.-]{0,79}$/.test(value);
export function validatePolicy(input: unknown): Policy {
  const x = keys(input, [
    "version",
    "installationId",
    "revision",
    "trustedProviders",
    "severityMap",
    "periodMs",
    "maxRunsPerPeriod",
    "maxAttemptsPerIncident",
    "persistenceMs",
    "runDeadlineMs",
    "allowedRunbooks",
  ]);
  ensure(x.version === 1 && identifier(x.installationId) && identifier(x.revision));
  ensure(
    Array.isArray(x.trustedProviders) &&
      x.trustedProviders.length > 0 &&
      x.trustedProviders.every(identifier),
  );
  const map = keys(x.severityMap, Object.keys((x.severityMap ?? {}) as object));
  ensure(
    Object.keys(map).length > 0 &&
      Object.keys(map).every(identifier) &&
      Object.values(map).every((v) => ["P0", "P1", "P2"].includes(v as string)),
  );
  for (const key of [
    "periodMs",
    "maxRunsPerPeriod",
    "maxAttemptsPerIncident",
    "persistenceMs",
    "runDeadlineMs",
  ])
    ensure(Number.isSafeInteger(x[key]) && (x[key] as number) > 0);
  ensure(Array.isArray(x.allowedRunbooks));
  for (const entry of x.allowedRunbooks) {
    const a = keys(entry, ["id", "version", "digest", "effect", "target"]);
    ensure(
      identifier(a.id) &&
        identifier(a.effect) &&
        identifier(a.target) &&
        typeof a.version === "string" &&
        /^\d+\.\d+\.\d+$/.test(a.version) &&
        typeof a.digest === "string" &&
        /^[a-f0-9]{64}$/.test(a.digest),
    );
  }
  return structuredClone(input) as Policy;
}
