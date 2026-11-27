import {
  BOTANICAL_TEMPLATES,
  buildBotanicalEditorial,
} from "./botanicalEditorial.ts";
import { createStudioBlock } from "@/lib/studio/blockFactory";
import type { StudioDesignSystem } from "@/lib/studio/designSystem";
import type { StudioBlock } from "@/types/studioBlocks";

export type CampaignTemplateSeason =
  "spring" | "summer" | "autumn" | "winter" | "evergreen";

export type CampaignTemplateCategory = "newsletter" | "promo";

export type CampaignTemplateFilter = "all" | CampaignTemplateCategory;

const NEWSLETTER_TAG_KEYWORDS = [
  "editorial",
  "newsletter",
  "retention",
  "announcement",
];

const PROMO_TAG_KEYWORDS = ["sale", "launch", "drop", "event"];

function matchesAnyKeyword(tags: string[], keywords: readonly string[]) {
  return tags.some((tag) =>
    keywords.some((keyword) => tag.toLowerCase().includes(keyword)),
  );
}

export function isNewsletterTemplate(template: { tags: string[] }) {
  return matchesAnyKeyword(template.tags, NEWSLETTER_TAG_KEYWORDS);
}

export function isPromoTemplate(template: { tags: string[] }) {
  return matchesAnyKeyword(template.tags, PROMO_TAG_KEYWORDS);
}

export function templateMatchesFilter(
  template: { tags: string[] },
  filter: CampaignTemplateFilter,
) {
  if (filter === "all") {
    return true;
  }
  if (filter === "newsletter") {
    return isNewsletterTemplate(template);
  }
  return isPromoTemplate(template);
}

export type CampaignTemplateThumbnailBlock = {
  kind:
    | "eyebrow"
    | "newsletter-header"
    | "hero"
    | "text"
    | "image-text"
    | "product-gallery"
    | "quote"
    | "cta"
    | "divider"
    | "social-follow"
    | "footer";
  width?: string;
  height?: number;
};

export type CampaignTemplate = {
  id: string;
  name: string;
  summary: string;
  season: CampaignTemplateSeason;
  tags: string[];
  accentColor: string;
  subjectLine: string;
  previewText: string;
  /** Short, human-readable description shown beneath the picker preview. */
  formatLabel?: string;
  thumbnailBlocks: CampaignTemplateThumbnailBlock[];
  buildBlocks: (designSystem?: StudioDesignSystem | null) => StudioBlock[];
};

type TemplateBlockOptions = {
  headline?: string;
  subheading?: string;
  body?: string;
  tagLabel?: string;
  buttonText?: string;
  buttonUrl?: string;
  backgroundColor?: string;
  textColor?: string;
  accentColor?: string;
  layout?: string;
};

/**
 * Accent stored on the templates the campaign editor builds on the fly
 * (blank, saved and weekly-theme designs). It is email template data.
 */
export const EDITOR_TEMPLATE_ACCENT_COLOR = "#1F4341";

const TEMPLATE_PAPER = "#fbfaf6";
const TEMPLATE_CREAM = "#f6f2e8";

export function applyCampaignTemplateDesignDefaults(blocks: StudioBlock[]) {
  let splitBlockIndex = 0;

  return blocks.map((block, index) => {
    const isSplitBlock = [
      "image-text",
      "event",
      "blog",
      "announcement",
    ].includes(block.type);
    const imageSide: "left" | "right" =
      splitBlockIndex % 2 === 0 ? "left" : "right";
    if (isSplitBlock) splitBlockIndex += 1;

    const rhythmicBlock = isSplitBlock
      ? {
          ...block,
          imagePosition: imageSide,
          layout:
            block.type === "image-text" ? `image-${imageSide}` : block.layout,
          backgroundColor:
            block.backgroundColor ||
            (splitBlockIndex % 2 === 0 ? TEMPLATE_CREAM : "#ffffff"),
        }
      : block;

    if (rhythmicBlock.type === "footer") {
      return {
        ...rhythmicBlock,
        newsletterSettings: {
          version: 1,
          width: 640,
          blockGap: 12,
          backgroundColor: "#ece8de",
          contentBackgroundColor: TEMPLATE_PAPER,
          ...rhythmicBlock.newsletterSettings,
        },
        order: index,
        visible: rhythmicBlock.visible !== false,
      };
    }

    return {
      ...rhythmicBlock,
      order: index,
      visible: rhythmicBlock.visible !== false,
    };
  });
}

