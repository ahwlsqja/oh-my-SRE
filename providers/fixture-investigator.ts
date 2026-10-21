import type { Investigator, RunContext, Investigation, ToolCall } from "../core/contracts.ts";
export class FixtureInvestigator implements Investigator {
  kind = "fixture" as const;
  calls = 0;
  contexts: RunContext[] = [];
  call?: ToolCall;
  constructor(call?: ToolCall) {
    this.call = call;
  }
  async investigate(context: RunContext, signal: AbortSignal): Promise<Investigation> {
    signal.throwIfAborted();
    this.calls++;
    this.contexts.push(structuredClone(context));
    const learned = context.knowledge.find(
      (item) =>
        item.outcome === "verified" &&
        item.runbookRef &&
        context.tools.some(
          (tool) =>
            Array.isArray(tool.inputSchema.oneOf) &&
            tool.inputSchema.oneOf.some((variant) => {
              const p = (variant as { properties?: Record<string, { const?: string }> }).properties;
              return (
                p?.id?.const === item.runbookRef!.id &&
                p?.version?.const === item.runbookRef!.version &&
                p?.digest?.const === item.runbookRef!.digest
              );
            }),
        ),
    );
    const call = learned?.runbookRef
      ? {
          name: "runbook.execute" as const,
          arguments: { ...learned.runbookRef, parameters: { workerId: context.resourceKey } },
        }
      : this.call;
    return {
      basedOnRevision: context.revision,
      outcome: "completed",
      toolCalls: call ? [structuredClone(call)] : [],
      usageUnits: 1,
    };
  }
}
