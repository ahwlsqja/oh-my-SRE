import { readFileSync, realpathSync } from "node:fs";
import { join, relative, isAbsolute } from "node:path";
import { createHash } from "node:crypto";
import { ensure, identifier, keys } from "./policy.ts";
export interface Runbook {
  id: string;
  version: string;
  digest: string;
  effect: string;
  target: string;
  timeoutMs: number;
  verification: string;
  script: string;
  schema: { properties: Record<string, { type: "string"; const: string }>; required: string[] };
}
export function bundleDigest(directory: string): string {
  const hash = createHash("sha256");
  for (const path of ["manifest.json", "args.schema.json", "scripts/recover.mjs"]) {
    hash.update(path + "\0");
    hash.update(readFileSync(join(directory, path)));
  }
  return hash.digest("hex");
}
export function loadRegistry(root: string) {
  const registry = keys(
    JSON.parse(readFileSync(join(root, "registry.json"), "utf8")),
    ["schemaVersion", "entries"],
    "invalid_registry",
  );
  ensure(registry.schemaVersion === 1 && Array.isArray(registry.entries), "invalid_registry");
  const books = new Map<string, Runbook>();
  for (const item of registry.entries) {
    const entry = keys(item, ["id", "version", "digest"], "invalid_registry");
    ensure(
      identifier(entry.id) && typeof entry.version === "string" && typeof entry.digest === "string",
      "invalid_registry",
    );
    const directory = realpathSync(join(root, entry.id));
    ensure(!relative(realpathSync(root), directory).startsWith(".."), "invalid_registry");
    const manifest = keys(
      JSON.parse(readFileSync(join(directory, "manifest.json"), "utf8")),
      [
        "schemaVersion",
        "id",
        "version",
        "entrypoint",
        "argsSchema",
        "effect",
        "target",
        "timeoutMs",
        "verification",
      ],
      "invalid_runbook",
    );
    ensure(
      manifest.schemaVersion === 1 &&
        manifest.id === entry.id &&
        manifest.version === entry.version &&
        manifest.entrypoint === "scripts/recover.mjs" &&
        manifest.argsSchema === "args.schema.json" &&
        identifier(manifest.effect) &&
        identifier(manifest.target) &&
        identifier(manifest.verification) &&
        Number.isSafeInteger(manifest.timeoutMs) &&
        (manifest.timeoutMs as number) > 0,
      "invalid_runbook",
    );
    const digest = bundleDigest(directory);
    ensure(digest === entry.digest, "runbook_digest_mismatch");
    const schema = keys(
      JSON.parse(readFileSync(join(directory, "args.schema.json"), "utf8")),
      ["$schema", "type", "required", "additionalProperties", "properties"],
      "invalid_args_schema",
    );
    ensure(
      schema.type === "object" &&
        schema.additionalProperties === false &&
        Array.isArray(schema.required),
      "invalid_args_schema",
    );
    const properties = keys(
      schema.properties,
      Object.keys((schema.properties ?? {}) as object),
      "invalid_args_schema",
    );
    for (const [name, value] of Object.entries(properties)) {
      ensure(/^[a-zA-Z][a-zA-Z0-9]*$/.test(name), "invalid_args_schema");
      const field = keys(value, ["type", "const"], "invalid_args_schema");
      ensure(field.type === "string" && typeof field.const === "string", "invalid_args_schema");
    }
    ensure(
      schema.required.length === Object.keys(properties).length &&
        schema.required.every(
          (k: unknown) => typeof k === "string" && Object.hasOwn(properties, k),
        ),
      "invalid_args_schema",
    );
    const script = realpathSync(join(directory, manifest.entrypoint as string)),
      location = relative(directory, script);
    ensure(!location.startsWith("..") && !isAbsolute(location), "invalid_runbook");
    ensure(!books.has(entry.id), "invalid_registry");
    books.set(entry.id, { ...manifest, digest, script, schema } as unknown as Runbook);
  }
  return {
    get(id: string) {
      const book = books.get(id);
      ensure(book, "unregistered_runbook");
      ensure(bundleDigest(join(root, id)) === book.digest, "runbook_digest_mismatch");
      return structuredClone(book);
    },
    list() {
      return [...books.values()].map((book) => structuredClone(book));
    },
    validateArgs(book: Runbook, input: unknown) {
      const args = keys(input, Object.keys(book.schema.properties), "invalid_args");
      ensure(
        book.schema.required.every((key) => Object.hasOwn(args, key)),
        "invalid_args",
      );
      for (const [name, spec] of Object.entries(book.schema.properties))
        ensure(typeof args[name] === "string" && args[name] === spec.const, "invalid_args");
      return args as Record<string, string>;
    },
  };
}
export type Registry = ReturnType<typeof loadRegistry>;
