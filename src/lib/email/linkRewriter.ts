/**
 * Link Rewriter Utility for Email Campaigns
 * 
 * Extracts and rewrites links in HTML content for click tracking.
 * Guards against PII in URLs and appends UTM parameters.
 */

// Expanded PII patterns to detect in URLs
const PII_PATTERNS = [
  // Query parameter patterns (stricter matching)
  /(^|[?&])(e|u|email|email_id|subscriber|phone|msisdn)=/i,
  /[?&]tel=/i,
  /[?&]mobile=/i,
  /[?&]ssn=/i,
  /[?&]social=/i,
  /[?&]address=/i,
  /[?&]name=/i,
  /[?&]first_name=/i,
  /[?&]last_name=/i,
  // Merge tag patterns (handlebars, liquid, etc.)
  /\{\{.*email.*\}\}/i,
  /\{\{.*phone.*\}\}/i,
  /\{\{.*first_name.*\}\}/i,
  /\{\{.*last_name.*\}\}/i,
  /\{recipient\.[^}]+\}/i,  // {recipient.email}, {recipient.name} etc.
  /%7B%7B.*%7D%7D/i, // URL-encoded handlebars {{ }}
  /%7Brecipient\.[^%]+%7D/i, // URL-encoded {recipient.*}
];

// URLs to skip from tracking
const SKIP_PATTERNS = [
  // System/preference links
  /handle-unsubscribe/i,
  /manage-preferences/i,
  /manage[-_]prefs/i,
  /unsubscribe/i,
  /email-preferences/i,
  /opt-out/i,
  // Non-HTTP protocols
  /^mailto:/i,
  /^tel:/i,
  /^sms:/i,
  /^javascript:/i,
  /^data:/i,
  // Anchors (handled separately but included for completeness)
  /^#/,
];

export interface ExtractedLink {
  original: string;
  href: string;
  startIndex: number;
  endIndex: number;
}

export interface LinkRewriteResult {
  html: string;
  linksRewritten: number;
  piiWarnings: string[];
  skippedLinks: string[];
}

export interface TrackedLinkMapping {
  originalUrl: string;
  linkId: string;
  trackedUrl: string;
}

/**
 * Decode HTML entities in a URL
 */
export function decodeHtmlEntities(url: string): string {
  const entities: Record<string, string> = {
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#39;': "'",
    '&apos;': "'",
    '&#x27;': "'",
    '&#x2F;': '/',
    '&#47;': '/',
  };
  
  let decoded = url;
  for (const [entity, char] of Object.entries(entities)) {
    decoded = decoded.replace(new RegExp(entity, 'gi'), char);
  }
  
  return decoded;
}

/**
 * Check if a URL contains potential PII
 */
export function hasPII(url: string): boolean {
  const decoded = decodeHtmlEntities(url);
  return PII_PATTERNS.some(pattern => pattern.test(decoded));
}

/**
 * Check if a URL should be skipped from tracking
 */
export function shouldSkipLink(url: string): boolean {
  const decoded = decodeHtmlEntities(url);
  const trimmed = decoded.trim();
  
  // Skip empty or anchor-only links
  if (!trimmed || trimmed === '#' || trimmed.startsWith('#')) {
    return true;
  }
  
  // Skip non-HTTP protocols and system links
  return SKIP_PATTERNS.some(pattern => pattern.test(trimmed));
}

/**
 * Check if URL is a valid trackable link
 */
export function isTrackableUrl(url: string): boolean {
  const decoded = decodeHtmlEntities(url);
  const trimmed = decoded.trim();
  
  // Must start with http:// or https://
  if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
    return false;
  }
  
  // Must not match skip patterns
  if (shouldSkipLink(trimmed)) {
    return false;
  }
  
  return true;
}

/**
 * Extract all links from HTML content
 */
export function extractLinks(html: string): ExtractedLink[] {
  const links: ExtractedLink[] = [];
  const hrefRegex = /href=["']([^"']+)["']/gi;
  let match;

  while ((match = hrefRegex.exec(html)) !== null) {
    const href = decodeHtmlEntities(match[1]);
    
    // Skip non-trackable links
    if (!isTrackableUrl(href)) continue;

    links.push({
      original: match[0],
      href,
      startIndex: match.index,
      endIndex: match.index + match[0].length,
    });
  }

  return links;
}

/**
 * Build tracking URL for a link
 */
export function buildTrackingUrl(
  baseUrl: string,
  campaignId: string,
  linkId: string,
  recipientId: string,
  tenantId: string
): string {
  const params = new URLSearchParams({
    cid: campaignId,
    lid: linkId,
    rid: recipientId,
    t: tenantId,
  });
  
  return `${baseUrl}?${params.toString()}`;
}

/**
 * Append UTM parameters to a URL if not already present
 * Preserves existing UTM params
 */
export function appendUtmParams(url: string, campaignId: string, campaignName?: string): string {
  try {
    const urlObj = new URL(decodeHtmlEntities(url));
    
    // Only append UTMs if none exist
    if (!urlObj.searchParams.has('utm_source')) {
      urlObj.searchParams.set('utm_source', 'email');
    }
    if (!urlObj.searchParams.has('utm_campaign')) {
      urlObj.searchParams.set('utm_campaign', campaignName || campaignId);
    }
    if (!urlObj.searchParams.has('utm_medium')) {
      urlObj.searchParams.set('utm_medium', 'email');
    }
    
    return urlObj.toString();
  } catch {
    // If URL parsing fails, return original
    return url;
  }
}

/**
 * Rewrite all links in HTML content with tracking URLs
 * 
 * @param html - The HTML content to process
 * @param mapperFn - Function that takes a URL and returns { linkId, trackedUrl }
 * @returns Result with rewritten HTML and metadata
 */
export async function rewriteLinks(
  html: string,
  mapperFn: (url: string) => Promise<{ linkId: string; trackedUrl: string } | null>
): Promise<LinkRewriteResult> {
  const links = extractLinks(html);
  const piiWarnings: string[] = [];
  const skippedLinks: string[] = [];
  let rewrittenHtml = html;
  let linksRewritten = 0;

  // Process links in reverse order to maintain correct indices
  const sortedLinks = [...links].sort((a, b) => b.startIndex - a.startIndex);

  for (const link of sortedLinks) {
    // Check for PII
    if (hasPII(link.href)) {
      piiWarnings.push(link.href);
      skippedLinks.push(link.href);
      continue;
    }

    try {
      const result = await mapperFn(link.href);
      
      if (result) {
        const newHref = `href="${result.trackedUrl}"`;
        rewrittenHtml = 
          rewrittenHtml.substring(0, link.startIndex) +
          newHref +
          rewrittenHtml.substring(link.endIndex);
        linksRewritten++;
      }
    } catch (error) {
      console.warn(`Failed to rewrite link: ${link.href}`, error);
      skippedLinks.push(link.href);
    }
  }

  return {
    html: rewrittenHtml,
    linksRewritten,
    piiWarnings,
    skippedLinks,
  };
}

/**
 * Get unique URLs from extracted links
 */
export function getUniqueUrls(links: ExtractedLink[]): string[] {
  return [...new Set(links.map(l => l.href))];
}

/**
 * Validate URL is properly formatted
 */
export function isValidUrl(url: string): boolean {
  try {
    new URL(decodeHtmlEntities(url));
    return true;
  } catch {
    return false;
  }
}

/**
 * Validate UUID format
 */
export function isValidUUID(str: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}
