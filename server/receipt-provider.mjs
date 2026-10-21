import { open, realpath } from "node:fs/promises";
import { constants } from "node:fs";
import { isAbsolute, relative, sep } from "node:path";
import { validateSnapshot } from "../src/providers/receipt.ts";

export async function readReceiptFile(path, root, now = Date.now()) {
  let file;
  try {
    if (!path || !isAbsolute(path)) throw new Error();
    const [actualPath, actualRoot] = await Promise.all([realpath(path), realpath(root)]);
    const location = relative(actualRoot, actualPath);
    if (
      !location ||
      (!location.startsWith(`..${sep}`) && location !== ".." && !isAbsolute(location))
    )
      throw new Error();
    file = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
    const info = await file.stat();
    if (!info.isFile() || info.size > 131072) throw new Error();
    const buffer = Buffer.alloc(131073);
    const { bytesRead } = await file.read(buffer, 0, buffer.length, 0);
    if (bytesRead > 131072) throw new Error();
    return validateSnapshot(JSON.parse(buffer.subarray(0, bytesRead).toString("utf8")), now);
  } catch {
    throw new Error("receipt_unavailable");
  } finally {
    await file?.close();
  }
}

export function createReceiptMiddleware({ path, root, getPort, now = Date.now }) {
  return async (req, res, next) => {
    if (req.url?.split("?")[0] !== "/api/receipts") return next?.();
    const respond = (status, payload) => {
      res.statusCode = status;
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.setHeader("Cache-Control", "no-store");
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.end(JSON.stringify(payload));
    };
    const host = req.headers.host;
    const port = getPort();
    const allowed = [`127.0.0.1:${port}`, `localhost:${port}`];
    if (
      !allowed.includes(host) ||
      (req.headers.origin !== undefined && req.headers.origin !== `http://${host}`) ||
      req.headers["sec-fetch-site"] === "cross-site"
    )
      return respond(403, { error: "local_origin_required" });
    if (req.method !== "GET") return respond(405, { error: "get_required" });
    if (req.url !== "/api/receipts") return respond(400, { error: "query_not_allowed" });
    try {
      respond(200, await readReceiptFile(path, root, now()));
    } catch {
      respond(503, { error: "receipt_unavailable" });
    }
  };
}
