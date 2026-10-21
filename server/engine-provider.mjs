import { readBoundedJsonFile } from "./receipt-provider.mjs";

const object = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const text = (value) => typeof value === "string" && value.length > 0 && value.length <= 512;
const integer = (value) => Number.isSafeInteger(value) && value >= 0;
const positive = (value) => integer(value) && value > 0;
const digest = (value) => typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
const code = (value) => typeof value === "string" && /^[a-z][a-z0-9_]{0,127}$/.test(value);
const oneOf =
  (...values) =>
  (value) =>
    values.includes(value);
const list = (check) => (value) => Array.isArray(value) && value.every(check);
const isoTime = (value) =>
  typeof value === "string" &&
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(value) &&
  Number.isFinite(Date.parse(value));

function shape(value, required, optional = {}) {
  return (
    object(value) &&
    Object.entries(required).every(
      ([key, check]) => Object.hasOwn(value, key) && check(value[key]),
    ) &&
    Object.entries(value).every(([key, item]) => {
      const check = Object.hasOwn(required, key)
        ? required[key]
        : Object.hasOwn(optional, key)
          ? optional[key]
          : undefined;
      return check !== undefined && check(item);
    })
  );
}
const runbook = (value) => shape(value, { id: text, version: text, digest });
const incident = (value) =>
  shape(
    value,
    {
      id: digest,
      resourceKey: text,
      failureClass: text,
      episode: positive,
      revision: positive,
      severity: oneOf("P0", "P1", "P2", "unknown"),
      evidenceState: oneOf("complete", "partial", "missing", "failed", "stale"),
      status: oneOf("open", "resolved"),
      investigation: text,
      attempts: integer,
      periodAttempts: integer,
      dueAt: integer,
      recovery: oneOf("unverified", "verified"),
      knowledgeHits: integer,
    },
    { runbookRef: runbook, failureCode: code },
  );
const page = (value) =>
  shape(
    value,
    {
      key: digest,
      incidentId: digest,
      episode: positive,
      state: oneOf("pending", "acked"),
      revision: positive,
      recoveryUpdate: (item) => typeof item === "boolean",
    },
    { ackedBy: text },
  );
const effect = (value) =>
  shape(
    value,
    {
      id: digest,
      incidentId: digest,
      revision: positive,
      resourceKey: text,
      state: oneOf("executing", "outcome_unknown", "verified"),
      runbookRef: runbook,
      startedAt: integer,
    },
    { verifiedAt: integer, proofDigest: digest, reconcileDueAt: integer },
  );
const budgets = (value) =>
  object(value) &&
  Object.entries(value).every(
    ([period, counts]) =>
      /^(0|[1-9]\d*)$/.test(period) &&
      integer(Number(period)) &&
      shape(counts, { reserved: integer, spent: integer }),
  );

export function validateEngineProjection(value) {
  if (
    !shape(value, {
      kind: oneOf("local_engine"),
      scope: oneOf("local_demo"),
      investigator: oneOf("fixture", "openai_responses"),
      observedAt: isoTime,
      incidents: list(incident),
      pages: list(page),
      effects: list(effect),
      budgets,
      auditCount: integer,
    })
  )
    throw new Error("engine_unavailable");
  return value;
}

export async function readEngineFile(path, root) {
  try {
    return validateEngineProjection(await readBoundedJsonFile(path, root));
  } catch {
    throw new Error("engine_unavailable");
  }
}

export function createEngineMiddleware({ path, root, getPort }) {
  return async (req, res, next) => {
    if (req.url?.split("?")[0] !== "/api/engine") return next?.();
    const respond = (status, payload) => {
      res.statusCode = status;
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.setHeader("Cache-Control", "no-store");
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.end(JSON.stringify(payload));
    };
    const host = req.headers.host;
    const port = getPort();
    if (
      !positive(port) ||
      port > 65535 ||
      ![`127.0.0.1:${port}`, `localhost:${port}`].includes(host) ||
      (req.headers.origin !== undefined && req.headers.origin !== `http://${host}`) ||
      req.headers["sec-fetch-site"] === "cross-site"
    ) {
      return respond(403, { error: "local_origin_required" });
    }
    if (req.method !== "GET") return respond(405, { error: "get_required" });
    if (req.url !== "/api/engine") return respond(400, { error: "query_not_allowed" });
    try {
      respond(200, await readEngineFile(path, root));
    } catch {
      respond(503, { error: "engine_unavailable" });
    }
  };
}
