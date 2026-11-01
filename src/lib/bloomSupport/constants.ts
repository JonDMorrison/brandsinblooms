/** The one Brands in Blooms support address. Mail sent here reaches the Bloom support desk. */
export const SUPPORT_EMAIL = "bloom@support.bloomsuite.app";
/** Public help centre (approved Bloom answers). */
export const HELP_CENTRE_PATH = "/knowledge-base";

/**
 * Attachment types and size Bloom intake accepts. Mirrors the server check in
 * supabase/functions/_shared/bloom-support/attachments.ts; the server remains authoritative.
 */
export const ATTACHMENT_ACCEPT =
  "image/png,image/jpeg,image/gif,image/webp,image/heic,application/pdf,text/plain,text/csv,application/json,video/mp4,video/quicktime,video/webm";
export const MAX_ATTACHMENT_BYTES = 15 * 1024 * 1024;
export const MAX_ATTACHMENTS = 5;

/** Splits picked files into ones Bloom will accept and the reasons the others will not be sent. */
export function checkAttachments(files: File[]): { accepted: File[]; rejected: string[] } {
  const allowed = new Set(ATTACHMENT_ACCEPT.split(","));
  const accepted: File[] = [];
  const rejected: string[] = [];
  for (const file of files) {
    if (!allowed.has(file.type)) rejected.push(`${file.name}: this file type can't be attached`);
    else if (file.size === 0 || file.size > MAX_ATTACHMENT_BYTES) rejected.push(`${file.name}: files must be under 15 MB`);
    else if (accepted.length >= MAX_ATTACHMENTS) rejected.push(`${file.name}: up to ${MAX_ATTACHMENTS} files per request`);
    else accepted.push(file);
  }
  return { accepted, rejected };
}