function finalizeBlocks(blocks: StudioBlock[]) {
  return applyCampaignTemplateDesignDefaults(blocks);
}

function getPrimaryColor(
  designSystem: StudioDesignSystem | null | undefined,
  fallback: string,
) {
  return designSystem?.colors.primary || fallback;
}

function getTextColor(
  designSystem: StudioDesignSystem | null | undefined,
  fallback: string,
) {
  return designSystem?.colors.text || fallback;
}

function getWebsiteUrl(
  designSystem: StudioDesignSystem | null | undefined,
  fallback: string,
) {
  return designSystem?.company.websiteUrl || fallback;
}

function createHeader(
  designSystem: StudioDesignSystem | null | undefined,
  options: Pick<
    TemplateBlockOptions,
    "headline" | "tagLabel" | "backgroundColor" | "textColor"
  >,
) {
  const block = createStudioBlock("newsletter-header", designSystem);

  return {
    ...block,
    headline: options.headline,
    tagLabel: options.tagLabel,
    backgroundColor: options.backgroundColor || "#f7f7f5",
    textColor: options.textColor || "#171717",
    showDividerBelow: true,
    dividerBelowColor: "rgba(23, 23, 23, 0.12)",
  } satisfies StudioBlock;
}

function createHero(
  designSystem: StudioDesignSystem | null | undefined,
  options: TemplateBlockOptions,
) {
  const primaryColor = getPrimaryColor(
    designSystem,
    options.accentColor || "#27272a",
  );
  const block = createStudioBlock("email-safe-hero", designSystem);

  return {
    ...block,
    headline: options.headline,
    subheading: options.subheading,
    body: options.body,
    tagLabel: options.tagLabel,
    backgroundColor: options.backgroundColor || "#171717",
    textColor: options.textColor || "#fafafa",
    buttonText: options.buttonText || "Learn more",
    buttonUrl: options.buttonUrl || getWebsiteUrl(designSystem, "#preview"),
    buttonColor: "#fffaf1",
    // Dark text on the cream button. Brand green on cream was hard to read.
    buttonTextColor: "#1f2f2b",
    useBrandButtonColor: false,
    heroStyle: "solid",
    textAlign: "left",
    layoutPreset: "hero-dark-center",
  } satisfies StudioBlock;
}

function createText(
  designSystem: StudioDesignSystem | null | undefined,
  options: TemplateBlockOptions,
) {
  const block = createStudioBlock("plain-text", designSystem);

  return {
    ...block,
    body: options.body,
    backgroundColor: options.backgroundColor || TEMPLATE_PAPER,
    textColor: options.textColor || getTextColor(designSystem, "#27272a"),
    accentColor: options.accentColor || "#52525b",
    layout: options.layout || "side-accent",
    contentPadding: 30,
  } satisfies StudioBlock;
}

function createQuote(
  designSystem: StudioDesignSystem | null | undefined,
  options: TemplateBlockOptions & {
    authorName: string;
    authorTitle: string;
  },
) {
  const block = createStudioBlock("quote", designSystem);

  return {
    ...block,
    quoteText: options.body,
    authorName: options.authorName,
    authorTitle: options.authorTitle,
    backgroundColor: options.backgroundColor || TEMPLATE_CREAM,
    textColor: options.textColor || getTextColor(designSystem, "#18181b"),
    accentColor: options.accentColor || "#52525b",
    layout: options.layout || "classic",
    contentPadding: 32,
  } satisfies StudioBlock;
}

function createImageText(
  designSystem: StudioDesignSystem | null | undefined,
  options: TemplateBlockOptions & { imagePosition?: "left" | "right" },
) {
  const block = createStudioBlock("image-text", designSystem);
  const primaryColor = getPrimaryColor(
    designSystem,
    options.accentColor || "#315a46",
  );

  return {
    ...block,
    headline: options.headline,
    subheading: options.subheading,
    body: options.body,
    imagePosition: options.imagePosition || "left",
    layout: `image-${options.imagePosition || "left"}`,
    backgroundColor: options.backgroundColor || TEMPLATE_PAPER,
    textColor: options.textColor || getTextColor(designSystem, "#27272a"),
    buttonText: options.buttonText || "Read the story",
    buttonUrl: options.buttonUrl || getWebsiteUrl(designSystem, "#story"),
    buttonColor: primaryColor,
    buttonTextColor: designSystem?.colors.primaryContrastText || "#ffffff",
    contentPadding: 28,
    columnSplit: "50/50",
    borderRadius: 12,
  } satisfies StudioBlock;
}

