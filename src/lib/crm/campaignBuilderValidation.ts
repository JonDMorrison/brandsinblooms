import { decodeHtmlEntities } from "@/lib/email/linkRewriter";
import type { ContentBlock } from "@/types/emailBuilder";

const PLACEHOLDER_HOSTNAMES = new Set(["example.com", "www.example.com"]);

const GENERIC_PLACEHOLDER_TEXT = new Set(
  [
    "Hero headline",
    "Add a concise supporting message",
    "Enter headline",
    "Enter subheading",
    "Explain what happens next",
    "Enter body text",
    "Call to action",
    "Call to Action",
  ].map(normalizeComparableText),
);

const BLOCK_PLACEHOLDER_FIELDS: Partial<
  Record<ContentBlock["type"], Partial<Record<BuilderTextField, string[]>>>
> = {
  "email-safe-hero": {
    headline: ["Hero headline"],
    subtitle: ["Add a concise supporting message"],
  },
  button: {
    headline: ["Call to action"],
    body: ["Explain what happens next"],
  },
  "image-gallery": {
    headline: ["Image gallery"],
    body: ["Add context for this gallery"],
  },
  "product-gallery": {
    headline: ["Product gallery"],
    body: ["Showcase featured products, bundles, or seasonal picks"],
  },
};

const SUBJECT_PLACEHOLDER_PATTERNS = [
  /^subject$/i,
  /^test$/i,
  /^untitled$/i,
  /^\(no subject\)$/i,
];

type BuilderTextField =
  | "eyebrow"
  | "headline"
  | "subtitle"
  | "body"
  | "buttonText"
  | "quote"
  | "author"
  | "authorTitle"
  | "caption";

export interface BuilderTextFieldValue {
  field: BuilderTextField;
  label: string;
  value: string;
}

export interface BlockFieldIssue {
  blockId: string;
  blockIndex: number;
  blockType: ContentBlock["type"];
  blockLabel: string;
  field: BuilderTextField;
  fieldLabel: string;
  value: string;
}

export interface BlockIssue {
  blockId: string;
  blockIndex: number;
  blockType: ContentBlock["type"];
  blockLabel: string;
  detail: string;
}

export interface BuilderUrlValidationResult {
  sanitizedUrl: string;
  decodedUrl: string;
  isPresent: boolean;
  isValid: boolean;
  wasPlaceholder: boolean;
}

export interface CTAFieldValidationResult {
  sanitizedUrl: string;
  urlError?: string;
  wasPlaceholder: boolean;
}

export interface BlockEditorValidationResult {
  sanitizedBlock: ContentBlock;
  fieldErrors: Partial<Record<"buttonUrl" | "imageUrl", string>>;
  isValid: boolean;
}

export interface SubjectValidationResult {
  value: string;
  characterCount: number;
  isMissing: boolean;
  isPlaceholder: boolean;
  warnings: string[];
}

export interface AudienceValidationResult {
  recipientCount: number;
  hasRecipients: boolean;
  detail: string;
  warnings: string[];
}

