/**
 * Link Tracking Utility
 * 
 * Rewrites links in email HTML for click tracking.
 * This should be called AFTER merge tag rendering but BEFORE sending.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Tracking base URL - adjust based on your Supabase project
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || 'https://udldmkqwnxhdeztyqcau.supabase.co';
const TRACKING_BASE_URL = `${SUPABASE_URL}/functions/v1/track-email-click`;

export interface LinkTrackingParams {
  tenantId: string;
  campaignId?: string;
  automationId?: string;
  automationNodeId?: string;
  customerId?: string;
  messageId?: string;
  html: string;
}

export interface LinkTrackingResult {
  html: string;
  linkCount: number;
  trackedUrls: string[];
}

/**
 * Generate a secure random token for link tracking
 */
function generateToken(): string {
  const array = new Uint8Array(24);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Check if a URL should be tracked
 */
function shouldTrackUrl(url: string): boolean {
  if (!url) return false;
  
  const trimmedUrl = url.trim().toLowerCase();
  
  // Skip these URL schemes
  if (trimmedUrl.startsWith('mailto:')) return false;
  if (trimmedUrl.startsWith('tel:')) return false;
  if (trimmedUrl.startsWith('sms:')) return false;
  if (trimmedUrl.startsWith('#')) return false;
  if (trimmedUrl.startsWith('javascript:')) return false;
  
  // Skip already-tracked links
  if (trimmedUrl.includes('/track-email-click')) return false;
  if (trimmedUrl.includes('token=')) return false;
  
  // Skip unsubscribe/preferences links (these have their own tracking)
  if (trimmedUrl.includes('handle-unsubscribe')) return false;
  if (trimmedUrl.includes('manage-preferences')) return false;
  
  // Skip empty or placeholder URLs
  if (trimmedUrl === '' || trimmedUrl === '#') return false;
  if (trimmedUrl.includes('{{') || trimmedUrl.includes('}}')) return false; // Unrendered merge tags
  
  return true;
}

/**
 * Extract href URLs from HTML and their positions
 */
function extractLinks(html: string): Array<{ fullMatch: string; url: string; startIndex: number }> {
  const links: Array<{ fullMatch: string; url: string; startIndex: number }> = [];
  
  // Match href="..." or href='...'
  const hrefRegex = /href=["']([^"']+)["']/gi;
  let match;
  
  while ((match = hrefRegex.exec(html)) !== null) {
    links.push({
      fullMatch: match[0],
      url: match[1],
      startIndex: match.index
    });
  }
  
  return links;
}

/**
 * Rewrite links in HTML for tracking
 * 
 * This function:
 * 1. Finds all trackable links in the HTML
 * 2. Creates tracking records in the database
 * 3. Replaces original URLs with tracking URLs
 */
export async function rewriteLinksForTracking(
  params: LinkTrackingParams
): Promise<LinkTrackingResult> {
  const { tenantId, campaignId, automationId, automationNodeId, customerId, messageId, html } = params;
  
  console.log(`[linkTracking] Starting link rewrite for tenant=${tenantId}, campaign=${campaignId || 'none'}`);
  
  // Create service role client for inserting tracking records
  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );
  
  // Extract all links
  const links = extractLinks(html);
  const trackableLinks = links.filter(link => shouldTrackUrl(link.url));
  
  console.log(`[linkTracking] Found ${links.length} total links, ${trackableLinks.length} trackable`);
  
  if (trackableLinks.length === 0) {
    return { html, linkCount: 0, trackedUrls: [] };
  }
  
  // Group by unique URLs to avoid duplicates
  const uniqueUrls = [...new Set(trackableLinks.map(l => l.url))];
  const urlToToken = new Map<string, string>();
  const trackedUrls: string[] = [];
  
  // Create tracking records for each unique URL
  for (const url of uniqueUrls) {
    const token = generateToken();
    
    const { error } = await supabaseAdmin
      .from('email_tracked_links')
      .insert({
        tenant_id: tenantId,
        campaign_id: campaignId || null,
        automation_id: automationId || null,
        automation_node_id: automationNodeId || null,
        customer_id: customerId || null,
        message_id: messageId || null,
        original_url: url,
        token
      });
    
    if (error) {
      console.error(`[linkTracking] Failed to create tracking record for ${url}:`, error);
      continue;
    }
    
    urlToToken.set(url, token);
    trackedUrls.push(url);
  }
  
  // Replace URLs in HTML
  let rewrittenHtml = html;
  
  // Sort links by position descending to avoid index shifting
  const sortedLinks = [...trackableLinks].sort((a, b) => b.startIndex - a.startIndex);
  
  for (const link of sortedLinks) {
    const token = urlToToken.get(link.url);
    if (!token) continue;
    
    const trackingUrl = `${TRACKING_BASE_URL}?t=${token}`;
    const newHref = `href="${trackingUrl}"`;
    
    rewrittenHtml = 
      rewrittenHtml.slice(0, link.startIndex) + 
      newHref + 
      rewrittenHtml.slice(link.startIndex + link.fullMatch.length);
  }
  
  console.log(`[linkTracking] Rewrote ${trackedUrls.length} unique URLs`);
  
  return {
    html: rewrittenHtml,
    linkCount: trackedUrls.length,
    trackedUrls
  };
}

/**
 * Get click statistics for a campaign
 */
export async function getCampaignClickStats(
  supabase: ReturnType<typeof createClient>,
  campaignId: string
): Promise<{
  totalClicks: number;
  uniqueClicks: number;
  topLinks: Array<{ url: string; clicks: number }>;
}> {
  // Get all tracked links for this campaign
  const { data: links, error: linksError } = await supabase
    .from('email_tracked_links')
    .select('id, original_url')
    .eq('campaign_id', campaignId);
  
  if (linksError || !links?.length) {
    return { totalClicks: 0, uniqueClicks: 0, topLinks: [] };
  }
  
  const linkIds = links.map(l => l.id);
  
  // Get click events
  const { data: clicks, error: clicksError } = await supabase
    .from('email_click_events')
    .select('id, tracked_link_id, customer_id')
    .in('tracked_link_id', linkIds);
  
  if (clicksError || !clicks) {
    return { totalClicks: 0, uniqueClicks: 0, topLinks: [] };
  }
  
  // Calculate stats
  const totalClicks = clicks.length;
  
  // Unique clicks = distinct (customer_id, tracked_link_id) pairs
  const uniquePairs = new Set(clicks.map(c => `${c.customer_id || 'anon'}-${c.tracked_link_id}`));
  const uniqueClicks = uniquePairs.size;
  
  // Top links by click count
  const clicksByLink = new Map<string, number>();
  for (const click of clicks) {
    const link = links.find(l => l.id === click.tracked_link_id);
    if (link) {
      clicksByLink.set(link.original_url, (clicksByLink.get(link.original_url) || 0) + 1);
    }
  }
  
  const topLinks = Array.from(clicksByLink.entries())
    .map(([url, clicks]) => ({ url, clicks }))
    .sort((a, b) => b.clicks - a.clicks)
    .slice(0, 10);
  
  return { totalClicks, uniqueClicks, topLinks };
}
