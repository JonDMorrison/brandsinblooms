import {
  createFooterBlockFromDesignSystem,
  type StudioFooterProfile,
} from "@/lib/studio/emailHtmlGenerator";
import {
  buildStudioDesignSystem,
  type StudioDesignSystem,
} from "@/lib/studio/designSystem";
import type { StudioBlock } from "@/types/studioBlocks";

const DEFAULT_COMPLIANCE_TEXT =
  "You are receiving this email because you opted in to receive updates from our business.";
const DEFAULT_FOOTER_BACKGROUND = "#1e293b";
const DEFAULT_FOOTER_TEXT = "#ffffff";
const DEFAULT_FOOTER_LINK = "#cbd5e1";
const DEFAULT_FOOTER_DIVIDER = "rgba(255,255,255,0.16)";

type FooterFeatureFlags = {
  company_logo_url?: string;
  footer_colors?: {
    backgroundColor?: string;
    textColor?: string;
    linkColor?: string;
    dividerColor?: string;
    logoBackgroundColor?: string;
    logoTextColor?: string;
  };
};

export type FooterCompanyProfile = StudioFooterProfile & {
  location_info?: string | null;
  email_domain?: string | null;
  brand_secondary_color?: string | null;
  brand_accent_color?: string | null;
  facebook_url?: string | null;
  instagram_url?: string | null;
  tiktok_url?: string | null;
  pinterest_url?: string | null;
  youtube_url?: string | null;
  linkedin_url?: string | null;
  feature_flags?: FooterFeatureFlags | null;
};

type FooterComplianceOptions = {
  designSystem?: StudioDesignSystem | null;
  companyProfile?: FooterCompanyProfile | null;
  footerOverrides?: Partial<StudioBlock>;
};

function stringValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function valueMatchesDefault(value: string | undefined, defaults: string[]) {
  if (!value) {
    return true;
  }

  const normalizedValue = value.trim().toLowerCase();

  return defaults.some(
    (defaultValue) => defaultValue.trim().toLowerCase() === normalizedValue,
  );
}

function hasConfiguredSocialLinks(links: StudioBlock["footerSocialLinks"]) {
  return Boolean(
    links?.some((link) => link.enabled || Boolean(link.url?.trim())),
  );
}

function toCompanyInfo(companyProfile: FooterCompanyProfile) {
  const footerColors = companyProfile.feature_flags?.footer_colors;
  const addressParts = [
    stringValue(companyProfile.street_address),
    [
      stringValue(companyProfile.city),
      stringValue(companyProfile.state_province),
      stringValue(companyProfile.postal_code),
    ]
      .filter(Boolean)
      .join(", "),
    stringValue(companyProfile.country),
  ].filter(Boolean);

  return {
    name: stringValue(companyProfile.company_name),
    address:
      addressParts.join(", ") || stringValue(companyProfile.location_info),
    phone: stringValue(companyProfile.company_phone),
    email: stringValue(companyProfile.company_email),
    websiteUrl: stringValue(companyProfile.website_url),
    streetAddress: stringValue(companyProfile.street_address),
    city: stringValue(companyProfile.city),
    stateProvince: stringValue(companyProfile.state_province),
    postalCode: stringValue(companyProfile.postal_code),
    country: stringValue(companyProfile.country),
    logoUrl: stringValue(companyProfile.feature_flags?.company_logo_url),
    emailDomain: stringValue(companyProfile.email_domain),
    brandPrimaryColor: stringValue(companyProfile.brand_primary_color),
    brandSecondaryColor: stringValue(companyProfile.brand_secondary_color),
    brandAccentColor: stringValue(companyProfile.brand_accent_color),
    brandTextColor: stringValue(companyProfile.brand_text_color),
    brandPrimaryColorRaw: stringValue(companyProfile.brand_primary_color),
    brandSecondaryColorRaw: stringValue(companyProfile.brand_secondary_color),
    brandAccentColorRaw: stringValue(companyProfile.brand_accent_color),
    brandTextColorRaw: stringValue(companyProfile.brand_text_color),
    facebookUrl: stringValue(companyProfile.facebook_url) || undefined,
    instagramUrl: stringValue(companyProfile.instagram_url) || undefined,
    tiktokUrl: stringValue(companyProfile.tiktok_url) || undefined,
    pinterestUrl: stringValue(companyProfile.pinterest_url) || undefined,
    youtubeUrl: stringValue(companyProfile.youtube_url) || undefined,
    linkedinUrl: stringValue(companyProfile.linkedin_url) || undefined,
    footerLegalText: stringValue(companyProfile.footer_legal_text) || undefined,
    brandFooterColors: footerColors
      ? {
          backgroundColor:
            stringValue(footerColors.backgroundColor) || undefined,
          textColor: stringValue(footerColors.textColor) || undefined,
          linkColor: stringValue(footerColors.linkColor) || undefined,
          dividerColor: stringValue(footerColors.dividerColor) || undefined,
          logoBackgroundColor:
            stringValue(footerColors.logoBackgroundColor) || undefined,
          logoTextColor: stringValue(footerColors.logoTextColor) || undefined,
        }
      : undefined,
    selectedFont: undefined,
    headlineFont: undefined,
    subheadingFont: undefined,
    bodyFont: undefined,
    buttonFont: undefined,
  };
}

