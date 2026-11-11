/**
 * Narrow reconciliation rule for historically failed Slack notifications.
 *
 * Some older messages were accepted by Slack but Bloom rejected their receipt.
 * Replaying them may send duplicate messages. We only offer to clear a failed
 * job when the exact known problem predates its fix AND a newer job in the same
 * delivery lane has a verified Slack receipt. Clearing never resends messages.
 *
 * This intentionally fails closed for new error types or later incidents.
 */
const SLACK_RECEIPT_FIXED_AT = Date.parse("2026-11-08T20:04:41Z");
const FEATURE_SUMMARY_RECOVERED_AT = Date.parse("2026-11-08T04:54:01Z");
const VALID_SLACK_RECEIPT = /delivered to [a-z]+ \(Slack ts: \d{10}\.\d{6}\)/;

export function verifiedHistoricalNotificationFailure(
  failed: Record<string, unknown>,
  succeeded: Array<Record<string, unknown>>,
): boolean {
  if (failed.kind !== "notify" || failed.status !== "dead" || typeof failed.id !== "string") return false;
  const lane = failed.lane;
  const created = typeof failed.created_at === "string" ? Date.parse(failed.created_at) : NaN;
  if (typeof lane !== "string" || !lane.startsWith("slack:") || !Number.isFinite(created)) return false;

  if (failed.last_error === "Slack did not return a valid message timestamp") {
    // The receipt parsing bug was fixed in CRM PR #450. Do not include newer failures.
    if (created > SLACK_RECEIPT_FIXED_AT) return false;
  } else if (failed.last_error === "Feature summary is temporarily unavailable") {
    // This one expired before later successful features replies on the same lane.
    if (!lane.startsWith("slack:ask:features:") || created > FEATURE_SUMMARY_RECOVERED_AT) return false;
  } else return false;

  return succeeded.some((job) => {
    if (job.kind !== "notify" || job.status !== "succeeded" || job.lane !== lane) return false;
    const successAt = typeof job.created_at === "string" ? Date.parse(job.created_at) : NaN;
    const result = job.result;
    const note = result && typeof result === "object" && !Array.isArray(result)
      ? (result as Record<string, unknown>).note : null;
    return Number.isFinite(successAt) && successAt > created &&
      typeof note === "string" && VALID_SLACK_RECEIPT.test(note);
  });
}
