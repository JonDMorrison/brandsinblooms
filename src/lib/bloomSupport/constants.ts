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
export const MAX_ATTACHMENT_BYTES = 8 * 1024 * 1024;
export const MAX_ATTACHMENT_TOTAL_BYTES = 12 * 1024 * 1024;
export const MAX_ATTACHMENTS = 5;
export const MAX_SUPPORT_BODY_LENGTH = 20_000;
export const MAX_PUBLIC_SUPPORT_BODY_LENGTH = 10_000;
export const MAX_SUPPORT_SUBJECT_LENGTH = 300;

/** Only render tracking links that return to Bloom Support, never an arbitrary server-supplied URL. */
export function safeSupportTrackingUrl(value: unknown): string | null {
  if (typeof value !== "string" || !value) return null;
  try {
    const currentOrigin = typeof window === "undefined" ? "https://bloomsuite.app" : window.location.origin;
    const url = new URL(value, currentOrigin);
    if (url.origin !== currentOrigin && url.origin !== "https://bloomsuite.app") return null;
    if (url.origin === "https://bloomsuite.app" && url.protocol !== "https:") return null;
    if (/^https:\/\/bloomsuite\.app:/i.test(value)) return null;
    if (url.username || url.password) return null;
    if (!/^\/support\/track\/[A-Za-z0-9_-]{32}\/?$/.test(url.pathname)) return null;
    url.search = "";
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}

/** Splits picked files into ones Bloom will accept and the reasons the others will not be sent. */
export function checkAttachments(files: File[]): { accepted: File[]; rejected: string[] } {
  const allowed = new Set(ATTACHMENT_ACCEPT.split(","));
  const accepted: File[] = [];
  const rejected: string[] = [];
  const acceptedIdentities = new Set<string>();
  let acceptedBytes = 0;
  for (const file of files) {
    const identity = `${file.name}:${file.type}:${file.size}:${file.lastModified}`;
    if (acceptedIdentities.has(identity)) rejected.push(`${file.name}: this file was already selected`);
    else if (!allowed.has(file.type)) rejected.push(`${file.name}: this file type can't be attached`);
    else if (file.size === 0 || file.size > MAX_ATTACHMENT_BYTES) rejected.push(`${file.name}: files must be 8 MB or smaller`);
    else if (accepted.length >= MAX_ATTACHMENTS) rejected.push(`${file.name}: up to ${MAX_ATTACHMENTS} files per request`);
    else if (acceptedBytes + file.size > MAX_ATTACHMENT_TOTAL_BYTES) rejected.push(`${file.name}: attachments must total 12 MB or less`);
    else {
      accepted.push(file);
      acceptedIdentities.add(identity);
      acceptedBytes += file.size;
    }
  }
  return { accepted, rejected };
}
