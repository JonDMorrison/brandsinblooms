// src/types/publish.ts

/**
 * Frontend Platform Type - User-friendly identifiers
 * These are used in the UI and API requests.
 * 
 * Note: These values are mapped to database enum values before storage:
 * - "facebook" → "FB" (database enum)
 * - "instagram" → "IG_FEED" (database enum for feed posts)
 * 
 * See src/utils/platformMapping.ts for the mapping logic.
 */
export type Platform = "facebook" | "instagram";

export type PostStatus =
  | "draft"
  | "review"
  | "approved"
  | "ready"
  | "scheduled"
  | "publishing"
  | "published"
  | "failed";

export type PublishItem = {
  taskId: string;            // content_tasks.id (or equivalent)
  tenantId?: string;
  platform: Platform;
  accountId?: string | null; // linked social account ID (Page ID or IG Business ID)
  accountName?: string | null;
  caption?: string | null;   // prefer ai_output text
  firstComment?: string | null; // IG only (optional)
  mediaUrl?: string | null;  // current selected image
  scheduledFor?: string | null; // ISO timestamp (UTC) if scheduled
  status: PostStatus;
  // optional source data you already load:
  attachments?: Record<string, any> | null;
};

export type PublishNowInput = {
  platform: Platform;
  accountId: string;
  caption?: string | null;
  mediaUrl?: string | null;
  firstComment?: string | null; // IG
  contentId?: string; // Optional: generated_content.id for foreign key
};

export type ScheduleInput = PublishNowInput & {
  publishAt: string; // ISO timestamp (UTC)
  timezone?: string; // e.g. "America/Chicago" (optional)
};

export type ValidationResult = {
  ok: boolean;
  warnings: string[];
  errors: string[];
};