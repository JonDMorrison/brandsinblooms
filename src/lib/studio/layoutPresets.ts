import type { StudioDesignSystem } from "@/lib/studio/designSystem";
import type { StudioBlock } from "@/types/studioBlocks";

export interface LayoutPreset {
  key: string;
  name: string;
  thumbnail: string;
  description: string;
  fields: Partial<StudioBlock>;
}

function getBrandTextColor(
  designSystem: StudioDesignSystem | null | undefined,
  fallback: string,
) {
  return designSystem?.colors.text || fallback;
}

function getBrandPrimaryColor(
  designSystem: StudioDesignSystem | null | undefined,
  fallback: string,
) {
  return designSystem?.colors.primary || fallback;
}

function getBrandSecondaryColor(
  designSystem: StudioDesignSystem | null | undefined,
  fallback: string,
) {
  return designSystem?.colors.secondary || fallback;
}

function getBrandButtonFields(
  designSystem: StudioDesignSystem | null | undefined,
  fallbackButtonColor: string,
  fallbackButtonTextColor: string,
) {
  if (!designSystem?.colors.primary) {
    return {
      buttonColor: fallbackButtonColor,
      buttonTextColor: fallbackButtonTextColor,
    } satisfies Partial<StudioBlock>;
  }

  return {
    buttonColor: designSystem.colors.primary,
    buttonTextColor: designSystem.colors.primaryContrastText,
  } satisfies Partial<StudioBlock>;
}

function getReversedBrandButtonFields(
  designSystem: StudioDesignSystem | null | undefined,
  fallbackButtonColor: string,
  fallbackButtonTextColor: string,
) {
  if (!designSystem?.colors.primary) {
    return {
      buttonColor: fallbackButtonColor,
      buttonTextColor: fallbackButtonTextColor,
    } satisfies Partial<StudioBlock>;
  }

  return {
    buttonColor: designSystem.colors.primaryContrastText,
    buttonTextColor: designSystem.colors.primary,
  } satisfies Partial<StudioBlock>;
}

