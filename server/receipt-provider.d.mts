import type { IncomingMessage, ServerResponse } from "node:http";
import type { Snapshot } from "../src/providers/receipt";
export function readReceiptFile(
  path: string | undefined,
  root: string,
  now?: number,
): Promise<Snapshot>;
export function createReceiptMiddleware(options: {
  path: string | undefined;
  root: string;
  getPort: () => number | undefined;
  now?: () => number;
}): (req: IncomingMessage, res: ServerResponse, next?: () => void) => Promise<void>;
