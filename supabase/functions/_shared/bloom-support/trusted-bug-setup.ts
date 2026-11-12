import { BloomError, type Caller, directRpc, uuid } from "./runtime.ts";
/** A fixed setup operation, not a general policy editor or release approval. */
export async function configureTrustedBug(caller: Caller, input: Record<string, unknown>) {
  if (caller.via !== "crm_session" || caller.role !== "platform_admin") {
    throw new BloomError(403, "forbidden", "Use a signed-in administrator session");
  }
  const keys = ["issue_id", "github_issue", "ticket_ids", "expected_policy"];
  if (Object.keys(input).some(k => !keys.includes(k)) ||
    typeof input.github_issue !== "number" || !Number.isSafeInteger(input.github_issue) || input.github_issue < 1 || input.github_issue > 2147483647 ||
    !Array.isArray(input.ticket_ids) || input.ticket_ids.length < 1 || input.ticket_ids.length > 50 || new Set(input.ticket_ids).size !== input.ticket_ids.length ||
    !input.expected_policy || typeof input.expected_policy !== "object" || Array.isArray(input.expected_policy) || JSON.stringify(input.expected_policy).length > 500000) {
    throw new BloomError(400, "invalid", "Expected exact issue, GitHub issue, ticket IDs and current release policy");
  }
  const tickets = input.ticket_ids.map(t => uuid(t, "ticket_id"));
  return await directRpc("bloom_support_configure_trusted_bug", { p_actor: caller.principalId,
    p_issue_id: uuid(input.issue_id, "issue_id"), p_github_issue: input.github_issue,
    p_ticket_ids: tickets, p_expected_policy: input.expected_policy });
}
