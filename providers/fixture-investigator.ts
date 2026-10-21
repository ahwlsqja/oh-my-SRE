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
    return {
      basedOnRevision: context.revision,
      outcome: "completed",
      toolCalls: this.call ? [structuredClone(this.call)] : [],
      usageUnits: 1,
    };
  }
}
