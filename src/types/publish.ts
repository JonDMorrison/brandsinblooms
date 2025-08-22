// src/types/publish.ts
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