function getBrandPresetOverrides(
  presetKey: string,
  designSystem: StudioDesignSystem | null | undefined,
): Partial<StudioBlock> {
  switch (presetKey) {
    case "hero-dark-center":
    case "hero-gradient-warm":
    case "hero-image-overlay":
    case "hero-light-minimal":
      return getBrandButtonFields(designSystem, "#ffffff", "#1a1a2e");
    case "hero-brand-green":
      return {
        backgroundColor: getBrandPrimaryColor(designSystem, "#2E7D32"),
        textColor: designSystem?.colors.primary
          ? designSystem.colors.primaryContrastText
          : "#ffffff",
        ...getReversedBrandButtonFields(designSystem, "#ffffff", "#2E7D32"),
      };
    case "graphic-text-overlay":
      return getBrandButtonFields(designSystem, "#ffffff", "#111827");
    case "graphic-caption-bar":
      return {
        captionBarColor: getBrandSecondaryColor(designSystem, "#1e293b"),
      };
    case "newsletter-classic":
    case "newsletter-centered":
    case "newsletter-minimal":
      return {
        textColor: getBrandTextColor(designSystem, "#1a1a2e"),
      };
    case "newsletter-banner":
      return {
        backgroundColor: getBrandPrimaryColor(designSystem, "#0f766e"),
        textColor: designSystem?.colors.primary
          ? designSystem.colors.primaryContrastText
          : "#ffffff",
      };
    case "image-text-left":
    case "image-text-right":
    case "image-text-top":
      return {
        textColor: getBrandTextColor(designSystem, "#111827"),
        ...getBrandButtonFields(designSystem, "#111827", "#ffffff"),
      };
    case "image-text-overlay":
      return {
        ...getBrandButtonFields(designSystem, "#ffffff", "#111827"),
      };
    case "image-text-minimal":
      return {
        textColor: getBrandTextColor(designSystem, "#111827"),
      };
    case "plain-standard":
    case "plain-centered":
      return {
        textColor: getBrandTextColor(designSystem, "#111827"),
      };
    case "plain-boxed":
      return {
        textColor: getBrandTextColor(designSystem, "#111827"),
        accentColor: getBrandPrimaryColor(designSystem, "#dbe4f0"),
      };
    case "plain-accent":
      return {
        textColor: getBrandTextColor(designSystem, "#111827"),
        accentColor: getBrandPrimaryColor(designSystem, "#111827"),
      };
    case "quote-classic":
      return {
        textColor: getBrandTextColor(designSystem, "#111827"),
        accentColor: getBrandPrimaryColor(designSystem, "#111827"),
      };
    case "quote-centered":
      return {
        textColor: getBrandTextColor(designSystem, "#111827"),
        accentColor: getBrandPrimaryColor(designSystem, "#0f766e"),
      };
    case "quote-avatar":
      return {
        textColor: getBrandTextColor(designSystem, "#111827"),
        accentColor: getBrandPrimaryColor(designSystem, "#111827"),
      };
    case "product-standard":
    case "product-centered":
    case "product-minimal":
      return {
        textColor: getBrandTextColor(designSystem, "#111827"),
        badgeColor: getBrandPrimaryColor(designSystem, "#111827"),
        ...getBrandButtonFields(designSystem, "#111827", "#ffffff"),
      };
    case "cta-centered-hero":
    case "cta-inline-button":
    case "cta-split":
    case "cta-stacked-double":
      return {
        textColor: getBrandTextColor(designSystem, "#111827"),
        linkColor: getBrandPrimaryColor(designSystem, "#111827"),
        ...getBrandButtonFields(designSystem, "#111827", "#ffffff"),
      };
    case "cta-banner":
      return {
        backgroundColor: getBrandPrimaryColor(designSystem, "#111827"),
        textColor: designSystem?.colors.primary
          ? designSystem.colors.primaryContrastText
          : "#ffffff",
        ...getReversedBrandButtonFields(designSystem, "#ffffff", "#111827"),
      };
    case "social-icon-row":
    case "social-label-row":
      return {
        textColor: getBrandTextColor(designSystem, "#111827"),
      };
    case "social-vertical-list":
      return {
        textColor: getBrandTextColor(designSystem, "#111827"),
        customIconColor: getBrandPrimaryColor(designSystem, "#111827"),
      };
    case "divider-ornamental":
      return {
        ornamentColor: getBrandPrimaryColor(designSystem, "#111827"),
      };
    case "footer-standard-dark":
      return {
        backgroundColor: designSystem?.colors.footerBackground || "#1e293b",
        textColor: designSystem?.colors.footerText || "#ffffff",
        linkColor: designSystem?.colors.footerLink || "#cbd5e1",
        footerIconColor: designSystem?.colors.footerLink || "#cbd5e1",
        dividerBelowColor:
          designSystem?.colors.footerDivider || "rgba(255,255,255,0.16)",
      };
    case "footer-light-minimal":
      return {
        backgroundColor: designSystem?.colors.footerBackground || "#ffffff",
        textColor:
          designSystem?.colors.footerText ||
          getBrandTextColor(designSystem, "#111827"),
        linkColor:
          designSystem?.colors.footerLink ||
          getBrandPrimaryColor(designSystem, "#334155"),
        footerIconColor:
          designSystem?.colors.footerLink ||
          getBrandPrimaryColor(designSystem, "#334155"),
        dividerBelowColor: designSystem?.colors.footerDivider || "#e2e8f0",
      };
    case "footer-centered-branded":
      return {
        backgroundColor: designSystem?.colors.footerBackground || "#f8fafc",
        textColor:
          designSystem?.colors.footerText ||
          getBrandTextColor(designSystem, "#111827"),
        linkColor:
          designSystem?.colors.footerLink ||
          getBrandPrimaryColor(designSystem, "#0f766e"),
        footerIconColor:
          designSystem?.colors.footerLink ||
          getBrandPrimaryColor(designSystem, "#0f766e"),
        dividerBelowColor: designSystem?.colors.footerDivider || "#cbd5e1",
      };
    default:
      return {};
  }
}

function withBrandPreset(
  preset: LayoutPreset,
  designSystem: StudioDesignSystem | null | undefined,
) {
  return {
    ...preset,
    fields: {
      ...preset.fields,
      ...getBrandPresetOverrides(preset.key, designSystem),
    },
  } satisfies LayoutPreset;
}

export function getStudioLayoutPresets(
  designSystem: StudioDesignSystem | null | undefined,
) {
  return {
    heroPresets: heroPresets.map((preset) =>
      withBrandPreset(preset, designSystem),
    ),
    graphicHeroPresets: graphicHeroPresets.map((preset) =>
      withBrandPreset(preset, designSystem),
    ),
    fullWidthImagePresets: fullWidthImagePresets.map((preset) =>
      withBrandPreset(preset, designSystem),
    ),
    newsletterHeaderPresets: newsletterHeaderPresets.map((preset) =>
      withBrandPreset(preset, designSystem),
    ),
    imageTextPresets: imageTextPresets.map((preset) =>
      withBrandPreset(preset, designSystem),
    ),
    plainTextPresets: plainTextPresets.map((preset) =>
      withBrandPreset(preset, designSystem),
    ),
    quotePresets: quotePresets.map((preset) =>
      withBrandPreset(preset, designSystem),
    ),
    productCardPresets: productCardPresets.map((preset) =>
      withBrandPreset(preset, designSystem),
    ),
    imageGalleryPresets: imageGalleryPresets.map((preset) =>
      withBrandPreset(preset, designSystem),
    ),
    productGalleryPresets: productGalleryPresets.map((preset) =>
      withBrandPreset(preset, designSystem),
    ),
    ctaPresets: ctaPresets.map((preset) =>
      withBrandPreset(preset, designSystem),
    ),
    socialFollowPresets: socialFollowPresets.map((preset) =>
      withBrandPreset(preset, designSystem),
    ),
    dividerPresets: dividerPresets.map((preset) =>
      withBrandPreset(preset, designSystem),
    ),
    spacerPresets: spacerPresets.map((preset) =>
      withBrandPreset(preset, designSystem),
    ),
    footerPresets: footerPresets.map((preset) =>
      withBrandPreset(preset, designSystem),
    ),
  };
}

