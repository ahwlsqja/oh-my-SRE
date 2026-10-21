import { createServer } from "node:http";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { ProbeResult } from "../core/contracts.ts";
export async function startDemoWorker(workspace: string) {
  mkdirSync(workspace, { recursive: true, mode: 0o700 });
  const path = join(workspace, "worker.json");
  try {
    readFileSync(path);
  } catch {
    writeFileSync(path, JSON.stringify({ health: "degraded", effects: 0 }), { mode: 0o600 });
  }
  const server = createServer((req, res) => {
    if (req.method !== "GET" || req.url !== "/probe") {
      res.writeHead(404);
      res.end();
      return;
    }
    res.setHeader("content-type", "application/json");
    res.setHeader("cache-control", "no-store");
    res.end(readFileSync(path));
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("demo_server_missing");
  return {
    url: `http://127.0.0.1:${address.port}/probe`,
    close: () =>
      new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      ),
    degrade() {
      const current = JSON.parse(readFileSync(path, "utf8"));
      writeFileSync(path, JSON.stringify({ ...current, health: "degraded" }), { mode: 0o600 });
    },
  };
}
export function demoHttpProbe(
  url: string,
  options: { timeoutMs: number; maxBytes: number; now?: () => number },
) {
  const parsed = new URL(url);
  if (
    parsed.protocol !== "http:" ||
    parsed.hostname !== "127.0.0.1" ||
    parsed.pathname !== "/probe" ||
    parsed.username ||
    parsed.password ||
    parsed.search
  )
    throw new Error("local_demo_probe_only");
  if (
    !Number.isSafeInteger(options.timeoutMs) ||
    options.timeoutMs <= 0 ||
    !Number.isSafeInteger(options.maxBytes) ||
    options.maxBytes <= 0
  )
    throw new Error("invalid_probe_limit");
  return async (resourceKey: string): Promise<ProbeResult> => {
    if (resourceKey !== "demo-worker") throw new Error("unknown_probe_target");
    const response = await fetch(url, {
      signal: AbortSignal.timeout(options.timeoutMs),
      redirect: "error",
      cache: "no-store",
    });
    if (response.status !== 200) throw new Error("probe_failed");
    const reader = response.body?.getReader();
    if (!reader) throw new Error("probe_failed");
    const chunks: Uint8Array[] = [];
    let total = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        total += value.byteLength;
        if (total > options.maxBytes) throw new Error("probe_limit");
        chunks.push(value);
      }
    } finally {
      await reader.cancel();
    }
    const value = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    if (
      !value ||
      !["healthy", "degraded"].includes(value.health) ||
      Object.keys(value).some((k) => !["health", "effects", "lastOperation"].includes(k)) ||
      (value.lastOperation !== undefined && !/^[a-f0-9]{64}$/.test(value.lastOperation))
    )
      throw new Error("invalid_probe");
    return {
      resourceKey,
      observedAt: (options.now ?? Date.now)(),
      health: value.health,
      lastOperation: value.lastOperation,
    };
  };
}
