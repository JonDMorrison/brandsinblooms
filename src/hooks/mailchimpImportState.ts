export const MAILCHIMP_IMPORT_STALE_THRESHOLD_MS = 60_000;
export const MAILCHIMP_ACTIVE_IMPORT_MAX_AGE_MS = 30 * 60_000;

type MailchimpImportStateLike = {
  status?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type MailchimpImportStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed";

export function normalizeMailchimpImportStatus(
  value: string | null | undefined,
): MailchimpImportStatus | null {
  switch (value?.trim().toLowerCase()) {
    case "pending":
      return "pending";
    case "running":
      return "running";
    case "completed":
      return "completed";
    case "failed":
      return "failed";
    default:
      return null;
  }
}

export function getMailchimpImportActivityTimestamp(
  job: MailchimpImportStateLike | null | undefined,
) {
  return job?.updated_at ?? job?.created_at ?? null;
}

export function isMailchimpImportJobActivelyRunning(
  job: MailchimpImportStateLike | null | undefined,
  now = Date.now(),
) {
  const status = normalizeMailchimpImportStatus(job?.status);

  if (status !== "pending" && status !== "running") {
    return false;
  }

  const timestamp = getMailchimpImportActivityTimestamp(job);

  if (!timestamp) {
    return false;
  }

  const activityTime = new Date(timestamp).getTime();

  if (!Number.isFinite(activityTime)) {
    return false;
  }

  return now - activityTime < MAILCHIMP_ACTIVE_IMPORT_MAX_AGE_MS;
}

export function isMailchimpImportJobStale(
  job: MailchimpImportStateLike | null | undefined,
  now = Date.now(),
) {
  if (!isMailchimpImportJobActivelyRunning(job, now)) {
    return false;
  }

  const timestamp = getMailchimpImportActivityTimestamp(job);

  if (!timestamp) {
    return false;
  }

  const activityTime = new Date(timestamp).getTime();

  if (!Number.isFinite(activityTime)) {
    return false;
  }

  return now - activityTime >= MAILCHIMP_IMPORT_STALE_THRESHOLD_MS;
}