function createCta(
  designSystem: StudioDesignSystem | null | undefined,
  options: TemplateBlockOptions,
) {
  const primaryColor = getPrimaryColor(
    designSystem,
    options.accentColor || "#18181b",
  );
  const block = createStudioBlock("call-to-action", designSystem);

  return {
    ...block,
    headline: options.headline,
    body: options.body,
    buttonText: options.buttonText || "Learn more",
    buttonUrl: options.buttonUrl || getWebsiteUrl(designSystem, "#collection"),
    backgroundColor: primaryColor,
    textColor: designSystem?.colors.primaryContrastText || "#ffffff",
    buttonColor: "#fffaf1",
    buttonTextColor: primaryColor,
    useBrandButtonColor: false,
    layout: options.layout || "centered-hero",
    layoutPreset: options.layout ? undefined : "cta-centered-hero",
    verticalPadding: 36,
  } satisfies StudioBlock;
}

function createDivider(
  designSystem: StudioDesignSystem | null | undefined,
  accentColor: string,
) {
  const block = createStudioBlock("divider", designSystem);

  return {
    ...block,
    lineColor: "rgba(23, 23, 23, 0.14)",
    ornamentColor: accentColor,
    lineWidth: 92,
    paddingTop: 12,
    paddingBottom: 12,
    layout: "ornamental",
  } satisfies StudioBlock;
}

function createFooter(designSystem: StudioDesignSystem | null | undefined) {
  const block = createStudioBlock("footer", designSystem);

  return {
    ...block,
    showSocialInFooter: Boolean(designSystem?.social.hasConfiguredLinks),
  } satisfies StudioBlock;
}

function buildEditorialTemplate(
  designSystem: StudioDesignSystem | null | undefined,
  config: {
    heading: string;
    summary: string;
    quote: string;
    authorName: string;
    authorTitle: string;
    ctaLabel: string;
    ctaBody: string;
    accentColor: string;
    surfaceColor: string;
    heroColor: string;
    fallbackUrl: string;
  },
) {
  return finalizeBlocks([
    createHeader(designSystem, {
      headline: designSystem?.company.name || "Seasonal Notes",
      tagLabel: "Newsletter",
      backgroundColor: config.surfaceColor,
      textColor: "#18181b",
    }),
    createHero(designSystem, {
      headline: config.heading,
      subheading: config.summary,
      body: "Click this banner to change the words. Tell customers what is new this week.",
      tagLabel: "This week at the garden centre",
      backgroundColor: config.heroColor,
      textColor: "#fafafa",
      accentColor: config.accentColor,
      buttonText: "See what is new",
      buttonUrl: getWebsiteUrl(designSystem, config.fallbackUrl),
    }),
    createText(designSystem, {
      body: "Hello {{ first_name }},<br /><br />Write a short, friendly note here. Tell customers what is fresh in store, what is on sale, or what to plant this month.",
      backgroundColor: TEMPLATE_PAPER,
      textColor: "#27272a",
      accentColor: config.accentColor,
    }),
    createQuote(designSystem, {
      body: config.quote,
      authorName: config.authorName,
      authorTitle: config.authorTitle,
      accentColor: config.accentColor,
      backgroundColor: config.surfaceColor || TEMPLATE_CREAM,
      textColor: "#18181b",
    }),
    createDivider(designSystem, config.accentColor),
    createCta(designSystem, {
      headline: config.ctaLabel,
      body: config.ctaBody,
      buttonText: "Learn more",
      buttonUrl: getWebsiteUrl(designSystem, config.fallbackUrl),
      accentColor: config.accentColor,
      backgroundColor: config.surfaceColor,
      textColor: "#18181b",
    }),
    createFooter(designSystem),
  ]);
}

