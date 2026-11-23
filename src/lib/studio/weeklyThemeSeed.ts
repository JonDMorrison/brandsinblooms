import type {
  NewsletterIdea,
  NewsletterIdeaTemplateBlock,
} from "@/types/newsletter";
import { sanitizeCampaignTitle } from "@/utils/weekNumberSanitizer";

/** One image attached to a weekly theme (campaigns / master_campaign_templates.theme_images). */
export interface WeeklyThemeImage {
  url: string;
  alt: string;
  credit: string;
}

/** A tenant's weekly theme, merged from its campaigns row and the master week. */
export interface WeeklyThemeSource {
  weekNumber: number;
  /** public.campaigns.id for the tenant's row, when one exists. */
  themeCampaignId: string | null;
  title: string;
  theme: string;
  description: string;
  seasonalFocus: string;
  images: WeeklyThemeImage[];
}

export function toWeeklyThemeImages(value: unknown): WeeklyThemeImage[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const record = entry as Record<string, unknown>;
    const url = typeof record.url === "string" ? record.url.trim() : "";
    if (!/^https:\/\//i.test(url)) return [];
    return [
      {
        url,
        alt: typeof record.alt === "string" ? record.alt : "",
        credit: typeof record.credit === "string" ? record.credit : "",
      },
    ];
  });
}

/** Search words for theme photos, e.g. "spring bulb planting garden". */
export function buildWeeklyThemeImageQuery(source: Pick<WeeklyThemeSource, "theme" | "title">) {
  const words = sanitizeCampaignTitle(source.theme || source.title || "seasonal garden")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 2 && !["your", "the", "and", "for", "with", "week"].includes(word))
    .slice(0, 4);
  return [...words, "garden"].join(" ");
}

function firstSentence(text: string) {
  const trimmed = text.replace(/\s+/g, " ").trim();
  const match = trimmed.match(/^(.{20,200}?[.!?])\s/);
  return match ? match[1] : trimmed.slice(0, 200);
}

/** Splits "idea one • idea two" (how weekly content ideas are stored) into items. */
function splitIdeas(text: string) {
  return text
    .split(/\s*(?:•|\n|;)\s*/)
    .map((item) => item.trim())
    .filter(Boolean);
}

/**
 * The newsletter idea a weekly theme seeds: a header, the theme photo, the
 * week's content ideas, and an image story for the seasonal focus. Blocks
 * without an image are left out rather than shown as empty placeholders.
 */
export function buildWeeklyThemeIdea(source: WeeklyThemeSource): NewsletterIdea {
  const title = sanitizeCampaignTitle(source.title || source.theme || `Week ${source.weekNumber}`);
  const headline = sanitizeCampaignTitle(source.theme || source.title || title);
  const ideas = splitIdeas(source.description);
  const intro = ideas.length > 1
    ? ideas.map((idea) => `• ${idea}`).join("\n")
    : source.description || `Here's what's happening in the garden this week.`;
  const [hero, story, extra] = source.images;

  const templateBlocks: NewsletterIdeaTemplateBlock[] = [
    {
      type: "newsletter-header",
      title: headline,
      tagline: source.seasonalFocus || firstSentence(source.description),
    },
  ];
  if (hero) {
    templateBlocks.push({
      type: "full-width-image",
      image_url: hero.url,
      altText: hero.alt || headline,
    });
  }
  templateBlocks.push({ type: "text", content: intro });
  if (story) {
    templateBlocks.push({
      type: "image-text",
      title: source.seasonalFocus ? "In the garden this week" : headline,
      content: source.seasonalFocus || firstSentence(source.description),
      image_url: story.url,
      altText: story.alt || headline,
    });
  }
  if (extra && ideas.length > 1) {
    templateBlocks.push({
      type: "image-text",
      title: sanitizeCampaignTitle(ideas[1]).slice(0, 80),
      content: ideas.slice(2).join(". ") || firstSentence(source.description),
      image_url: extra.url,
      altText: extra.alt || headline,
    });
  }

  return {
    id: `weekly-theme-${source.weekNumber}`,
    title,
    description: source.description || source.seasonalFocus || title,
    category: "weekly",
    badge: `Week ${source.weekNumber}`,
    weekNumber: source.weekNumber,
    themeCampaignId: source.themeCampaignId ?? undefined,
    templateBlocks,
    heroQuery: buildWeeklyThemeImageQuery(source),
    estimatedReadTime: "3 min",
  };
}
