import { createStudioBlock } from "@/lib/studio/blockFactory";
import type { StudioDesignSystem } from "@/lib/studio/designSystem";
import type {
  NewsletterIdea,
  NewsletterIdeaTemplateBlock,
  NewsletterTemplate,
} from "@/types/newsletter";
import type { StudioBlock } from "@/types/studioBlocks";
import {
  sanitizeCampaignTitle,
  sanitizeWeekNumbers,
} from "@/utils/weekNumberSanitizer";

export type NewsletterIdeaLayout = NewsletterTemplate["layout"];

export type NewsletterIdeaNavigationState = {
  newsletterIdea: NewsletterIdea;
  newsletterLayout: NewsletterIdeaLayout;
};

export type NewsletterIdeaDraftSeed = {
  name: string;
  subjectLine: string;
  preheaderText: string;
  contentBlocks: StudioBlock[];
};

type NewsletterIdeaSeedSource = Pick<
  NewsletterIdea,
  | "id"
  | "title"
  | "description"
  | "category"
  | "badge"
  | "templateBlocks"
  | "estimatedReadTime"
>;

const DEFAULT_CTA_URL = "#campaign-studio";
const TEMPLATE_BLOCKS_SEARCH_PARAM = "templateBlocks";
const BADGE_SEARCH_PARAM = "badge";
const ESTIMATED_READ_TIME_SEARCH_PARAM = "estimatedReadTime";

