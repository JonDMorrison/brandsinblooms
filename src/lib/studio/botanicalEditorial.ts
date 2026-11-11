import type { StudioBlock } from "../../types/studioBlocks.ts";
import { type StudioDesignSystem } from "./designSystem.ts";
import { createFooterBlockFromDesignSystem } from "./emailHtmlGenerator.ts";
import { safeEmailUrl } from "./newsletter/settings.ts";

export const BOTANICAL_TEMPLATES = [
  { id: "botanical-editorial", name: "Botanical Editorial", tags: ["event", "workshop", "invite"], heading: "Make something beautiful.", label: "You're invited" },
  { id: "botanical-seasonal", name: "Botanical Seasonal Newsletter", tags: ["newsletter", "editorial", "monthly"], heading: "A fresh season of inspiration.", label: "Seasonal notes" },
  { id: "botanical-product", name: "Botanical Product Feature", tags: ["new arrivals", "curated", "merchandising"], heading: "Something worth a closer look.", label: "In the spotlight" },
  { id: "botanical-events", name: "Botanical Event Roundup", tags: ["event", "newsletter"], heading: "Make room for something lovely.", label: "What's coming up" },
] as const;

export type BotanicalTemplateId = typeof BOTANICAL_TEMPLATES[number]["id"];
export interface BotanicalFeature {
  title: string;
  body: string;
  buttonText: string;
  buttonUrl: string;
  imageUrl?: string;
  imageAlt?: string;
}
export interface BotanicalBrief {
  headline?: string;
  subheading?: string;
  introduction?: string;
  heroImageUrl?: string;
  heroImageAlt?: string;
  closing?: string;
  features?: BotanicalFeature[];
  images?: Array<{ url: string; alt: string }>;
}

export function isBotanicalTemplateId(value: unknown): value is BotanicalTemplateId {
  return BOTANICAL_TEMPLATES.some((template) => template.id === value);
}

/** Shared by Studio and the agent. Only supplied facts and images enter a draft. */
export function buildBotanicalEditorial(
  templateId: BotanicalTemplateId,
  designSystem?: StudioDesignSystem | null,
  brief: BotanicalBrief = {},
): StudioBlock[] {
  const template = BOTANICAL_TEMPLATES.find((entry) => entry.id === templateId)!;
  const ink = "#243c32";
  const paper = "#fbf8f2";
  const accent = designSystem?.colors.primary || "#f4b0bd";
  const headingFont = designSystem?.typography.headline?.fontFamilyCss || "Georgia, 'Times New Roman', serif";
  const base = (type: StudioBlock["type"], label: string): StudioBlock => ({
    id: crypto.randomUUID(), type, label, order: 0, visible: true,
    backgroundColor: paper, textColor: ink,
  });
  const text = (label: string, body: string): StudioBlock => ({
    ...base("plain-text", label), body, layout: "standard", contentPadding: 28,
    textAlign: "left", showAccent: false,
    appearance: { text: { body: { size: 17, lineHeight: 1.6 } } },
  });
  const blocks: StudioBlock[] = [
    {
      ...base("newsletter-header", "Brand header"),
      headline: designSystem?.company.name || "", logoUrl: designSystem?.company.logoUrl || "",
      logoAlignment: "center", layout: "centered", logoSize: 76,
      showDividerBelow: false, backgroundColor: "#f8f9fb", dateLabel: "",
    },
    {
      ...base("email-safe-hero", "Photographic opening"),
      headline: brief.headline || template.heading, subheading: brief.subheading || "",
      tagLabel: template.label, heroStyle: "image-overlay", layout: "editorial-panel",
      imageUrl: safeEmailUrl(brief.heroImageUrl, true), imageAlt: brief.heroImageAlt || "",
      backgroundColor: ink, textColor: "#fffaf2", overlayColor: ink,
      textAlign: "left", buttonText: "", buttonUrl: "",
      appearance: { text: { heading: { fontFamily: headingFont, size: 40, weight: 400, lineHeight: 1.1 } } },
    },
    text("Personal introduction", brief.introduction || "Hello {{ first_name }},"),
  ];
  const features = brief.features?.length ? brief.features : [{
    title: "", body: "", buttonText: "Learn more", buttonUrl: "",
  }];
  for (const [index, feature] of features.entries()) {
    if (feature.imageUrl) blocks.push({
      ...base("full-width-image", "Feature photograph"),
      imageUrl: safeEmailUrl(feature.imageUrl, true), imageAlt: feature.imageAlt || "",
      imageFit: "contain", imagePadding: true,
    });
    blocks.push({
      ...base("call-to-action", index === 0 ? "Featured details" : "More to explore"),
      headline: feature.title, body: feature.body,
      buttonText: feature.buttonText, buttonUrl: safeEmailUrl(feature.buttonUrl),
      backgroundColor: "#eeeae1", textAlign: "left", verticalPadding: 24,
      buttonColor: ink, buttonTextColor: "#ffffff", useBrandButtonColor: false,
      buttonSize: "lg", buttonRounded: false,
      appearance: {
        margin: { left: 24, right: 24 },
        border: { style: "solid", width: 1, color: accent },
        text: { heading: { fontFamily: headingFont, size: 27, weight: 400 }, body: { size: 16, lineHeight: 1.7 } },
      },
    });
  }
  const images = (brief.images || []).filter((image) => safeEmailUrl(image.url, true));
  // Keep an editable image slot when starting from the template gallery.
  blocks.push({
    ...base("image-gallery", "Supporting photographs"),
    galleryImages: images.map((image) => ({ ...image, id: crypto.randomUUID(), url: safeEmailUrl(image.url, true) })),
    gridColumns: 2, layout: "row-2", imageHeight: 270, gridGap: 10, borderRadius: 0,
    appearance: { padding: { top: 24, right: 24, bottom: 0, left: 24 } },
  });
  blocks.push(text("Personal closing", brief.closing || ""));
  blocks.push({
    ...base("divider", "Brand accent"), lineColor: accent, lineThickness: 6,
    paddingTop: 0, paddingBottom: 0, lineWidth: 100,
  });
  blocks.push(createFooterBlockFromDesignSystem(designSystem, {
    id: crypto.randomUUID(), backgroundColor: paper, textColor: ink, linkColor: ink,
    address: designSystem?.company.addressLines || designSystem?.company.address || "",
    layout: "standard-light", showSocialInFooter: Boolean(designSystem?.social.hasConfiguredLinks),
    newsletterSettings: { version: 1, width: 640, blockGap: 0, backgroundColor: "#eeeae3", contentBackgroundColor: paper },
  }));
  return blocks.map((block, order) => ({ ...block, order }));
}

