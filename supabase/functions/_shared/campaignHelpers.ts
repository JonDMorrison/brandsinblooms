import { renderMergeTags, convertLegacyTags, createMergeTagDataFromCustomer, type MergeTagData } from "./mergeTagEngine.ts";
import { type CompanyProfileData, generateServerFooterHtml } from "./footerGenerator.ts";

export function serializeSupabaseError(err: any) {
  if (!err) return null;

  let safeJson: string | null = null;
  try {
    safeJson = JSON.stringify(err);
  } catch {
    safeJson = null;
  }

  const keys = (() => {
    try {
      return typeof err === 'object' && err ? Object.keys(err) : null;
    } catch {
      return null;
    }
  })();

  return {
    type: typeof err,
    isArray: Array.isArray(err),
    keys,
    asString: (() => {
      try {
        return String(err);
      } catch {
        return null;
      }
    })(),
    json: safeJson,
    name: err?.name,
    message: err?.message,
    code: err?.code,
    details: err?.details,
    hint: err?.hint,
    status: err?.status,
    statusCode: err?.statusCode,
  };
}

/**
 * Strip ALL existing footer HTML from content to prevent double footers.
 */
export function stripExistingFooter(html: string): string {
  let strippedHtml = html;

  const footerWrapperPattern = /<div[^>]*style="[^"]*margin-top:\s*40px[^"]*"[^>]*>[\s\S]*?<\/div>\s*<\/div>(?=\s*(<\/body>|<\/html>|<\/div>\s*<\/div>\s*$))/gi;
  if (footerWrapperPattern.test(strippedHtml)) {
    strippedHtml = strippedHtml.replace(footerWrapperPattern, '');
  }

  const unsubscribeFooterPattern = /<div[^>]*style="[^"]*background-color[^"]*"[^>]*>[\s\S]*?<div[^>]*style="[^"]*max-width:\s*640px[^"]*"[^>]*>[\s\S]*?[Uu]nsubscribe[\s\S]*?<\/div>\s*<\/div>(?=\s*(<\/body>|<\/html>|<\/div>\s*$))/gi;
  if (unsubscribeFooterPattern.test(strippedHtml)) {
    strippedHtml = strippedHtml.replace(unsubscribeFooterPattern, '');
  }

  const socialIconsFooterPattern = /<div[^>]*style="[^"]*background-color[^"]*"[^>]*>[\s\S]*?social-icons[\s\S]*?<\/div>\s*<\/div>(?=\s*(<\/body>|<\/html>|<\/div>\s*$))/gi;
  if (socialIconsFooterPattern.test(strippedHtml)) {
    strippedHtml = strippedHtml.replace(socialIconsFooterPattern, '');
  }

  const legacyGreenFooterPattern = /<div[^>]*style="[^"]*background-color:\s*#283024[^"]*"[^>]*>[\s\S]*?<\/div>\s*<\/div>(?=\s*(<\/body>|<\/html>|<\/div>\s*$))/gi;
  if (legacyGreenFooterPattern.test(strippedHtml)) {
    strippedHtml = strippedHtml.replace(legacyGreenFooterPattern, '');
  }

  const finalCleanupPattern = /<div[^>]*style="[^"]*background-color[^"]*width:\s*100%[^"]*"[^>]*>[\s\S]*?[Uu]nsubscribe[\s\S]*?<\/div>\s*<\/div>(?=\s*(<\/div>)*\s*(<\/body>|<\/html>|$))/gi;
  strippedHtml = strippedHtml.replace(finalCleanupPattern, '');

  return strippedHtml;
}

/**
 * Build email payload for a single customer (OPTIMIZED - uses pre-generated footer)
 */
