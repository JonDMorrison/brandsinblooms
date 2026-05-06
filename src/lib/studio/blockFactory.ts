import {
  STUDIO_BLOCK_LOOKUP,
  type StudioBlockType,
} from "@/components/crm/studio/blockLibraryData";
import type { StudioDesignSystem } from "@/lib/studio/designSystem";
import type { SocialLink, StudioBlock } from "@/types/studioBlocks";

const DEFAULT_COMPLIANCE_TEMPLATE =
  "You are receiving this email because you opted in at {name}. If you no longer wish to receive these emails, you can unsubscribe at any time.";

function stringValue(value: string | null | undefined) {
  return typeof value === "string" ? value.trim() : "";
}

function createEmptyGalleryProduct() {
  return {
    id: crypto.randomUUID(),
    imageUrl: "",
    name: "",
    price: "",
    originalPrice: "",
    description: "",
    badgeText: "",
    badgeColor: "#111827",
    buttonText: "",
    buttonUrl: "",
  };
}

function createDefaultSocialLinks(): SocialLink[] {
  return [
    "facebook",
    "instagram",
    "twitter",
    "linkedin",
    "youtube",
    "tiktok",
    "pinterest",
    "threads",
  ].map((platform) => ({
    platform,
    url: "",
    enabled: false,
  })) as SocialLink[];
}

function getDefaultDateLabel() {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
  }).format(new Date());
}

function getDefaultCopyrightText(companyName = "Your Business") {
  return `© ${new Date().getFullYear()} ${companyName}`;
}

function getFooterAddress(designSystem: StudioDesignSystem | null | undefined) {
  if (!designSystem) {
    return "";
  }

  return designSystem.company.addressLines || designSystem.company.address;
}

export function getBlockLabel(type: StudioBlockType) {
  return STUDIO_BLOCK_LOOKUP[type]?.name ?? type;
}

