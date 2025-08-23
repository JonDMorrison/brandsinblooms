import { useMemo } from 'react';
import { useGeneratedBundle } from '@/hooks/useGeneratedBundle';
import type { GeneratedBundle, GeneratedBundleItem } from '@/hooks/useGeneratedBundle';
import type { Channel } from '@/lib/content/libraryTypes';
import { sanitizeWeekNumbers } from '@/utils/weekNumberSanitizer';

function pickBestItem(items: GeneratedBundleItem[]): GeneratedBundleItem | null {
  if (!items || items.length === 0) return null;
  const order: Channel[] = ['newsletter', 'blog', 'instagram', 'facebook', 'video'];
  const byChannelPriority = [...items].sort(
    (a, b) => order.indexOf(a.channel as Channel) - order.indexOf(b.channel as Channel)
  );
  // Prefer with title
  const withTitle = byChannelPriority.find(i => i.title && i.title.trim().length > 0);
  if (withTitle) return withTitle;
  // Then with summary
  const withSummary = byChannelPriority.find(i => i.summary && i.summary.trim().length > 0);
  if (withSummary) return withSummary;
  // Otherwise first by priority
  return byChannelPriority[0] || null;
}

function firstSentence(text: string): string {
  if (!text) return '';
  const clean = text.replace(/\s+/g, ' ').trim();
  const match = clean.match(/([^.!?]+[.!?])/);
  return (match ? match[1] : clean).trim();
}

function withChannelTag(title: string, ch?: Channel): string {
  const map: Record<Channel, string> = {
    instagram: 'Instagram',
    facebook: 'Facebook',
    newsletter: 'Newsletter',
    video: 'Video',
    blog: 'Blog',
  };
  return ch ? `[${map[ch]}] ${title}` : title;
}

function truncate(s: string, max = 90): string {
  if (s.length <= max) return s;
  return s.slice(0, max - 1).trimEnd() + '…';
}

export function useBundlePreviewTitle(bundleId?: string, opts?: { includeChannelTag?: boolean; maxLength?: number }) {
  const { query } = useGeneratedBundle(bundleId);

  const derived = useMemo(() => {
    const content = query.data?.content as GeneratedBundle | undefined;
    if (!content) return { title: undefined as string | undefined };
    const item = pickBestItem(content.items || []);
    if (!item) return { title: undefined as string | undefined };

    let candidate = (item.title && item.title.trim())
      || (item.summary && item.summary.trim())
      || firstSentence(item.body || '');

    // Sanitize week numbers from the candidate title
    candidate = sanitizeWeekNumbers(candidate);

    // Guard against non-informative titles
    if (!candidate || /^untitled$/i.test(candidate)) return { title: undefined as string | undefined };

    const includeTag = opts?.includeChannelTag ?? true;
    const max = opts?.maxLength ?? 90;
    const finalTitle = includeTag ? withChannelTag(candidate, item.channel as Channel) : candidate;

    return { title: truncate(finalTitle, max) };
  }, [query.data, opts?.includeChannelTag, opts?.maxLength]);

  return { title: derived.title, isLoading: query.isLoading };
}
