import { createStudioBlock } from "@/lib/studio/blockFactory";
import type { StudioDesignSystem } from "@/lib/studio/designSystem";
import type { StudioBlock } from "@/types/studioBlocks";

export type CampaignTemplateSeason =
  | "spring"
  | "summer"
  | "autumn"
  | "winter"
  | "evergreen";

export type CampaignTemplateFilter = CampaignTemplateSeason | "all";

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

function finalizeBlocks(blocks: StudioBlock[]) {
  return blocks.map((block, index) => ({
    ...block,
    order: index,
    visible: block.visible !== false,
  }));
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
    buttonText: options.buttonText || "View the edit",
    buttonUrl: options.buttonUrl || getWebsiteUrl(designSystem, "#preview"),
    buttonColor: primaryColor,
    buttonTextColor: designSystem?.colors.primaryContrastText || "#fafafa",
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
    backgroundColor: options.backgroundColor || "#fcfcfb",
    textColor: options.textColor || getTextColor(designSystem, "#27272a"),
    accentColor: options.accentColor || "#52525b",
    layout: options.layout || "side-accent",
    contentPadding: 26,
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
    backgroundColor: options.backgroundColor || "#ffffff",
    textColor: options.textColor || getTextColor(designSystem, "#18181b"),
    accentColor: options.accentColor || "#52525b",
    layout: options.layout || "classic",
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
    buttonText: options.buttonText || "Open the collection",
    buttonUrl: options.buttonUrl || getWebsiteUrl(designSystem, "#collection"),
    backgroundColor: options.backgroundColor || "#f4f4f5",
    textColor: options.textColor || getTextColor(designSystem, "#18181b"),
    buttonColor: primaryColor,
    buttonTextColor: designSystem?.colors.primaryContrastText || "#fafafa",
    layout: options.layout || "centered-hero",
    verticalPadding: 28,
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
      tagLabel: "Curated release",
      backgroundColor: config.surfaceColor,
      textColor: "#18181b",
    }),
    createHero(designSystem, {
      headline: config.heading,
      subheading: config.summary,
      body: "A restrained campaign layout with real Studio blocks, ready for fine edits in Campaign Studio.",
      tagLabel: "Seasonal template",
      backgroundColor: config.heroColor,
      textColor: "#fafafa",
      accentColor: config.accentColor,
      buttonText: "Review the edit",
      buttonUrl: getWebsiteUrl(designSystem, config.fallbackUrl),
    }),
    createText(designSystem, {
      body: "Hello {{ first_name }},<br /><br />This layout gives you a clean editorial cadence: a strong opening statement, generous spacing, and one decisive call to action. Swap in your own studio copy, add imagery, or keep the monochrome tone intact.",
      backgroundColor: "#fcfcfb",
      textColor: "#27272a",
      accentColor: config.accentColor,
    }),
    createQuote(designSystem, {
      body: config.quote,
      authorName: config.authorName,
      authorTitle: config.authorTitle,
      accentColor: config.accentColor,
      backgroundColor: "#ffffff",
      textColor: "#18181b",
    }),
    createDivider(designSystem, config.accentColor),
    createCta(designSystem, {
      headline: config.ctaLabel,
      body: config.ctaBody,
      buttonText: "Open the campaign",
      buttonUrl: getWebsiteUrl(designSystem, config.fallbackUrl),
      accentColor: config.accentColor,
      backgroundColor: config.surfaceColor,
      textColor: "#18181b",
    }),
    createFooter(designSystem),
  ]);
}