export const heroPresets: LayoutPreset[] = [
  {
    key: "hero-dark-center",
    name: "Dark Centered",
    thumbnail: "dark-center",
    description: "Dark background, centered white text",
    fields: {
      heroStyle: "solid",
      backgroundColor: "#1a1a2e",
      textColor: "#ffffff",
      textAlign: "center",
      buttonColor: "#ffffff",
      buttonTextColor: "#1a1a2e",
    },
  },
  {
    key: "hero-gradient-warm",
    name: "Warm Gradient",
    thumbnail: "gradient-warm",
    description: "Warm gradient from coral to gold",
    fields: {
      heroStyle: "gradient",
      gradientFrom: "#ff6b6b",
      gradientTo: "#ffd93d",
      textColor: "#ffffff",
      textAlign: "center",
      buttonColor: "#ffffff",
      buttonTextColor: "#1a1a2e",
    },
  },
  {
    key: "hero-image-overlay",
    name: "Image Overlay",
    thumbnail: "image-overlay",
    description: "Background image with dark overlay",
    fields: {
      heroStyle: "image-overlay",
      overlayOpacity: 50,
      overlayColor: "#000000",
      textColor: "#ffffff",
      textAlign: "center",
      buttonColor: "#ffffff",
      buttonTextColor: "#1a1a2e",
    },
  },
  {
    key: "hero-light-minimal",
    name: "Light Minimal",
    thumbnail: "light-minimal",
    description: "Light background, dark text, minimal style",
    fields: {
      heroStyle: "solid",
      backgroundColor: "#f8f9fa",
      textColor: "#1a1a2e",
      textAlign: "center",
      buttonColor: "#1a1a2e",
      buttonTextColor: "#ffffff",
    },
  },
  {
    key: "hero-brand-green",
    name: "Brand Green",
    thumbnail: "brand-green",
    description: "Brand green background with white text",
    fields: {
      heroStyle: "solid",
      backgroundColor: "#2E7D32",
      textColor: "#ffffff",
      textAlign: "center",
      buttonColor: "#ffffff",
      buttonTextColor: "#2E7D32",
    },
  },
];

export const graphicHeroPresets: LayoutPreset[] = [
  {
    key: "graphic-full-bleed",
    name: "Full Bleed",
    thumbnail: "graphic-full-bleed",
    description: "Image reaches the full email width",
    fields: {
      layout: "full-bleed",
      imageFit: "cover",
      maxHeight: 400,
      borderRadius: 0,
      insetPadding: false,
      imagePadding: false,
      showShadow: false,
      showOverlay: false,
      showTextOverlay: false,
      showButton: false,
      showCaptionBar: false,
      backgroundColor: "#ffffff",
    },
  },
  {
    key: "graphic-rounded-card",
    name: "Rounded Card",
    thumbnail: "graphic-rounded-card",
    description: "Rounded image with a clean white frame",
    fields: {
      layout: "rounded-card",
      imageFit: "cover",
      maxHeight: 400,
      borderRadius: 12,
      insetPadding: true,
      imagePadding: true,
      showShadow: false,
      showOverlay: false,
      showTextOverlay: false,
      showButton: false,
      showCaptionBar: false,
      backgroundColor: "#ffffff",
    },
  },
  {
    key: "graphic-text-overlay",
    name: "Text Overlay",
    thumbnail: "graphic-text-overlay",
    description: "Darkened image with optional headline and CTA on top",
    fields: {
      layout: "text-overlay",
      imageFit: "cover",
      maxHeight: 400,
      borderRadius: 0,
      insetPadding: false,
      imagePadding: false,
      showShadow: false,
      showOverlay: true,
      overlayColor: "#000000",
      overlayOpacity: 50,
      overlayGradientDirection: "uniform",
      showTextOverlay: true,
      textPosition: "center",
      textAlign: "center",
      textColor: "#ffffff",
      textShadow: true,
      showButton: false,
      buttonColor: "#ffffff",
      buttonTextColor: "#111827",
      showCaptionBar: false,
      backgroundColor: "#ffffff",
    },
  },
  {
    key: "graphic-caption-bar",
    name: "Caption Bar",
    thumbnail: "graphic-caption-bar",
    description: "Image with a caption and CTA bar below",
    fields: {
      layout: "caption-bar",
      imageFit: "cover",
      maxHeight: 400,
      borderRadius: 0,
      insetPadding: false,
      imagePadding: false,
      showShadow: false,
      showOverlay: false,
      showTextOverlay: false,
      showButton: false,
      showCaptionBar: true,
      captionBarColor: "#1e293b",
      textColor: "#ffffff",
      backgroundColor: "#ffffff",
    },
  },
  {
    key: "graphic-framed-shadow",
    name: "Framed",
    thumbnail: "graphic-framed-shadow",
    description: "Framed image with generous padding and soft shadow",
    fields: {
      layout: "framed-shadow",
      imageFit: "cover",
      maxHeight: 400,
      borderRadius: 16,
      insetPadding: true,
      imagePadding: true,
      showShadow: true,
      showOverlay: false,
      showTextOverlay: false,
      showButton: false,
      showCaptionBar: false,
      backgroundColor: "#f8fafc",
    },
  },
];

