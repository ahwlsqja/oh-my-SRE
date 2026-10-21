import type { Registry } from "./registry.ts";
import type { Policy } from "./policy.ts";
import type { Broker } from "./broker.ts";
export async function callDerivedTool(
  broker: Broker,
  context: { incidentId: string; revision: number; runId: string },
  name: string,
  args: unknown,
) {
  if (name !== "runbook.execute") throw new Error("unknown_tool");
  return broker.execute({
    ...context,
    call: { name, arguments: args as Parameters<Broker["execute"]>[0]["call"]["arguments"] },
  });
}
export function deriveExports(registry: Registry, policy?: Policy) {
  const books = registry
    .list()
    .filter(
      (book) =>
        !policy ||
        policy.allowedRunbooks.some(
          (a) =>
            a.id === book.id &&
            a.version === book.version &&
            a.digest === book.digest &&
            a.effect === book.effect &&
            a.target === book.target,
        ),
    );
  const variants = books.map((book) => ({
    type: "object",
    additionalProperties: false,
    required: ["id", "version", "digest", "parameters"],
    properties: {
      id: { type: "string", const: book.id },
      version: { type: "string", const: book.version },
      digest: { type: "string", const: book.digest },
      parameters: {
        type: "object",
        additionalProperties: false,
        required: book.schema.required,
        properties: book.schema.properties,
      },
    },
  }));
  return {
    kind: "derived_metadata_only" as const,
    tools: books.length
      ? [
          {
            name: "runbook.execute",
            description: "등록된 버전과 설치 정책을 broker가 재검증한 뒤 실행",
            inputSchema: { type: "object", oneOf: variants },
          },
        ]
      : [],
    skills: books.map((book) => ({
      id: book.id,
      version: book.version,
      digest: book.digest,
      content: `---\nname: ${book.id}\ndescription: 등록된 런북을 broker로 호출하는 절차\n---\n\n버전 ${book.version}, digest ${book.digest}.\n\nrunbook.execute에 id/version/digest/parameters를 전달한다. 정적 script를 직접 실행하지 않는다. 새 draft와 이 지침은 실행 권한이 아니다.\n`,
    })),
  };
}
