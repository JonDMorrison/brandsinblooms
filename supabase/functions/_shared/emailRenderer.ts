/**
 * Unified Email Renderer
 *
 * SINGLE SOURCE OF TRUTH for all email rendering.
 * This function MUST be used by:
 * - Campaign preview
 * - Test send
 * - Send now (campaign)
 * - Scheduled campaign send
 * - Automation email execution
 *
 * DO NOT create alternative render paths - all email rendering goes through here.
 */

import {
  renderMergeTags,
  convertLegacyTags,
  createMergeTagDataFromCustomer,
  GLOBAL_FALLBACKS,
  type MergeTagData,
} from "./mergeTagEngine.ts";
import {
  generateServerFooterHtml,
  type CompanyProfileData,
} from "./emailFooter.ts";
import { rewriteLinksSync } from "./linkRewriter.ts";
import {
  renderContentBlocksToEmailHtml,
  type RenderableContentBlock,
} from "./campaignEmailContent.ts";
import { sanitizeEmailHtmlImageSources } from "./emailImageUrl.ts";
import type { ServerCompanyProfileShape } from "./resolveDesignSystem.ts";

// ============================================================================
// TYPES
// ============================================================================

export interface RenderEmailParams {
  tenantId: string;
  campaignId?: string;
  automationId?: string;
  automationNodeId?: string;
  subject?: string;
  previewText?: string;
  html?: string;
  contentBlocks?: RenderableContentBlock[] | null;
  customer: CustomerShape | null;
  companyProfile?: CompanyProfileShape | null;
  mode: "preview" | "send";
  /** If true, appends the footer. Default: true for send, false for preview */
  includeFooter?: boolean;
  /** Controls whether footer links are preview-safe anchors or real send links. */
  footerLinkMode?: "preview" | "send";
  /** If true, rewrites links for click tracking. Default: true for send, false for preview */
  enableLinkTracking?: boolean;
  trackedLinkMap?: Map<string, string> | null;
}

export interface CustomerShape {
  id?: string;
  email: string;
  first_name?: string | null;
  last_name?: string | null;
  phone?: string | null;
  lifetime_value?: number | null;
  total_spent?: number | null;
  first_purchase_date?: string | null;
  last_purchase_date?: string | null;
  custom_fields?: Record<string, unknown>;
}

export type CompanyProfileShape = ServerCompanyProfileShape;

export interface RenderDiagnostics {
  usedTags: string[];
  missingTags: string[];
  emptyResolvedTags: string[];
  legacyTagsConverted: number;
}

export interface RenderEmailResult {
  renderedHtml: string;
  renderedSubject: string;
  diagnostics: RenderDiagnostics;
}

// ============================================================================
// TOKEN NORMALIZATION
// ============================================================================

/**
 * Normalize escaped HTML entities back to merge tag syntax.
 * This prevents broken tags like &#123;&#123;first_name&#125;&#125;
 */