export const fullWidthImagePresets: LayoutPreset[] = [
  {
    key: "image-full-width",
    name: "Full Bleed",
    thumbnail: "image-full",
    description: "Edge-to-edge image with no frame or caption",
    fields: {
      layout: "full-bleed",
      borderRadius: 0,
      insetPadding: false,
      imagePadding: false,
      showShadow: false,
      showCaption: false,
      caption: "",
      imageFit: "cover",
      maxHeight: 400,
      backgroundColor: "#ffffff",
    },
  },
  {
    key: "image-rounded",
    name: "Rounded",
    thumbnail: "image-rounded",
    description: "Soft rounded corners with a clean standalone image",
    fields: {
      layout: "rounded",
      borderRadius: 12,
      insetPadding: false,
      imagePadding: false,
      showShadow: false,
      showCaption: false,
      imageFit: "cover",
      maxHeight: 400,
      backgroundColor: "#ffffff",
    },
  },
  {
    key: "image-padded-rounded",
    name: "Padded & Framed",
    thumbnail: "image-padded",
    description: "Inset image with a light frame and soft shadow",
    fields: {
      layout: "framed",
      borderRadius: 12,
      insetPadding: true,
      imagePadding: true,
      showShadow: true,
      showCaption: false,
      imageFit: "cover",
      maxHeight: 400,
      backgroundColor: "#f8fafc",
    },
  },
  {
    key: "image-caption",
    name: "With Caption",
    thumbnail: "image-caption",
    description: "Image with an italic caption below the frame",
    fields: {
      layout: "caption",
      borderRadius: 0,
      insetPadding: false,
      imagePadding: false,
      showShadow: false,
      showCaption: true,
      captionAlignment: "center",
      captionColor: "#6b7280",
      imageFit: "cover",
      maxHeight: 400,
      backgroundColor: "#ffffff",
    },
  },
];

export const newsletterHeaderPresets: LayoutPreset[] = [
  {
    key: "newsletter-classic",
    name: "Classic Left",
    thumbnail: "newsletter-classic",
    description: "Logo and title left-aligned with the date opposite",
    fields: {
      layout: "classic",
      logoAlignment: "left",
      logoSize: 40,
      logoShape: "rounded",
      showDivider: true,
      showDividerBelow: true,
      dividerBelowColor: "#e2e8f0",
      verticalPadding: 20,
      backgroundColor: "#ffffff",
      textColor: "#1a1a2e",
    },
  },
  {
    key: "newsletter-centered",
    name: "Centered",
    thumbnail: "newsletter-centered",
    description: "Centered logo, title, and date",
    fields: {
      layout: "centered",
      logoAlignment: "center",
      logoSize: 44,
      logoShape: "rounded",
      showDivider: false,
      showDividerBelow: false,
      verticalPadding: 24,
      backgroundColor: "#ffffff",
      textColor: "#1a1a2e",
    },
  },
  {
    key: "newsletter-minimal",
    name: "Minimal",
    thumbnail: "newsletter-minimal",
    description: "Text-only header with divider",
    fields: {
      layout: "minimal",
      logoAlignment: "left",
      logoSize: 36,
      logoShape: "square",
      showDivider: true,
      showDividerBelow: true,
      dividerBelowColor: "#e2e8f0",
      verticalPadding: 16,
      backgroundColor: "#ffffff",
      textColor: "#1a1a2e",
    },
  },
  {
    key: "newsletter-banner",
    name: "Banner",
    thumbnail: "newsletter-banner",
    description: "Full-width color bar",
    fields: {
      layout: "banner",
      logoAlignment: "left",
      logoSize: 40,
      logoShape: "rounded",
      backgroundColor: "#0f766e",
      textColor: "#ffffff",
      showDividerBelow: false,
      dividerBelowColor: "rgba(255,255,255,0.2)",
      verticalPadding: 20,
      showDivider: false,
    },
  },
];

