import { test } from "node:test";
import assert from "node:assert/strict";
import { deriveExports, callDerivedTool } from "../core/tool-exports.ts";
import { harness } from "./core-harness.mjs";
test("MCP/Skills metadata는 같은 hash·args를 보존하며 호출은 broker로 간다", async () => {
  const h = await harness({ action: false });
  try {
    const metadata = deriveExports(h.registry, h.policy);
    assert.equal(metadata.kind, "derived_metadata_only");
    assert.equal(metadata.tools[0].inputSchema.oneOf[0].properties.digest.const, h.book.digest);
    assert.deepEqual(
      metadata.tools[0].inputSchema.oneOf[0].properties.parameters.properties,
      h.book.schema.properties,
    );
    assert.match(metadata.skills[0].content, new RegExp(h.book.digest));
    assert.match(metadata.skills[0].content, /직접 실행하지 않는다/);
    await h.engine.ingest(h.observation());
    const incident = Object.values(h.store.state.incidents)[0];
    h.store.transaction((s) => {
      s.incidents[incident.id].activeRunId = "metadata-test";
      s.incidents[incident.id].activeRunDeadlineAt = h.now() + 1000;
    });
    const context = {
        incidentId: incident.id,
        revision: incident.revision,
        runId: "metadata-test",
      },
      args = {
        id: h.book.id,
        version: h.book.version,
        digest: h.book.digest,
        parameters: { workerId: "demo-worker" },
      };
    assert.equal(
      (await callDerivedTool(h.broker, context, "runbook.execute", args)).state,
      "verified",
    );
    await assert.rejects(
      callDerivedTool(h.broker, context, "arbitrary.shell", args),
      /unknown_tool/,
    );
    assert.equal(deriveExports(h.registry, { ...h.policy, allowedRunbooks: [] }).tools.length, 0);
  } finally {
    await h.close();
  }
});