/** Validate agent input at execution too: queued tasks can outlive their schema. */
export function parseBotanicalBrief(value: unknown): BotanicalBrief {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Provide a newsletter brief.");
  const record = value as Record<string, unknown>;
  const read = (key: string, max = 5000): string | undefined => {
    const value = record[key];
    if (value === undefined) return undefined;
    if (typeof value !== "string" || value.length > max) throw new Error("Invalid newsletter " + key + ".");
    return value.trim();
  };
  const brief: BotanicalBrief = {
    headline: read("headline", 180), subheading: read("subheading", 400),
    introduction: read("introduction"), closing: read("closing"),
    heroImageUrl: read("heroImageUrl", 2048), heroImageAlt: read("heroImageAlt", 300),
  };
  if (!brief.headline || !brief.introduction) throw new Error("A headline and introduction are required.");
  if (brief.heroImageUrl && !safeEmailUrl(brief.heroImageUrl, true)) throw new Error("Use a valid public image URL.");
  if (!Array.isArray(record.features) || !record.features.length || record.features.length > 6) throw new Error("Include one to six featured events, products or stories.");
  brief.features = record.features.map((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) throw new Error("Invalid newsletter feature.");
    const row = item as Record<string, unknown>;
    for (const key of ["title", "body", "buttonText", "buttonUrl"]) {
      if (typeof row[key] !== "string" || !row[key].trim() || row[key].length > 5000) throw new Error("Each feature needs a title, details, button label and destination.");
    }
    if (!safeEmailUrl(row.buttonUrl)) throw new Error("Use a valid feature destination URL.");
    if (row.imageUrl !== undefined && (typeof row.imageUrl !== "string" || (row.imageUrl && !safeEmailUrl(row.imageUrl, true)))) throw new Error("Use a valid feature image URL.");
    return { title: row.title as string, body: row.body as string, buttonText: row.buttonText as string, buttonUrl: row.buttonUrl as string,
      imageUrl: typeof row.imageUrl === "string" ? row.imageUrl : undefined, imageAlt: typeof row.imageAlt === "string" ? row.imageAlt : "" };
  });
  if (record.images !== undefined) {
    if (!Array.isArray(record.images) || record.images.length > 6) throw new Error("Use up to six supporting photographs.");
    brief.images = record.images.map((item) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) throw new Error("Invalid supporting photograph.");
      const image = item as Record<string, unknown>;
      if (typeof image.url !== "string" || !safeEmailUrl(image.url, true) || typeof image.alt !== "string") throw new Error("Each photograph needs a valid URL and description.");
      return { url: image.url, alt: image.alt };
    });
  }
  return brief;
}
