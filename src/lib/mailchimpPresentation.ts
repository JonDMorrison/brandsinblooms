const FETCHING_STAGE_PATTERN = /^Fetching\s+(.+?)\s+[·-]\s*batch\s+(\d+)$/i;
const COMPLETED_SCOPE_PATTERN = /^Completed\s+(.+)$/i;
const SAFE_STAGE_PATTERN = /^[A-Za-z0-9 ,.'&()/-]+$/;

const CONNECTION_ERROR_FRAGMENTS = [
  "token",
  "oauth",
  "authorize",
  "authorization",
  "not connected",
  "connection",
  "expired",
  "revoked",
  "unauthorized",
  "forbidden",
  "invalid_client",
  "invalid grant",
  "access token",
];

function isLikelyOpaqueIdentifier(value: string) {
  return (
    /^[A-Za-z0-9_-]+:[A-Za-z0-9_-]+$/.test(value) ||
    /^(list|segment|job|acct|audience)[-_][A-Za-z0-9_-]+$/i.test(value) ||
    /^[a-f0-9]{16,}$/i.test(value)
  );
}

function isHumanReadableFallbackStage(value: string) {
  const normalized = value.trim();
  const lower = normalized.toLowerCase();

  if (!SAFE_STAGE_PATTERN.test(normalized)) {
    return false;
  }

  if (
    lower.startsWith("error:") ||
    lower.includes("batch ") ||
    lower.includes("token") ||
    lower.includes("oauth") ||
    lower.includes("authorization") ||
    lower.includes("connection")
  ) {
    return false;
  }

  return true;
}

function sanitizeScopeLabel(value: string | null | undefined) {
  const normalized = value?.trim();

  if (!normalized || isLikelyOpaqueIdentifier(normalized)) {
    return null;
  }

  return normalized;
}

export function isMailchimpConnectionIssueMessage(message: string) {
  const normalized = message.trim().toLowerCase();

  return CONNECTION_ERROR_FRAGMENTS.some((fragment) =>
    normalized.includes(fragment),
  );
}

export function resolveMailchimpSelectionName(
  value: string | null | undefined,
  kind: "list" | "segment",
  index = 0,
) {
  const normalized = value?.trim();

  if (normalized && !isLikelyOpaqueIdentifier(normalized)) {
    return normalized;
  }

  const baseLabel = kind === "list" ? "Selected list" : "Selected segment";

  return index > 0 ? `${baseLabel} ${index + 1}` : baseLabel;
}

export function summarizeMailchimpSelections(labels: string[]) {
  const normalized = labels.filter((label) => label.trim().length > 0);

  if (normalized.length === 0) {
    return "Selected Mailchimp audience";
  }

  if (normalized.length === 1) {
    return normalized[0];
  }

  if (normalized.length === 2) {
    return `${normalized[0]} + ${normalized[1]}`;
  }

  return `${normalized[0]} + ${normalized.length - 1} more`;
}

export function formatMailchimpStageLabel(stage?: string | null) {
  const normalized = stage?.trim();

  if (!normalized) {
    return "Preparing your import";
  }

  const lower = normalized.toLowerCase();

  if (lower === "complete" || lower === "import finished") {
    return "Import completed";
  }

  if (lower === "running") {
    return "Import in progress";
  }

  if (lower === "paused by user") {
    return "Import paused";
  }

  if (lower === "cancelled by user" || lower === "canceled by user") {
    return "Import cancelled";
  }

  if (lower.startsWith("starting mailchimp import")) {
    return "Preparing your import";
  }

  if (lower.startsWith("resuming mailchimp import")) {
    return "Resuming your import";
  }

  if (lower.startsWith("restarting failed mailchimp import")) {
    return "Restarting your import";
  }

  if (lower.startsWith("finalizing mailchimp import")) {
    return "Finalizing your import";
  }

  if (lower.startsWith("error:")) {
    return "Import needs attention";
  }

  const completedScopeMatch = normalized.match(COMPLETED_SCOPE_PATTERN);
  if (completedScopeMatch) {
    const scopeLabel = sanitizeScopeLabel(completedScopeMatch[1]);
    return scopeLabel ? `Finished ${scopeLabel}` : "Finalizing your import";
  }

  const fetchingMatch = normalized.match(FETCHING_STAGE_PATTERN);
  if (fetchingMatch) {
    const scopeLabel = sanitizeScopeLabel(fetchingMatch[1]);
    const batchNumber = Number(fetchingMatch[2]);

    if (!scopeLabel) {
      return batchNumber > 1
        ? "Continuing your import"
        : "Importing your selected audience";
    }

    return batchNumber > 1
      ? `Continuing ${scopeLabel}`
      : `Importing ${scopeLabel}`;
  }

  if (isMailchimpConnectionIssueMessage(normalized)) {
    return "Import needs attention";
  }

  if (isHumanReadableFallbackStage(normalized)) {
    return normalized;
  }

  return "Import in progress";
}

export function formatMailchimpErrorMessage(message: string) {
  const normalized = message.trim();

  if (!normalized) {
    return "This import needs attention before it can continue.";
  }

  const lower = normalized.toLowerCase();

  if (isMailchimpConnectionIssueMessage(normalized)) {
    return "Your Mailchimp connection needs to be reconnected before the import can continue.";
  }

  if (lower.includes("rate limit") || lower.includes("too many requests")) {
    return "Mailchimp asked us to slow down. Wait a moment, then try the import again.";
  }

  if (
    lower.includes("timeout") ||
    lower.includes("timed out") ||
    lower.includes("network") ||
    lower.includes("fetch failed") ||
    lower.includes("service unavailable")
  ) {
    return "Mailchimp did not respond in time. Try the import again in a moment.";
  }

  if (
    lower.includes("not found") ||
    lower.includes("unknown list") ||
    lower.includes("unknown segment")
  ) {
    return "One of the selected Mailchimp audiences is no longer available. Refresh your selection and try again.";
  }

  if (lower.includes("invalid email")) {
    return "Some contacts were skipped because their email address was invalid.";
  }

  if (
    lower.includes("unsubscribed") ||
    lower.includes("suppression") ||
    lower.includes("cleaned")
  ) {
    return "Some contacts were skipped because they were unsubscribed or suppressed in Mailchimp.";
  }

  if (
    lower.includes("schema") ||
    lower.includes("column") ||
    lower.includes("constraint") ||
    lower.includes("cache") ||
    lower.includes("on conflict")
  ) {
    return "BloomSuite hit a setup issue before the import could finish. Try again in a moment.";
  }

  if (lower.includes("segment link")) {
    return "Some imported contacts could not be added to their segment in BloomSuite.";
  }

  if (
    (lower.includes("batch") && lower.includes("failed")) ||
    lower.includes("unknown batch error")
  ) {
    return "Part of the import could not be processed. Retry the import to continue.";
  }

  if (lower.startsWith("error:")) {
    return "The import stopped before it could finish. Retry it after reviewing the connection and audience selection.";
  }

  return "Some contacts could not be imported. Retry the import if you want to continue.";
}

export function formatMailchimpErrorMessages(messages: string[]) {
  const normalized = new Set<string>();

  for (const message of messages) {
    normalized.add(formatMailchimpErrorMessage(message));
  }

  return Array.from(normalized);
}