export const CAMPAIGN_TEMPLATES: CampaignTemplate[] = [
  {
    id: "spring-studio-introduction",
    name: "Spring Studio Introduction",
    summary:
      "Soft seasonal launch with editorial pacing and a welcoming lead-in.",
    season: "spring",
    tags: ["launch", "editorial"],
    accentColor: "#6ea85c",
    subjectLine: "A lighter spring edit is ready for {{ first_name }}",
    previewText:
      "Clean storytelling, soft contrast, and one clear call to action.",
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
        heading: "A quieter spring release, paced for attention.",
        summary:
          "Introduce a seasonal collection, a service window, or a new editorial moment without overwhelming the inbox.",
        quote:
          "We wanted the message to feel composed, not crowded. This template keeps the tone measured while still giving the campaign a strong point of view.",
        authorName: "Studio Team",
        authorTitle: "Seasonal campaign lead",
        ctaLabel: "Open the spring release",
        ctaBody:
          "Replace this CTA with your featured collection, booking flow, or seasonal landing page.",
        accentColor: "#6ea85c",
        surfaceColor: "#f4f8ef",
        heroColor: "#2f5130",
        fallbackUrl: "#spring-edit",
      }),
  },
  {
    id: "spring-client-preview",
    name: "Spring Client Preview",
    summary:
      "Reserved preview layout for members, VIP lists, or early access drops.",
    season: "spring",
    tags: ["vip", "early access"],
    accentColor: "#4b9872",
    subjectLine: "Early access opens quietly today",
    previewText:
      "A restrained client preview with real Studio blocks and immediate send parity.",
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
        heading: "A private preview for your first look list.",
        summary:
          "Use this for membership launches, appointment-first releases, or an understated early-access note.",
        quote:
          "A preview email works best when the hierarchy is clear: one opening statement, one reason to care, one place to act.",
        authorName: "Client Services",
        authorTitle: "Private access team",
        ctaLabel: "Unlock the preview window",
        ctaBody:
          "Point the CTA at a hidden collection, an RSVP link, or a booking page.",
        accentColor: "#4b9872",
        surfaceColor: "#eef8f3",
        heroColor: "#22503e",
        fallbackUrl: "#spring-preview",
      }),
  },
  {
    id: "summer-launch-window",
    name: "Summer Launch Window",
    summary: "High-clarity summer drop layout with a stronger opening hero.",
    season: "summer",
    tags: ["drop", "announcement"],
    accentColor: "#2d8aa9",
    subjectLine: "The summer launch window is now open",
    previewText:
      "A monochrome launch template built for product edits and campaign parity.",
    thumbnailBlocks: [
      { kind: "eyebrow", width: "28%", height: 10 },
      { kind: "hero", height: 48 },
      { kind: "product-gallery", height: 34 },
      { kind: "cta", width: "52%" },
      { kind: "social-follow" },
    ],
    buildBlocks: (designSystem) =>
      buildEditorialTemplate(designSystem, {
        heading: "A focused summer launch, framed with room to breathe.",
        summary:
          "Built for product drops, event windows, or a short summer campaign with one clear primary action.",
        quote:
          "If a campaign only needs one decisive action, the layout should support that instead of competing with it.",
        authorName: "Launch Planning",
        authorTitle: "Campaign operations",
        ctaLabel: "Open the launch page",
        ctaBody:
          "Pair with a live product release, a booking slot, or a short seasonal offer.",
        accentColor: "#2d8aa9",
        surfaceColor: "#eef8fb",
        heroColor: "#1f4d63",
        fallbackUrl: "#summer-launch",
      }),
  },
  {
    id: "summer-weekend-note",
    name: "Summer Weekend Note",
    summary:
      "Concise weekend send for light programming, events, or reminders.",
    season: "summer",
    tags: ["weekend", "event"],
    accentColor: "#ef8b4e",
    subjectLine: "Your weekend note is ready",
    previewText:
      "A compact layout for short seasonal sends and event reminders.",
    thumbnailBlocks: [
      { kind: "newsletter-header" },
      { kind: "image-text", height: 34 },
      { kind: "quote" },
      { kind: "cta", width: "40%" },
      { kind: "social-follow" },
    ],
    buildBlocks: (designSystem) =>
      buildEditorialTemplate(designSystem, {
        heading: "A short weekend send with a measured tone.",
        summary:
          "Ideal for event reminders, appointment nudges, or a calm end-of-week note to your audience.",
        quote:
          "Short sends work best when the layout feels intentional rather than stripped down.",
        authorName: "Events Desk",
        authorTitle: "Weekend programming",
        ctaLabel: "Open the weekend brief",
        ctaBody:
          "Replace this section with your event timing, RSVP details, or visit window.",
        accentColor: "#ef8b4e",
        surfaceColor: "#fff4ec",
        heroColor: "#8a4f27",
        fallbackUrl: "#summer-note",
      }),
  },
  {
    id: "autumn-capsule-edit",
    name: "Autumn Capsule Edit",
    summary:
      "Structured autumn release for curated product or service highlights.",
    season: "autumn",
    tags: ["capsule", "curated"],
    accentColor: "#c97834",
    subjectLine: "A new autumn capsule is ready to review",
    previewText:
      "Editorial structure with enough contrast to support a curated release.",
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
        heading: "A quieter autumn edit with a curated point of view.",
        summary:
          "Use this for capsule collections, service bundles, or a refined seasonal announcement.",
        quote:
          "The message feels premium when the hierarchy is disciplined: headline, context, then action.",
        authorName: "Merchandising",
        authorTitle: "Curated collection team",
        ctaLabel: "Open the autumn capsule",
        ctaBody:
          "Point this CTA at a curated release, a lookbook, or a booking sequence.",
        accentColor: "#c97834",
        surfaceColor: "#fff2e7",
        heroColor: "#6e3b1f",
        fallbackUrl: "#autumn-capsule",
      }),
  },
  {
    id: "autumn-client-appreciation",
    name: "Autumn Client Appreciation",
    summary:
      "Warm but restrained thank-you note for loyalty or reorder campaigns.",
    season: "autumn",
    tags: ["retention", "thank you"],
    accentColor: "#99572d",
    subjectLine: "A quieter thank-you for your best clients",
    previewText:
      "Retention-focused seasonal template with editorial spacing and a polished CTA.",
    thumbnailBlocks: [
      { kind: "newsletter-header" },
      { kind: "quote" },
      { kind: "text" },
      { kind: "cta", width: "42%" },
      { kind: "social-follow" },
    ],
    buildBlocks: (designSystem) =>
      buildEditorialTemplate(designSystem, {
        heading: "A client note that feels composed, not promotional.",
        summary:
          "Designed for appreciation campaigns, reorder reminders, or a soft loyalty message at the turn of the season.",
        quote:
          "The best retention emails feel personal because the layout leaves enough space for the message to land.",
        authorName: "Relationship Team",
        authorTitle: "Client care",
        ctaLabel: "Continue the client conversation",
        ctaBody:
          "Send readers to a loyalty offer, a reorder path, or a reserved booking page.",
        accentColor: "#99572d",
        surfaceColor: "#fdf0e7",
        heroColor: "#5c341d",
        fallbackUrl: "#autumn-thanks",
      }),
  },
  {
    id: "winter-gift-edit",
    name: "Winter Gift Edit",
    summary:
      "High-contrast winter send for gifting, premium bundles, or last-mile curation.",
    season: "winter",
    tags: ["gift", "holiday"],
    accentColor: "#4172b8",
    subjectLine: "A winter gift edit is ready for {{ first_name }}",
    previewText:
      "A premium winter template with concise hierarchy and live preview parity.",
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
        heading: "A winter gift edit with deliberate contrast.",
        summary:
          "Use this for premium gifting, bundled services, or a final high-intent seasonal push.",
        quote:
          "A gift campaign can feel premium without becoming loud. Contrast and spacing do most of the work.",
        authorName: "Seasonal Team",
        authorTitle: "Holiday merchandising",
        ctaLabel: "Open the winter gift edit",
        ctaBody:
          "Drive readers to a curated gift page, concierge request flow, or high-intent offer.",
        accentColor: "#4172b8",
        surfaceColor: "#eef4ff",
        heroColor: "#1f3d6a",
        fallbackUrl: "#winter-gift",
      }),
  },
  {
    id: "winter-year-end-note",
    name: "Winter Year-End Note",
    summary:
      "Reflective close-of-year template for milestones, updates, or a founder note.",
    season: "winter",
    tags: ["year end", "founder note"],
    accentColor: "#2a677f",
    subjectLine: "A measured year-end note for your audience",
    previewText:
      "Monochrome structure for reflective updates and close-of-year storytelling.",
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
        heading: "A year-end note with clear structure and a calm finish.",
        summary:
          "Useful for milestone recaps, a founder letter, or a forward-looking seasonal close.",
        quote:
          "When the message is reflective, the layout should be quieter than the copy.",
        authorName: "Founder's Office",
        authorTitle: "Year-end update",
        ctaLabel: "Share the next step",
        ctaBody:
          "Point readers to the next chapter: bookings, new releases, or an annual recap page.",
        accentColor: "#2a677f",
        surfaceColor: "#edf8fc",
        heroColor: "#1c4150",
        fallbackUrl: "#winter-note",
      }),
  },
  {
    id: "evergreen-brand-story",
    name: "Evergreen Brand Story",
    summary:
      "Always-on editorial template for narrative campaigns and founder notes.",
    season: "evergreen",
    tags: ["story", "always on"],
    accentColor: "#4e7d63",
    subjectLine: "A composed story-led campaign is ready",
    previewText:
      "Evergreen editorial structure with real Studio blocks and restrained contrast.",
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
        heading: "A story-led layout built for composed campaigns.",
        summary:
          "Use this for a founder note, a brand story, or any campaign where the narrative should carry the page.",
        quote: "The template should support the story, not compete with it.",
        authorName: "Brand Team",
        authorTitle: "Editorial direction",
        ctaLabel: "Continue the story",
        ctaBody:
          "Send readers to a story page, a new collection, or an editorial landing surface.",
        accentColor: "#4e7d63",
        surfaceColor: "#f0f7f3",
        heroColor: "#234735",
        fallbackUrl: "#brand-story",
      }),
  },
  {
    id: "evergreen-new-arrivals",
    name: "Evergreen New Arrivals",
    summary:
      "Flexible release template for new arrivals, restocks, or featured edits.",
    season: "evergreen",
    tags: ["new arrivals", "merchandising"],
    accentColor: "#3c8a7f",
    subjectLine: "A new arrivals edit is ready to send",
    previewText:
      "A versatile merchandising layout with restrained monochrome styling.",
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
          "A composed new-arrivals layout with one strong primary action.",
        summary:
          "Built for restocks, releases, or a short merchandising edit that still feels premium.",
        quote:
          "Clarity matters most when the campaign asks readers to decide quickly.",
        authorName: "Merchandising",
        authorTitle: "Weekly release",
        ctaLabel: "Open the arrivals edit",
        ctaBody:
          "Drive to a collection, restock page, or an editorially grouped set of featured items.",
        accentColor: "#3c8a7f",
        surfaceColor: "#eef9f8",
        heroColor: "#24534d",
        fallbackUrl: "#new-arrivals",
      }),
  },
  {
    id: "evergreen-appointment-invite",
    name: "Evergreen Appointment Invite",
    summary:
      "Clean service-booking template for consultations, appointments, or demos.",
    season: "evergreen",
    tags: ["services", "booking"],
    accentColor: "#33696a",
    subjectLine: "A polished appointment invite is ready",
    previewText:
      "Use this template for bookings, demos, or service-led campaigns.",
    thumbnailBlocks: [
      { kind: "newsletter-header" },
      { kind: "image-text", height: 34 },
      { kind: "divider" },
      { kind: "cta", width: "40%" },
      { kind: "footer" },
    ],
    buildBlocks: (designSystem) =>
      buildEditorialTemplate(designSystem, {
        heading: "An appointment-led campaign with disciplined hierarchy.",
        summary:
          "Designed for consultations, demos, service windows, or any campaign that leads directly into booking.",
        quote:
          "A booking email should feel easy to scan and confident enough to trust.",
        authorName: "Scheduling Team",
        authorTitle: "Appointments",
        ctaLabel: "Open the booking path",
        ctaBody:
          "Swap in your scheduling link, request form, or consultation calendar.",
        accentColor: "#33696a",
        surfaceColor: "#edf7f6",
        heroColor: "#1f4647",
        fallbackUrl: "#appointments",
      }),
  },
  {
    id: "evergreen-loyalty-thank-you",
    name: "Evergreen Loyalty Thank You",
    summary:
      "Retention note for loyalty moments, re-engagement, or a measured thank-you.",
    season: "evergreen",
    tags: ["retention", "loyalty"],
    accentColor: "#8e6a3f",
    subjectLine: "A quieter loyalty note is ready to send",
    previewText:
      "Retention-focused layout with enough space for a personal tone.",
    thumbnailBlocks: [
      { kind: "newsletter-header" },
      { kind: "quote" },
      { kind: "text" },
      { kind: "cta", width: "42%" },
      { kind: "social-follow" },
    ],
    buildBlocks: (designSystem) =>
      buildEditorialTemplate(designSystem, {
        heading: "A loyalty note that leaves room for sincerity.",
        summary:
          "Use this for retention campaigns, reorder nudges, or a thank-you email that should feel personal.",
        quote:
          "The strongest loyalty campaigns often say less, with more care.",
        authorName: "Client Team",
        authorTitle: "Loyalty and retention",
        ctaLabel: "Continue the relationship",
        ctaBody:
          "Send readers to a loyalty offer, a refill path, or a return visit campaign.",
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