const HEADER_LIKE_SOURCE_TYPES = new Set([
  "header",
  "hero",
  "email-safe-hero",
  "graphic-hero",
  "newsletter-header",
]);
const CTA_LIKE_SOURCE_TYPES = new Set([
  "button",
  "cta",
  "call-to-action",
]);
const FOOTER_LIKE_SOURCE_TYPES = new Set(["footer"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function asString(value: unknown) {
  return typeof value === "string" ? value : null;
}

function trimString(value: string | null | undefined) {
  return typeof value === "string" ? value.trim() : "";
}

function isNewsletterIdeaLayout(value: unknown): value is NewsletterIdeaLayout {
  return value === "block-builder" || value === "simple-email";
}

function isNewsletterIdeaTemplateBlock(
  value: unknown,
): value is NewsletterIdeaTemplateBlock {
  return isRecord(value) && trimString(asString(value.type)).length > 0;
}

function normalizeCategory(value: unknown): NewsletterIdea["category"] {
  switch (value) {
    case "holiday":
    case "seasonal":
    case "product":
    case "ai-generated":
    case "general":
    case "weekly":
      return value;
    default:
      return "general";
  }
}

function normalizeTitle(value: string | null | undefined) {
  return sanitizeCampaignTitle(trimString(value));
}

function normalizeText(value: string | null | undefined) {
  return sanitizeWeekNumbers(trimString(value));
}

function toIdeaLabel(idea: NewsletterIdeaSeedSource) {
  const badge = normalizeText(idea.badge);

  if (badge) {
    return badge;
  }

  switch (idea.category) {
    case "holiday":
      return "Holiday feature";
    case "seasonal":
      return "Seasonal feature";
    case "product":
      return "Product spotlight";
    case "ai-generated":
      return "AI concept";
    case "weekly":
      return "Seasonal newsletter";
    default:
      return "Curated idea";
  }
}

function truncateAtWordBoundary(value: string, maxLength: number) {
  if (value.length <= maxLength) {
    return value;
  }

  const sliced = value.slice(0, maxLength + 1);
  const lastSpaceIndex = sliced.lastIndexOf(" ");
  const trimmed =
    lastSpaceIndex > Math.floor(maxLength * 0.6)
      ? sliced.slice(0, lastSpaceIndex)
      : value.slice(0, maxLength);

  return `${trimmed.trimEnd()}...`;
}

function buildPreheaderText(idea: NewsletterIdeaSeedSource) {
  const description = normalizeText(idea.description);
  if (!description) {
    return truncateAtWordBoundary(
      `A seeded newsletter draft for ${idea.title}.`,
      120,
    );
  }

  return truncateAtWordBoundary(description, 120);
}

function composeSectionBody(title: string, body: string) {
  if (!title) {
    return body;
  }

  if (!body) {
    return `<strong>${title}</strong>`;
  }

  return body.toLowerCase().includes(title.toLowerCase())
    ? body
    : `<strong>${title}</strong><br /><br />${body}`;
}

function toTemplateBlocks(value: unknown) {
  if (!Array.isArray(value)) {
    return [] as NewsletterIdeaTemplateBlock[];
  }

  return value.filter(isNewsletterIdeaTemplateBlock);
}

function getTemplateBlockType(templateBlock: NewsletterIdeaTemplateBlock) {
  return trimString(asString(templateBlock.type)).toLowerCase();
}

function serializeTemplateBlocks(
  templateBlocks: NewsletterIdea["templateBlocks"],
) {
  try {
    return JSON.stringify(templateBlocks);
  } catch {
    return "[]";
  }
}

function parseTemplateBlocksFromSearchParams(value: string | null) {
  if (!value) {
    return [] as NewsletterIdeaTemplateBlock[];
  }

  try {
    return toTemplateBlocks(JSON.parse(value));
  } catch {
    return [] as NewsletterIdeaTemplateBlock[];
  }
}

export function buildNewsletterIdeaEditorSearchParams(
  idea: NewsletterIdea,
  layout: NewsletterIdeaLayout,
) {
  const searchParams = new URLSearchParams({
    type: "newsletter",
    flow: "template-picker",
    templateId: idea.id,
    layout,
    source: "picker",
    title: idea.title,
    description: idea.description,
    category: idea.category,
    [TEMPLATE_BLOCKS_SEARCH_PARAM]: serializeTemplateBlocks(idea.templateBlocks),
  });

  if (idea.badge) {
    searchParams.set(BADGE_SEARCH_PARAM, idea.badge);
  }

  if (idea.estimatedReadTime) {
    searchParams.set(
      ESTIMATED_READ_TIME_SEARCH_PARAM,
      idea.estimatedReadTime,
    );
  }

  return searchParams;
}

function parseIdeaFromLocationState(
  state: unknown,
): NewsletterIdeaSeedSource | null {
  if (!isRecord(state) || !isRecord(state.newsletterIdea)) {
    return null;
  }

  const idea = state.newsletterIdea;
  const title = normalizeTitle(asString(idea.title));

  if (!title) {
    return null;
  }

  return {
    id:
      trimString(asString(idea.id)) ||
      `newsletter-idea-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
    title,
    description: normalizeText(asString(idea.description)),
    category: normalizeCategory(idea.category),
    badge: trimString(asString(idea.badge)) || undefined,
    templateBlocks: toTemplateBlocks(idea.templateBlocks),
    estimatedReadTime:
      trimString(asString(idea.estimatedReadTime)) || undefined,
  };
}

function parseIdeaFromSearchParams(
  searchParams: URLSearchParams,
): NewsletterIdeaSeedSource | null {
  const title = normalizeTitle(searchParams.get("title"));

  if (!title) {
    return null;
  }

  return {
    id:
      trimString(searchParams.get("templateId")) ||
      `newsletter-idea-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
    title,
    description: normalizeText(searchParams.get("description")),
    category: normalizeCategory(searchParams.get("category")),
    badge: trimString(searchParams.get(BADGE_SEARCH_PARAM)) || undefined,
    templateBlocks: parseTemplateBlocksFromSearchParams(
      searchParams.get(TEMPLATE_BLOCKS_SEARCH_PARAM),
    ),
    estimatedReadTime:
      trimString(searchParams.get(ESTIMATED_READ_TIME_SEARCH_PARAM)) ||
      undefined,
  };
}

function getTemplateBlockTitle(templateBlock: NewsletterIdeaTemplateBlock) {
  return normalizeTitle(
    templateBlock.title ??
      templateBlock.headline ??
      templateBlock.productName ??
      templateBlock.businessName,
  );
}

function getTemplateBlockBody(templateBlock: NewsletterIdeaTemplateBlock) {
  return normalizeText(
    templateBlock.body ??
      templateBlock.content ??
      templateBlock.description ??
      templateBlock.productDescription,
  );
}

function getTemplateBlockSubheading(
  templateBlock: NewsletterIdeaTemplateBlock,
) {
  return normalizeText(templateBlock.subheading);
}

function getTemplateBlockTagLabel(
  templateBlock: NewsletterIdeaTemplateBlock,
) {
  return normalizeText(templateBlock.tagLabel);
}

function getTemplateBlockTagline(templateBlock: NewsletterIdeaTemplateBlock) {
  return normalizeText(templateBlock.tagline);
}

function getTemplateBlockDateLabel(templateBlock: NewsletterIdeaTemplateBlock) {
  return normalizeText(templateBlock.dateLabel);
}

function getTemplateBlockButtonText(
  templateBlock: NewsletterIdeaTemplateBlock,
) {
  return trimString(
    templateBlock.buttonText ??
      templateBlock.ctaText ??
      templateBlock.cta_text,
  );
}

function getTemplateBlockButtonUrl(
  templateBlock: NewsletterIdeaTemplateBlock,
) {
  return (
    trimString(
      templateBlock.buttonUrl ??
        templateBlock.ctaUrl ??
        templateBlock.cta_url,
    ) || DEFAULT_CTA_URL
  );
}

function getTemplateBlockImageUrl(templateBlock: NewsletterIdeaTemplateBlock) {
  return trimString(templateBlock.imageUrl ?? templateBlock.image_url);
}

function getTemplateBlockImageAlt(
  templateBlock: NewsletterIdeaTemplateBlock,
  fallback: string,
) {
  return trimString(templateBlock.imageAlt ?? templateBlock.altText) || fallback;
}

function getTemplateBlockQuoteText(
  templateBlock: NewsletterIdeaTemplateBlock,
  fallback: string,
) {
  return normalizeText(templateBlock.quoteText) || fallback;
}

function buildHeaderBlock(
  idea: NewsletterIdeaSeedSource,
  designSystem?: StudioDesignSystem | null,
) {
  const block = createStudioBlock("newsletter-header", designSystem);
  const companyName = trimString(designSystem?.company.name);

  return {
    ...block,
    headline: companyName || idea.title,
    tagline: companyName ? idea.title : buildPreheaderText(idea),
    tagLabel: toIdeaLabel(idea),
  } satisfies StudioBlock;
}

function buildHeroBlock(
  idea: NewsletterIdeaSeedSource,
  designSystem?: StudioDesignSystem | null,
) {
  const block = createStudioBlock("email-safe-hero", designSystem);

  return {
    ...block,
    headline: idea.title,
    subheading: buildPreheaderText(idea),
    body: "Start with this seeded structure, then tailor each block with your own imagery, offers, links, and final copy.",
    tagLabel: toIdeaLabel(idea),
    buttonText: "",
    buttonUrl: "",
  } satisfies StudioBlock;
}

function buildIntroTextBlock(
  idea: NewsletterIdeaSeedSource,
  designSystem?: StudioDesignSystem | null,
) {
  const block = createStudioBlock("plain-text", designSystem);
  const intro = normalizeText(idea.description);

  return {
    ...block,
    body: intro
      ? `Hi {{ first_name | default: "Friend" }},<br /><br />${intro}`
      : `Hi {{ first_name | default: "Friend" }},<br /><br />This draft is seeded from the idea <strong>${idea.title}</strong> so you can continue refining it in Campaign Studio.`,
  } satisfies StudioBlock;
}

function buildAngleTextBlock(
  idea: NewsletterIdeaSeedSource,
  designSystem?: StudioDesignSystem | null,
) {
  const block = createStudioBlock("plain-text", designSystem);

  let body =
    "Use this section to expand the core idea, add one practical takeaway, and close with the next action you want readers to take.";

  switch (idea.category) {
    case "holiday":
      body =
        "Anchor the email around the holiday moment, explain why it matters now, and connect it to a timely offer, event, or featured collection.";
      break;
    case "seasonal":
    case "weekly":
      body =
        "Lead with what is timely right now, add a practical seasonal recommendation, and finish with a clear visit, booking, or purchase action.";
      break;
    case "product":
      body =
        "Highlight the featured product or collection, explain why it matters now, and point readers toward a direct purchase or inquiry path.";
      break;
    case "ai-generated":
      body =
        "Use this section to turn the AI concept into your own voice with one strong proof point, one useful takeaway, and one crisp next step.";
      break;
    default:
      break;
  }

  return {
    ...block,
    body: composeSectionBody("Suggested angle", body),
  } satisfies StudioBlock;
}

function buildCtaBlock(
  idea: NewsletterIdeaSeedSource,
  designSystem?: StudioDesignSystem | null,
) {
  const block = createStudioBlock("call-to-action", designSystem);

  return {
    ...block,
    headline: "Continue shaping this newsletter",
    body: `Review the seeded draft for ${idea.title}, refine the copy, and add any final links or visuals before you send.`,
    buttonText: "Review the draft",
    buttonUrl: trimString(designSystem?.company.websiteUrl) || DEFAULT_CTA_URL,
  } satisfies StudioBlock;
}

function buildFooterBlock(designSystem?: StudioDesignSystem | null) {
  return createStudioBlock("footer", designSystem);
}

function mapTemplateBlockToStudioBlock(
  templateBlock: NewsletterIdeaTemplateBlock,
  idea: NewsletterIdeaSeedSource,
  layout: NewsletterIdeaLayout,
  designSystem?: StudioDesignSystem | null,
) {
  const type = getTemplateBlockType(templateBlock);
  const title = getTemplateBlockTitle(templateBlock);
  const body = getTemplateBlockBody(templateBlock);
  const subheading = getTemplateBlockSubheading(templateBlock);
  const tagLabel = getTemplateBlockTagLabel(templateBlock);
  const tagline = getTemplateBlockTagline(templateBlock);
  const dateLabel = getTemplateBlockDateLabel(templateBlock);
  const buttonText = getTemplateBlockButtonText(templateBlock);
  const buttonUrl = getTemplateBlockButtonUrl(templateBlock);
  const imageUrl = getTemplateBlockImageUrl(templateBlock);
  const imageAlt = getTemplateBlockImageAlt(templateBlock, title || idea.title);

  switch (type) {
    case "header": {
      if (layout === "simple-email") {
        const block = createStudioBlock("plain-text", designSystem);
        return {
          ...block,
          body: composeSectionBody(
            title || idea.title,
            body || buildPreheaderText(idea),
          ),
        } satisfies StudioBlock;
      }

      const block = createStudioBlock("email-safe-hero", designSystem);
      return {
        ...block,
        headline: title || idea.title,
        subheading: body || buildPreheaderText(idea),
        body: "",
        tagLabel: toIdeaLabel(idea),
        buttonText: "",
        buttonUrl: "",
      } satisfies StudioBlock;
    }
    case "newsletter-header": {
      const block = createStudioBlock("newsletter-header", designSystem);
      return {
        ...block,
        headline: title || idea.title,
        tagline: tagline || body || buildPreheaderText(idea),
        tagLabel: tagLabel || toIdeaLabel(idea),
        dateLabel: dateLabel || block.dateLabel,
      } satisfies StudioBlock;
    }
    case "hero":
    case "email-safe-hero": {
      const block = createStudioBlock("email-safe-hero", designSystem);
      return {
        ...block,
        headline: title || idea.title,
        subheading: subheading || body || buildPreheaderText(idea),
        body: subheading && body ? body : "",
        tagLabel: tagLabel || toIdeaLabel(idea),
        buttonText,
        buttonUrl: buttonText ? buttonUrl : "",
      } satisfies StudioBlock;
    }
    case "graphic-hero": {
      const block = createStudioBlock("graphic-hero", designSystem);
      return {
        ...block,
        headline: title || idea.title,
        subheading: subheading || body || buildPreheaderText(idea),
        imageUrl,
        imageAlt,
        showButton: Boolean(buttonText),
        buttonText,
        buttonUrl: buttonText ? buttonUrl : "",
      } satisfies StudioBlock;
    }
    case "image-text": {
      if (!imageUrl || layout === "simple-email") {
        const block = createStudioBlock("plain-text", designSystem);
        return {
          ...block,
          body: composeSectionBody(title, body),
        } satisfies StudioBlock;
      }

      const block = createStudioBlock("image-text", designSystem);
      return {
        ...block,
        headline: title,
        subheading,
        body,
        imageUrl,
        imageAlt,
        buttonText,
        buttonUrl: buttonText ? buttonUrl : "",
      } satisfies StudioBlock;
    }
    case "button":
    case "cta":
    case "call-to-action": {
      const block = createStudioBlock("call-to-action", designSystem);
      return {
        ...block,
        headline: title || "Take the next step",
        body: body || `Continue building the ${idea.title} campaign in Studio.`,
        buttonText: buttonText || "Open the draft",
        buttonUrl,
      } satisfies StudioBlock;
    }
    case "quote": {
      const block = createStudioBlock("quote", designSystem);
      return {
        ...block,
        quoteText: getTemplateBlockQuoteText(templateBlock, body || title || idea.title),
        authorName: trimString(templateBlock.authorName) || "Campaign Studio",
        authorTitle: normalizeText(templateBlock.authorTitle) || toIdeaLabel(idea),
      } satisfies StudioBlock;
    }
    case "divider": {
      return createStudioBlock("divider", designSystem);
    }
    case "spacer": {
      return createStudioBlock("spacer", designSystem);
    }
    case "image":
    case "full-width-image": {
      if (!imageUrl) {
        return null;
      }

      const block = createStudioBlock("full-width-image", designSystem);
      return {
        ...block,
        imageUrl,
        imageAlt,
        caption: body,
        showCaption: Boolean(body),
      } satisfies StudioBlock;
    }
    case "product":
    case "product-card": {
      const block = createStudioBlock("product-card", designSystem);
      const productName = title || trimString(templateBlock.productName) || idea.title;

      return {
        ...block,
        productName,
        productPrice: trimString(templateBlock.productPrice),
        originalPrice: trimString(templateBlock.originalPrice),
        productDescription: body,
        imageUrl,
        imageAlt,
        badgeText: trimString(templateBlock.badgeText),
        buttonText,
        buttonUrl: buttonText ? buttonUrl : "",
      } satisfies StudioBlock;
    }
    case "image-gallery": {
      const block = createStudioBlock("image-gallery", designSystem);

      if (!Array.isArray(templateBlock.galleryImages)) {
        return imageUrl
          ? {
              ...createStudioBlock("full-width-image", designSystem),
              imageUrl,
              imageAlt,
              caption: body,
              showCaption: Boolean(body),
            }
          : null;
      }

      return {
        ...block,
        headline: title,
        body,
        galleryImages: templateBlock.galleryImages,
      } satisfies StudioBlock;
    }
    case "product-gallery": {
      const block = createStudioBlock("product-gallery", designSystem);
      return {
        ...block,
        headline: title,
        body,
        galleryProducts: Array.isArray(templateBlock.galleryProducts)
          ? templateBlock.galleryProducts
          : block.galleryProducts,
      } satisfies StudioBlock;
    }
    case "social-follow": {
      const block = createStudioBlock("social-follow", designSystem);
      return {
        ...block,
        socialLabel: title || body,
        socialLinks: Array.isArray(templateBlock.socialLinks)
          ? templateBlock.socialLinks
          : block.socialLinks,
      } satisfies StudioBlock;
    }
    case "footer": {
      const block = createStudioBlock("footer", designSystem);
      const websiteUrl = trimString(templateBlock.websiteUrl);

      return {
        ...block,
        businessName:
          trimString(templateBlock.businessName) || title || block.businessName,
        address: normalizeText(templateBlock.address) || block.address,
        complianceText:
          normalizeText(templateBlock.complianceText) || body || block.complianceText,
        websiteUrl: websiteUrl || block.websiteUrl,
        showWebsiteLink: Boolean(websiteUrl || block.websiteUrl),
        footerSocialLinks: Array.isArray(templateBlock.socialLinks)
          ? templateBlock.socialLinks
          : block.footerSocialLinks,
      } satisfies StudioBlock;
    }
    case "text":
    case "plain-text":
    default: {
      const block = createStudioBlock("plain-text", designSystem);
      if (!title && !body) {
        return null;
      }

      return {
        ...block,
        body: composeSectionBody(title, body),
      } satisfies StudioBlock;
    }
  }
}

function finalizeBlocks(blocks: StudioBlock[]) {
  return blocks.map((block, index) => ({
    ...block,
    order: index,
    visible: block.visible !== false,
  }));
}

function buildFallbackBlocks(
  idea: NewsletterIdeaSeedSource,
  designSystem?: StudioDesignSystem | null,
) {
  return [
    buildIntroTextBlock(idea, designSystem),
    buildAngleTextBlock(idea, designSystem),
  ];
}

function hasSourceBlockType(
  templateBlocks: NewsletterIdeaTemplateBlock[],
  blockTypes: Set<string>,
) {
  return templateBlocks.some((templateBlock) =>
    blockTypes.has(getTemplateBlockType(templateBlock)),
  );
}

function buildSeedBlocks(
  idea: NewsletterIdeaSeedSource,
  layout: NewsletterIdeaLayout,
  designSystem?: StudioDesignSystem | null,
) {
  // Mapping rules:
  // - Preserve every source template block in source order. Never truncate.
  // - Layout changes how a source block maps, not how many blocks survive.
  // - Only inject synthetic header, hero, CTA, or footer blocks when the
  //   source omits that structure entirely.
  // - Let footer compliance keep the single footer at the end instead of
  //   creating duplicate structural blocks in the seed path.
  const sourceTemplateBlocks = toTemplateBlocks(idea.templateBlocks);
  const mappedBlocks = sourceTemplateBlocks
    .map((templateBlock) =>
      mapTemplateBlockToStudioBlock(templateBlock, idea, layout, designSystem),
    )
    .filter((block): block is StudioBlock => block !== null);
  const blocks: StudioBlock[] = [];

  const hasSourceHeaderLikeBlock = hasSourceBlockType(
    sourceTemplateBlocks,
    HEADER_LIKE_SOURCE_TYPES,
  );
  const hasSourceCtaBlock = hasSourceBlockType(
    sourceTemplateBlocks,
    CTA_LIKE_SOURCE_TYPES,
  );
  const hasSourceFooterBlock = hasSourceBlockType(
    sourceTemplateBlocks,
    FOOTER_LIKE_SOURCE_TYPES,
  );

  if (!hasSourceHeaderLikeBlock) {
    blocks.push(buildHeaderBlock(idea, designSystem));
  }

  if (layout === "block-builder" && !hasSourceHeaderLikeBlock) {
    blocks.push(buildHeroBlock(idea, designSystem));
  }

  if (mappedBlocks.length > 0) {
    blocks.push(...mappedBlocks);
  } else {
    blocks.push(...buildFallbackBlocks(idea, designSystem));
  }

  if (!hasSourceCtaBlock && !blocks.some((block) => block.type === "call-to-action")) {
    blocks.push(buildCtaBlock(idea, designSystem));
  }

  if (!hasSourceFooterBlock && !blocks.some((block) => block.type === "footer")) {
    blocks.push(buildFooterBlock(designSystem));
  }

  return finalizeBlocks(blocks);
}

export function resolveNewsletterIdeaDraftSeed({
  locationState,
  searchParams,
  designSystem,
}: {
  locationState: unknown;
  searchParams: URLSearchParams;
  designSystem?: StudioDesignSystem | null;
}): NewsletterIdeaDraftSeed | null {
  const layoutFromState =
    isRecord(locationState) &&
    isNewsletterIdeaLayout(locationState.newsletterLayout)
      ? locationState.newsletterLayout
      : null;
  const ideaFromState = parseIdeaFromLocationState(locationState);
  const layoutFromSearch = isNewsletterIdeaLayout(searchParams.get("layout"))
    ? searchParams.get("layout")
    : null;
  const layout = layoutFromState ?? layoutFromSearch;
  const idea = ideaFromState ?? parseIdeaFromSearchParams(searchParams);
  const isPickerFlow =
    searchParams.get("type") === "newsletter" &&
    searchParams.get("flow") === "template-picker" &&
    searchParams.get("source") === "picker";

  if (!layout || !idea || !isPickerFlow) {
    return null;
  }

  const preheaderText = buildPreheaderText(idea);

  return {
    name: idea.title,
    subjectLine: idea.title,
    preheaderText,
    contentBlocks: buildSeedBlocks(idea, layout, designSystem),
  };
}