export function normalizeMergeTokens(content: string): string {
  if (!content) return "";

  return (
    content
      // HTML entity encoding (most common)
      .replace(/&#123;&#123;/g, "{{")
      .replace(/&#125;&#125;/g, "}}")
      // Named entities
      .replace(/&lbrace;&lbrace;/g, "{{")
      .replace(/&rbrace;&rbrace;/g, "}}")
      // URL encoding
      .replace(/%7B%7B/g, "{{")
      .replace(/%7D%7D/g, "}}")
      // Handle double-escaped scenarios
      .replace(/&amp;#123;&amp;#123;/g, "{{")
      .replace(/&amp;#125;&amp;#125;/g, "}}")
  );
}

// ============================================================================
// TAG ANALYSIS (DIAGNOSTICS)
// ============================================================================

const MERGE_TAG_REGEX =
  /\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*(?:\.[a-zA-Z_][a-zA-Z0-9_]*)*)\s*(?:\|\s*default:\s*["']([^"']*)["'])?\s*\}\}/g;
const LEGACY_TAG_REGEX = /\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g;

/**
 * Extract all merge tags from content
 */
function extractAllTags(content: string): string[] {
  const tags: string[] = [];
  let match;

  const regex = new RegExp(MERGE_TAG_REGEX.source, "g");
  while ((match = regex.exec(content)) !== null) {
    tags.push(match[0]);
  }

  return [...new Set(tags)];
}

/**
 * Count legacy tags that will be converted
 */
function countLegacyTags(content: string): number {
  const matches = content.match(LEGACY_TAG_REGEX);
  return matches ? matches.length : 0;
}

/**
 * Find tags that resolve to empty values (no data, no default, no fallback)
 */
function findEmptyResolvedTags(
  content: string,
  mergeData: MergeTagData,
): string[] {
  const emptyTags: string[] = [];
  const regex = new RegExp(MERGE_TAG_REGEX.source, "g");
  let match;

  while ((match = regex.exec(content)) !== null) {
    const fullTag = match[0];
    const fieldPath = match[1];
    const explicitDefault = match[2];

    const value = getNestedValue(
      mergeData as Record<string, unknown>,
      fieldPath,
    );

    // Check if resolved to empty
    if (
      (value === null || value === undefined || value === "") &&
      (explicitDefault === undefined || explicitDefault === "") &&
      (!GLOBAL_FALLBACKS[fieldPath] || GLOBAL_FALLBACKS[fieldPath] === "")
    ) {
      emptyTags.push(fullTag);
    }
  }

  return [...new Set(emptyTags)];
}

/**
 * Find truly missing tags (not in data and no fallback)
 */
function findMissingTags(tags: string[], mergeData: MergeTagData): string[] {
  return tags.filter((tag) => {
    const fieldMatch = tag.match(/\{\{\s*([a-zA-Z_][a-zA-Z0-9_.]*)/);
    if (!fieldMatch) return false;

    const fieldPath = fieldMatch[1];
    const value = getNestedValue(
      mergeData as Record<string, unknown>,
      fieldPath,
    );
    const hasGlobalFallback = GLOBAL_FALLBACKS[fieldPath] !== undefined;
    const hasExplicitDefault = tag.includes("| default:");

    return value === undefined && !hasGlobalFallback && !hasExplicitDefault;
  });
}

/**
 * Get nested value from object using dot notation
 */
function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split(".");
  let current: unknown = obj;

  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    if (typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[part];
  }

  return current;
}

// ============================================================================
// MAIN RENDERER
// ============================================================================

/**
 * Render email for a specific recipient.
 *
 * This is THE ONLY function that should render email content.
 * All code paths (preview, send, automation) MUST use this.
 */
export function renderEmailForRecipient(
  params: RenderEmailParams,
): RenderEmailResult {
  const {
    tenantId,
    campaignId,
    subject = "",
    previewText = "",
    html = "",
    contentBlocks,
    customer,
    companyProfile,
    mode,
    includeFooter = mode === "send",
    footerLinkMode = mode === "send" ? "send" : "preview",
    enableLinkTracking = mode === "send",
    trackedLinkMap = null,
  } = params;

  const hasContentBlocks =
    Array.isArray(contentBlocks) && contentBlocks.length > 0;
  const footerLinks = buildFooterLinks(customer, tenantId, footerLinkMode);
  const sourceHtml = hasContentBlocks
    ? renderContentBlocksToEmailHtml(contentBlocks, {
        subject,
        previewText,
        companyProfile,
        footerLinks,
      })
    : typeof html === "string" && html.trim().length > 0
      ? html
      : `<html><body><div style="font-family:Arial,sans-serif;padding:32px;"><h1 style="font-size:24px;margin:0 0 12px;">Campaign content unavailable</h1><p style="margin:0;color:#475569;line-height:1.6;">No renderable HTML is stored for this campaign.</p></div></body></html>`;

  console.log(
    `[emailRenderer] mode=${mode}, tenantId=${tenantId}, customer=${customer?.email || "sample"}`,
  );

  // Step 1: Normalize escaped merge tokens
  let normalizedHtml = normalizeMergeTokens(sourceHtml);
  let normalizedSubject = normalizeMergeTokens(subject);

  // Step 2: Count legacy tags before conversion
  const legacyTagsConverted =
    countLegacyTags(normalizedHtml) + countLegacyTags(normalizedSubject);

  // Step 3: Convert legacy tags to modern syntax
  normalizedHtml = convertLegacyTags(normalizedHtml);
  normalizedSubject = convertLegacyTags(normalizedSubject);

  // Step 4: Extract all tags for diagnostics
  const usedTags = [
    ...extractAllTags(normalizedHtml),
    ...extractAllTags(normalizedSubject),
  ];

  // Step 5: Build merge data
  const mergeData = buildMergeData(customer, companyProfile, tenantId);

  // Step 6: Find diagnostic info
  const emptyResolvedTags = findEmptyResolvedTags(
    normalizedHtml + normalizedSubject,
    mergeData,
  );
  const missingTags = findMissingTags(usedTags, mergeData);

  // Step 7: Render merge tags
  let renderedHtml = renderMergeTags(normalizedHtml, mergeData);
  const renderedSubject = renderMergeTags(normalizedSubject, mergeData);

  // Step 8: Append footer if requested (for send mode)
  if (includeFooter && mode === "send" && customer && !hasContentBlocks) {
    renderedHtml = appendFooter(
      renderedHtml,
      customer,
      companyProfile,
      tenantId,
      footerLinkMode,
    );
  }

  if (
    enableLinkTracking &&
    mode === "send" &&
    campaignId &&
    customer?.id &&
    trackedLinkMap &&
    trackedLinkMap.size > 0
  ) {
    renderedHtml = rewriteLinksSync(
      renderedHtml,
      trackedLinkMap,
      campaignId,
      customer.id,
      tenantId,
      customer.email,
    ).html;
  }

  const imageSanitization = sanitizeEmailHtmlImageSources(
    renderedHtml,
    "emailRenderer",
  );
  renderedHtml = imageSanitization.html;

  // Step 9: Log diagnostics
  console.log(
    `[emailRenderer] usedTags=${usedTags.length}, legacy=${legacyTagsConverted}, missing=${missingTags.length}, empty=${emptyResolvedTags.length}, imageWarnings=${imageSanitization.warnings.length}`,
  );

  return {
    renderedHtml,
    renderedSubject,
    diagnostics: {
      usedTags: [...new Set(usedTags)],
      missingTags,
      emptyResolvedTags,
      legacyTagsConverted,
    },
  };
}

/**
 * Build merge data from customer and company profile
 */
function buildMergeData(
  customer: CustomerShape | null,
  companyProfile: CompanyProfileShape | null | undefined,
  tenantId: string,
): MergeTagData {
  // Base unsubscribe/preferences URLs (will be replaced with real ones during send)
  const baseUnsubscribeUrl = customer?.email
    ? `https://udldmkqwnxhdeztyqcau.supabase.co/functions/v1/handle-unsubscribe?email=${encodeURIComponent(customer.email)}&tenant_id=${tenantId}`
    : "#";
  const basePreferencesUrl = baseUnsubscribeUrl.replace(
    "handle-unsubscribe",
    "manage-preferences",
  );

  if (customer) {
    const mergeData = createMergeTagDataFromCustomer(
      customer as unknown as Record<string, unknown>,
      {
        company_name: companyProfile?.company_name || undefined,
        address:
          companyProfile?.location_info ||
          companyProfile?.street_address ||
          undefined,
        phone: companyProfile?.company_phone || undefined,
        email: companyProfile?.company_email || undefined,
        website_url: companyProfile?.website_url || undefined,
      },
    );

    mergeData.system = {
      unsubscribe_url: baseUnsubscribeUrl,
      preferences_url: basePreferencesUrl,
      current_year: new Date().getFullYear().toString(),
      current_date: new Date().toLocaleDateString(),
    };

    return mergeData;
  }

  // Sample/preview data
  return {
    first_name: "Friend",
    last_name: "Customer",
    email: "customer@your-domain.test",
    phone: "",
    company: {
      name: companyProfile?.company_name || "Your Company",
      address: companyProfile?.location_info || "",
      phone: companyProfile?.company_phone || "",
      email: companyProfile?.company_email || "",
      website: companyProfile?.website_url || "",
    },
    system: {
      unsubscribe_url: "#",
      preferences_url: "#",
      current_year: new Date().getFullYear().toString(),
      current_date: new Date().toLocaleDateString(),
    },
  };
}

function buildFooterLinks(
  customer: CustomerShape | null,
  tenantId: string,
  footerLinkMode: "preview" | "send",
) {
  if (!customer?.email || footerLinkMode === "preview") {
    return {
      unsubscribeUrl: "#unsubscribe",
      preferencesUrl: "#preferences",
    };
  }

  const unsubscribeToken = btoa(`${customer.email}:${tenantId}`);
  const unsubscribeUrl = `https://udldmkqwnxhdeztyqcau.supabase.co/functions/v1/handle-unsubscribe?email=${encodeURIComponent(customer.email)}&tenant_id=${tenantId}&token=${unsubscribeToken}`;

  return {
    unsubscribeUrl,
    preferencesUrl: unsubscribeUrl.replace(
      "handle-unsubscribe",
      "manage-preferences",
    ),
  };
}

/**
 * Append footer to email HTML
 */
function appendFooter(
  html: string,
  customer: CustomerShape,
  companyProfile: CompanyProfileShape | null | undefined,
  tenantId: string,
  footerLinkMode: "preview" | "send",
): string {
  const footerLinks = buildFooterLinks(customer, tenantId, footerLinkMode);
  const footerColors = companyProfile?.feature_flags?.footer_colors;
  const footerColorsRecord = footerColors as
    | Record<string, string | undefined>
    | undefined;

  // Build profile data for footer generator (include feature_flags for logo)
  const profileData: CompanyProfileData = {
    company_name: companyProfile?.company_name || "Your Company",
    company_phone: companyProfile?.company_phone || "",
    company_email: companyProfile?.company_email || "",
    website_url: companyProfile?.website_url || "",
    street_address: companyProfile?.street_address || "",
    city: companyProfile?.city || "",
    state_province: companyProfile?.state_province || "",
    postal_code: companyProfile?.postal_code || "",
    country: companyProfile?.country || "",
    footer_legal_text: companyProfile?.footer_legal_text || "",
    facebook_url: companyProfile?.facebook_url || "",
    instagram_url: companyProfile?.instagram_url || "",
    tiktok_url: companyProfile?.tiktok_url || "",
    pinterest_url: companyProfile?.pinterest_url || "",
    youtube_url: companyProfile?.youtube_url || "",
    linkedin_url: companyProfile?.linkedin_url || "",
    brand_primary_color: companyProfile?.brand_primary_color || "#283024",
    feature_flags: companyProfile?.feature_flags
      ? {
          company_logo_url:
            companyProfile.feature_flags.company_logo_url || undefined,
          footer_colors: footerColors
            ? {
                backgroundColor:
                  footerColorsRecord?.backgroundColor ||
                  footerColorsRecord?.background,
                textColor:
                  footerColorsRecord?.textColor || footerColorsRecord?.text,
                linkColor:
                  footerColorsRecord?.linkColor || footerColorsRecord?.link,
                dividerColor: footerColorsRecord?.dividerColor,
                logoBackgroundColor: footerColorsRecord?.logoBackgroundColor,
                logoTextColor: footerColorsRecord?.logoTextColor,
              }
            : undefined,
          footer_settings: companyProfile.feature_flags.footer_settings,
        }
      : undefined,
  };

  // Generate footer with placeholders then replace
  const footerTemplate = generateServerFooterHtml(
    profileData,
    "{{UNSUBSCRIBE_URL}}",
    "{{PREFERENCES_URL}}",
  );
  const footer = footerTemplate
    .replace(/\{\{UNSUBSCRIBE_URL\}\}/g, footerLinks.unsubscribeUrl)
    .replace(/\{\{PREFERENCES_URL\}\}/g, footerLinks.preferencesUrl);

  // Strip existing footer first
  const strippedHtml = stripExistingFooter(html);

  // Append footer
  if (strippedHtml.includes("</body>")) {
    return strippedHtml.replace("</body>", `${footer}</body>`);
  } else if (strippedHtml.includes("</html>")) {
    return strippedHtml.replace("</html>", `${footer}</html>`);
  }

  return strippedHtml + footer;
}

/**
 * Strip existing footer from HTML
 */
function stripExistingFooter(html: string): string {
  let strippedHtml = html;

  const patterns = [
    /<!-- BLOOMSUITE_FOOTER_START -->[\s\S]*?<!-- BLOOMSUITE_FOOTER_END -->/gi,
    /<div[^>]*style="[^"]*margin-top:\s*40px[^"]*"[^>]*>[\s\S]*?<\/div>\s*<\/div>(?=\s*(<\/body>|<\/html>|<\/div>\s*<\/div>\s*$))/gi,
    /<div[^>]*style="[^"]*background-color[^"]*"[^>]*>[\s\S]*?<div[^>]*style="[^"]*max-width:\s*640px[^"]*"[^>]*>[\s\S]*?[Uu]nsubscribe[\s\S]*?<\/div>\s*<\/div>(?=\s*(<\/body>|<\/html>|<\/div>\s*$))/gi,
    /<div[^>]*style="[^"]*background-color[^"]*"[^>]*>[\s\S]*?social-icons[\s\S]*?<\/div>\s*<\/div>(?=\s*(<\/body>|<\/html>|<\/div>\s*$))/gi,
    /<div[^>]*style="[^"]*background-color:\s*#283024[^"]*"[^>]*>[\s\S]*?<\/div>\s*<\/div>(?=\s*(<\/body>|<\/html>|<\/div>\s*$))/gi,
  ];

  for (const pattern of patterns) {
    strippedHtml = strippedHtml.replace(pattern, "");
  }

  return strippedHtml;
}

// ============================================================================
// EXPORTS
// ============================================================================

export { type MergeTagData } from "./mergeTagEngine.ts";