export const imageTextPresets: LayoutPreset[] = [
  {
    key: "image-text-left",
    name: "Image Left",
    thumbnail: "image-text-left",
    description: "Image left, text right",
    fields: {
      layout: "image-left",
      imagePosition: "left",
      imageFit: "cover",
      imageRatio: "4:3",
      borderRadius: 8,
      columnSplit: "50/50",
      contentPadding: 24,
      textAlign: "left",
      backgroundColor: "#ffffff",
      textColor: "#111827",
      buttonStyle: "filled",
    },
  },
  {
    key: "image-text-right",
    name: "Image Right",
    thumbnail: "image-text-right",
    description: "Text left, image right",
    fields: {
      layout: "image-right",
      imagePosition: "right",
      imageFit: "cover",
      imageRatio: "4:3",
      borderRadius: 8,
      columnSplit: "50/50",
      contentPadding: 24,
      textAlign: "left",
      backgroundColor: "#ffffff",
      textColor: "#111827",
      buttonStyle: "filled",
    },
  },
  {
    key: "image-text-top",
    name: "Image Top",
    thumbnail: "image-text-top",
    description: "Image above the text content",
    fields: {
      layout: "image-top",
      imagePosition: "top",
      imageFit: "cover",
      imageRatio: "16:9",
      borderRadius: 8,
      columnSplit: "50/50",
      contentPadding: 24,
      textAlign: "left",
      backgroundColor: "#ffffff",
      textColor: "#111827",
      buttonStyle: "filled",
    },
  },
  {
    key: "image-text-overlay",
    name: "Text Overlay",
    thumbnail: "image-text-overlay",
    description: "Text placed over a darkened image",
    fields: {
      layout: "image-overlay",
      imagePosition: "overlay",
      imageFit: "cover",
      imageRatio: "16:9",
      borderRadius: 8,
      columnSplit: "50/50",
      contentPadding: 32,
      textAlign: "left",
      backgroundColor: "#111827",
      textColor: "#ffffff",
      overlayColor: "#000000",
      overlayOpacity: 52,
      showOverlay: true,
      buttonColor: "#ffffff",
      buttonTextColor: "#111827",
      buttonStyle: "filled",
    },
  },
  {
    key: "image-text-minimal",
    name: "Minimal",
    thumbnail: "image-text-minimal",
    description: "Centered card with a small rounded image",
    fields: {
      layout: "minimal-card",
      imagePosition: "top",
      imageFit: "cover",
      imageRatio: "1:1",
      borderRadius: 16,
      columnSplit: "50/50",
      contentPadding: 32,
      textAlign: "center",
      backgroundColor: "#ffffff",
      textColor: "#111827",
      buttonStyle: "link",
    },
  },
];

export const plainTextPresets: LayoutPreset[] = [
  {
    key: "plain-standard",
    name: "Standard",
    thumbnail: "plain-standard",
    description: "Simple padded text block",
    fields: {
      layout: "standard",
      backgroundColor: "#ffffff",
      textColor: "#111827",
      textAlign: "left",
      fontSize: "md",
      fontSizePreset: "md",
      fontWeightPreset: "normal",
      lineHeight: 1.6,
      lineHeightValue: 1.6,
      contentPadding: 24,
    },
  },
  {
    key: "plain-centered",
    name: "Centered Feature",
    thumbnail: "plain-centered",
    description: "Centered feature paragraph",
    fields: {
      layout: "centered-feature",
      backgroundColor: "#ffffff",
      textColor: "#111827",
      textAlign: "center",
      fontSize: "lg",
      fontSizePreset: "lg",
      fontWeightPreset: "medium",
      lineHeight: 1.8,
      lineHeightValue: 1.8,
      contentPadding: 32,
    },
  },
  {
    key: "plain-boxed",
    name: "Boxed",
    thumbnail: "plain-boxed",
    description: "Text inside a subtle rounded box",
    fields: {
      layout: "boxed",
      backgroundColor: "#ffffff",
      textColor: "#111827",
      textAlign: "left",
      showAccent: true,
      accentColor: "#dbe4f0",
      accentThickness: 1,
      boxBorderRadius: 12,
      fontSize: "md",
      fontSizePreset: "md",
      fontWeightPreset: "normal",
      lineHeight: 1.65,
      lineHeightValue: 1.65,
      contentPadding: 24,
    },
  },
  {
    key: "plain-accent",
    name: "Side Accent",
    thumbnail: "plain-accent",
    description: "Left accent border for emphasis",
    fields: {
      layout: "side-accent",
      backgroundColor: "#ffffff",
      textColor: "#111827",
      textAlign: "left",
      showAccent: true,
      accentColor: "#111827",
      accentThickness: 3,
      fontSize: "md",
      fontSizePreset: "md",
      fontWeightPreset: "normal",
      lineHeight: 1.65,
      lineHeightValue: 1.65,
      contentPadding: 24,
    },
  },
];

export const quotePresets: LayoutPreset[] = [
  {
    key: "quote-classic",
    name: "Classic Blockquote",
    thumbnail: "quote-classic",
    description: "Classic blockquote with left accent",
    fields: {
      layout: "classic",
      backgroundColor: "#ffffff",
      textColor: "#111827",
      accentColor: "#111827",
      fontStyle: "italic",
      showAuthorImage: false,
      authorAvatarSize: 48,
      quoteMarkSize: 48,
      contentPadding: 28,
    },
  },
  {
    key: "quote-centered",
    name: "Large Centered",
    thumbnail: "quote-centered",
    description: "Large centered quote",
    fields: {
      layout: "large-centered",
      backgroundColor: "#ffffff",
      textColor: "#111827",
      accentColor: "#0f766e",
      fontStyle: "normal",
      showAuthorImage: false,
      authorAvatarSize: 48,
      quoteMarkSize: 56,
      contentPadding: 32,
    },
  },
  {
    key: "quote-avatar",
    name: "Card with Avatar",
    thumbnail: "quote-avatar",
    description: "Card quote with author avatar",
    fields: {
      layout: "avatar-card",
      backgroundColor: "#ffffff",
      textColor: "#111827",
      accentColor: "#111827",
      fontStyle: "normal",
      showAuthorImage: true,
      authorAvatarSize: 48,
      quoteMarkSize: 48,
      contentPadding: 28,
    },
  },
];

