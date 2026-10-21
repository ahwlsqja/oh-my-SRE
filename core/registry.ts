import { readFileSync, realpathSync, readdirSync, lstatSync } from "node:fs";
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
  const paths: string[] = [];
  let bytes = 0;
  const walk = (relativePath: string) => {
    for (const name of readdirSync(join(directory, relativePath)).sort()) {
      const path = join(relativePath, name),
        info = lstatSync(join(directory, path));
      ensure(!info.isSymbolicLink(), "invalid_bundle");
      if (info.isDirectory()) walk(path);
      else {
        ensure(info.isFile(), "invalid_bundle");
        paths.push(path);
        bytes += info.size;
        ensure(paths.length <= 64 && bytes <= 1048576, "bundle_limit");
      }
    }
  };
  walk("");
  for (const path of paths.sort()) {
    hash.update(path + "\0");
    hash.update(readFileSync(join(directory, path)));
  }
  return hash.digest("hex");
}
function bundlePath(directory: string, value: unknown): string {
  ensure(
    typeof value === "string" &&
      !isAbsolute(value) &&
      value.split(/[\\/]/).every((part) => part !== ".." && part !== "." && part !== ""),
    "invalid_runbook_path",
  );
  const path = realpathSync(join(directory, value)),
    location = relative(directory, path);
  ensure(location && !location.startsWith("..") && !isAbsolute(location), "invalid_runbook_path");
  return path;
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
        typeof manifest.entrypoint === "string" &&
        manifest.entrypoint.endsWith(".mjs") &&
        typeof manifest.argsSchema === "string" &&
        manifest.argsSchema.endsWith(".json") &&
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
      JSON.parse(readFileSync(bundlePath(directory, manifest.argsSchema), "utf8")),
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
    const script = bundlePath(directory, manifest.entrypoint),
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
