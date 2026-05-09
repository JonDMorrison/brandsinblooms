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

export type PublishSourceBundle = {
  bundleId: string;
  snapshotId?: string | null;
  snapshotVersion?: number | null;
  channel: Platform;
  previewTitle?: string | null;
};

export type PostStatus =
  | "draft"
  | "generated"
  | "review"
  | "approved"
  | "ready"
  | "scheduled"
  | "publishing"
  | "published"
  | "failed";

export type PublishItem = {
  taskId: string; // content_tasks.id (or equivalent)
  tenantId?: string;
  platform: Platform;
  accountId?: string | null; // linked social account ID (Page ID or IG Business ID)
  accountName?: string | null;
  caption?: string | null; // prefer ai_output text
  firstComment?: string | null; // IG only (optional)
  mediaUrl?: string | null; // single image (legacy)
  mediaUrls?: string[]; // multiple images for carousel
  isCarousel?: boolean; // indicates if post is a carousel
  scheduledFor?: string | null; // ISO timestamp (UTC) if scheduled
  status: PostStatus;
  // ISO timestamp of when the underlying content_tasks row was created.
  // Used by /publish to show when the draft was generated and to filter
  // out items older than 30 days behind an "Older" toggle.
  createdAt?: string | null;
  // optional source data you already load:
  attachments?: Record<string, any> | null;
  sourceBundle?: PublishSourceBundle | null;
};

export type PublishNowInput = {
  platform: Platform;
  accountId: string;
  caption?: string | null;
  mediaUrl?: string | null; // single image (legacy)
  mediaUrls?: string[]; // multiple images for carousel
  isCarousel?: boolean; // carousel mode flag
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