export const productCardPresets: LayoutPreset[] = [
  {
    key: "product-standard",
    name: "Standard",
    thumbnail: "product-standard",
    description: "Image left with product details right",
    fields: {
      layout: "standard",
      imageFit: "cover",
      buttonStyle: "filled",
      backgroundColor: "#ffffff",
      textColor: "#111827",
      badgePosition: "top-left",
      showCardBorder: true,
      cardBorderRadius: 12,
      showBorder: true,
    },
  },
  {
    key: "product-centered",
    name: "Centered",
    thumbnail: "product-centered",
    description: "Stacked centered product card",
    fields: {
      layout: "centered",
      imageFit: "cover",
      buttonStyle: "filled",
      backgroundColor: "#ffffff",
      textColor: "#111827",
      badgePosition: "top-right",
      showCardBorder: true,
      cardBorderRadius: 12,
      showBorder: true,
    },
  },
  {
    key: "product-minimal",
    name: "Minimal",
    thumbnail: "product-minimal",
    description: "Text-only product card",
    fields: {
      layout: "minimal",
      buttonStyle: "link",
      backgroundColor: "#ffffff",
      textColor: "#111827",
      badgePosition: "top-right",
      showCardBorder: false,
      cardBorderRadius: 12,
      showBorder: false,
    },
  },
];

export const imageGalleryPresets: LayoutPreset[] = [
  {
    key: "gallery-grid-3",
    name: "Grid of 3",
    thumbnail: "gallery-grid-3",
    description: "Three images in a single row",
    fields: {
      layout: "grid-3",
      gridColumns: 3,
      imageHeight: 180,
      gridGap: 8,
      borderRadius: 6,
      showShadow: false,
      backgroundColor: "#ffffff",
    },
  },
  {
    key: "gallery-grid-4",
    name: "Grid of 4",
    thumbnail: "gallery-grid-4",
    description: "Four images in a two-column grid",
    fields: {
      layout: "grid-4",
      gridColumns: 2,
      imageHeight: 180,
      gridGap: 8,
      borderRadius: 6,
      showShadow: false,
      backgroundColor: "#ffffff",
    },
  },
  {
    key: "gallery-grid-6",
    name: "Grid of 6",
    thumbnail: "gallery-grid-6",
    description: "Six images in a three-column grid",
    fields: {
      layout: "grid-6",
      gridColumns: 3,
      imageHeight: 180,
      gridGap: 8,
      borderRadius: 6,
      showShadow: false,
      backgroundColor: "#ffffff",
    },
  },
  {
    key: "gallery-feature-grid",
    name: "Feature + Grid",
    thumbnail: "gallery-feature-grid",
    description: "One large feature image with two stacked images",
    fields: {
      layout: "feature-grid",
      gridColumns: 3,
      imageHeight: 180,
      gridGap: 8,
      borderRadius: 6,
      showShadow: false,
      backgroundColor: "#ffffff",
    },
  },
];

export const productGalleryPresets: LayoutPreset[] = [
  {
    key: "product-gallery-standard",
    name: "2-Column Grid",
    thumbnail: "product-gallery-standard",
    description: "Standard two-column product grid",
    fields: {
      layout: "standard-grid",
      gridColumns: 2,
      imageHeight: 160,
      cardGap: 16,
      showBadges: true,
      showPrices: true,
      showOriginalPrice: false,
      showCtaButtons: true,
      showDescription: true,
      showCardBorder: true,
      cardBorderRadius: 12,
      showBorder: true,
      backgroundColor: "#ffffff",
      cardBackgroundColor: "#ffffff",
    },
  },
  {
    key: "product-gallery-three-column",
    name: "3-Column Grid",
    thumbnail: "product-gallery-three-column",
    description: "Three products per row",
    fields: {
      layout: "three-column-grid",
      gridColumns: 3,
      imageHeight: 150,
      cardGap: 12,
      showBadges: true,
      showPrices: true,
      showOriginalPrice: false,
      showCtaButtons: true,
      showDescription: true,
      showCardBorder: true,
      cardBorderRadius: 12,
      showBorder: true,
      backgroundColor: "#ffffff",
      cardBackgroundColor: "#ffffff",
    },
  },
  {
    key: "product-gallery-feature",
    name: "Single Feature",
    thumbnail: "product-gallery-feature",
    description: "Single featured product with side-by-side details",
    fields: {
      layout: "feature-product",
      gridColumns: 1,
      imageHeight: 220,
      cardGap: 16,
      showBadges: true,
      showPrices: true,
      showOriginalPrice: true,
      showCtaButtons: true,
      showDescription: true,
      showCardBorder: true,
      cardBorderRadius: 12,
      showBorder: true,
      backgroundColor: "#ffffff",
      cardBackgroundColor: "#ffffff",
    },
  },
];