function stripHtml(value: string): string {
  return decodeHtmlEntities(value)
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeComparableText(value: string): string {
  return stripHtml(value)
    .trim()
    .replace(/[.!?]+$/g, "")
    .toLowerCase();
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function getPrimaryTextFields(block: ContentBlock): BuilderTextFieldValue[] {
  const fields: BuilderTextFieldValue[] = [
    {
      field: "eyebrow",
      label: "Eyebrow",
      value: stringValue(block.eyebrow),
    },
    {
      field: "headline",
      label: "Headline",
      value: stringValue(block.headline || block.title || block.heading),
    },
    {
      field: "subtitle",
      label: "Subheading",
      value: stringValue(block.subtitle),
    },
    {
      field: "body",
      label: "Body",
      value: stringValue(block.body || block.content),
    },
    {
      field: "buttonText",
      label: "Button text",
      value: stringValue(block.buttonText || block.ctaText),
    },
    {
      field: "quote",
      label: "Quote",
      value: stringValue(block.quote),
    },
    {
      field: "author",
      label: "Author",
      value: stringValue(block.author),
    },
    {
      field: "authorTitle",
      label: "Author title",
      value: stringValue(block.authorTitle),
    },
    {
      field: "caption",
      label: "Caption",
      value: stringValue(block.caption),
    },
  ];

  return fields.filter((field) => field.value.length > 0);
}

export function getBlockDisplayLabel(
  block: Pick<ContentBlock, "type">,
  blockIndex: number,
): string {
  const typeLabel = {
    header: "Header",
    text: "Text",
    image: "Image",
    "image-text": "Image + Text",
    button: "Button",
    divider: "Divider",
    product: "Product",
    quote: "Quote",
    cta: "CTA",
    "newsletter-header": "Newsletter Header",
    "image-gallery": "Image Gallery",
    "product-gallery": "Product Gallery",
    "social-follow": "Social Follow",
    footer: "Footer",
    "email-safe-hero": "Hero",
    "graphic-hero": "Graphic Hero",
  }[block.type];

  return `${typeLabel || block.type} block #${blockIndex + 1}`;
}

function hasPlaceholderValue(
  block: ContentBlock,
  field: BuilderTextField,
  value: string,
): boolean {
  const normalizedValue = normalizeComparableText(value);
  if (!normalizedValue) return false;

  if (GENERIC_PLACEHOLDER_TEXT.has(normalizedValue)) {
    return true;
  }

  const blockPlaceholders = BLOCK_PLACEHOLDER_FIELDS[block.type]?.[field] ?? [];
  return blockPlaceholders
    .map(normalizeComparableText)
    .includes(normalizedValue);
}

function hasMeaningfulImage(block: ContentBlock): boolean {
  return stringValue(block.imageUrl).length > 0;
}

function hasMeaningfulGallery(block: ContentBlock): boolean {
  if (Array.isArray(block.galleryImages) && block.galleryImages.length > 0) {
    return block.galleryImages.some(
      (image) => stringValue(image.url).length > 0,
    );
  }

  if (Array.isArray(block.galleryItems) && block.galleryItems.length > 0) {
    return block.galleryItems.some(
      (item) =>
        stringValue(item.imageUrl).length > 0 ||
        stringValue(item.title).length > 0 ||
        stringValue(item.url).length > 0,
    );
  }

  return false;
}

function hasAnyRenderableContent(block: ContentBlock): boolean {
  if (getPrimaryTextFields(block).length > 0) {
    return true;
  }

  if (hasMeaningfulImage(block)) {
    return true;
  }

  if (hasMeaningfulGallery(block)) {
    return true;
  }

  return false;
}

export function getVisibleContentBlocks(
  blocks: ContentBlock[],
): ContentBlock[] {
  return blocks.filter(
    (block) => block.type !== "footer" && block.visible !== false,
  );
}

export function normalizeBuilderUrl(
  rawUrl: string | null | undefined,
): BuilderUrlValidationResult {
  const rawValue = typeof rawUrl === "string" ? rawUrl.trim() : "";
  const decodedUrl = decodeHtmlEntities(rawValue).trim();

  if (!decodedUrl) {
    return {
      sanitizedUrl: "",
      decodedUrl,
      isPresent: false,
      isValid: true,
      wasPlaceholder: false,
    };
  }

  try {
    const parsed = new URL(decodedUrl);
    const protocol = parsed.protocol.toLowerCase();
    const hostname = parsed.hostname.toLowerCase();
    const wasPlaceholder = PLACEHOLDER_HOSTNAMES.has(hostname);
    const isHttpProtocol = protocol === "http:" || protocol === "https:";
    const hasDomain = hostname.includes(".") && !hostname.startsWith(".");

    return {
      sanitizedUrl:
        wasPlaceholder || !isHttpProtocol || !hasDomain
          ? ""
          : parsed.toString(),
      decodedUrl,
      isPresent: true,
      isValid: isHttpProtocol && hasDomain && !wasPlaceholder,
      wasPlaceholder,
    };
  } catch {
    return {
      sanitizedUrl: "",
      decodedUrl,
      isPresent: true,
      isValid: false,
      wasPlaceholder: false,
    };
  }
}

export function validateCTAFields(params: {
  buttonText?: string | null;
  buttonUrl?: string | null;
}): CTAFieldValidationResult {
  const buttonText = stringValue(params.buttonText);
  const urlResult = normalizeBuilderUrl(params.buttonUrl);

  if (urlResult.isPresent && !urlResult.isValid) {
    return {
      sanitizedUrl: urlResult.sanitizedUrl,
      urlError: "Please enter a valid URL for this button",
      wasPlaceholder: urlResult.wasPlaceholder,
    };
  }

  if (buttonText.length > 0 && !urlResult.sanitizedUrl) {
    return {
      sanitizedUrl: "",
      urlError: "Please enter a valid URL for this button",
      wasPlaceholder: urlResult.wasPlaceholder,
    };
  }

  return {
    sanitizedUrl: urlResult.sanitizedUrl,
    wasPlaceholder: urlResult.wasPlaceholder,
  };
}

export function validateBlockBeforeSave(
  block: ContentBlock,
): BlockEditorValidationResult {
  const buttonText = block.buttonText || block.ctaText || "";
  const buttonUrl = block.buttonUrl || block.ctaUrl || "";
  const ctaValidation = validateCTAFields({ buttonText, buttonUrl });
  const sanitizedBlock: ContentBlock = {
    ...block,
    buttonUrl: ctaValidation.sanitizedUrl,
    ctaUrl: ctaValidation.sanitizedUrl,
  };
  const fieldErrors: Partial<Record<"buttonUrl" | "imageUrl", string>> = {};

  if (ctaValidation.urlError) {
    fieldErrors.buttonUrl = ctaValidation.urlError;
  }

  const requiresPrimaryImage =
    block.type === "graphic-hero" ||
    (block.type === "image" && block.layout === "full-width");

  if (requiresPrimaryImage && !hasMeaningfulImage(block)) {
    fieldErrors.imageUrl = "Please add an image before saving this block";
  }

  return {
    sanitizedBlock,
    fieldErrors,
    isValid: Object.keys(fieldErrors).length === 0,
  };
}

export function findPlaceholderTextIssues(
  blocks: ContentBlock[],
): BlockFieldIssue[] {
  return getVisibleContentBlocks(blocks).flatMap((block, index) => {
    const blockLabel = getBlockDisplayLabel(block, index);

    return getPrimaryTextFields(block)
      .filter((field) => hasPlaceholderValue(block, field.field, field.value))
      .map((field) => ({
        blockId: block.id,
        blockIndex: index,
        blockType: block.type,
        blockLabel,
        field: field.field,
        fieldLabel: field.label,
        value: field.value,
      }));
  });
}

export function findEmptyBlocks(blocks: ContentBlock[]): BlockIssue[] {
  return getVisibleContentBlocks(blocks)
    .map((block, index) => ({ block, index }))
    .filter(({ block }) => !hasAnyRenderableContent(block))
    .map(({ block, index }) => ({
      blockId: block.id,
      blockIndex: index,
      blockType: block.type,
      blockLabel: getBlockDisplayLabel(block, index),
      detail: `${getBlockDisplayLabel(block, index)} has no content and will render as a blank section.`,
    }));
}

export function findIncompleteImageBlocks(
  blocks: ContentBlock[],
): BlockIssue[] {
  return getVisibleContentBlocks(blocks)
    .map((block, index) => ({ block, index }))
    .filter(
      ({ block }) =>
        (block.type === "graphic-hero" ||
          (block.type === "image" && block.layout === "full-width")) &&
        !hasMeaningfulImage(block),
    )
    .map(({ block, index }) => ({
      blockId: block.id,
      blockIndex: index,
      blockType: block.type,
      blockLabel: getBlockDisplayLabel(block, index),
      detail: `${getBlockDisplayLabel(block, index)} has no image and will appear empty in the email.`,
    }));
}

export function validateSubjectLine(
  subjectLine: string,
  campaignType: "email" | "sms",
): SubjectValidationResult {
  const value = stringValue(subjectLine);
  const characterCount = value.length;
  const warnings: string[] = [];

  if (campaignType === "sms") {
    return {
      value,
      characterCount,
      isMissing: false,
      isPlaceholder: false,
      warnings,
    };
  }

  const isPlaceholder = SUBJECT_PLACEHOLDER_PATTERNS.some((pattern) =>
    pattern.test(value),
  );

  if (characterCount > 60) {
    warnings.push(
      "Subject lines over 60 characters may be truncated in inboxes.",
    );
  }

  if (isPlaceholder) {
    warnings.push("Subject line still looks like placeholder text.");
  }

  return {
    value,
    characterCount,
    isMissing: value.length === 0,
    isPlaceholder,
    warnings,
  };
}

export function validateAudienceSelection(params: {
  recipientCount: number | null | undefined;
  invalidEmailCount?: number | null;
}): AudienceValidationResult {
  const recipientCount = Number.isFinite(Number(params.recipientCount))
    ? Math.max(0, Number(params.recipientCount))
    : 0;
  const warnings: string[] = [];

  if ((params.invalidEmailCount ?? 0) > 0) {
    warnings.push(
      `${Number(params.invalidEmailCount).toLocaleString()} contacts have missing or invalid email addresses.`,
    );
  }

  return {
    recipientCount,
    hasRecipients: recipientCount > 0,
    detail: `This campaign will be sent to ${recipientCount.toLocaleString()} recipients.`,
    warnings,
  };
}