export function buildEmailPayloadOptimized(
  customer: any,
  campaign: any,
  companyProfile: any,
  profileData: CompanyProfileData,
  fromAddress: string,
  senderEmail: string,
  usesVerifiedDomain: boolean,
  activeDomainId: string | null,
  sharedFooterTemplate: string,
  replyToEmail?: string
): any {
  const companyName = companyProfile?.company_name || 'Your Garden Center';

  const unsubscribeToken = btoa(`${customer.email}:${campaign.tenant_id}`);
  const unsubscribeLink = `https://udldmkqwnxhdeztyqcau.supabase.co/functions/v1/handle-unsubscribe?email=${encodeURIComponent(customer.email)}&tenant_id=${campaign.tenant_id}&token=${unsubscribeToken}`;
  const preferencesLink = unsubscribeLink.replace('handle-unsubscribe', 'manage-preferences');

  const customerFooter = sharedFooterTemplate
    .replace(/\{\{UNSUBSCRIBE_URL\}\}/g, unsubscribeLink)
    .replace(/\{\{PREFERENCES_URL\}\}/g, preferencesLink);

  const mergeTagData: MergeTagData = createMergeTagDataFromCustomer(customer, {
    company_name: companyName,
    address: companyProfile?.location_info,
    website_url: companyProfile?.custom_sender_email?.split('@')[1]
  });

  mergeTagData.system = {
    unsubscribe_url: unsubscribeLink,
    preferences_url: preferencesLink,
    current_year: new Date().getFullYear().toString(),
    current_date: new Date().toLocaleDateString()
  };

  let emailContent = convertLegacyTags(campaign.content || '');
  let emailSubject = convertLegacyTags(campaign.subject_line || 'Newsletter from your Garden Center');

  emailContent = renderMergeTags(emailContent, mergeTagData);
  emailSubject = renderMergeTags(emailSubject, mergeTagData);

  emailContent = stripExistingFooter(emailContent);

  if (emailContent.includes('</body>')) {
    emailContent = emailContent.replace('</body>', `${customerFooter}</body>`);
  } else if (emailContent.includes('</html>')) {
    emailContent = emailContent.replace('</html>', `${customerFooter}</html>`);
  } else {
    emailContent += customerFooter;
  }

  const emailPayload: any = {
    from: fromAddress,
    to: [customer.email],
    subject: emailSubject,
    html: emailContent,
    headers: {
      'X-Campaign-ID': campaign.id,
      'X-Campaign-Type': 'bulk',
      'X-Tenant-ID': campaign.tenant_id,
      'X-Domain-ID': activeDomainId || 'fallback'
    },
    tags: [
      { name: 'campaign_id', value: campaign.id },
      { name: 'type', value: 'bulk' },
      { name: 'tenant_id', value: campaign.tenant_id }
    ]
  };

  if (replyToEmail) {
    emailPayload.reply_to = replyToEmail;
  } else if (usesVerifiedDomain && senderEmail !== 'noreply@bloomsuite.app') {
    emailPayload.reply_to = senderEmail;
  }

  return emailPayload;
}

/**
 * Process a batch inline (for small campaigns or immediate processing)
 */
export async function processInline(
  resend: any,
  emailPayloads: any[],
  supabase: any,
  campaignId: string,
  activeDomainId: string | null,
  warmupStage: number,
  dailyLimit: number
): Promise<{ sent: number; failed: number }> {
  const BATCH_SIZE = 100;
  let emailsSent = 0;
  let failed = 0;

  for (let i = 0; i < emailPayloads.length; i += BATCH_SIZE) {
    const batch = emailPayloads.slice(i, i + BATCH_SIZE);

    try {
      const batchResponse = await resend.batch.send(batch);

      if (batchResponse?.data) {
        const successCount = Array.isArray(batchResponse.data)
          ? batchResponse.data.filter((r: any) => r?.id).length
          : 1;
        emailsSent += successCount;
      } else if (batchResponse?.error) {
        failed += batch.length;
        console.error(`Batch failed:`, batchResponse.error);
      }
    } catch (batchError: any) {
      console.warn(`Batch failed, trying individual sends:`, batchError.message);

      for (const payload of batch) {
        try {
          const singleResponse = await resend.emails.send(payload);
          if (singleResponse?.id) {
            emailsSent++;
          } else {
            failed++;
          }
        } catch {
          failed++;
        }
      }
    }
  }

  return { sent: emailsSent, failed };
}

export function isEngagementBasedSuppression(reason?: string | null): boolean {
  if (!reason) return false;
  const lower = reason.toLowerCase();
  return (
    lower.includes('no email opens') ||
    lower.includes('inactivity') ||
    lower.includes('engagement') ||
    lower.includes('180 days')
  );
}

export function isUuidLike(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}
