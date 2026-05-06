import { STUDIO_BLOCK_LOOKUP } from "@/components/crm/studio/blockLibraryData";
import type {
  AIImageStudioCampaignContext,
  AIImageStudioCampaignContextAspectRatio,
} from "@/components/crm/ai-image-studio/types";
import type { EditorCampaignType } from "@/lib/crm/campaignEditor";
import type { StudioBlock } from "@/types/studioBlocks";

const MAX_CONTENT_SUMMARY_LENGTH = 200;

function normalizeVisibleText(value: unknown) {
  if (typeof value !== "string") {
    return "";
  }

  return value
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function truncateText(value: string, maxLength: number) {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength - 3).trimEnd()}...`;
}

function omitEmptyFields(record: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(record).flatMap(([key, value]) => {
      const normalizedValue = normalizeVisibleText(value);
      return normalizedValue ? [[key, normalizedValue]] : [];
    }),
  ) as Record<string, string>;
}

function joinProductField(
  products: StudioBlock["galleryProducts"],
  selector: (
    product: NonNullable<StudioBlock["galleryProducts"]>[number],
  ) => string | undefined,
) {
  const joinedValue = (products ?? [])
    .map((product) => normalizeVisibleText(selector(product)))
    .filter(Boolean)
    .join(", ");

  return joinedValue ? truncateText(joinedValue, 120) : "";
}

export function extractBlockContentFields(block: StudioBlock) {
  switch (block.type) {
    case "email-safe-hero":
      return omitEmptyFields({
        eyebrow: block.tagLabel,
        headline: block.headline,
        subheading: block.subheading,
        bodyText: block.body,
      });
    case "image-text":
      return omitEmptyFields({
        headline: block.headline,
        subheading: block.subheading,
        bodyText: block.body,
      });
    case "graphic-hero":
      return omitEmptyFields({
        headline: block.headline,
        subheading: block.subheading,
      });
    case "full-width-image":
      return omitEmptyFields({
        caption: block.caption,
      });
    case "newsletter-header":
      return omitEmptyFields({
        headline: block.headline,
        dateLabel: block.dateLabel,
        tagline: block.tagline,
      });
    case "plain-text":
      return omitEmptyFields({
        bodyText: block.body,
      });
    case "quote":
      return omitEmptyFields({
        quoteText: block.quoteText,
        authorName: block.authorName,
        authorTitle: block.authorTitle,
      });
    case "product-card":
      return omitEmptyFields({
        title: block.productName,
        description: block.productDescription,
        badgeText: block.badgeText,
      });
    case "image-gallery":
      return omitEmptyFields({});
    case "product-gallery":
      return omitEmptyFields({
        productNames: joinProductField(
          block.galleryProducts,
          (product) => product.name,
        ),
        productDescriptions: joinProductField(
          block.galleryProducts,
          (product) => product.description,
        ),
        badgeText: joinProductField(
          block.galleryProducts,
          (product) => product.badgeText,
        ),
      });
    case "call-to-action":
      return omitEmptyFields({
        headline: block.headline,
        bodyText: block.body,
        buttonText: block.buttonText,
      });
    case "social-follow":
      return omitEmptyFields({
        socialLabel: block.socialLabel,
      });
    case "footer":
      return omitEmptyFields({
        businessName: block.businessName,
        address: block.address,
        complianceText: block.complianceText,
      });
    case "divider":
    case "spacer":
    default:
      return omitEmptyFields({
        headline: block.headline,
        subheading: block.subheading,
        bodyText: block.body,
      });
  }
}

export function extractBlockContentSummary(block: StudioBlock) {
  const blockContent = extractBlockContentFields(block);
  const summary = Object.values(blockContent).join(" — ");
  return summary ? truncateText(summary, MAX_CONTENT_SUMMARY_LENGTH) : "";
}

export function buildStudioCampaignContext({
  aspectRatioHint,
  block,
  campaignName,
  campaignType,
}: {
  aspectRatioHint: AIImageStudioCampaignContextAspectRatio;
  block: StudioBlock;
  campaignName: string;
  campaignType: EditorCampaignType;
}): AIImageStudioCampaignContext {
  return {
    aspectRatioHint,
    blockContent: extractBlockContentFields(block),
    blockLabel: STUDIO_BLOCK_LOOKUP[block.type]?.name ?? block.label,
    blockType: block.type,
    campaignName: normalizeVisibleText(campaignName) || "Untitled Campaign",
    campaignType,
    contentSummary: extractBlockContentSummary(block),
  };
}