function resolveDesignSystem(options: FooterComplianceOptions) {
  if (options.designSystem) {
    return options.designSystem;
  }

  if (options.companyProfile) {
    return buildStudioDesignSystem(toCompanyInfo(options.companyProfile));
  }

  return null;
}

export function hydrateFooterBlockWithDesignSystem(
  block: StudioBlock,
  designSystem: StudioDesignSystem | null | undefined,
) {
  if (block.type !== "footer" || !designSystem) {
    return block;
  }

  const businessName = designSystem.company.name || block.businessName;
  const address = designSystem.company.addressLines || block.address;
  const websiteUrl = designSystem.company.websiteUrl || block.websiteUrl;

  const nextBlock = {
    ...block,
    businessName,
    address,
    copyright:
      block.copyright?.replace(
        "Your Business",
        businessName || "Your Business",
      ) || `© ${new Date().getFullYear()} ${businessName || "Your Business"}`,
    copyrightText:
      block.copyrightText?.replace(
        "Your Business",
        businessName || "Your Business",
      ) || `© ${new Date().getFullYear()} ${businessName || "Your Business"}`,
    complianceText:
      designSystem.company.footerLegalText ||
      block.complianceText ||
      DEFAULT_COMPLIANCE_TEXT,
    logoUrl: block.logoUrl || designSystem.company.logoUrl,
    websiteUrl,
    showWebsiteLink: Boolean(websiteUrl),
    backgroundColor: valueMatchesDefault(block.backgroundColor, [
      DEFAULT_FOOTER_BACKGROUND,
    ])
      ? designSystem.colors.footerBackground || block.backgroundColor
      : block.backgroundColor,
    textColor: valueMatchesDefault(block.textColor, [DEFAULT_FOOTER_TEXT])
      ? designSystem.colors.footerText || block.textColor
      : block.textColor,
    linkColor: valueMatchesDefault(block.linkColor, [DEFAULT_FOOTER_LINK])
      ? designSystem.colors.footerLink || block.linkColor
      : block.linkColor,
    dividerBelowColor: valueMatchesDefault(block.dividerBelowColor, [
      DEFAULT_FOOTER_DIVIDER,
    ])
      ? designSystem.colors.footerDivider || block.dividerBelowColor
      : block.dividerBelowColor,
    footerIconColor: valueMatchesDefault(block.footerIconColor, [
      DEFAULT_FOOTER_LINK,
    ])
      ? designSystem.colors.footerLink || block.footerIconColor
      : block.footerIconColor,
    footerSocialLinks: hasConfiguredSocialLinks(block.footerSocialLinks)
      ? block.footerSocialLinks
      : designSystem.social.links,
  };

  if (
    nextBlock.businessName === block.businessName &&
    nextBlock.address === block.address &&
    nextBlock.copyright === block.copyright &&
    nextBlock.copyrightText === block.copyrightText &&
    nextBlock.complianceText === block.complianceText &&
    nextBlock.logoUrl === block.logoUrl &&
    nextBlock.websiteUrl === block.websiteUrl &&
    nextBlock.showWebsiteLink === block.showWebsiteLink &&
    nextBlock.backgroundColor === block.backgroundColor &&
    nextBlock.textColor === block.textColor &&
    nextBlock.linkColor === block.linkColor &&
    nextBlock.dividerBelowColor === block.dividerBelowColor &&
    nextBlock.footerIconColor === block.footerIconColor &&
    nextBlock.footerSocialLinks === block.footerSocialLinks
  ) {
    return block;
  }

  return nextBlock;
}

export function ensureFooterBlockCompliance(
  blocks: StudioBlock[],
  options: FooterComplianceOptions = {},
) {
  const designSystem = resolveDesignSystem(options);
  const sortedBlocks = blocks
    .map((block, index) => ({
      block: {
        ...block,
        order: typeof block.order === "number" ? block.order : index,
        visible: block.visible !== false,
      },
      index,
    }))
    .sort(
      (left, right) =>
        (left.block.order ?? left.index) - (right.block.order ?? right.index) ||
        left.index - right.index,
    )
    .map(({ block }) => block);

  const nonFooterBlocks = sortedBlocks.filter(
    (block) => block.type !== "footer",
  );
  const existingFooter =
    sortedBlocks.filter((block) => block.type === "footer").at(-1) ?? null;
  const footerSeed = existingFooter
    ? existingFooter
    : createFooterBlockFromDesignSystem(designSystem, options.footerOverrides);
  const footerBlock = hydrateFooterBlockWithDesignSystem(
    footerSeed,
    designSystem,
  );

  return [...nonFooterBlocks, footerBlock].map((block, index) => ({
    ...block,
    order: index,
  }));
}

export function hasFooterBlock(blocks: StudioBlock[]) {
  return blocks.some((block) => block.type === "footer");
}
