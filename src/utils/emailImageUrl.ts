/**
 * Email-safe image URL utilities
 *
 * This module provides utilities for validating and normalizing image URLs
 * to ensure they work correctly in email clients (Gmail, Apple Mail, Outlook, etc.)
 *
 * Email clients require:
 * - Absolute URLs starting with https://
 * - Publicly accessible URLs (no authentication required)
 * - Stable URLs that won't expire
 *
 * NOT allowed in emails:
 * - Relative paths (/images/foo.png)
 * - Data URIs (data:image/...)
 * - Blob URLs (blob:...)
 * - Localhost URLs
 * - Framework-specific paths (/_next/image, /api/...)
 */

// Known safe Supabase storage domains for this project
const SUPABASE_STORAGE_PATTERN = /^https:\/\/[a-z0-9-]+\.supabase\.(co|in)\/storage\/v1\/object\/public\//i;

// Common image CDN patterns we trust
const TRUSTED_CDN_PATTERNS = [
  /^https:\/\/images\.unsplash\.com\//i,
  /^https:\/\/[a-z0-9-]+\.supabase\.co\/storage\//i,
  /^https:\/\/[a-z0-9-]+\.supabase\.in\/storage\//i,
  /^https:\/\/cdn\.pixabay\.com\//i,
  /^https:\/\/images\.pexels\.com\//i,
  /^https:\/\/res\.cloudinary\.com\//i,
];

// Patterns that should NEVER appear in email HTML
const BLOCKED_URL_PATTERNS = [
  /^data:/i, // Data URIs
  /^blob:/i, // Blob URLs
  /^\/[^\/]/, // Relative paths starting with /
  /^\.\//, // Relative paths starting with ./
  /^\.?\.\//, // Relative paths starting with ../
  /localhost/i, // Localhost URLs
  /127\.0\.0\.1/, // Localhost IP
  /\/_next\//i, // Next.js image proxy
  /\/api\//i, // API routes
];

/**
 * Validates if a URL is safe for use in email HTML.
 *
 * @param url - The image URL to validate
 * @returns true if the URL is safe for email, false otherwise
 */
export function isEmailSafeImageUrl(url: string | undefined | null): boolean {
  if (!url || typeof url !== "string") {
    return false;
  }

  const trimmedUrl = url.trim();

  // Must start with https:// (http is technically okay but https is preferred)
  if (!/^https?:\/\//i.test(trimmedUrl)) {
    return false;
  }

  // Check for blocked patterns
  for (const pattern of BLOCKED_URL_PATTERNS) {
    if (pattern.test(trimmedUrl)) {
      return false;
    }
  }

  return true;
}

/**
 * Validates if a URL is from a trusted source (our Supabase storage or trusted CDNs).
 * This is stricter than isEmailSafeImageUrl.
 *
 * @param url - The image URL to validate
 * @returns true if the URL is from a trusted source
 */
export function isTrustedImageSource(url: string | undefined | null): boolean {
  if (!isEmailSafeImageUrl(url)) {
    return false;
  }

  const trimmedUrl = url!.trim();

  // Check against Supabase storage pattern
  if (SUPABASE_STORAGE_PATTERN.test(trimmedUrl)) {
    return true;
  }

  // Check against trusted CDN patterns
  for (const pattern of TRUSTED_CDN_PATTERNS) {
    if (pattern.test(trimmedUrl)) {
      return true;
    }
  }

  return false;
}

/**
 * Get the Supabase public URL base for storage
 */
export function getSupabaseStorageBaseUrl(): string {
  const supabaseUrl = "https://udldmkqwnxhdeztyqcau.supabase.co";
  return `${supabaseUrl}/storage/v1/object/public`;
}

/**
 * Build a canonical public URL for a storage path
 *
 * @param bucket - The storage bucket name
 * @param path - The file path within the bucket
 * @returns The full public URL
 */
export function buildEmailAssetUrl(bucket: string, path: string): string {
  const base = getSupabaseStorageBaseUrl();
  // Ensure path doesn't start with /
  const cleanPath = path.startsWith("/") ? path.slice(1) : path;
  return `${base}/${bucket}/${cleanPath}`;
}

/**
 * Attempts to extract the storage path from a Supabase URL and rebuild it
 * as a canonical public URL. Useful for fixing malformed URLs.
 *
 * @param url - The potentially malformed URL
 * @returns The canonical URL, or null if it can't be fixed
 */
export function normalizeSupabaseStorageUrl(
  url: string | undefined | null,
): string | null {
  if (!url) return null;

  // Already a valid public URL
  if (SUPABASE_STORAGE_PATTERN.test(url)) {
    return url;
  }

  // Try to extract bucket and path from various URL formats
  const patterns = [
    // /storage/v1/object/public/bucket/path
    /\/storage\/v1\/object\/public\/([^\/]+)\/(.+)$/i,
    // /storage/v1/object/authenticated/bucket/path (convert to public)
    /\/storage\/v1\/object\/authenticated\/([^\/]+)\/(.+)$/i,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      const [, bucket, path] = match;
      return buildEmailAssetUrl(bucket, path);
    }
  }

  return null;
}

/**
 * Safely get an email-safe image URL, with fallback handling.
 * Use this in email HTML rendering to ensure only safe URLs are used.
 *
 * @param url - The image URL to validate
 * @param fallback - Optional fallback if the URL is not safe (default: empty string, which means no <img> tag)
 * @returns The safe URL or the fallback
 */
export function getEmailSafeImageUrl(
  url: string | undefined | null,
  fallback: string = "",
): string {
  if (isEmailSafeImageUrl(url)) {
    return url!.trim();
  }

  // Try to normalize if it looks like a Supabase URL (.co or .in)
  if (url && (url.includes("supabase") || url.includes("/storage/"))) {
    const normalized = normalizeSupabaseStorageUrl(url);
    if (normalized) {
      return normalized;
    }
  }

  return fallback;
}

/**
 * Sanitize all image URLs in an email block for safe email rendering.
 *
 * @param block - The email block object
 * @returns A copy of the block with sanitized image URLs
 */
export function sanitizeBlockImageUrls(
  block: Record<string, any>,
): Record<string, any> {
  const result = { ...block };

  // Common image URL fields in email blocks
  const imageFields = [
    "imageUrl",
    "backgroundImageUrl",
    "logoUrl",
    "thumbnailUrl",
    "coverImage",
  ];

  for (const field of imageFields) {
    if (field in result && result[field]) {
      result[field] = getEmailSafeImageUrl(result[field]);
    }
  }

  return result;
}

/**
 * Debug utility: Log all image URLs in blocks that would be filtered
 *
 * @param blocks - Array of email blocks
 */
export function debugBlockImageUrls(blocks: Array<Record<string, any>>): void {
  blocks.forEach((block, index) => {
    const imageFields = ["imageUrl", "backgroundImageUrl", "logoUrl"];
    for (const field of imageFields) {
      const url = block[field];
      if (url && !isEmailSafeImageUrl(url)) {
      }
    }
  });
}