export const ctaPresets: LayoutPreset[] = [
  {
    key: "cta-centered-hero",
    name: "Centered Hero",
    thumbnail: "cta-centered-hero",
    description: "Centered headline, copy, and primary button",
    fields: {
      layout: "centered-hero",
      textAlign: "center",
      verticalPadding: 32,
      buttonStyle: "filled",
      fullWidthButton: false,
      showSecondaryLink: false,
      backgroundColor: "#ffffff",
      textColor: "#111827",
      buttonColor: "#111827",
      buttonTextColor: "#ffffff",
    },
  },
  {
    key: "cta-banner",
    name: "Banner",
    thumbnail: "cta-banner",
    description: "Compact banner with copy and CTA inline",
    fields: {
      layout: "banner",
      textAlign: "left",
      verticalPadding: 28,
      buttonStyle: "filled",
      fullWidthButton: false,
      showSecondaryLink: false,
      backgroundColor: "#111827",
      textColor: "#ffffff",
      buttonColor: "#ffffff",
      buttonTextColor: "#111827",
    },
  },
  {
    key: "cta-inline-button",
    name: "Inline",
    thumbnail: "cta-inline-button",
    description: "Button-only CTA for concise sections",
    fields: {
      layout: "inline-button-only",
      textAlign: "center",
      verticalPadding: 20,
      buttonStyle: "ghost",
      fullWidthButton: false,
      showSecondaryLink: false,
      backgroundColor: "#ffffff",
      textColor: "#111827",
      buttonColor: "#111827",
      buttonTextColor: "#111827",
    },
  },
  {
    key: "cta-split",
    name: "Split",
    thumbnail: "cta-split",
    description: "Text on the left with button on the right",
    fields: {
      layout: "split",
      textAlign: "left",
      verticalPadding: 36,
      buttonStyle: "filled",
      fullWidthButton: false,
      showSecondaryLink: false,
      backgroundColor: "#f8fafc",
      textColor: "#111827",
      buttonColor: "#111827",
      buttonTextColor: "#ffffff",
    },
  },
  {
    key: "cta-stacked-double",
    name: "Double CTA",
    thumbnail: "cta-stacked-double",
    description: "Stacked copy with primary button and secondary link",
    fields: {
      layout: "stacked-double",
      textAlign: "center",
      verticalPadding: 44,
      buttonStyle: "filled",
      fullWidthButton: false,
      showSecondaryLink: true,
      linkColor: "#111827",
      backgroundColor: "#ffffff",
      textColor: "#111827",
      buttonColor: "#111827",
      buttonTextColor: "#ffffff",
    },
  },
];

export const socialFollowPresets: LayoutPreset[] = [
  {
    key: "social-icon-row",
    name: "Icon Row Centered",
    thumbnail: "social-icon-row",
    description: "Centered row of social icons",
    fields: {
      layout: "icon-row",
      socialLabel: "",
      iconStyle: "filled",
      iconSize: "md",
      iconColorMode: "brand",
      iconSpacing: 12,
      socialIconStyle: "filled",
      socialIconSize: "md",
      socialColorMode: "brand",
      textAlign: "center",
      verticalPadding: 16,
      backgroundColor: "#ffffff",
      textColor: "#111827",
    },
  },
  {
    key: "social-label-row",
    name: "With Label",
    thumbnail: "social-label-row",
    description: "Short label above a centered icon row",
    fields: {
      layout: "label-row",
      socialLabel: "Follow us",
      iconStyle: "outlined",
      iconSize: "md",
      iconColorMode: "mono",
      iconSpacing: 12,
      socialIconStyle: "outlined",
      socialIconSize: "md",
      socialColorMode: "monochrome",
      textAlign: "center",
      verticalPadding: 28,
      backgroundColor: "#ffffff",
      textColor: "#111827",
    },
  },
  {
    key: "social-vertical-list",
    name: "Vertical List",
    thumbnail: "social-vertical-list",
    description: "Vertical social list with platform names",
    fields: {
      layout: "vertical-list",
      socialLabel: "Connect with us",
      iconStyle: "minimal",
      iconSize: "sm",
      iconColorMode: "custom",
      iconSpacing: 14,
      socialIconStyle: "minimal",
      socialIconSize: "sm",
      socialColorMode: "custom",
      customIconColor: "#111827",
      textAlign: "left",
      verticalPadding: 28,
      backgroundColor: "#ffffff",
      textColor: "#111827",
    },
  },
];

