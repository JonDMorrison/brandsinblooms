import type { ToolName, ToolResult } from "./types.ts";

/**
 * Tool failures reach the model as tool results. A failed purchase lookup must
 * never read as "no purchases", and a timeout must be named as a timeout.
 */
const PURCHASE_EVIDENCE_TOOLS: readonly ToolName[] = [
  "get_customer_product_history",
  "explore_customer_purchases",
  "explore_customer_reported_spending",
  "explain_customer_set_member",
  "analyze_customer_basket",
  "compare_customer_growth",
  "get_customer_detail",
  "get_customer_timeline",
  "query_orders",
];
const FAILED_LOOKUP_IS_NOT_EVIDENCE =
  "This lookup failed. It is not evidence that the customer bought nothing. Say the purchase history could not be retrieved; do not guess.";

function readErrorDetails(error: unknown): { message: string; code: string | null } {
  if (error instanceof Error) {
    const code = (error as Error & { code?: unknown }).code;
    return { message: error.message, code: typeof code === "string" ? code : null };
  }
  if (error && typeof error === "object") {
    const record = error as { message?: unknown; code?: unknown };
    return {
      message: typeof record.message === "string" ? record.message : "Tool execution failed.",
      code: typeof record.code === "string" ? record.code : null,
    };
  }
  return { message: "Tool execution failed.", code: null };
}

/** Postgres 57014 / PostgREST / fetch timeouts. */
export function isTimeoutFailure(message: string, code: string | null): boolean {
  return (
    code === "57014" ||
    /statement timeout|canceling statement|timed out|timeout exceeded|aborterror|the operation was aborted/i.test(message)
  );
}

export function toolFailureResult(toolName: string, error: unknown): ToolResult {
  const { message, code } = readErrorDetails(error);
  const timeout = isTimeoutFailure(message, code);
  const purchaseTool = (PURCHASE_EVIDENCE_TOOLS as readonly string[]).includes(toolName);
  const base = timeout
    ? "The data lookup timed out before it finished. No partial result was returned."
    : message;
  return {
    success: false,
    data: null,
    count: null,
    message: purchaseTool ? `${base} ${FAILED_LOOKUP_IS_NOT_EVIDENCE}` : base,
    error: timeout ? "timeout_error" : "execution_error",
    block_type: "text",
    confirmation_required: false,
    confirmation_details: null,
  };
}
