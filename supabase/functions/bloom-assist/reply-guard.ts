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
  /** get_send_readiness verdict, when this outcome is that tool's result. */
  sendReadiness?: SendReadinessOutcome | null;
}

export interface SendReadinessOutcome {
  verdict: string;
  summary: string;
  reachableOfTotal: string | null;
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
    sendReadiness:
      data?.kind === "send_readiness" && typeof data.verdict === "string" && typeof data.summary === "string"
        ? {
            verdict: data.verdict,
            summary: data.summary,
            reachableOfTotal: typeof data.reachable_of_total === "string" ? data.reachable_of_total : null,
          }
        : null,
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

const SENDING_WORKS_CLAIM =
  /\b(?:(?:you|we) (?:should be|are|'re|will be) (?:able|ready|all set|good) to send|(?:you|we) can (?:now |start |go ahead and )?send|(?:should|will) be able to send|sending (?:will|should) work|ready to send|good to go|all set|without (?:any )?issues|in good (?:condition|shape)|set up correctly|everything is set)\b/i;
const NEGATED = /\b(?:not|n't|cannot|no one|nobody|never|but)\b/i;

/**
 * Never tell the user sending will work when get_send_readiness said it will
 * not. gpt-4o read a 0% bounce rate as "you should be able to send campaigns
 * without issues" while no customer could receive email. Sentences that claim
 * sending works are removed and the tool's verdict leads the reply; a reply
 * that leaves out the reachable count gets the verdict added.
 */
export function correctSendReadinessReply(content: string, outcomes: readonly ToolOutcome[]): string {
  const readiness = [...outcomes].reverse().find((outcome) => outcome.sendReadiness)?.sendReadiness;
  if (!readiness || readiness.verdict === "ready") return content;
  const lines = content.split("\n");
  let removed = false;
  const kept = lines.map((line) => {
    const sentences = line.split(/(?<=[.!?])\s+/);
    const filtered = sentences.filter((sentence) => {
      const claims = SENDING_WORKS_CLAIM.test(sentence) && !NEGATED.test(sentence);
      if (claims) removed = true;
      return !claims;
    });
    return filtered.join(" ");
  });
  const cleaned = kept.join("\n").replace(/\n{3,}/g, "\n\n").trim();
  const mentionsCount = readiness.reachableOfTotal ? cleaned.includes(readiness.reachableOfTotal) : false;
  if (!removed && mentionsCount) return content;
  return cleaned ? `${readiness.summary}\n\n${cleaned}` : readiness.summary;
}
