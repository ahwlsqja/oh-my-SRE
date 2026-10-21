import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { OpenAIResponsesInvestigator } from "../providers/openai-responses.ts";
import { harness } from "./core-harness.mjs";
test("공식 Responses wire의 도구제안·usage를 로컬 stub으로 검증한다", async () => {
  const h = await harness({ action: false });
  let mode = "ok",
    payload,
    redirectHits = 0;
  const server = createServer(async (req, res) => {
    if (req.url === "/redirect-target") {
      redirectHits++;
      res.end("{}");
      return;
    }
    let body = "";
    for await (const chunk of req) body += chunk;
    payload = JSON.parse(body);
    if (mode === "hang") return;
    if (mode === "redirect") {
      res.writeHead(302, { location: "/redirect-target" });
      res.end();
      return;
    }
    if (mode === "401") {
      res.writeHead(401);
      res.end(JSON.stringify({ error: { message: "synthetic-key-only" } }));
      return;
    }
    if (mode === "large") {
      res.end(" ".repeat(10000));
      return;
    }
    const props = payload.tools[0].parameters.properties;
    const args = {
      id: props.id.enum[0],
      version: props.version.enum[0],
      digest: props.digest.enum[0],
      parameters: {
        workerId:
          mode === "bad-args" ? "unregistered" : props.parameters.properties.workerId.enum[0],
      },
    };
    res.setHeader("content-type", "application/json");
    res.end(
      JSON.stringify({
        status: "completed",
        output: [
          {
            type: "function_call",
            call_id: "synthetic-call",
            name: mode === "bad-tool" ? "arbitrary_shell" : payload.tools[0].name,
            arguments: JSON.stringify(args),
          },
        ],
        usage: { input_tokens: 7, output_tokens: 5, total_tokens: 12 },
      }),
    );
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    await h.engine.ingest(h.observation());
    const context = h.investigator.contexts[0],
      options = {
        endpoint: `http://127.0.0.1:${server.address().port}/v1/responses`,
        model: "fixture-model",
        credential: async () => "synthetic-key-only",
        allowLocalStub: true,
        maxOutputTokens: 32,
        maxRequestBytes: 20000,
        maxResponseBytes: 5000,
        timeoutMs: 50,
      };
    const adapter = new OpenAIResponsesInvestigator(options);
    const invoke = () =>
      adapter.investigate(
        { ...context, deadlineAt: Date.now() + 1000 },
        new AbortController().signal,
      );
    const result = await invoke();
    assert.equal(payload.model, "fixture-model");
    assert.equal(payload.max_output_tokens, 32);
    assert.equal(payload.parallel_tool_calls, false);
    assert.equal(payload.store, false);
    assert.equal(result.toolCalls[0].name, "runbook.execute");
    assert.equal(result.telemetry.totalTokens, 12);
    assert.equal(result.usageUnits, 1);
    for (const [value, error] of [
      ["bad-args", /invalid_model_tool_args/],
      ["bad-tool", /invalid_model_tool/],
      ["401", /model_http_401/],
      ["large", /model_response_limit/],
      ["redirect", /model_transport_failed/],
      ["hang", /model_timeout/],
    ]) {
      mode = value;
      await assert.rejects(invoke(), error);
    }
    assert.equal(redirectHits, 0);
    assert.throws(
      () => new OpenAIResponsesInvestigator({ ...options, allowLocalStub: false }),
      /https_required/,
    );
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
    await h.close();
  }
});
