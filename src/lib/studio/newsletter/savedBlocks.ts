import type { StudioBlock } from "@/types/studioBlocks";
import { STUDIO_BLOCK_LOOKUP } from "@/components/crm/studio/blockLibraryData";
const MAX_BLOCK_BYTES = 256_000;
export interface SavedBlock {
  id: string;
  name: string;
  block: StudioBlock;
  updatedAt: string;
}
export function readSavedBlock(value: unknown): StudioBlock | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (
    typeof record.type !== "string" ||
    !Object.prototype.hasOwnProperty.call(STUDIO_BLOCK_LOOKUP, record.type) ||
    record.type === "footer"
  )
    return null;
  if (typeof record.id !== "string" || typeof record.label !== "string")
    return null;
  // Saved designs are untrusted JSON (including manually imported browser records).
  // Validate nested values before renderer helpers receive them.
  const scalars: Array<[readonly string[], string]> = [
    [
      [
        "headingLevel",
        "couponAmount",
        "couponBundlePrice",
        "couponRegularPrice",
        "couponSizing",
        "couponExpiry",
        "couponBarcode",
        "couponBarcodeImageUrl",
        "productSubtitle",
        "tableCaption",
        "chartUnit",
        "videoUrl",
        "eventDate",
        "eventLocation",
        "headerBannerUrl",
        "id",
        "type",
        "label",
        "couponOffer",
        "couponPrice",
        "couponConditions",
        "couponImageSide",
        "headline",
        "subheading",
        "body",
        "tagLabel",
        "tagline",
        "dateLabel",
        "imageUrl",
        "imageAlt",
        "linkUrl",
        "caption",
        "captionAlignment",
        "captionColor",
        "businessName",
        "address",
        "copyright",
        "copyrightText",
        "complianceText",
        "websiteUrl",
        "linkColor",
        "buttonText",
        "buttonUrl",
        "buttonColor",
        "buttonTextColor",
        "buttonSize",
        "buttonStyle",
        "secondaryLinkText",
        "secondaryLinkUrl",
        "backgroundColor",
        "textColor",
        "textAlign",
        "accentColor",
        "overlayColor",
        "overlayGradientDirection",
        "heroStyle",
        "gradientFrom",
        "gradientTo",
        "layout",
        "layoutPreset",
        "logoUrl",
        "logoAlignment",
        "logoShape",
        "imageFit",
        "imagePosition",
        "imageRatio",
        "columnSplit",
        "cardBackgroundColor",
        "lineColor",
        "dividerBelowColor",
        "lineStyle",
        "lineType",
        "ornamentSymbol",
        "ornamentColor",
        "textPosition",
        "captionBarColor",
        "fontSize",
        "fontSizePreset",
        "fontStyle",
        "fontWeightPreset",
        "quoteText",
        "authorName",
        "authorTitle",
        "authorImageUrl",
        "authorAvatarUrl",
        "productName",
        "productPrice",
        "originalPrice",
        "productDescription",
        "badgeText",
        "badgeColor",
        "badgeTextColor",
        "badgePosition",
        "socialLabel",
        "iconStyle",
        "footerIconStyle",
        "iconSize",
        "iconColorMode",
        "footerIconColor",
        "socialIconStyle",
        "socialIconSize",
        "socialColorMode",
        "customIconColor",
      ],
      "string",
    ],
    [
      [
        "couponPercent",
        "couponBuyQuantity",
        "couponBundleQuantity",
        "couponMinimumQuantity",
        "order",
        "accentThickness",
        "overlayOpacity",
        "logoSize",
        "borderRadius",
        "cardBorderRadius",
        "boxBorderRadius",
        "contentPadding",
        "verticalPadding",
        "imageFocalX",
        "imageFocalY",
        "imageHeight",
        "maxHeight",
        "gridColumns",
        "gridGap",
        "cardGap",
        "lineThickness",
        "lineWidth",
        "paddingTop",
        "paddingBottom",
        "ornamentSize",
        "spacerHeight",
        "lineHeight",
        "lineHeightValue",
        "authorAvatarSize",
        "quoteMarkSize",
        "iconSpacing",
      ],
      "number",
    ],
    [
      [
        "visible",
        "couponBorder",
        "couponScissors",
        "showCaption",
        "showUnsubscribe",
        "showManagePreferences",
        "showWebsiteLink",
        "buttonRounded",
        "fullWidthButton",
        "showSecondaryLink",
        "showAccent",
        "showOverlay",
        "imagePadding",
        "insetPadding",
        "showOrnament",
        "showDottedOutline",
        "showDivider",
        "showDividerBelow",
        "showBorder",
        "showCardBorder",
        "showShadow",
        "showBadges",
        "showPrices",
        "showOriginalPrice",
        "showCtaButtons",
        "showDescription",
        "showTextOverlay",
        "textShadow",
        "showButton",
        "showCaptionBar",
        "showAuthorImage",
        "showSocialInFooter",
      ],
      "boolean",
    ],
  ];
  for (const [keys, kind] of scalars)
    for (const key of keys) {
      const item = record[key];
      if (
        item !== undefined &&
        item !== null &&
        (typeof item !== kind || (kind === "number" && !Number.isFinite(item)))
      )
        return null;
    }
  for (const key of [
    "galleryImages",
    "galleryProducts",
    "links",
    "badges",
    "chartData",
  ]) {
    const items = record[key];
    if (
      items !== undefined &&
      (!Array.isArray(items) ||
        items.length > 500 ||
        items.some(
          (item) => !item || typeof item !== "object" || Array.isArray(item),
        ))
    )
      return null;
  }
  for (const key of [
    "galleryImages",
    "galleryProducts",
    "links",
    "badges",
    "chartData",
    "socialLinks",
    "footerSocialLinks",
  ]) {
    const items = record[key];
    if (items === undefined) continue;
    if (!Array.isArray(items) || items.length > 500) return null;
    for (const item of items) {
      if (!item || typeof item !== "object" || Array.isArray(item)) return null;
      for (const [field, cell] of Object.entries(item)) {
        if (cell === undefined || cell === null) continue;
        if (key === "chartData" && field === "value") {
          if (typeof cell !== "number" || !Number.isFinite(cell)) return null;
        } else if (
          ["socialLinks", "footerSocialLinks"].includes(key) &&
          field === "enabled"
        ) {
          if (typeof cell !== "boolean") return null;
        } else if (typeof cell !== "string") return null;
      }
    }
  }
  for (const key of ["textColumns", "tableHeaders"]) {
    const items = record[key];
    if (
      items !== undefined &&
      (!Array.isArray(items) || items.some((item) => typeof item !== "string"))
    )
      return null;
  }
  if (
    record.tableRows !== undefined &&
    (!Array.isArray(record.tableRows) ||
      record.tableRows.some(
        (row) =>
          !Array.isArray(row) || row.some((cell) => typeof cell !== "string"),
      ))
  )
    return null;
  for (const key of ["appearance", "audience"]) {
    if (
      record[key] !== undefined &&
      (!record[key] ||
        typeof record[key] !== "object" ||
        Array.isArray(record[key]))
    )
      return null;
  }
  const audience = record.audience as Record<string, unknown> | undefined;
  if (
    audience &&
    ((audience.mode !== "all" && audience.mode !== "segments") ||
      (audience.segmentIds !== undefined &&
        (!Array.isArray(audience.segmentIds) ||
          audience.segmentIds.some((id) => typeof id !== "string"))))
  )
    return null;
  const appearance = record.appearance as Record<string, unknown> | undefined;
  if (appearance) {
    for (const key of [
      "margin",
      "padding",
      "imageMargin",
      "imagePadding",
      "border",
      "text",
    ]) {
      const object = appearance[key];
      if (
        object !== undefined &&
        (!object || typeof object !== "object" || Array.isArray(object))
      )
        return null;
    }
    if (
      appearance.text &&
      Object.values(appearance.text).some(
        (item) => !item || typeof item !== "object" || Array.isArray(item),
      )
    )
      return null;
    if (
      appearance.linkDecoration !== undefined &&
      !["none", "underline"].includes(String(appearance.linkDecoration))
    )
      return null;
  }
  try {
    const encoded = JSON.stringify(value);
    if (new TextEncoder().encode(encoded).byteLength > MAX_BLOCK_BYTES)
      return null;
    const clone = JSON.parse(encoded) as StudioBlock;
    delete clone.newsletterSettings;
    for (const [keys] of scalars)
      for (const key of keys)
        if ((clone as unknown as Record<string, unknown>)[key] === null)
          delete (clone as unknown as Record<string, unknown>)[key];
    clone.order = 0;
    clone.visible = true;
    return clone;
  } catch {
    return null;
  }
}
export function savedBlockName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed || trimmed.length > 160)
    throw new Error("Enter a block name between 1 and 160 characters.");
  return trimmed;
}
export function cloneSavedBlock(source: StudioBlock): StudioBlock {
  const block = readSavedBlock(source);
  if (!block)
    throw new Error("This saved block is not a supported newsletter block.");
  block.id = crypto.randomUUID();
  block.galleryImages = block.galleryImages?.map((image) => ({
    ...image,
    id: crypto.randomUUID(),
  }));
  block.galleryProducts = block.galleryProducts?.map((product) => ({
    ...product,
    id: crypto.randomUUID(),
  }));
  block.links = block.links?.map((link) => ({
    ...link,
    id: crypto.randomUUID(),
  }));
  block.badges = block.badges?.map((badge) => ({
    ...badge,
    id: crypto.randomUUID(),
  }));
  return block;
}
export function readBrowserSavedBlocks(
  storage: Pick<Storage, "getItem">,
): Array<{ name: string; block: StudioBlock }> {
  try {
    const parsed: unknown = JSON.parse(
      storage.getItem("bloomsuite-saved-block-templates") || "[]",
    );
    if (!Array.isArray(parsed)) return [];
    return parsed.slice(0, 100).flatMap((value) => {
      if (!value || typeof value !== "object") return [];
      const record = value as Record<string, unknown>;
      const block = readSavedBlock(record.block);
      return block
        ? [{ name: String(record.name || block.label).slice(0, 160), block }]
        : [];
    });
  } catch {
    return [];
  }
}