export const CAMPAIGN_TEMPLATES: CampaignTemplate[] = [
  ...BOTANICAL_TEMPLATES.map((template): CampaignTemplate => ({
    id: template.id,
    name: template.name,
    summary:
      "A photographic opening, readable text panel, clear details and generous imagery. Add your own photos and copy.",
    season: "evergreen",
    tags: [...template.tags],
    accentColor: "#243c32",
    subjectLine: "",
    previewText: "",
    thumbnailBlocks: [
      { kind: "newsletter-header" },
      { kind: "hero", height: 64 },
      { kind: "text" },
      { kind: "cta" },
      { kind: "product-gallery", height: 40 },
      { kind: "footer" },
    ],
    buildBlocks: (designSystem) =>
      buildBotanicalEditorial(template.id, designSystem),
  })),
  {
    id: "evergreen-seasonal-showcase",
    name: "Seasonal Showcase",
    summary:
      "Image-led magazine layout for seasonal stories, services, and featured products.",
    season: "evergreen",
    tags: ["newsletter", "showcase", "seasonal stories"],
    accentColor: "#315a46",
    subjectLine: "What is new this season",
    previewText:
      "Stories, ideas and what is new at the garden centre.",
    formatLabel: "Image-led · 3 stories · Closing CTA",
    thumbnailBlocks: [
      { kind: "newsletter-header" },
      { kind: "hero", height: 48 },
      { kind: "image-text", height: 34 },
      { kind: "image-text", height: 34 },
      { kind: "image-text", height: 34 },
      { kind: "cta", width: "46%" },
      { kind: "social-follow" },
    ],
    buildBlocks: (designSystem) => {
      const accentColor = "#315a46";
      return finalizeBlocks([
        createHeader(designSystem, {
          headline: designSystem?.company.name || "The Seasonal Edit",
          tagLabel: "Stories, ideas & what's new",
          backgroundColor: "#f3eee3",
          textColor: "#1f3028",
        }),
        createHero(designSystem, {
          headline: "A season worth slowing down for.",
          subheading:
            "Lead with one beautiful idea, then guide readers through a curated mix of stories and highlights.",
          body: "Click any part of this email to change the words and photos.",
          tagLabel: "The seasonal showcase",
          backgroundColor: accentColor,
          textColor: "#fffaf1",
          accentColor,
          buttonText: "Explore the season",
          buttonUrl: getWebsiteUrl(designSystem, "#seasonal-showcase"),
        }),
        createText(designSystem, {
          body: "Hello {{ first_name }},<br /><br />Use this opening note to welcome readers and introduce the theme that connects the stories below. Keep it warm, brief, and personal.",
          backgroundColor: TEMPLATE_PAPER,
          textColor: "#29362f",
          accentColor,
          layout: "standard",
        }),
        createImageText(designSystem, {
          headline: "Your lead story",
          subheading: "A timely idea with room to breathe",
          body: "Feature the most important product, service, event, or seasonal idea here. Add one strong image and keep the copy focused.",
          buttonText: "Discover the story",
          buttonUrl: getWebsiteUrl(designSystem, "#lead-story"),
          accentColor,
          backgroundColor: "#f4efe5",
          imagePosition: "left",
        }),
        createImageText(designSystem, {
          headline: "A second perspective",
          subheading: "Useful, inspiring, and easy to act on",
          body: "Use the alternating layout for a helpful tip, a behind-the-scenes story, or a complementary feature.",
          buttonText: "See the details",
          buttonUrl: getWebsiteUrl(designSystem, "#second-story"),
          accentColor,
          backgroundColor: "#edf3ee",
          imagePosition: "right",
        }),
        createImageText(designSystem, {
          headline: "One final highlight",
          subheading: "End the editorial section on a fresh note",
          body: "Close with a smaller discovery, upcoming date, or customer favourite before the final call to action.",
          buttonText: "Take a closer look",
          buttonUrl: getWebsiteUrl(designSystem, "#final-story"),
          accentColor,
          backgroundColor: "#f4efe5",
          imagePosition: "left",
        }),
        createCta(designSystem, {
          headline: "Ready to explore the full collection?",
          body: "Give readers one clear next step that ties the whole newsletter together.",
          buttonText: "Explore what's new",
          buttonUrl: getWebsiteUrl(designSystem, "#whats-new"),
          accentColor,
        }),
        createFooter(designSystem),
      ]);
    },
  },
  {
    id: "spring-studio-introduction",
    name: "Spring Welcome",
    summary:
      "Welcome customers back for spring.",
    season: "spring",
    tags: ["launch", "editorial"],
    accentColor: "#6ea85c",
    subjectLine: "Spring has arrived, {{ first_name }}",
    previewText:
      "New plants are in. Come see what is blooming this week.",
    thumbnailBlocks: [
      { kind: "newsletter-header" },
      { kind: "hero", height: 44 },
      { kind: "image-text", height: 34 },
      { kind: "quote" },
      { kind: "cta", width: "48%" },
      { kind: "social-follow" },
    ],
    buildBlocks: (designSystem) =>
      buildEditorialTemplate(designSystem, {
        heading: "Spring has arrived at the garden centre",
        summary:
          "New plants are in. Come see what is blooming this week.",
        quote:
          "Add a kind word from a happy customer here. Real quotes help people trust you.",
        authorName: "Customer name",
        authorTitle: "Local gardener",
        ctaLabel: "Visit us this week",
        ctaBody:
          "Add your store hours here, or link this button to your website.",
        accentColor: "#6ea85c",
        surfaceColor: "#f4f8ef",
        heroColor: "#2f5130",
        fallbackUrl: "#spring-edit",
      }),
  },
  {
    id: "spring-client-preview",
    name: "Early Look for Best Customers",
    summary:
      "Give your best customers a first look at something new.",
    season: "spring",
    tags: ["vip", "early access"],
    accentColor: "#4b9872",
    subjectLine: "You get the first look",
    previewText:
      "New plants arrive this week. Shop them before anyone else.",
    thumbnailBlocks: [
      { kind: "newsletter-header" },
      { kind: "hero", height: 48 },
      { kind: "product-gallery", height: 34 },
      { kind: "divider" },
      { kind: "cta", width: "44%" },
      { kind: "social-follow" },
    ],
    buildBlocks: (designSystem) =>
      buildEditorialTemplate(designSystem, {
        heading: "You get the first look",
        summary:
          "New plants arrive this week. As a valued customer, you can shop them first.",
        quote:
          "Add a kind word from a happy customer here. Real quotes help people trust you.",
        authorName: "Customer name",
        authorTitle: "Local gardener",
        ctaLabel: "Shop the early look",
        ctaBody:
          "Tell customers when the early look ends and how to shop it.",
        accentColor: "#4b9872",
        surfaceColor: "#eef8f3",
        heroColor: "#22503e",
        fallbackUrl: "#spring-preview",
      }),
  },
  {
    id: "summer-launch-window",
    name: "Summer Is Here",
    summary: "Announce your summer plants, products or hours.",
    season: "summer",
    tags: ["drop", "announcement"],
    accentColor: "#2d8aa9",
    subjectLine: "Summer is here at the garden centre",
    previewText:
      "Our summer plants and supplies are in.",
    thumbnailBlocks: [
      { kind: "eyebrow", width: "28%", height: 10 },
      { kind: "hero", height: 48 },
      { kind: "product-gallery", height: 34 },
      { kind: "cta", width: "52%" },
      { kind: "social-follow" },
    ],
    buildBlocks: (designSystem) =>
      buildEditorialTemplate(designSystem, {
        heading: "Summer is here at the garden centre",
        summary:
          "Our summer plants and supplies are in. Here is what is new.",
        quote:
          "Add a kind word from a happy customer here. Real quotes help people trust you.",
        authorName: "Customer name",
        authorTitle: "Local gardener",
        ctaLabel: "See what is new for summer",
        ctaBody:
          "Add your store hours here, or link this button to your website.",
        accentColor: "#2d8aa9",
        surfaceColor: "#eef8fb",
        heroColor: "#1f4d63",
        fallbackUrl: "#summer-launch",
      }),
  },
  {
    id: "summer-weekend-note",
    name: "This Weekend",
    summary:
      "A short note about what is happening this weekend.",
    season: "summer",
    tags: ["weekend", "event"],
    // Unified summer hue. Previously #ef8b4e (warm peach) but the
    // companion "Summer Launch Window" template uses cool blue #2d8aa9.
    // Neither hue is dominant in the rest of the codebase (each appears
    // only in this file), so per design spec defaulting both summer
    // cards to the cool blue for consistency.
    accentColor: "#2d8aa9",
    subjectLine: "Happening this weekend",
    previewText:
      "Stop by this weekend. Here is what we have planned.",
    thumbnailBlocks: [
      { kind: "newsletter-header" },
      { kind: "image-text", height: 34 },
      { kind: "quote" },
      { kind: "cta", width: "40%" },
      { kind: "social-follow" },
    ],
    buildBlocks: (designSystem) =>
      buildEditorialTemplate(designSystem, {
        heading: "Happening this weekend",
        summary:
          "Stop by this weekend. Here is what we have planned.",
        quote:
          "Add a kind word from a happy customer here. Real quotes help people trust you.",
        authorName: "Customer name",
        authorTitle: "Local gardener",
        ctaLabel: "Plan your visit",
        ctaBody:
          "Add the day, the time and anything customers should bring.",
        accentColor: "#2d8aa9",
        surfaceColor: "#eef8fb",
        heroColor: "#1f4d63",
        fallbackUrl: "#summer-note",
      }),
  },
  {
    id: "autumn-capsule-edit",
    name: "Fall Favourites",
    summary:
      "Show a few favourite fall plants or products.",
    season: "autumn",
    tags: ["capsule", "curated"],
    accentColor: "#c97834",
    subjectLine: "Our fall favourites are in",
    previewText:
      "Mums, bulbs and everything you need for fall planting.",
    thumbnailBlocks: [
      { kind: "newsletter-header" },
      { kind: "hero", height: 48 },
      { kind: "product-gallery", height: 34 },
      { kind: "divider" },
      { kind: "cta", width: "46%" },
      { kind: "social-follow" },
    ],
    buildBlocks: (designSystem) =>
      buildEditorialTemplate(designSystem, {
        heading: "Our fall favourites are in",
        summary:
          "Mums, bulbs and everything you need for fall planting.",
        quote:
          "Add a kind word from a happy customer here. Real quotes help people trust you.",
        authorName: "Customer name",
        authorTitle: "Local gardener",
        ctaLabel: "Shop fall favourites",
        ctaBody:
          "Link this button to your website, or invite customers to visit in store.",
        accentColor: "#c97834",
        surfaceColor: "#fff2e7",
        heroColor: "#6e3b1f",
        fallbackUrl: "#autumn-capsule",
      }),
  },
  {
    id: "autumn-client-appreciation",
    name: "Thank You to Customers",
    summary:
      "A warm thank-you note for your customers.",
    season: "autumn",
    tags: ["retention", "thank you"],
    accentColor: "#99572d",
    subjectLine: "Thank you for a great season",
    previewText:
      "A small thank-you from all of us.",
    thumbnailBlocks: [
      { kind: "newsletter-header" },
      { kind: "quote" },
      { kind: "text" },
      { kind: "cta", width: "42%" },
      { kind: "social-follow" },
    ],
    buildBlocks: (designSystem) =>
      buildEditorialTemplate(designSystem, {
        heading: "Thank you for a great season",
        summary:
          "We are grateful for every visit. Here is a small thank-you from us.",
        quote:
          "Add a kind word from a happy customer here. Real quotes help people trust you.",
        authorName: "Customer name",
        authorTitle: "Local gardener",
        ctaLabel: "See your thank-you offer",
        ctaBody:
          "Add a thank-you offer here, or simply invite customers back.",
        accentColor: "#99572d",
        surfaceColor: "#fdf0e7",
        heroColor: "#5c341d",
        fallbackUrl: "#autumn-thanks",
      }),
  },
  {
    id: "winter-gift-edit",
    name: "Holiday Gift Ideas",
    summary:
      "Share gift ideas for the holidays.",
    season: "winter",
    tags: ["gift", "holiday"],
    accentColor: "#4172b8",
    subjectLine: "Gift ideas for the gardener in your life",
    previewText:
      "Gifts, wreaths and holiday plants are in store now.",
    thumbnailBlocks: [
      { kind: "newsletter-header" },
      { kind: "hero", height: 50 },
      { kind: "product-gallery", height: 34 },
      { kind: "quote" },
      { kind: "cta", width: "48%" },
      { kind: "social-follow" },
    ],
    buildBlocks: (designSystem) =>
      buildEditorialTemplate(designSystem, {
        heading: "Gift ideas for the gardener in your life",
        summary:
          "Find gifts, wreaths and holiday plants in store now.",
        quote:
          "Add a kind word from a happy customer here. Real quotes help people trust you.",
        authorName: "Customer name",
        authorTitle: "Local gardener",
        ctaLabel: "See gift ideas",
        ctaBody:
          "Remind customers of your holiday hours and the last day to order.",
        accentColor: "#4172b8",
        surfaceColor: "#eef4ff",
        heroColor: "#1f3d6a",
        fallbackUrl: "#winter-gift",
      }),
  },
  {
    id: "winter-year-end-note",
    name: "Year-End Note",
    summary:
      "Look back on the year and thank your customers.",
    season: "winter",
    tags: ["year end", "founder note"],
    accentColor: "#2a677f",
    subjectLine: "A look back at our year",
    previewText:
      "Thank you for growing with us this year.",
    thumbnailBlocks: [
      { kind: "newsletter-header" },
      { kind: "hero", height: 44 },
      { kind: "text" },
      { kind: "quote" },
      { kind: "cta", width: "38%" },
      { kind: "social-follow" },
    ],
    buildBlocks: (designSystem) =>
      buildEditorialTemplate(designSystem, {
        heading: "A look back at our year",
        summary:
          "Thank you for growing with us this year. Here is what is coming next.",
        quote:
          "Add a kind word from a happy customer here. Real quotes help people trust you.",
        authorName: "Customer name",
        authorTitle: "Local gardener",
        ctaLabel: "See what is coming next spring",
        ctaBody:
          "Tell customers when you reopen or what to look forward to.",
        accentColor: "#2a677f",
        surfaceColor: "#edf8fc",
        heroColor: "#1c4150",
        fallbackUrl: "#winter-note",
      }),
  },
  {
    id: "evergreen-brand-story",
    name: "Our Story",
    summary:
      "Tell customers the story behind your garden centre.",
    season: "evergreen",
    tags: ["story", "always on"],
    accentColor: "#4e7d63",
    subjectLine: "The story behind our garden centre",
    previewText:
      "How we started and what we care about.",
    thumbnailBlocks: [
      { kind: "newsletter-header" },
      { kind: "hero", height: 46 },
      { kind: "text" },
      { kind: "quote" },
      { kind: "cta", width: "46%" },
      { kind: "footer" },
    ],
    buildBlocks: (designSystem) =>
      buildEditorialTemplate(designSystem, {
        heading: "The story behind our garden centre",
        summary:
          "Share how you started, who your team is, or what you care about.",
        quote: "Add a kind word from a happy customer here. Real quotes help people trust you.",
        authorName: "Customer name",
        authorTitle: "Local gardener",
        ctaLabel: "Come and say hello",
        ctaBody:
          "Invite customers to visit, or link to the About page on your website.",
        accentColor: "#4e7d63",
        surfaceColor: "#f0f7f3",
        heroColor: "#234735",
        fallbackUrl: "#brand-story",
      }),
  },
  {
    id: "evergreen-new-arrivals",
    name: "New Arrivals",
    summary:
      "Show customers what just arrived.",
    season: "evergreen",
    tags: ["new arrivals", "merchandising"],
    accentColor: "#3c8a7f",
    subjectLine: "Fresh arrivals this week",
    previewText:
      "New plants just came in. Here are a few we love.",
    thumbnailBlocks: [
      { kind: "newsletter-header" },
      { kind: "product-gallery", height: 34 },
      { kind: "text" },
      { kind: "cta", width: "44%" },
      { kind: "social-follow" },
    ],
    buildBlocks: (designSystem) =>
      buildEditorialTemplate(designSystem, {
        heading:
          "Fresh arrivals this week",
        summary:
          "New plants just came in. Here are a few we love.",
        quote:
          "Add a kind word from a happy customer here. Real quotes help people trust you.",
        authorName: "Customer name",
        authorTitle: "Local gardener",
        ctaLabel: "See what just arrived",
        ctaBody:
          "Link this button to your website, or invite customers to visit in store.",
        accentColor: "#3c8a7f",
        surfaceColor: "#eef9f8",
        heroColor: "#24534d",
        fallbackUrl: "#new-arrivals",
      }),
  },
  {
    id: "evergreen-appointment-invite",
    name: "Book a Visit",
    summary:
      "Invite customers to book a consultation or service.",
    season: "evergreen",
    tags: ["services", "booking"],
    accentColor: "#33696a",
    subjectLine: "Book a time with our team",
    previewText:
      "Need help with a garden plan? We can help.",
    thumbnailBlocks: [
      { kind: "newsletter-header" },
      { kind: "image-text", height: 34 },
      { kind: "divider" },
      { kind: "cta", width: "40%" },
      { kind: "footer" },
    ],
    buildBlocks: (designSystem) =>
      buildEditorialTemplate(designSystem, {
        heading: "Book a time with our team",
        summary:
          "Need help with a garden plan? Book a time and we will help you.",
        quote:
          "Add a kind word from a happy customer here. Real quotes help people trust you.",
        authorName: "Customer name",
        authorTitle: "Local gardener",
        ctaLabel: "Book your time",
        ctaBody:
          "Tell customers how to book. Add a phone number or a booking link.",
        accentColor: "#33696a",
        surfaceColor: "#edf7f6",
        heroColor: "#1f4647",
        fallbackUrl: "#appointments",
      }),
  },
  {
    id: "evergreen-loyalty-thank-you",
    name: "Loyalty Thank You",
    summary:
      "Thank your loyal customers and invite them back.",
    season: "evergreen",
    tags: ["retention", "loyalty"],
    accentColor: "#8e6a3f",
    subjectLine: "Thank you for being a loyal customer",
    previewText:
      "Here is something special for you.",
    thumbnailBlocks: [
      { kind: "newsletter-header" },
      { kind: "quote" },
      { kind: "text" },
      { kind: "cta", width: "42%" },
      { kind: "social-follow" },
    ],
    buildBlocks: (designSystem) =>
      buildEditorialTemplate(designSystem, {
        heading: "Thank you for being a loyal customer",
        summary:
          "You keep us growing. Here is something special for you.",
        quote:
          "Add a kind word from a happy customer here. Real quotes help people trust you.",
        authorName: "Customer name",
        authorTitle: "Local gardener",
        ctaLabel: "See your reward",
        ctaBody:
          "Describe the reward and how customers can use it.",
        accentColor: "#8e6a3f",
        surfaceColor: "#fbf4eb",
        heroColor: "#5c4322",
        fallbackUrl: "#loyalty-note",
      }),
  },
];