export const dividerPresets: LayoutPreset[] = [
  {
    key: "divider-simple",
    name: "Simple Line",
    thumbnail: "divider-simple",
    description: "Simple solid divider line",
    fields: {
      layout: "simple-line",
      lineType: "solid",
      lineStyle: "solid",
      lineThickness: 1,
      lineWidth: 100,
      paddingTop: 20,
      paddingBottom: 20,
      textAlign: "center",
      lineColor: "#d1d5db",
      showOrnament: false,
      backgroundColor: "#ffffff",
    },
  },
  {
    key: "divider-dashed",
    name: "Dashed",
    thumbnail: "divider-dashed",
    description: "Dashed divider with medium spacing",
    fields: {
      layout: "dashed-line",
      lineType: "dashed",
      lineStyle: "dashed",
      lineThickness: 1,
      lineWidth: 88,
      paddingTop: 22,
      paddingBottom: 22,
      textAlign: "center",
      lineColor: "#9ca3af",
      showOrnament: false,
      backgroundColor: "#ffffff",
    },
  },
  {
    key: "divider-dotted",
    name: "Dotted",
    thumbnail: "divider-dotted",
    description: "Dotted divider with compact spacing",
    fields: {
      layout: "dotted-line",
      lineType: "dotted",
      lineStyle: "dotted",
      lineThickness: 2,
      lineWidth: 76,
      paddingTop: 18,
      paddingBottom: 18,
      textAlign: "center",
      lineColor: "#9ca3af",
      showOrnament: false,
      backgroundColor: "#ffffff",
    },
  },
  {
    key: "divider-ornamental",
    name: "Ornamental",
    thumbnail: "divider-ornamental",
    description: "Line split around a small ornament",
    fields: {
      layout: "ornamental",
      lineType: "solid",
      lineStyle: "solid",
      lineThickness: 1,
      lineWidth: 84,
      paddingTop: 26,
      paddingBottom: 26,
      textAlign: "center",
      lineColor: "#d1d5db",
      showOrnament: true,
      ornamentSymbol: "✦",
      ornamentColor: "#111827",
      ornamentSize: 16,
      backgroundColor: "#ffffff",
    },
  },
];

export const spacerPresets: LayoutPreset[] = [
  {
    key: "spacer-tight",
    name: "Tight",
    thumbnail: "spacer-tight",
    description: "Small spacing between compact sections",
    fields: {
      layout: "spacer-tight",
      spacerHeight: 16,
      backgroundColor: "transparent",
      showDottedOutline: true,
    },
  },
  {
    key: "spacer-standard",
    name: "Standard",
    thumbnail: "spacer-standard",
    description: "Standard section spacing",
    fields: {
      layout: "spacer-standard",
      spacerHeight: 32,
      backgroundColor: "transparent",
      showDottedOutline: true,
    },
  },
  {
    key: "spacer-airy",
    name: "Airy",
    thumbnail: "spacer-airy",
    description: "Generous spacing for stronger separation",
    fields: {
      layout: "spacer-airy",
      spacerHeight: 48,
      backgroundColor: "transparent",
      showDottedOutline: true,
    },
  },
  {
    key: "spacer-large",
    name: "Large",
    thumbnail: "spacer-large",
    description: "Large breathing room between major sections",
    fields: {
      layout: "spacer-large",
      spacerHeight: 64,
      backgroundColor: "transparent",
      showDottedOutline: true,
    },
  },
];

export const footerPresets: LayoutPreset[] = [
  {
    key: "footer-standard-dark",
    name: "Dark Standard",
    thumbnail: "footer-standard-dark",
    description: "Dark footer with logo, address, compliance, and links",
    fields: {
      layout: "standard-dark",
      logoAlignment: "left",
      logoSize: 40,
      backgroundColor: "#1e293b",
      textColor: "#ffffff",
      linkColor: "#cbd5e1",
      showManagePreferences: true,
      showWebsiteLink: false,
      showSocialInFooter: false,
      footerIconStyle: "filled",
      footerIconColor: "#cbd5e1",
      dividerBelowColor: "rgba(255,255,255,0.16)",
      verticalPadding: 32,
    },
  },
  {
    key: "footer-light-minimal",
    name: "Light Minimal",
    thumbnail: "footer-light-minimal",
    description: "Light footer with concise business and compliance links",
    fields: {
      layout: "light-minimal",
      logoAlignment: "left",
      logoSize: 36,
      backgroundColor: "#ffffff",
      textColor: "#111827",
      linkColor: "#334155",
      showManagePreferences: true,
      showWebsiteLink: false,
      showSocialInFooter: false,
      footerIconStyle: "minimal",
      footerIconColor: "#334155",
      dividerBelowColor: "#e2e8f0",
      verticalPadding: 28,
    },
  },
  {
    key: "footer-centered-branded",
    name: "Centered Branded",
    thumbnail: "footer-centered-branded",
    description: "Centered branded footer with logo and copyright",
    fields: {
      layout: "centered-branded",
      logoAlignment: "center",
      logoSize: 40,
      backgroundColor: "#f8fafc",
      textColor: "#111827",
      linkColor: "#0f766e",
      showManagePreferences: true,
      showWebsiteLink: true,
      showSocialInFooter: true,
      footerIconStyle: "outlined",
      footerIconColor: "#0f766e",
      dividerBelowColor: "#cbd5e1",
      verticalPadding: 32,
    },
  },
];
