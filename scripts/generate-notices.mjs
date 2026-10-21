import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const licenses = JSON.parse(
  execFileSync("pnpm", ["licenses", "list", "--prod", "--json"], { encoding: "utf8" }),
);
const groups = new Map();
// 배포 패키지에서 누락된 원문은 공식 upstream의 LICENSE blob 7c08c3990396ecefd90f99ff5d9a34f26f5b5616에서 보존했다.
const upstreamFiles = {
  "react-remove-scroll-bar": "scripts/licenses/react-remove-scroll-bar-LICENSE.txt",
};
for (const entries of Object.values(licenses)) {
  for (const entry of entries) {
    const directory = entry.paths[0];
    const files = readdirSync(directory)
      .filter((name) => /^(licen[cs]e|copying|notice)(\.|$)/i.test(name))
      .sort();
    if (files.length === 0 && !upstreamFiles[entry.name])
      throw new Error(`원본 라이선스 파일 없음: ${entry.name}`);
    const text = files.length
      ? files
          .map((name) =>
            readFileSync(path.join(directory, name), "utf8").replaceAll("\r\n", "\n").trim(),
          )
          .join("\n\n")
      : readFileSync(upstreamFiles[entry.name], "utf8").trim();
    const names = groups.get(text) ?? [];
    names.push(`${entry.name} ${entry.versions.join(", ")} (${entry.license})`);
    groups.set(text, names);
  }
}
let output =
  "oh-my-SRE 타사 런타임 고지\n\npnpm licenses:generate로 설치 의존성의 원본 고지를 모았습니다.\n영문 라이선스·저작권은 원문 그대로 유지합니다.\n";
for (const [text, names] of [...groups].sort((left, right) =>
  left[1][0].localeCompare(right[1][0]),
)) {
  output += `\n${"=".repeat(72)}\n${names.sort().join("\n")}\n${"=".repeat(72)}\n\n${text}\n`;
}
mkdirSync("public", { recursive: true });
output +=
  "\nOpenCode 디자인 파일 (MIT)\n\n" + readFileSync("public/licenses/OpenCode-MIT.txt", "utf8");
output += "\nInter 글꼴 (SIL OFL 1.1)\n\n" + readFileSync("public/fonts/OFL-Inter.txt", "utf8");
writeFileSync("public/THIRD_PARTY_NOTICES.txt", output);
console.log(`런타임 고지 ${Object.values(licenses).flat().length}개를 보존했습니다.`);