export function applyCampaignTemplate(
  template: CampaignTemplate,
  designSystem?: StudioDesignSystem | null,
) {
  return template.buildBlocks(designSystem);
}

export type CampaignIntentKey =
  | "newsletter"
  | "showcase"
  | "sale"
  | "new-arrivals"
  | "event"
  | "thank-you"
  | "blank";

// Tag keywords that map an intent to one or more of the existing
// seasonal templates. Multiple keywords per intent so the picker
// keeps working even if a template gets re-tagged. Keep these
// lowercase — matching is case-insensitive.
const INTENT_TAG_KEYWORDS: Record<
  Exclude<CampaignIntentKey, "blank">,
  readonly string[]
> = {
  newsletter: ["newsletter", "editorial", "retention", "monthly"],
  showcase: ["showcase", "seasonal stories"],
  sale: ["sale", "promo", "promotion", "launch", "drop"],
  "new-arrivals": [
    "new arrivals",
    "arrivals",
    "drop",
    "capsule",
    "curated",
    "merchandising",
  ],
  event: ["event", "weekend", "workshop", "invite"],
  "thank-you": ["thank you", "retention", "vip", "appreciation", "loyalty"],
};

function templateMatchesIntent(
  template: { tags: string[] },
  intent: Exclude<CampaignIntentKey, "blank">,
) {
  const keywords = INTENT_TAG_KEYWORDS[intent];
  return template.tags.some((tag) =>
    keywords.some((keyword) => tag.toLowerCase().includes(keyword)),
  );
}

