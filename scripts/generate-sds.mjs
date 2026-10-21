import { readFileSync, mkdirSync, writeFileSync } from "node:fs";

const root = "src/sds/";
const spec = JSON.parse(readFileSync(root + "tokens.json", "utf8"));
const stripComments = (text) => text.replace(/\/\*[\s\S]*?\*\//g, "");
function block(text, selector) {
  const start = text.indexOf(selector);
  if (start < 0) throw new Error(`upstream 선택자 없음: ${selector}`);
  let cursor = text.indexOf("{", start) + 1;
  const begin = cursor;
  let depth = 1;
  for (; cursor < text.length && depth; cursor++) {
    if (text[cursor] === "{") depth++;
    if (text[cursor] === "}") depth--;
  }
  return text.slice(begin, cursor - 1);
}
const declarations = (text) =>
  Object.fromEntries(
    [...text.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)].map((match) => [match[1], match[2].trim()]),
  );
const colors = stripComments(readFileSync(root + "upstream/styles/tokens/colors.css", "utf8"));
const themes = stripComments(readFileSync(root + "upstream/styles/tokens/theme.css", "utf8"));
const light = { ...declarations(block(colors, ":root")), ...declarations(block(themes, ":root")) };
const dark = { ...light, ...declarations(block(themes, '[data-color-scheme="dark"]')) };
function resolve(token, palette, seen = new Set()) {
  if (seen.has(token) || !palette[token]) throw new Error(`토큰 해석 실패: ${token}`);
  seen.add(token);
  const value = palette[token];
  const alias = value.match(/^var\((--[\w-]+)\)$/);
  return alias ? resolve(alias[1], palette, seen) : value;
}
function opaque(value, canvas) {
  if (!/^#[0-9a-f]{6}([0-9a-f]{2})?$/i.test(value))
    throw new Error(`터미널 색 형식 미지원: ${value}`);
  const alpha = value.length === 9 ? parseInt(value.slice(7, 9), 16) / 255 : 1;
  const channels = [1, 3, 5].map((index) =>
    Math.round(
      parseInt(value.slice(index, index + 2), 16) * alpha +
        parseInt(canvas.slice(index, index + 2), 16) * (1 - alpha),
    ),
  );
  return "#" + channels.map((channel) => channel.toString(16).padStart(2, "0")).join("");
}
const terminal = {
  source: spec.source,
  statuses: spec.statuses,
  priorities: spec.priorities,
  light: {},
  dark: {},
  renderer: spec.terminal.renderer,
};
for (const [scheme, palette] of Object.entries({ light, dark })) {
  const canvas = resolve(spec.roles.canvas, palette);
  terminal[scheme] = Object.fromEntries(
    Object.entries(spec.roles).map(([role, token]) => [
      role,
      opaque(resolve(token, palette), canvas),
    ]),
  );
}
const css =
  "/* tokens.json에서 생성. 직접 수정하지 않는다. */\n:root {\n" +
  Object.entries(spec.roles)
    .map(([role, token]) => `  --sds-${role}: var(${token});`)
    .join("\n") +
  "\n}\n";
const outputs = {
  "tokens.css": css,
  "terminal-theme.json": JSON.stringify(terminal, null, 2) + "\n",
};
mkdirSync(root + "generated", { recursive: true });
for (const [name, content] of Object.entries(outputs)) {
  const file = root + "generated/" + name;
  if (process.argv.includes("--check")) {
    if (readFileSync(file, "utf8") !== content) throw new Error(`생성 파일 드리프트: ${file}`);
  } else writeFileSync(file, content);
}
console.log(
  process.argv.includes("--check") ? "SDS 웹·터미널 파생 일치" : "SDS 웹·터미널 토큰 생성",
);
