/**
 * Link Rewriter Utility for Email Campaigns
 * 
 * Extracts and rewrites links in HTML content for click tracking.
 * Guards against PII in URLs and appends UTM parameters.
 */

// PII patterns to detect in URLs
const PII_PATTERNS = [
  /[?&]email=/i,
  /[?&]e=/i,
  /[?&]phone=/i,
  /[?&]tel=/i,
  /[?&]mobile=/i,
  /[?&]ssn=/i,
  /[?&]social=/i,
  /[?&]address=/i,
  /[?&]name=/i,
  /\{\{.*email.*\}\}/i,
  /\{\{.*phone.*\}\}/i,
  /\{\{.*first_name.*\}\}/i,
  /\{\{.*last_name.*\}\}/i,
  /%7B%7B.*%7D%7D/i, // URL-encoded merge tags
];

// URLs to skip (system URLs, unsubscribe links, etc.)
const SKIP_PATTERNS = [
  /handle-unsubscribe/i,
  /manage-preferences/i,
  /unsubscribe/i,
  /mailto:/i,
  /tel:/i,
  /sms:/i,
  /javascript:/i,
  /#/,
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
 * Check if a URL contains potential PII
 */
export function hasPII(url: string): boolean {
  return PII_PATTERNS.some(pattern => pattern.test(url));
}

/**
 * Check if a URL should be skipped from tracking
 */
export function shouldSkipLink(url: string): boolean {
  return SKIP_PATTERNS.some(pattern => pattern.test(url));
}

/**
 * Extract all links from HTML content
 */
export function extractLinks(html: string): ExtractedLink[] {
  const links: ExtractedLink[] = [];
  const hrefRegex = /href=["']([^"']+)["']/gi;
  let match;

  while ((match = hrefRegex.exec(html)) !== null) {
    const href = match[1];
    
    // Skip empty or anchor-only links
    if (!href || href === '#' || href.startsWith('#')) continue;
    
    // Skip mailto, tel, javascript, etc.
    if (shouldSkipLink(href)) continue;

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
 */
export function appendUtmParams(url: string, campaignId: string): string {
  try {
    const urlObj = new URL(url);
    
    // Only append UTMs if none exist
    if (!urlObj.searchParams.has('utm_source')) {
      urlObj.searchParams.set('utm_source', 'email');
    }
    if (!urlObj.searchParams.has('utm_campaign')) {
      urlObj.searchParams.set('utm_campaign', campaignId);
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
    new URL(url);
    return true;
  } catch {
    return false;
  }
}