/**
 * Returns the best matching seasonal template for a given intent
 * key. Picks the highest-tag-overlap template; ties broken by
 * authoring order. Returns null for "blank" (the caller is expected
 * to build a minimal starter), or when no template matches an
 * intent (caller should render a disabled "Coming soon" state).
 */
export function getTemplateForIntent(
  intent: CampaignIntentKey,
  templates: readonly CampaignTemplate[] = CAMPAIGN_TEMPLATES,
): CampaignTemplate | null {
  if (intent === "blank") {
    return null;
  }
  const matches = templates.filter((template) =>
    templateMatchesIntent(template, intent),
  );
  if (matches.length === 0) {
    return null;
  }
  // Prefer the template with the most keyword overlap so e.g. a
  // template tagged ["launch", "editorial"] correctly maps to "sale"
  // over a template only tagged ["launch"] in a hypothetical tie.
  const keywords = INTENT_TAG_KEYWORDS[intent];
  let best = matches[0];
  let bestScore = -1;
  for (const candidate of matches) {
    const score = candidate.tags.reduce(
      (acc, tag) =>
        acc +
        (keywords.some((keyword) => tag.toLowerCase().includes(keyword))
          ? 1
          : 0),
      0,
    );
    if (score > bestScore) {
      best = candidate;
      bestScore = score;
    }
  }
  return best;
}
