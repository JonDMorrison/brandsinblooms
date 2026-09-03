/**
 * SMS link tracking utilities.
 *
 * Tracking rows are registered through a service-only RPC immediately before
 * provider delivery. Retried messages reuse the rows already registered for
 * their message ID, so a retry never changes a recipient's links.
 */

export interface SmsTrackingLink {
  link_index: number;
  original_url: string;
  tracking_code: string;
}

interface SmsTrackingRegistration {
  link_index: number;
  original_url: string;
  tracking_code: string;
}

interface SmsMessageTrackingContext {
  messageId: string;
}

interface SupabaseRpcClient {
  rpc(
    functionName: string,
    args: Record<string, unknown>,
  ): Promise<{ data: unknown; error: { message?: string } | null }>;
}

const URL_PATTERN = /https?:\/\/[^\s<>"{}|\\^\x60\x5b\x5d]+/gi;
const TRAILING_PUNCTUATION = /[.,!?;:]+$/;

function trimTrailingPunctuation(url: string): string {
  return url.replace(TRAILING_PUNCTUATION, '');
}

/** Extract unique, trackable HTTP(S) links in first-seen order. */
export function extractTrackableUrls(content: string): string[] {
  const matches = content.match(URL_PATTERN) || [];
  const unique = new Set<string>();

  for (const match of matches) {
    const candidate = trimTrailingPunctuation(match);
    try {
      const parsed = new URL(candidate);
      if ((parsed.protocol === 'http:' || parsed.protocol === 'https:') && candidate.length <= 4096) {
        unique.add(candidate);
      }
    } catch {
      // Invalid URLs stay untouched in the recipient's message.
    }
  }

  return Array.from(unique).slice(0, 20);
}

/** Generate a cryptographically secure, URL-safe 128-bit tracking code. */
export function generateTrackingCode(): string {
  return crypto.randomUUID().replaceAll('-', '');
}

export function replaceLinksWithTrackingUrls(
  content: string,
  baseRedirectUrl: string,
  links: SmsTrackingLink[],
): string {
  const base = baseRedirectUrl.replace(/\/+$/, '');

  // Replace longer URLs first so a URL that prefixes another cannot corrupt it.
  return [...links]
    .sort((a, b) => b.original_url.length - a.original_url.length)
    .reduce(
      (rewritten, link) => rewritten.split(link.original_url).join(`${base}/${link.tracking_code}`),
      content,
    );
}

/**
 * Register and apply canonical tracking links for one queued SMS message.
 * The database owns idempotency through (message_id, link_index).
 */
export async function prepareSmsContentForDelivery(
  supabase: SupabaseRpcClient,
  content: string,
  baseRedirectUrl: string,
  context: SmsMessageTrackingContext,
): Promise<{ content: string; links: SmsTrackingLink[] }> {
  const urls = extractTrackableUrls(content);
  if (urls.length === 0) return { content, links: [] };

  const registrations: SmsTrackingRegistration[] = urls.map((originalUrl, linkIndex) => ({
    link_index: linkIndex,
    original_url: originalUrl,
    tracking_code: generateTrackingCode(),
  }));

  const { data, error } = await supabase.rpc('register_sms_tracking_links', {
    p_message_id: context.messageId,
    p_links: registrations,
  });

  if (error) {
    throw Object.assign(new Error(`SMS link tracking registration failed: ${error.message || 'unknown error'}`), {
      code: '54001',
    });
  }

  const canonicalLinks = Array.isArray(data) ? data as SmsTrackingLink[] : [];
  const linksByIndex = new Map(canonicalLinks.map(link => [Number(link.link_index), link]));
  const complete = registrations.every((registration) => {
    const stored = linksByIndex.get(registration.link_index);
    return stored?.original_url === registration.original_url && /^[a-f0-9]{32}$/.test(stored.tracking_code);
  });

  if (!complete) {
    throw Object.assign(new Error('SMS link tracking registration returned an incomplete mapping'), {
      code: '54001',
    });
  }

  return {
    content: replaceLinksWithTrackingUrls(content, baseRedirectUrl, canonicalLinks),
    links: canonicalLinks,
  };
}
