const codes = new Set([
  "investigation_timeout",
  "investigation_failed",
  "invalid_investigation",
  "model_timeout",
  "model_cancelled",
  "model_auth_unavailable",
  "model_request_limit",
  "model_response_limit",
  "model_tool_limit",
  "model_transport_failed",
  "invalid_model_response",
  "invalid_model_usage",
  "invalid_model_tool",
  "invalid_model_tool_args",
  "unsupported_tool_schema",
  "invalid_tool_call",
  "unknown_tool",
  "unregistered_runbook",
  "runbook_digest_mismatch",
  "invalid_args",
  "action_not_allowed",
  "action_deadline",
  "stale_action_context",
  "effect_pending",
  "precondition_unverified",
  "probe_timeout",
  "wiki_entry_limit",
]);
export function safeErrorCode(error: unknown): string {
  const code = error instanceof Error ? error.message : "";
  return codes.has(code) || /^model_http_[1-5][0-9]{2}$/.test(code) ? code : "provider_failed";
}
