import {
  mkdirSync,
  existsSync,
  writeFileSync,
  readFileSync,
  readdirSync,
  statSync,
  openSync,
  fsyncSync,
  closeSync,
} from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { digest } from "../storage/journal.ts";
import { ensure } from "../core/policy.ts";
export interface Knowledge {
  incidentId: string;
  episode: number;
  revision: number;
  failureClass: string;
  severity: string;
  outcome: string;
  runbook?: { id: string; version: string; digest: string };
}
export class GitWiki {
  directory: string;
  limits: { maxEntries: number; maxEntryBytes: number };
  constructor(directory: string, limits: { maxEntries: number; maxEntryBytes: number }) {
    ensure(
      Number.isSafeInteger(limits.maxEntries) &&
        limits.maxEntries > 0 &&
        Number.isSafeInteger(limits.maxEntryBytes) &&
        limits.maxEntryBytes > 0,
      "invalid_wiki_limit",
    );
    this.directory = directory;
    this.limits = limits;
    mkdirSync(directory, { recursive: true, mode: 0o700 });
    if (!existsSync(join(directory, ".git")))
      this.git(["init", "-q", "--initial-branch=knowledge"]);
    for (const path of ["incidents", "drafts"])
      mkdirSync(join(directory, path), { recursive: true, mode: 0o700 });
  }
  git(args: string[]): string {
    return execFileSync(
      "git",
      [
        "-C",
        this.directory,
        "-c",
        "core.hooksPath=/dev/null",
        "-c",
        "commit.gpgsign=false",
        "-c",
        "user.name=oh-my-SRE local engine",
        "-c",
        "user.email=engine@example.invalid",
        ...args,
      ],
      { encoding: "utf8", maxBuffer: 1000000, stdio: ["ignore", "pipe", "pipe"] },
    );
  }
  write(area: "incidents" | "drafts", value: unknown): string {
    const id = digest(value),
      relative = `${area}/${id}.md`,
      path = join(this.directory, relative),
      content = `# 로컬 엔진 ${area === "incidents" ? "사건 학습" : "미승격 수정안"}\n\n\`\`\`json\n${JSON.stringify(value, null, 2)}\n\`\`\`\n`;
    ensure(Buffer.byteLength(content) <= this.limits.maxEntryBytes, "wiki_entry_limit");
    if (!existsSync(path)) {
      ensure(
        readdirSync(join(this.directory, area)).length < this.limits.maxEntries,
        "wiki_entry_limit",
      );
      writeFileSync(path, content, { mode: 0o600 });
      const fd = openSync(path, "r");
      try {
        fsyncSync(fd);
      } finally {
        closeSync(fd);
      }
    } else ensure(readFileSync(path, "utf8") === content, "wiki_conflict");
    this.git(["add", "--", relative]);
    if (this.git(["diff", "--cached", "--name-only"]).trim())
      this.git([
        "commit",
        "-q",
        "-m",
        area === "incidents"
          ? "독립 검증 결과를 다음 사건의 근거로 남긴다"
          : "런북 수정안을 실행 권한과 분리해 보존한다",
      ]);
    return relative;
  }
  record(value: Knowledge): string {
    return this.write("incidents", value);
  }
  draft(value: { id: string; proposal: string }): string {
    return this.write("drafts", value);
  }
  search(failureClass: string): Knowledge[] {
    const files = readdirSync(join(this.directory, "incidents")).filter((name) =>
      /^[a-f0-9]{64}\.md$/.test(name),
    );
    ensure(files.length <= this.limits.maxEntries, "wiki_entry_limit");
    const results: Knowledge[] = [];
    for (const name of files) {
      const path = join(this.directory, "incidents", name);
      ensure(statSync(path).size <= this.limits.maxEntryBytes, "wiki_entry_limit");
      const match = readFileSync(path, "utf8").match(/```json\n([\s\S]*?)\n```/);
      if (!match) throw new Error("corrupt_wiki");
      const record = JSON.parse(match[1]) as Knowledge;
      if (record.failureClass === failureClass) results.push(record);
    }
    return results.slice(-5);
  }
}
