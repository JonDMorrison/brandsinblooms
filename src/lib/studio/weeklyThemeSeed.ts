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

/**
 * Button URL placeholder in theme template blocks: the seed swaps it for the
 * tenant's website, or drops the button when there is no website.
 */
export const WEEKLY_THEME_WEBSITE_URL = "{{website_url}}";

/**
 * Customer-facing copy for a theme week. Built only from the week's title,
 * theme and seasonal focus; the theme description / prompt / content ideas
 * are notes for the store (e.g. "Encourage documenting successes...") and
 * never reach the email.
 */
export function buildWeeklyThemeCopy(source: Pick<WeeklyThemeSource, "title" | "theme" | "seasonalFocus" | "weekNumber">) {
  const title = sanitizeCampaignTitle(source.title || source.theme || `Week ${source.weekNumber}`);
  const heading = sanitizeCampaignTitle(source.theme || source.title || title);
  const focus = source.seasonalFocus.replace(/\s+/g, " ").trim().replace(/[.!?]+$/, "");
  // The text block shows `title` as its heading (composeSectionBody), so the
  // body does not repeat it.
  const intro =
    "Here are our favourite ideas for the season, and the plants and supplies to go with them. " +
    "Drop by the store and our team will gladly help you get started.";
  const storyHeading = focus || "In the garden this week";
  const storyBody = focus
    ? `${focus} is on our minds this week. Bring your questions and your plans; we'll help you choose what fits your garden.`
    : "Bring your questions and your plans; we'll help you choose what fits your garden.";
  const preview = `${heading}: ideas and advice for your garden this week.`;
  return { title, heading, intro, storyHeading, storyBody, preview };
}

export function buildWeeklyThemeIdea(source: WeeklyThemeSource): NewsletterIdea {
  const copy = buildWeeklyThemeCopy(source);
  const [hero, story] = source.images;

  const templateBlocks: NewsletterIdeaTemplateBlock[] = [
    {
      type: "newsletter-header",
      title: copy.heading,
      tagline: source.seasonalFocus || "",
    },
  ];
  if (hero) {
    templateBlocks.push({
      type: "full-width-image",
      image_url: hero.url,
      altText: hero.alt || copy.heading,
    });
  }
  templateBlocks.push({ type: "text", title: copy.title, content: copy.intro });
  if (story) {
    templateBlocks.push({
      type: "image-text",
      title: copy.storyHeading,
      content: copy.storyBody,
      image_url: story.url,
      altText: story.alt || copy.heading,
      ctaText: "Visit our website",
      ctaUrl: WEEKLY_THEME_WEBSITE_URL,
    });
  }

  return {
    id: `weekly-theme-${source.weekNumber}`,
    title: copy.title,
    // Customer-facing: used as the draft's preview text.
    description: copy.preview,
    category: "weekly",
    badge: `Week ${source.weekNumber}`,
    weekNumber: source.weekNumber,
    themeCampaignId: source.themeCampaignId ?? undefined,
    templateBlocks,
    heroQuery: buildWeeklyThemeImageQuery(source),
    estimatedReadTime: "3 min",
  };
}
