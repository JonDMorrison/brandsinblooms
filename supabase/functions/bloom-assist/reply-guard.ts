/**
 * Guard against a reply that says a lookup failed when every lookup in the
 * turn succeeded. gpt-4o-mini repeatedly answered "the data could not be
 * retrieved" right after a search returned thousands of customers, which
 * tells a garden centre their data is broken when it is not.
 */
export interface ToolOutcome {
  status: string;
  success: boolean | null;
  message: string | null;
  label: string | null;
}

const FAILURE_CLAIM =
  /\b(could ?n[o']t be (retrieved|accessed|found)|could not (retrieve|access|load)|unable to (retrieve|access|load)|(an |a )?(issue|problem|error) (retrieving|accessing|loading|with retrieving)|(result|data) (is|was) (currently )?unavailable|timed? ?out)\b/i;

/** Pull the plain result line a tool returned, if any. */
export function toolOutcomeFrom(status: string, result: unknown): ToolOutcome {
  const record = result && typeof result === "object" && !Array.isArray(result) ? result as Record<string, unknown> : null;
  const data = record?.data && typeof record.data === "object" && !Array.isArray(record.data) ? record.data as Record<string, unknown> : null;
  const trail = Array.isArray(data?.trail) ? data!.trail as unknown[] : [];
  const last = trail[trail.length - 1] as Record<string, unknown> | undefined;
  return {
    status,
    success: typeof record?.success === "boolean" ? record.success : null,
    message: typeof record?.message === "string" ? record.message : null,
    label: typeof last?.label === "string" ? last.label : null,
  };
}

function plainResult(outcome: ToolOutcome): string {
  const text = (outcome.message ?? "")
    .replace(/^Search succeeded:\s*/i, "")
    .replace(/\s*This is a complete answer, not an error\.?/i, "")
    .trim();
  return outcome.label ? `${outcome.label}: ${text}` : text;
}

/** Replace a false failure claim with what the tools actually returned. */
export function correctFalseFailureReply(content: string, outcomes: readonly ToolOutcome[]): string {
  if (!outcomes.length || !FAILURE_CLAIM.test(content)) return content;
  const allSucceeded = outcomes.every((o) => o.status === "completed" && o.success !== false);
  const lines = outcomes.filter((o) => o.message).map(plainResult).filter(Boolean);
  if (!allSucceeded || !lines.length) return content;
  return `Here is what I found.\n\n${lines.join("\n\n")}`;
}
