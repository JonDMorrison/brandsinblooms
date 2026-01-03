/**
 * Link Rewriter Utility for Email Campaigns (Edge Function version)
 * 
 * Extracts and rewrites links in HTML content for click tracking.
 * Guards against PII in URLs.
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
    
    // Skip mailto, tel, javascript, system links, etc.
    if (shouldSkipLink(href)) continue;

    // Only process http/https links
    if (!href.startsWith('http://') && !href.startsWith('https://')) continue;

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
  linkId: string,
  campaignId: string,
  recipientId: string,
  tenantId: string,
  customerEmail?: string
): string {
  const baseUrl = 'https://udldmkqwnxhdeztyqcau.supabase.co/functions/v1/redirect-click';
  const params = new URLSearchParams({
    cid: campaignId,
    lid: linkId,
    rid: recipientId,
    t: tenantId,
  });
  
  // Optionally include email for tracking (hashed by redirect-click)
  if (customerEmail) {
    params.set('e', customerEmail);
  }
  
  return `${baseUrl}?${params.toString()}`;
}

/**
 * Get unique URLs from extracted links
 */
export function getUniqueUrls(links: ExtractedLink[]): string[] {
  return [...new Set(links.map(l => l.href))];
}

/**
 * Rewrite links in HTML with tracking URLs
 * 
 * @param html - The HTML content
 * @param urlToLinkIdMap - Map of original URL -> link_id
 * @param campaignId - Campaign ID
 * @param recipientId - Recipient/customer ID
 * @param tenantId - Tenant ID
 * @param customerEmail - Customer email (optional)
 * @returns Rewritten HTML and metadata
 */
export function rewriteLinksSync(
  html: string,
  urlToLinkIdMap: Map<string, string>,
  campaignId: string,
  recipientId: string,
  tenantId: string,
  customerEmail?: string
): LinkRewriteResult {
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
      console.warn(`⚠️ PII detected in link, skipping: ${link.href.substring(0, 50)}...`);
      continue;
    }

    const linkId = urlToLinkIdMap.get(link.href);
    if (!linkId) {
      skippedLinks.push(link.href);
      continue;
    }

    const trackingUrl = buildTrackingUrl(linkId, campaignId, recipientId, tenantId, customerEmail);
    const newHref = `href="${trackingUrl}"`;
    
    rewrittenHtml = 
      rewrittenHtml.substring(0, link.startIndex) +
      newHref +
      rewrittenHtml.substring(link.endIndex);
    linksRewritten++;
  }

  return {
    html: rewrittenHtml,
    linksRewritten,
    piiWarnings,
    skippedLinks,
  };
}
