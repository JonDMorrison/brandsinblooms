/**
 * SMS Link Wrapping Utility
 * 
 * Wraps URLs in SMS content for click tracking
 */

export interface TrackingRecord {
  trackingCode: string;
  originalUrl: string;
  messageId?: string;
  customerId?: string;
  campaignId?: string;
  phone: string;
  tenantId: string;
}

/**
 * Generate a unique tracking code
 */
function generateTrackingCode(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Extract URLs from text content
 */
function extractUrls(text: string): string[] {
  // Match URLs starting with http:// or https://
  const urlRegex = /https?:\/\/[^\s<>"{}|\\^`\[\]]+/gi;
  return text.match(urlRegex) || [];
}

/**
 * Wrap URLs in SMS content with tracking URLs
 */
export function wrapLinksForTracking(
  content: string,
  baseRedirectUrl: string,
  context: {
    messageId?: string;
    customerId?: string;
    campaignId?: string;
    phone: string;
    tenantId: string;
  }
): { wrappedContent: string; trackingRecords: TrackingRecord[] } {
  const urls = extractUrls(content);
  const trackingRecords: TrackingRecord[] = [];
  let wrappedContent = content;

  for (const originalUrl of urls) {
    const trackingCode = generateTrackingCode();
    const trackingUrl = `${baseRedirectUrl}/${trackingCode}`;

    // Replace the URL in content
    wrappedContent = wrappedContent.replace(originalUrl, trackingUrl);

    // Add to tracking records
    trackingRecords.push({
      trackingCode,
      originalUrl,
      messageId: context.messageId,
      customerId: context.customerId,
      campaignId: context.campaignId,
      phone: context.phone,
      tenantId: context.tenantId,
    });
  }

  return { wrappedContent, trackingRecords };
}

/**
 * Store tracking records in the database
 */
export async function storeTrackingRecords(
  supabase: any,
  records: TrackingRecord[]
): Promise<boolean> {
  if (records.length === 0) return true;

  const insertData = records.map(record => ({
    tenant_id: record.tenantId,
    customer_id: record.customerId || null,
    message_id: record.messageId || null,
    campaign_id: record.campaignId || null,
    phone: record.phone,
    original_url: record.originalUrl,
    tracking_code: record.trackingCode,
  }));

  const { error } = await supabase
    .from('sms_link_clicks')
    .insert(insertData);

  if (error) {
    console.error('[smsLinkWrapper] Error storing tracking records:', error);
    return false;
  }

  return true;
}
