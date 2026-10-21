import {
  mkdirSync,
  openSync,
  closeSync,
  readFileSync,
  writeFileSync,
  fsyncSync,
  unlinkSync,
  existsSync,
  statSync,
} from "node:fs";
import { join } from "node:path";
import { createHash, randomUUID } from "node:crypto";

export const digest = (value: unknown): string =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");
export interface Journal<T> {
  readonly state: T;
  transaction(change: (state: T) => void): T;
  close(): void;
}
export function openJournal<T>(
  directory: string,
  initial: T,
  options: { maxBytes: number; recoverStaleLock?: boolean },
): Journal<T> {
  if (!Number.isSafeInteger(options.maxBytes) || options.maxBytes <= 0)
    throw new Error("invalid_journal_limit");
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  const lock = join(directory, "owner.lock"),
    path = join(directory, "journal.jsonl"),
    token = randomUUID();
  if (existsSync(lock)) {
    if (!options.recoverStaleLock) throw new Error("owner_locked");
    const owner = JSON.parse(readFileSync(lock, "utf8"));
    if (!Number.isSafeInteger(owner.pid) || owner.pid <= 0) throw new Error("owner_locked");
    try {
      process.kill(owner.pid, 0);
      throw new Error("owner_locked");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ESRCH") throw new Error("owner_locked");
    }
    // 죽은 owner의 잠금 회수는 설치 운영자의 명시적 복구 경로다.
    unlinkSync(lock);
  }
  let lockFd: number;
  try {
    lockFd = openSync(lock, "wx", 0o600);
  } catch {
    throw new Error("owner_locked");
  }
  writeFileSync(lockFd, JSON.stringify({ pid: process.pid, token }));
  fsyncSync(lockFd);
  closeSync(lockFd);
  let state = structuredClone(initial),
    seq = 0,
    previous = "0".repeat(64),
    closed = false,
    poisoned = false;
  let fd: number | undefined;
  const unlock = () => {
    try {
      if (JSON.parse(readFileSync(lock, "utf8")).token === token) unlinkSync(lock);
    } catch {
      /* 소유자가 달라졌다면 제거하지 않는다. */
    }
  };
  try {
    if (existsSync(path)) {
      if (statSync(path).size > options.maxBytes) throw new Error("journal_limit");
      const text = readFileSync(path, "utf8");
      if (text && !text.endsWith("\n")) throw new Error("corrupt_journal");
      for (const line of text.split("\n").filter(Boolean)) {
        let row;
        try {
          row = JSON.parse(line);
        } catch {
          throw new Error("corrupt_journal");
        }
        const payload = { seq: row.seq, previous: row.previous, state: row.state };
        if (row.seq !== seq + 1 || row.previous !== previous || digest(payload) !== row.digest)
          throw new Error("corrupt_journal");
        state = row.state;
        seq = row.seq;
        previous = row.digest;
      }
    }
    fd = openSync(path, "a", 0o600);
    const dirFd = openSync(directory, "r");
    try {
      fsyncSync(dirFd);
    } finally {
      closeSync(dirFd);
    }
  } catch (error) {
    if (fd !== undefined) closeSync(fd);
    unlock();
    throw error;
  }
  const journalFd = fd;
  return {
    get state() {
      return structuredClone(state);
    },
    transaction(change) {
      if (closed || poisoned) throw new Error("journal_unavailable");
      const next = structuredClone(state);
      change(next);
      const payload = { seq: seq + 1, previous, state: next },
        hash = digest(payload),
        line = JSON.stringify({ ...payload, digest: hash }) + "\n";
      if (statSync(path).size + Buffer.byteLength(line) > options.maxBytes)
        throw new Error("journal_limit");
      try {
        writeFileSync(journalFd, line);
        fsyncSync(journalFd);
      } catch {
        poisoned = true;
        throw new Error("journal_write_unknown");
      }
      state = next;
      seq++;
      previous = hash;
      return structuredClone(state);
    },
    close() {
      if (!closed) {
        closed = true;
        closeSync(journalFd);
        unlock();
      }
    },
  };
}