export function createStudioBlock(
  type: StudioBlockType,
  designSystem?: StudioDesignSystem | null,
): StudioBlock {
  const primaryColor = designSystem?.colors.primary;
  const primaryContrastText = designSystem?.colors.primaryContrastText;
  const brandTextColor = designSystem?.colors.text;
  const footerBackgroundColor = designSystem?.colors.footerBackground;
  const footerTextColor = designSystem?.colors.footerText;
  const footerLinkColor = designSystem?.colors.footerLink;
  const footerDividerColor = designSystem?.colors.footerDivider;
  const businessName = designSystem?.company.name || "Your Business";
  const address = getFooterAddress(designSystem);
  const complianceText =
    designSystem?.company.footerLegalText ||
    DEFAULT_COMPLIANCE_TEMPLATE.replace("{name}", businessName);
  const defaultSocialLinks = designSystem?.social.links.length
    ? designSystem.social.links
    : createDefaultSocialLinks();
  const base = {
    id: crypto.randomUUID(),
    type,
    label: getBlockLabel(type),
    order: 0,
    visible: true,
  } satisfies Pick<StudioBlock, "id" | "type" | "label" | "order" | "visible">;

  switch (type) {
    case "email-safe-hero":
      return {
        ...base,
        headline: "",
        subheading: "",
        body: "",
        tagLabel: "",
        backgroundColor: "#1a1a2e",
        textColor: "#ffffff",
        textAlign: "center",
        heroStyle: "solid",
        overlayOpacity: 45,
        overlayColor: "#000000",
        gradientFrom: "#ff6b6b",
        gradientTo: "#ffd93d",
        buttonText: "",
        buttonUrl: "",
        buttonColor: primaryColor || "#ffffff",
        buttonTextColor: (primaryColor && primaryContrastText) || "#1a1a2e",
        buttonSize: "md",
        buttonRounded: true,
        layoutPreset: "hero-dark-center",
      };
    case "graphic-hero":
      return {
        ...base,
        headline: "",
        subheading: "",
        imageUrl: "",
        imageAlt: "",
        linkUrl: "",
        imageFit: "cover",
        maxHeight: 400,
        borderRadius: 0,
        insetPadding: false,
        imagePadding: false,
        showShadow: false,
        backgroundColor: "#ffffff",
        showOverlay: false,
        overlayColor: "#000000",
        overlayOpacity: 45,
        overlayGradientDirection: "uniform",
        showTextOverlay: false,
        textPosition: "center",
        textAlign: "center",
        textColor: "#ffffff",
        textShadow: true,
        showButton: false,
        buttonText: "",
        buttonUrl: "",
        buttonStyle: "filled",
        buttonColor: primaryColor || "#ffffff",
        buttonTextColor: (primaryColor && primaryContrastText) || "#000000",
        buttonSize: "md",
        buttonRounded: true,
        showCaptionBar: false,
        captionBarColor: "#1e293b",
        layout: "full-bleed",
        layoutPreset: "graphic-full-bleed",
      };
    case "full-width-image":
      return {
        ...base,
        imageUrl: "",
        imageAlt: "",
        linkUrl: "",
        caption: "",
        showCaption: false,
        captionAlignment: "center",
        captionColor: "#6b7280",
        imageFit: "cover",
        maxHeight: 400,
        borderRadius: 0,
        insetPadding: false,
        imagePadding: false,
        showShadow: false,
        backgroundColor: "#ffffff",
        textColor: "#6b7280",
        layout: "full-bleed",
        layoutPreset: "image-full-width",
      };
    case "newsletter-header":
      return {
        ...base,
        headline: "",
        dateLabel: getDefaultDateLabel(),
        tagline: "",
        logoAlignment: "left",
        logoSize: 40,
        logoShape: "rounded",
        logoUrl: designSystem?.company.logoUrl || "",
        backgroundColor: "#ffffff",
        textColor: brandTextColor || "#1a1a2e",
        layout: "classic",
        layoutPreset: "newsletter-classic",
        dividerBelowColor: "#e2e8f0",
        showDividerBelow: true,
        verticalPadding: 20,
        showDivider: true,
      };
    case "image-text":
      return {
        ...base,
        headline: "",
        subheading: "",
        body: "",
        imageUrl: "",
        imageAlt: "",
        imagePosition: "left",
        imageFit: "cover",
        imageRatio: "auto",
        borderRadius: 8,
        columnSplit: "50/50",
        contentPadding: 24,
        backgroundColor: "#ffffff",
        textColor: brandTextColor || "#111827",
        textAlign: "left",
        overlayColor: "#000000",
        overlayOpacity: 48,
        showOverlay: false,
        buttonText: "",
        buttonUrl: "",
        buttonColor: primaryColor || "#111827",
        buttonTextColor: (primaryColor && primaryContrastText) || "#ffffff",
        buttonSize: "md",
        buttonStyle: "filled",
        buttonRounded: true,
        fullWidthButton: false,
        layout: "image-left",
        layoutPreset: "image-text-left",
      };
    case "plain-text":
      return {
        ...base,
        body: "",
        backgroundColor: "#ffffff",
        textColor: brandTextColor || "#111827",
        textAlign: "left",
        showAccent: false,
        accentColor: primaryColor || "#111827",
        accentThickness: 3,
        boxBorderRadius: 10,
        fontSize: "md",
        fontSizePreset: "md",
        fontWeightPreset: "normal",
        lineHeight: 1.6,
        lineHeightValue: 1.6,
        contentPadding: 24,
        layout: "standard",
        layoutPreset: "plain-standard",
      };
    case "quote":
      return {
        ...base,
        quoteText: "",
        authorName: "",
        authorTitle: "",
        authorImageUrl: "",
        authorAvatarSize: 48,
        showAuthorImage: false,
        quoteMarkSize: 48,
        authorAvatarUrl: "",
        backgroundColor: "#ffffff",
        textColor: brandTextColor || "#111827",
        accentColor: primaryColor || "#111827",
        fontStyle: "italic",
        contentPadding: 28,
        layout: "classic",
        layoutPreset: "quote-classic",
      };
    case "product-card":
      return {
        ...base,
        productName: "",
        productPrice: "",
        originalPrice: "",
        productDescription: "",
        imageUrl: "",
        imageAlt: "",
        imageFit: "cover",
        badgeText: "",
        badgeColor: primaryColor || "#111827",
        badgeTextColor: "#ffffff",
        badgePosition: "top-left",
        buttonText: "",
        buttonUrl: "",
        buttonColor: primaryColor || "#111827",
        buttonTextColor: (primaryColor && primaryContrastText) || "#ffffff",
        buttonStyle: "filled",
        fullWidthButton: false,
        backgroundColor: "#ffffff",
        textColor: brandTextColor || "#111827",
        showCardBorder: true,
        cardBorderRadius: 12,
        showBorder: true,
        layout: "standard",
        layoutPreset: "product-standard",
      };
    case "image-gallery":
      return {
        ...base,
        galleryImages: [],
        layout: "grid-3",
        layoutPreset: "gallery-grid-3",
        gridColumns: 3,
        imageHeight: 180,
        gridGap: 8,
        borderRadius: 6,
        backgroundColor: "#ffffff",
        showShadow: false,
      };
    case "product-gallery":
      return {
        ...base,
        galleryProducts: Array.from({ length: 4 }, () =>
          createEmptyGalleryProduct(),
        ),
        layout: "standard-grid",
        layoutPreset: "product-gallery-standard",
        gridColumns: 2,
        imageHeight: 160,
        cardGap: 16,
        backgroundColor: "#ffffff",
        cardBackgroundColor: "#ffffff",
        textColor: brandTextColor || "#111827",
        showBadges: true,
        showPrices: true,
        showOriginalPrice: false,
        showCtaButtons: true,
        showDescription: true,
        showCardBorder: true,
        cardBorderRadius: 12,
        showBorder: true,
      };
    case "call-to-action":
      return {
        ...base,
        headline: "",
        body: "",
        buttonText: "",
        buttonUrl: "",
        buttonColor: primaryColor || "#111827",
        buttonTextColor: (primaryColor && primaryContrastText) || "#ffffff",
        buttonSize: "md",
        buttonStyle: "filled",
        buttonRounded: true,
        fullWidthButton: false,
        showSecondaryLink: false,
        secondaryLinkText: "",
        secondaryLinkUrl: "",
        linkColor: primaryColor || brandTextColor || "#111827",
        backgroundColor: "#ffffff",
        textColor: brandTextColor || "#111827",
        textAlign: "center",
        verticalPadding: 32,
        layout: "centered-hero",
        layoutPreset: "cta-centered-hero",
      };
    case "social-follow":
      return {
        ...base,
        socialLinks: defaultSocialLinks,
        socialLabel: "",
        iconStyle: "filled",
        iconSize: "md",
        iconColorMode: "brand",
        iconSpacing: 12,
        socialIconStyle: "filled",
        socialIconSize: "md",
        socialColorMode: "brand",
        customIconColor: primaryColor || brandTextColor || "#111827",
        backgroundColor: "#ffffff",
        textColor: brandTextColor || "#111827",
        textAlign: "center",
        verticalPadding: 16,
        layout: "icon-row",
        layoutPreset: "social-icon-row",
      };
    case "divider":
      return {
        ...base,
        backgroundColor: "#ffffff",
        lineColor: "#d1d5db",
        lineType: "solid",
        lineStyle: "solid",
        lineThickness: 1,
        lineWidth: 100,
        textAlign: "center",
        paddingTop: 20,
        paddingBottom: 20,
        showOrnament: false,
        ornamentSymbol: "✦",
        ornamentColor: primaryColor || "#111827",
        ornamentSize: 16,
        layout: "simple-line",
        layoutPreset: "divider-simple",
      };
    case "spacer":
      return {
        ...base,
        spacerHeight: 32,
        backgroundColor: "transparent",
        showDottedOutline: true,
        layout: "spacer-standard",
        layoutPreset: "spacer-standard",
      };
    case "footer":
      return {
        ...base,
        businessName,
        address: address || "123 Main St\nCity, State",
        copyright: getDefaultCopyrightText(businessName),
        copyrightText: getDefaultCopyrightText(businessName),
        complianceText,
        logoUrl: designSystem?.company.logoUrl || "",
        logoAlignment: "left",
        logoSize: 40,
        showUnsubscribe: true,
        showManagePreferences: true,
        showWebsiteLink: Boolean(stringValue(designSystem?.company.websiteUrl)),
        websiteUrl: stringValue(designSystem?.company.websiteUrl),
        showSocialInFooter: false,
        footerSocialLinks: defaultSocialLinks,
        footerIconStyle: "filled",
        footerIconColor: footerLinkColor || "#cbd5e1",
        backgroundColor: footerBackgroundColor || "#1e293b",
        textColor: footerTextColor || "#ffffff",
        linkColor: footerLinkColor || "#cbd5e1",
        dividerBelowColor: footerDividerColor || "rgba(255,255,255,0.16)",
        verticalPadding: 32,
        layout: "standard-dark",
        layoutPreset: "footer-standard-dark",
      };
    default:
      return base;
  }
}
