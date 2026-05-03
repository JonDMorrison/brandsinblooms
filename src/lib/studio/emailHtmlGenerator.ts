import type {
  GalleryImage,
  GalleryProduct,
  SocialLink,
  StudioBlock,
} from "../../types/studioBlocks.ts";
import { formatDraftRichText } from "@/lib/crm/htmlContent";
import type { StudioDesignSystem } from "@/lib/studio/designSystem";

export type EmailFooterLinks = {
  unsubscribeUrl?: string;
  preferencesUrl?: string;
  websiteUrl?: string;
};

export type StudioFooterProfile = {
  company_name?: string | null;
  company_email?: string | null;
  company_phone?: string | null;
  website_url?: string | null;
  street_address?: string | null;
  city?: string | null;
  state_province?: string | null;
  postal_code?: string | null;
  country?: string | null;
  footer_legal_text?: string | null;
  brand_primary_color?: string | null;
  brand_text_color?: string | null;
  feature_flags?: {
    company_logo_url?: string;
    footer_settings?: {
      showManagePreferences?: boolean;
      websiteUrl?: string;
      complianceText?: string;
    };
    footer_colors?: {
      backgroundColor?: string;
      textColor?: string;
      linkColor?: string;
    };
  } | null;
};

export type GenerateEmailHtmlParams = {
  blocks: StudioBlock[];
  subject: string;
  previewText: string;
  footer: StudioBlock | null;
  mergeData?: Record<string, string>;
  footerLinks?: EmailFooterLinks;
  designSystem?: StudioDesignSystem | null;
};

type EmailFontRole = "brand" | "headline" | "subheading" | "body" | "button";

const DEFAULT_EMAIL_FONT_STACK = "Arial, Helvetica, sans-serif";
const EMAIL_WIDTH = 640;
const DEFAULT_COMPLIANCE_TEXT =
  "You are receiving this email because you opted in to receive updates from our business.";
const SOCIAL_ICON_BASE_URL = "https://bloomsuite.app/social-icons";
const DEFAULT_SOCIAL_PLATFORMS: Array<SocialLink["platform"]> = [
  "facebook",
  "instagram",
  "twitter",
  "linkedin",
  "youtube",
  "tiktok",
  "pinterest",
  "threads",
];
const SOCIAL_ICON_URLS: Partial<Record<SocialLink["platform"], string>> = {
  facebook: `${SOCIAL_ICON_BASE_URL}/facebook.png`,
  instagram: `${SOCIAL_ICON_BASE_URL}/instagram.png`,
  linkedin: `${SOCIAL_ICON_BASE_URL}/linkedin.png`,
  youtube: `${SOCIAL_ICON_BASE_URL}/youtube.png`,
  tiktok: `${SOCIAL_ICON_BASE_URL}/tiktok.png`,
  pinterest: `${SOCIAL_ICON_BASE_URL}/pinterest.png`,
};
const SOCIAL_LABELS: Record<SocialLink["platform"], string> = {
  facebook: "Facebook",
  instagram: "Instagram",
  twitter: "Twitter / X",
  linkedin: "LinkedIn",
  youtube: "YouTube",
  tiktok: "TikTok",
  pinterest: "Pinterest",
  threads: "Threads",
};
const SOCIAL_COLORS: Record<SocialLink["platform"], string> = {
  facebook: "#1877F2",
  instagram: "#C13584",
  twitter: "#111111",
  linkedin: "#0A66C2",
  youtube: "#FF0000",
  tiktok: "#111111",
  pinterest: "#E60023",
  threads: "#111111",
};

function getDesignSystemFontFamily(
  designSystem: StudioDesignSystem | null | undefined,
  role: EmailFontRole,
) {
  if (!designSystem) {
    return "";
  }

  switch (role) {
    case "brand":
      return (
        designSystem.typography.selected?.fontFamilyCss ||
        designSystem.typography.body?.fontFamilyCss ||
        ""
      );
    case "headline":
      return (
        designSystem.typography.headline?.fontFamilyCss ||
        designSystem.typography.selected?.fontFamilyCss ||
        ""
      );
    case "subheading":
      return (
        designSystem.typography.subheading?.fontFamilyCss ||
        designSystem.typography.headline?.fontFamilyCss ||
        designSystem.typography.selected?.fontFamilyCss ||
        ""
      );
    case "button":
      return (
        designSystem.typography.button?.fontFamilyCss ||
        designSystem.typography.body?.fontFamilyCss ||
        designSystem.typography.selected?.fontFamilyCss ||
        ""
      );
    case "body":
    default:
      return (
        designSystem.typography.body?.fontFamilyCss ||
        designSystem.typography.selected?.fontFamilyCss ||
        ""
      );
  }
}

function getFontStack(
  designSystem: StudioDesignSystem | null | undefined,
  role: EmailFontRole,
) {
  const fontFamily = getDesignSystemFontFamily(designSystem, role);

  if (!fontFamily || /var\(/i.test(fontFamily)) {
    return DEFAULT_EMAIL_FONT_STACK;
  }

  if (
    /(sans-serif|serif|monospace|cursive|fantasy|system-ui)/i.test(fontFamily)
  ) {
    return fontFamily;
  }

  return `${fontFamily}, ${DEFAULT_EMAIL_FONT_STACK}`;
}

function buildFontLinks(designSystem: StudioDesignSystem | null | undefined) {
  if (!designSystem) {
    return "";
  }

  const urls = Array.from(new Set(designSystem.fontUrls.filter(Boolean)));

  if (urls.length === 0) {
    return "";
  }

  return `${urls
    .map((url) => `  <link rel="stylesheet" href="${escapeAttribute(url)}" />`)
    .join("\n")}
`;
}

function getDesignSystemSocialLinks(
  designSystem: StudioDesignSystem | null | undefined,
) {
  return designSystem?.social.links ?? [];
}

function getDesignSystemSocialUrl(
  designSystem: StudioDesignSystem | null | undefined,
  platform: SocialLink["platform"],
) {
  return stringValue(
    getDesignSystemSocialLinks(designSystem).find(
      (link) => link.platform === platform,
    )?.url,
  );
}

function getFooterContactLines(
  block: StudioBlock,
  designSystem: StudioDesignSystem | null | undefined,
) {
  const lines = stringValue(
    block.address,
    stringValue(designSystem?.company.addressLines),
  )
    .split(/\n+/)
    .map((line) => stringValue(line))
    .filter(Boolean);

  if (stringValue(designSystem?.company.phone)) {
    lines.push(stringValue(designSystem?.company.phone));
  }

  if (stringValue(designSystem?.company.email)) {
    lines.push(stringValue(designSystem?.company.email));
  }

  return lines;
}

function renderFooterContactContent(
  block: StudioBlock,
  designSystem: StudioDesignSystem | null | undefined,
  inline = false,
) {
  const lines = getFooterContactLines(block, designSystem);

  if (lines.length === 0) {
    return "";
  }

  return lines
    .map((line) => escapeHtml(line))
    .join(inline ? " &middot; " : "<br>");
}

function getDividerLineColor(
  block: StudioBlock,
  designSystem: StudioDesignSystem | null | undefined,
) {
  const rawLineColor = stringValue(block.lineColor).toLowerCase();
  const brandTint = designSystem?.colors.text
    ? colorWithOpacity(safeColor(designSystem.colors.text, "#111827"), 0.18)
    : "#d1d5db";

  if (!rawLineColor || rawLineColor === "#d1d5db") {
    return brandTint;
  }

  return safeColor(block.lineColor, brandTint);
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeAttribute(value: string) {
  return escapeHtml(value).replace(/`/g, "&#96;");
}

function stringValue(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : fallback;
}

function numberValue(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function safeColor(value: unknown, fallback: string) {
  const color = stringValue(value);
  if (/^#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/.test(color)) return color;
  if (/^rgba?\([^)]+\)$/i.test(color)) return color;
  if (color === "transparent") return color;
  return fallback;
}

function colorWithOpacity(color: string, opacity: number) {
  if (/^rgba?\(/i.test(color)) {
    return color;
  }

  const hex = color.replace("#", "");
  const fullHex =
    hex.length === 3
      ? hex
          .split("")
          .map((part) => `${part}${part}`)
          .join("")
      : hex;

  if (!/^[0-9a-f]{6}$/i.test(fullHex)) {
    return `rgba(0,0,0,${opacity})`;
  }

  const red = Number.parseInt(fullHex.slice(0, 2), 16);
  const green = Number.parseInt(fullHex.slice(2, 4), 16);
  const blue = Number.parseInt(fullHex.slice(4, 6), 16);

  return `rgba(${red},${green},${blue},${opacity})`;
}

function safeUrl(value: unknown, options: { image?: boolean } = {}) {
  const url = stringValue(value);
  if (!url) return "";
  if (/^javascript:/i.test(url)) return "";
  if (/^data:/i.test(url) && !options.image) return "";
  return url;
}

function resolveMergeTags(html: string, mergeData?: Record<string, string>) {
  if (!mergeData) return html;

  return html.replace(
    /\{\{\s*([a-zA-Z_][a-zA-Z0-9_.]*)\s*(?:\|\s*default:\s*["']([^"']*)["'])?\s*\}\}/g,
    (_match, key: string, fallback?: string) =>
      escapeHtml(mergeData[key] ?? fallback ?? ""),
  );
}

function hasRenderableRichText(value: unknown) {
  if (typeof value !== "string") return false;

  return Boolean(
    value
      .replace(/<[^>]*>/g, "")
      .replace(/&nbsp;/g, " ")
      .trim(),
  );
}

function sanitizeRichHtml(
  html: string,
  designSystem?: StudioDesignSystem | null,
) {
  const headlineFont = getFontStack(designSystem, "headline");
  const subheadingFont = getFontStack(designSystem, "subheading");
  const bodyFont = getFontStack(designSystem, "body");
  const stripped = formatDraftRichText(html).replace(
    /<\/?(?:html|head|body)[^>]*>/gi,
    "",
  );

  return stripped
    .replace(
      /<p(\s[^>]*)?>/gi,
      `<p style="margin:0 0 12px;font-family:${bodyFont};">`,
    )
    .replace(
      /<h1(\s[^>]*)?>/gi,
      `<h1 style="margin:0 0 12px;font-family:${headlineFont};font-size:26px;line-height:1.2;">`,
    )
    .replace(
      /<h2(\s[^>]*)?>/gi,
      `<h2 style="margin:0 0 12px;font-family:${subheadingFont};font-size:22px;line-height:1.25;">`,
    )
    .replace(
      /<h3(\s[^>]*)?>/gi,
      `<h3 style="margin:0 0 10px;font-family:${subheadingFont};font-size:18px;line-height:1.3;">`,
    )
    .replace(
      /<ul(\s[^>]*)?>/gi,
      `<ul style="margin:0 0 12px 20px;padding:0;font-family:${bodyFont};">`,
    )
    .replace(
      /<ol(\s[^>]*)?>/gi,
      `<ol style="margin:0 0 12px 20px;padding:0;font-family:${bodyFont};">`,
    )
    .replace(
      /<li(\s[^>]*)?>/gi,
      `<li style="margin:0 0 6px;font-family:${bodyFont};">`,
    )
    .replace(/<a(\s[^>]*)?>/gi, (_match, attrs: string = "") => {
      const styleMatch = attrs.match(/\sstyle=("([^"]*)"|'([^']*)')/i);

      if (!styleMatch) {
        return `<a${attrs} style="color:inherit;text-decoration:underline;">`;
      }

      const existingStyles = styleMatch[2] ?? styleMatch[3] ?? "";
      const quote = styleMatch[1][0];
      const mergedStyles = `${existingStyles}${existingStyles.trim().endsWith(";") || !existingStyles ? "" : ";"}color:inherit;text-decoration:underline;`;

      return `<a${attrs.replace(styleMatch[0], ` style=${quote}${mergedStyles}${quote}`)}>`;
    });
}

function textBlock(value: unknown) {
  return escapeHtml(stringValue(value)).replace(/\n/g, "<br>");
}

function getAlignment(
  value: StudioBlock["textAlign"],
  fallback: "left" | "center" | "right" = "left",
) {
  return value === "center" || value === "right" || value === "left"
    ? value
    : fallback;
}

function getButtonPadding(size: StudioBlock["buttonSize"]) {
  switch (size) {
    case "sm":
      return "10px 18px";
    case "lg":
      return "15px 30px";
    default:
      return "13px 24px";
  }
}

function getButtonFontSize(size: StudioBlock["buttonSize"]) {
  switch (size) {
    case "sm":
      return 13;
    case "lg":
      return 16;
    default:
      return 14;
  }
}

function getGraphicHeroVerticalAlign(position: StudioBlock["textPosition"]) {
  switch (position) {
    case "top":
      return "top";
    case "bottom":
      return "bottom";
    default:
      return "middle";
  }
}

function getGraphicHeroBackgroundSize(fit: StudioBlock["imageFit"]) {
  switch (fit) {
    case "contain":
      return "contain";
    case "fill":
      return "100% 100%";
    default:
      return "cover";
  }
}

function getGraphicHeroOverlayStyle(block: StudioBlock) {
  const overlayColor = safeColor(block.overlayColor, "#000000");
  const overlayOpacity =
    Math.max(0, Math.min(100, numberValue(block.overlayOpacity, 45))) / 100;
  const solid = colorWithOpacity(overlayColor, overlayOpacity);
  const transparent = colorWithOpacity(overlayColor, 0);

  switch (block.overlayGradientDirection) {
    case "top-to-bottom":
      return `background:${solid};background:linear-gradient(to bottom, ${solid}, ${transparent});`;
    case "bottom-to-top":
      return `background:${solid};background:linear-gradient(to top, ${solid}, ${transparent});`;
    default:
      return `background-color:${solid};`;
  }
}

function renderGraphicHeroContent(
  block: StudioBlock,
  designSystem: StudioDesignSystem | null | undefined,
  options: {
    includeButton?: boolean;
    compact?: boolean;
    defaultTextColor?: string;
  } = {},
) {
  const align = getAlignment(block.textAlign, "center");
  const textColor = safeColor(
    block.textColor,
    options.defaultTextColor || "#ffffff",
  );
  const headline = stringValue(block.headline);
  const subheading = stringValue(block.subheading);
  const maxWidth = options.compact ? 560 : 520;
  const margin =
    align === "center" ? "0 auto" : align === "right" ? "0 0 0 auto" : "0";
  const pieces: string[] = [];
  const headlineFont = getFontStack(designSystem, "headline");
  const subheadingFont = getFontStack(designSystem, "subheading");

  if (headline) {
    pieces.push(
      `<div style="font-family:${headlineFont};font-size:${options.compact ? 16 : 28}px;line-height:${options.compact ? 1.35 : 1.2};font-weight:700;color:${textColor};margin:0 0 ${subheading ? 6 : 0}px;text-align:${align};">${textBlock(headline)}</div>`,
    );
  }

  if (subheading) {
    pieces.push(
      `<div style="font-family:${subheadingFont};font-size:${options.compact ? 13 : 16}px;line-height:1.5;color:${colorWithOpacity(textColor, options.compact ? 0.72 : 0.82)};margin:0;text-align:${align};">${textBlock(subheading)}</div>`,
    );
  }

  if (options.includeButton && stringValue(block.buttonText)) {
    pieces.push(
      renderButton(block, designSystem, {
        align,
        marginTop: pieces.length ? 18 : 0,
      }),
    );
  }

  return `<div style="max-width:${maxWidth}px;margin:${margin};text-align:${align};">${pieces.join("")}</div>`;
}

function getFontSize(size: StudioBlock["fontSize"]) {
  switch (size) {
    case "sm":
      return 14;
    case "lg":
      return 18;
    default:
      return 16;
  }
}

function resolveImageTextLayout(block: StudioBlock) {
  if (block.layout) {
    return block.layout;
  }

  switch (block.layoutPreset) {
    case "image-text-right":
      return "image-right";
    case "image-text-top":
      return "image-top";
    case "image-text-overlay":
      return "image-overlay";
    case "image-text-minimal":
      return "minimal-card";
    default:
      break;
  }

  switch (block.imagePosition) {
    case "right":
      return "image-right";
    case "top":
      return "image-top";
    case "overlay":
      return "image-overlay";
    default:
      return "image-left";
  }
}

function getImageTextSplit(columnSplit: StudioBlock["columnSplit"]) {
  switch (columnSplit) {
    case "40/60":
      return { image: 40, text: 60 };
    case "60/40":
      return { image: 60, text: 40 };
    default:
      return { image: 50, text: 50 };
  }
}

function resolveQuoteLayout(block: StudioBlock) {
  if (block.layout) {
    return block.layout;
  }

  switch (block.layoutPreset) {
    case "quote-centered":
      return "large-centered";
    case "quote-avatar":
      return "avatar-card";
    default:
      return "classic";
  }
}

function resolveImageGalleryLayout(block: StudioBlock) {
  if (block.layout) {
    return block.layout;
  }

  switch (block.layoutPreset) {
    case "gallery-grid-4":
      return "grid-4";
    case "gallery-grid-6":
      return "grid-6";
    case "gallery-feature-grid":
      return "feature-grid";
    default:
      return "grid-3";
  }
}

function getImageGalleryColumns(block: StudioBlock, layout: string) {
  switch (layout) {
    case "grid-4":
      return 2;
    case "grid-6":
      return 3;
    default:
      return Math.max(1, Math.min(4, numberValue(block.gridColumns, 3)));
  }
}

function resolveFooterLayout(block: StudioBlock) {
  if (block.layout) {
    return block.layout;
  }

  switch (block.layoutPreset) {
    case "footer-light-minimal":
      return "light-minimal";
    case "footer-centered-branded":
      return "centered-branded";
    default:
      return "standard-dark";
  }
}

function renderSection(backgroundColor: string, innerHtml: string) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;border-collapse:collapse;background-color:${backgroundColor};"><tr><td style="padding:0;background-color:${backgroundColor};">${innerHtml}</td></tr></table>`;
}

function renderTextContent(
  block: StudioBlock,
  designSystem: StudioDesignSystem | null | undefined,
  options: { compact?: boolean } = {},
) {
  const textColor = safeColor(block.textColor, "#111827");
  const align = getAlignment(block.textAlign, "left");
  const headline = stringValue(block.headline || block.subheading);
  const subheading = stringValue(block.subheading);
  const body = stringValue(block.body);
  const pieces: string[] = [];
  const bodyFont = getFontStack(designSystem, "body");
  const headlineFont = getFontStack(designSystem, "headline");
  const subheadingFont = getFontStack(designSystem, "subheading");

  if (stringValue(block.tagLabel)) {
    pieces.push(
      `<div style="font-family:${bodyFont};font-size:12px;line-height:1.4;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:${textColor};opacity:0.72;margin-bottom:8px;">${textBlock(block.tagLabel)}</div>`,
    );
  }

  if (headline) {
    pieces.push(
      `<h1 style="font-family:${headlineFont};font-size:${options.compact ? 22 : 30}px;line-height:1.15;font-weight:700;color:${textColor};margin:0 0 12px;text-align:${align};">${textBlock(headline)}</h1>`,
    );
  }

  if (subheading && subheading !== headline) {
    pieces.push(
      `<div style="font-family:${subheadingFont};font-size:18px;line-height:1.45;color:${textColor};opacity:0.86;margin-bottom:12px;text-align:${align};">${textBlock(subheading)}</div>`,
    );
  }

  if (body) {
    pieces.push(
      `<div style="font-family:${bodyFont};font-size:${options.compact ? 14 : 16}px;line-height:1.65;color:${textColor};text-align:${align};">${sanitizeRichHtml(body, designSystem)}</div>`,
    );
  }

  return pieces.join("");
}

function renderButton(
  block: StudioBlock,
  designSystem: StudioDesignSystem | null | undefined,
  options: { marginTop?: number; align?: "left" | "center" | "right" } = {},
) {
  const label = stringValue(block.buttonText);
  if (!label) return "";

  const href = safeUrl(block.buttonUrl) || "#";
  const style = block.buttonStyle || "filled";
  const align = options.align || getAlignment(block.textAlign, "center");
  const buttonColor = safeColor(block.buttonColor, "#111827");
  const textColor = safeColor(
    block.buttonTextColor,
    style === "filled" ? "#ffffff" : buttonColor,
  );
  const radius = block.buttonRounded === false ? "6px" : "999px";
  const fullWidth = block.fullWidthButton ? "width:100%;" : "";
  const common = `font-family:${getFontStack(designSystem, "button")};font-size:${getButtonFontSize(block.buttonSize)}px;line-height:1.2;font-weight:700;text-decoration:${style === "link" ? "underline" : "none"};display:block;${fullWidth}`;
  const styleText =
    style === "outlined"
      ? `${common}padding:${getButtonPadding(block.buttonSize)};border:1px solid ${buttonColor};border-radius:${radius};color:${textColor};background-color:transparent;`
      : style === "ghost"
        ? `${common}padding:${getButtonPadding(block.buttonSize)};border:1px solid ${buttonColor};border-radius:${radius};color:${textColor};background-color:${colorWithOpacity(buttonColor, 0.16)};`
        : style === "link"
          ? `${common}padding:0;color:${buttonColor};background-color:transparent;`
          : `${common}padding:${getButtonPadding(block.buttonSize)};border-radius:${radius};color:${textColor};background-color:${buttonColor};`;
  const cellBg =
    style === "filled" ? ` bgcolor="${escapeAttribute(buttonColor)}"` : "";

  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="${align}" style="border-collapse:separate;margin:${options.marginTop ?? 24}px ${align === "center" ? "auto" : align === "right" ? "0 0 0 auto" : "0"} 0;${block.fullWidthButton ? "width:100%;max-width:420px;" : ""}"><tr><td${cellBg} align="center" style="border-radius:${radius};"><a href="${escapeAttribute(href)}" target="_blank" style="${styleText}">${escapeHtml(label)}</a></td></tr></table>`;
}

function renderHeroBlock(
  block: StudioBlock,
  designSystem: StudioDesignSystem | null | undefined,
) {
  const backgroundColor = safeColor(block.backgroundColor, "#1a1a2e");
  const textColor = safeColor(block.textColor, "#ffffff");
  const align = getAlignment(block.textAlign, "center");
  const heroStyle = block.heroStyle || "solid";
  const imageUrl = safeUrl(block.imageUrl, { image: true });
  const padding = "48px 32px";
  const background =
    heroStyle === "gradient"
      ? `background:${safeColor(block.gradientFrom, "#ff6b6b")};background:linear-gradient(135deg, ${safeColor(block.gradientFrom, "#ff6b6b")}, ${safeColor(block.gradientTo, "#ffd93d")});`
      : `background-color:${backgroundColor};`;
  const content = `<div style="max-width:560px;margin:${align === "center" ? "0 auto" : align === "right" ? "0 0 0 auto" : "0"};text-align:${align};color:${textColor};">${renderTextContent({ ...block, textColor }, designSystem, { compact: false })}${renderButton(block, designSystem, { align })}</div>`;

  if (heroStyle === "image-overlay" && imageUrl) {
    const overlayOpacity =
      Math.max(0, Math.min(100, numberValue(block.overlayOpacity, 45))) / 100;
    const overlayColor = safeColor(block.overlayColor, "#000000");
    return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;border-collapse:collapse;background-color:${backgroundColor};"><tr><td background="${escapeAttribute(imageUrl)}" bgcolor="${escapeAttribute(backgroundColor)}" style="background-color:${backgroundColor};background-image:url('${escapeAttribute(imageUrl)}');background-position:center center;background-size:cover;background-repeat:no-repeat;"><!--[if gte mso 9]><v:rect xmlns:v="urn:schemas-microsoft-com:vml" fill="true" stroke="false" style="width:${EMAIL_WIDTH}px;"><v:fill type="frame" src="${escapeAttribute(imageUrl)}" color="${escapeAttribute(backgroundColor)}" /><v:textbox inset="0,0,0,0"><![endif]--><div style="background-color:${colorWithOpacity(overlayColor, overlayOpacity)};padding:${padding};">${content}</div><!--[if gte mso 9]></v:textbox></v:rect><![endif]--></td></tr></table>`;
  }

  if (heroStyle === "image-bottom") {
    const imageHtml = imageUrl
      ? `<img class="responsive-image" src="${escapeAttribute(imageUrl)}" alt="${escapeAttribute(block.imageAlt || block.headline || "Hero image")}" width="${EMAIL_WIDTH}" style="display:block;width:100%;max-width:${EMAIL_WIDTH}px;height:auto;border:0;outline:none;text-decoration:none;" />`
      : "";
    return renderSection(
      backgroundColor,
      `<div class="mobile-padding" style="${background}padding:${padding};">${content}</div>${imageHtml}`,
    );
  }

  return renderSection(
    backgroundColor,
    `<div class="mobile-padding" style="${background}padding:${padding};">${content}</div>`,
  );
}

function renderGraphicImageBlock(
  block: StudioBlock,
  designSystem: StudioDesignSystem | null | undefined,
) {
  const imageUrl = safeUrl(block.imageUrl, { image: true });
  if (!imageUrl) return "";

  if (block.type !== "graphic-hero") {
    const backgroundColor = safeColor(block.backgroundColor, "#ffffff");
    const radius = numberValue(block.borderRadius, 0);
    const padding = block.imagePadding ? 16 : 0;
    const image = `<img class="responsive-image" src="${escapeAttribute(imageUrl)}" alt="${escapeAttribute(block.imageAlt || block.caption || "Campaign image")}" width="${EMAIL_WIDTH - padding * 2}" style="display:block;width:100%;max-width:${EMAIL_WIDTH - padding * 2}px;height:auto;border:0;outline:none;text-decoration:none;border-radius:${radius}px;" />`;
    const linked = safeUrl(block.linkUrl)
      ? `<a href="${escapeAttribute(safeUrl(block.linkUrl))}" target="_blank" style="text-decoration:none;">${image}</a>`
      : image;
    const caption = stringValue(block.caption)
      ? `<div style="font-family:${getFontStack(designSystem, "body")};font-size:12px;line-height:1.5;color:${safeColor(block.textColor, "#64748b")};text-align:center;padding:10px 0 0;">${textBlock(block.caption)}</div>`
      : "";

    return renderSection(
      backgroundColor,
      `<div style="padding:${padding}px;background-color:${backgroundColor};line-height:0;">${linked}${caption}</div>`,
    );
  }

  const backgroundColor = safeColor(block.backgroundColor, "#ffffff");
  const radius = numberValue(block.borderRadius, 0);
  const padding = (block.insetPadding ?? block.imagePadding) ? 16 : 0;
  const maxHeight = Math.max(
    200,
    Math.min(600, numberValue(block.maxHeight, 400)),
  );
  const align = getAlignment(block.textAlign, "center");
  const showTextOverlay = block.showTextOverlay === true;
  const showCaptionBar = block.showCaptionBar === true;
  const showButton =
    block.showButton === true && Boolean(stringValue(block.buttonText));
  const showFloatingButton = showButton && !showCaptionBar;
  const imageRadius = showCaptionBar
    ? `${radius}px ${radius}px 0 0`
    : `${radius}px`;
  const imageCellBackground = `background-color:${backgroundColor};background-image:url('${escapeAttribute(imageUrl)}');background-position:center center;background-size:${getGraphicHeroBackgroundSize(block.imageFit)};background-repeat:no-repeat;`;
  const overlayStyle = block.showOverlay
    ? getGraphicHeroOverlayStyle(block)
    : "";
  const overlayContent = showTextOverlay
    ? renderGraphicHeroContent(block, designSystem, {
        includeButton: showFloatingButton,
        defaultTextColor: "#ffffff",
      })
    : showFloatingButton
      ? renderButton(block, designSystem, { align, marginTop: 0 })
      : "";
  const overlayLayer = `<div style="height:${maxHeight}px;${overlayStyle}"><table role="presentation" width="100%" height="${maxHeight}" cellpadding="0" cellspacing="0" border="0" style="width:100%;height:${maxHeight}px;border-collapse:collapse;"><tr><td valign="${getGraphicHeroVerticalAlign(block.textPosition)}" style="padding:${showTextOverlay ? "32px 24px" : "24px"};">${overlayContent || "&nbsp;"}</td></tr></table></div>`;
  const imageTable = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;border-collapse:separate;border-spacing:0;"><tr><td background="${escapeAttribute(imageUrl)}" bgcolor="${escapeAttribute(backgroundColor)}" height="${maxHeight}" style="height:${maxHeight}px;${imageCellBackground}border-radius:${imageRadius};overflow:hidden;">${overlayLayer}</td></tr></table>`;
  const linkedImage = safeUrl(block.linkUrl)
    ? `<a href="${escapeAttribute(safeUrl(block.linkUrl))}" target="_blank" style="text-decoration:none;display:block;">${imageTable}</a>`
    : imageTable;
  const captionBar = showCaptionBar
    ? `<div style="background-color:${safeColor(block.captionBarColor, "#1e293b")};padding:16px 24px;text-align:${align};">${renderGraphicHeroContent(block, designSystem, { includeButton: showButton, compact: true, defaultTextColor: "#ffffff" })}</div>`
    : "";
  const shadow = block.showShadow
    ? "box-shadow:0 4px 16px rgba(0,0,0,0.12);"
    : "";

  return renderSection(
    backgroundColor,
    `<div style="padding:${padding}px;background-color:${backgroundColor};line-height:0;"><div style="${shadow}border-radius:${radius}px;overflow:hidden;">${linkedImage}${captionBar}</div></div>`,
  );
}

function getNewsletterHeaderDefaultPaddingY(layout: string) {
  switch (layout) {
    case "centered":
      return 24;
    case "minimal":
      return 16;
    case "banner":
      return 20;
    default:
      return 20;
  }
}

function getNewsletterHeaderLogoRadius(block: StudioBlock) {
  switch (block.logoShape) {
    case "circle":
      return "50%";
    case "square":
      return "0px";
    default:
      return "10px";
  }
}

function renderNewsletterHeaderLogoHtml(
  block: StudioBlock,
  title: string,
  textColor: string,
  designSystem: StudioDesignSystem | null | undefined,
  options: { showPlaceholder?: boolean; size?: number } = {},
) {
  const showPlaceholder = options.showPlaceholder ?? true;
  const size = Math.max(24, numberValue(block.logoSize, options.size ?? 40));
  const logoUrl = safeUrl(block.logoUrl, { image: true });
  const isCircle = block.logoShape === "circle";
  const placeholderWidth = isCircle ? size : Math.max(size, 52);
  const maxWidth = isCircle
    ? size
    : Math.max(placeholderWidth, Math.round(size * 2.6));

  if (logoUrl) {
    return `<img src="${escapeAttribute(logoUrl)}" alt="${escapeAttribute(title)} logo" style="display:block;width:${isCircle ? `${size}px` : "auto"};max-width:${maxWidth}px;height:${size}px;object-fit:${isCircle ? "cover" : "contain"};border:0;outline:none;text-decoration:none;border-radius:${getNewsletterHeaderLogoRadius(block)};" />`;
  }

  if (!showPlaceholder) {
    return "";
  }

  return `<div style="display:inline-flex;align-items:center;justify-content:center;width:${placeholderWidth}px;height:${size}px;border-radius:${getNewsletterHeaderLogoRadius(block)};border:1.5px dashed ${colorWithOpacity(textColor, 0.16)};background-color:#f8fafc;color:${colorWithOpacity(textColor, 0.42)};font-family:${getFontStack(designSystem, "brand")};font-size:11px;font-weight:700;line-height:1;">Logo</div>`;
}

function renderNewsletterHeaderBlock(
  block: StudioBlock,
  designSystem: StudioDesignSystem | null | undefined,
) {
  const layout = block.layout || "classic";
  const backgroundColor = safeColor(
    block.backgroundColor,
    layout === "banner" ? "#0f766e" : "#ffffff",
  );
  const textColor = safeColor(
    block.textColor,
    layout === "banner" ? "#ffffff" : "#1a1a2e",
  );
  const paddingY = numberValue(
    block.verticalPadding,
    getNewsletterHeaderDefaultPaddingY(layout),
  );
  const title = stringValue(block.headline, "Newsletter Title");
  const tagline = stringValue(block.tagline, "Your weekly garden update");
  const dateLabel = stringValue(block.dateLabel, "May 2026");
  const hasTitle = Boolean(stringValue(block.headline));
  const hasTagline = Boolean(stringValue(block.tagline));
  const hasDate = Boolean(stringValue(block.dateLabel));
  const showDivider = block.showDividerBelow ?? block.showDivider ?? true;
  const dividerColor = safeColor(
    block.dividerBelowColor,
    layout === "banner" ? "rgba(255,255,255,0.2)" : "#e2e8f0",
  );
  const titleFont = getFontStack(designSystem, "headline");
  const subheadingFont = getFontStack(designSystem, "subheading");
  const bodyFont = getFontStack(designSystem, "body");
  const titleColor = hasTitle ? textColor : colorWithOpacity(textColor, 0.42);
  const subtitleColor = hasTagline
    ? colorWithOpacity(textColor, layout === "banner" ? 0.82 : 0.64)
    : colorWithOpacity(textColor, layout === "banner" ? 0.7 : 0.48);
  const dateColor = hasDate
    ? colorWithOpacity(textColor, layout === "banner" ? 0.7 : 0.54)
    : colorWithOpacity(textColor, layout === "banner" ? 0.6 : 0.4);
  const logoHtml = renderNewsletterHeaderLogoHtml(
    block,
    title,
    textColor,
    designSystem,
    {
      showPlaceholder: layout !== "banner",
      size: layout === "banner" ? 36 : 40,
    },
  );
  const dividerRow = showDivider
    ? `<tr><td valign="middle" style="padding:0 24px;"><div style="height:1px;background-color:${dividerColor};${layout === "banner" ? "opacity:0.45;" : ""}"></div></td></tr>`
    : "";

  if (layout === "centered") {
    return renderSection(
      backgroundColor,
      `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;border-collapse:collapse;background-color:${backgroundColor};"><tr><td valign="middle" align="center" style="padding:${paddingY}px 24px;text-align:center;vertical-align:middle;">${logoHtml ? `<div style="margin-bottom:8px;">${logoHtml}</div>` : ""}<div style="font-family:${titleFont};font-size:22px;line-height:1.2;font-weight:700;color:${titleColor};margin:0;">${textBlock(title)}</div><div style="font-family:${subheadingFont};font-size:13px;line-height:1.4;color:${subtitleColor};margin-top:4px;">${textBlock(tagline)}</div><div style="font-family:${bodyFont};font-size:12px;line-height:1.35;color:${dateColor};margin-top:4px;">${textBlock(dateLabel)}</div></td></tr>${dividerRow}</table>`,
    );
  }

  if (layout === "minimal") {
    const minimalTagline = hasTagline
      ? `<div style="font-family:${subheadingFont};font-size:13px;line-height:1.35;color:${colorWithOpacity(textColor, 0.64)};margin-top:4px;">${textBlock(stringValue(block.tagline))}</div>`
      : "";

    return renderSection(
      backgroundColor,
      `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;border-collapse:collapse;background-color:${backgroundColor};"><tr><td valign="middle" style="padding:${paddingY}px 24px;vertical-align:middle;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;border-collapse:collapse;"><tr><td class="responsive-column" valign="middle" style="vertical-align:middle;"><div style="font-family:${titleFont};font-size:18px;line-height:1.2;font-weight:600;color:${titleColor};margin:0;">${textBlock(title)}</div></td><td class="responsive-column" width="96" valign="middle" align="right" style="width:96px;vertical-align:middle;text-align:right;padding-left:16px;"><div style="font-family:${bodyFont};font-size:12px;line-height:1.35;color:${dateColor};margin:0;white-space:nowrap;">${textBlock(dateLabel)}</div></td></tr></table>${minimalTagline}</td></tr>${dividerRow}</table>`,
    );
  }

  const contentHtml = `<div style="font-family:${titleFont};font-size:${layout === "banner" ? 18 : 20}px;line-height:1.2;font-weight:700;color:${titleColor};margin:0;">${textBlock(title)}</div><div style="font-family:${subheadingFont};font-size:${layout === "banner" ? 12 : 13}px;line-height:${layout === "banner" ? 1.35 : 1.3};color:${subtitleColor};margin-top:4px;">${textBlock(tagline)}</div>`;
  const logoCellWidth = Math.max(
    48,
    numberValue(block.logoSize, layout === "banner" ? 36 : 40) + 12,
  );
  const leadingContent = logoHtml
    ? block.logoAlignment === "right"
      ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;border-collapse:collapse;"><tr><td class="responsive-column" valign="middle" style="vertical-align:middle;padding-right:12px;">${contentHtml}</td><td class="responsive-column" width="${logoCellWidth}" valign="middle" style="width:${logoCellWidth}px;vertical-align:middle;padding-left:12px;">${logoHtml}</td></tr></table>`
      : `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;border-collapse:collapse;"><tr><td class="responsive-column" width="${logoCellWidth}" valign="middle" style="width:${logoCellWidth}px;vertical-align:middle;padding-right:12px;">${logoHtml}</td><td class="responsive-column" valign="middle" style="vertical-align:middle;">${contentHtml}</td></tr></table>`
    : contentHtml;
  const dateHtml = `<div style="font-family:${bodyFont};font-size:${layout === "banner" ? 12 : 13}px;line-height:1.35;color:${dateColor};margin:0;white-space:nowrap;">${textBlock(dateLabel)}</div>`;

  return renderSection(
    backgroundColor,
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;border-collapse:collapse;background-color:${backgroundColor};"><tr><td valign="middle" style="padding:${paddingY}px 24px;vertical-align:middle;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;border-collapse:collapse;"><tr><td class="responsive-column" valign="middle" style="vertical-align:middle;">${leadingContent}</td><td class="responsive-column" width="${layout === "banner" ? 92 : 110}" valign="middle" align="right" style="width:${layout === "banner" ? 92 : 110}px;vertical-align:middle;text-align:right;padding-left:16px;">${dateHtml}</td></tr></table></td></tr>${dividerRow}</table>`,
  );
}

function renderPlainTextBlock(
  block: StudioBlock,
  designSystem: StudioDesignSystem | null | undefined,
) {
  const backgroundColor = safeColor(block.backgroundColor, "#ffffff");
  const textColor = safeColor(block.textColor, "#111827");
  const align = getAlignment(block.textAlign, "left");
  const padding = numberValue(block.contentPadding, 28);
  const fontSize = getFontSize(block.fontSize);
  const lineHeight = numberValue(block.lineHeight, 1.6);
  const accent =
    block.layout === "side-accent"
      ? `border-left:4px solid ${safeColor(block.accentColor, "#111827")};padding-left:18px;`
      : "";
  const boxed =
    block.layout === "boxed"
      ? "background-color:#f8fafc;border:1px solid #e5e7eb;border-radius:10px;padding:20px;"
      : "";
  const body = stringValue(block.body)
    ? sanitizeRichHtml(block.body || "", designSystem)
    : `<p style="margin:0;color:${textColor};opacity:0.5;">Add text content...</p>`;

  return renderSection(
    backgroundColor,
    `<div class="mobile-padding" style="padding:${padding}px 24px;background-color:${backgroundColor};"><div style="${boxed}${accent}font-family:${getFontStack(designSystem, "body")};font-size:${fontSize}px;line-height:${lineHeight};color:${textColor};text-align:${align};">${body}</div></div>`,
  );
}

function renderImageTextBlock(
  block: StudioBlock,
  designSystem: StudioDesignSystem | null | undefined,
) {
  const imageUrl = safeUrl(block.imageUrl, { image: true });
  const backgroundColor = safeColor(block.backgroundColor, "#ffffff");
  const textColor = safeColor(block.textColor, "#111827");
  const padding = numberValue(block.contentPadding, 24);
  const radius = numberValue(block.borderRadius, 8);
  const layout = resolveImageTextLayout(block);
  const align = getAlignment(block.textAlign, "left");
  const split = getImageTextSplit(block.columnSplit);
  const content = `${renderTextContent({ ...block, textColor }, designSystem)}${renderButton(block, designSystem, { align })}`;

  if (layout === "image-overlay" && imageUrl) {
    const overlayOpacity =
      Math.max(0, Math.min(100, numberValue(block.overlayOpacity, 52))) / 100;
    const overlayColor = safeColor(block.overlayColor, "#000000");
    return renderSection(
      backgroundColor,
      `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;border-collapse:collapse;background-color:${backgroundColor};"><tr><td background="${escapeAttribute(imageUrl)}" bgcolor="${escapeAttribute(backgroundColor)}" style="background-color:${backgroundColor};background-image:url('${escapeAttribute(imageUrl)}');background-position:center center;background-size:${block.imageFit === "contain" ? "contain" : "cover"};background-repeat:no-repeat;border-radius:${radius}px;overflow:hidden;"><!--[if gte mso 9]><v:rect xmlns:v="urn:schemas-microsoft-com:vml" fill="true" stroke="false" style="width:${EMAIL_WIDTH}px;"><v:fill type="frame" src="${escapeAttribute(imageUrl)}" color="${escapeAttribute(backgroundColor)}" /><v:textbox inset="0,0,0,0"><![endif]--><div style="background-color:${colorWithOpacity(overlayColor, overlayOpacity)};padding:${padding}px;"><div style="max-width:420px;">${content}</div></div><!--[if gte mso 9]></v:textbox></v:rect><![endif]--></td></tr></table>`,
    );
  }

  if (layout === "image-top" || layout === "minimal-card") {
    const isMinimal = layout === "minimal-card";
    const imageHtml = imageUrl
      ? `<img class="responsive-image" src="${escapeAttribute(imageUrl)}" alt="${escapeAttribute(block.imageAlt || block.headline || "Image")}" width="${EMAIL_WIDTH - padding * 2}" style="display:block;width:100%;height:auto;border:0;outline:none;text-decoration:none;border-radius:${radius}px;" />`
      : "";

    return renderSection(
      backgroundColor,
      `<div class="mobile-padding" style="padding:${padding}px;background-color:${backgroundColor};text-align:${isMinimal ? "center" : align};"><div style="${isMinimal ? "max-width:420px;width:76%;margin:0 auto;" : ""}">${imageHtml}</div><div style="padding-top:${imageHtml ? 16 : 0}px;${isMinimal ? "max-width:460px;margin:0 auto;" : ""}">${renderTextContent({ ...block, textColor, textAlign: isMinimal ? "center" : block.textAlign }, designSystem)}${renderButton(block, designSystem, { align: isMinimal ? "center" : align })}</div></div>`,
    );
  }

  const availableWidth = EMAIL_WIDTH - padding * 2 - 24;
  const imageWidth = Math.floor(availableWidth * (split.image / 100));
  const imageCell = `<td class="responsive-column" width="${split.image}%" valign="top" style="width:${split.image}%;vertical-align:top;padding-right:12px;">${imageUrl ? `<img class="responsive-image" src="${escapeAttribute(imageUrl)}" alt="${escapeAttribute(block.imageAlt || block.headline || "Image")}" width="${imageWidth}" style="display:block;width:100%;max-width:${imageWidth}px;height:auto;border:0;outline:none;text-decoration:none;border-radius:${radius}px;" />` : ""}</td>`;
  const textCell = `<td class="responsive-column" width="${split.text}%" valign="middle" style="width:${split.text}%;vertical-align:middle;padding-left:12px;">${content}</td>`;
  const reverse = layout === "image-right";

  return renderSection(
    backgroundColor,
    `<div class="mobile-padding" style="padding:${padding}px;background-color:${backgroundColor};"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;"><tr>${reverse ? `<td class="responsive-column" width="${split.text}%" valign="middle" style="width:${split.text}%;vertical-align:middle;padding-right:12px;">${content}</td><td class="responsive-column" width="${split.image}%" valign="top" style="width:${split.image}%;vertical-align:top;padding-left:12px;">${imageUrl ? `<img class="responsive-image" src="${escapeAttribute(imageUrl)}" alt="${escapeAttribute(block.imageAlt || block.headline || "Image")}" width="${imageWidth}" style="display:block;width:100%;max-width:${imageWidth}px;height:auto;border:0;outline:none;text-decoration:none;border-radius:${radius}px;" />` : ""}</td>` : imageCell + textCell}</tr></table></div>`,
  );
}

function renderQuoteBlock(
  block: StudioBlock,
  designSystem: StudioDesignSystem | null | undefined,
) {
  const backgroundColor = safeColor(block.backgroundColor, "#ffffff");
  const textColor = safeColor(block.textColor, "#111827");
  const accentColor = safeColor(block.accentColor, "#111827");
  const layout = resolveQuoteLayout(block);
  const quote = stringValue(block.quoteText || block.body);
  const quoteHtml = hasRenderableRichText(quote)
    ? sanitizeRichHtml(quote, designSystem)
    : sanitizeRichHtml("Share a customer quote or testimonial.", designSystem);
  const author = stringValue(block.authorName);
  const authorTitle = stringValue(block.authorTitle);
  const centered = layout === "large-centered";
  const avatarUrl = safeUrl(block.authorImageUrl || block.authorAvatarUrl, {
    image: true,
  });
  const border =
    layout === "classic"
      ? `border-left:4px solid ${accentColor};padding-left:20px;`
      : "";
  const avatar = avatarUrl
    ? `<img src="${escapeAttribute(avatarUrl)}" alt="" width="40" height="40" style="display:block;width:40px;height:40px;border-radius:50%;border:0;outline:none;text-decoration:none;" />`
    : "";
  const padding = numberValue(block.contentPadding, 32);
  const authorRow = author || authorTitle || avatar;

  if (layout === "avatar-card") {
    return renderSection(
      backgroundColor,
      `<div class="mobile-padding" style="padding:${padding}px 24px;background-color:${backgroundColor};"><div style="border:1px solid #e5e7eb;border-radius:12px;padding:24px;background-color:#ffffff;"><div style="font-family:${getFontStack(designSystem, "body")};font-size:19px;line-height:1.55;font-style:${block.fontStyle || "italic"};color:${textColor};margin:0;">${quoteHtml}</div>${authorRow ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="left" style="margin-top:20px;border-collapse:collapse;"><tr>${avatar ? `<td style="padding-right:12px;">${avatar}</td>` : ""}<td style="font-family:${getFontStack(designSystem, "subheading")};font-size:13px;line-height:1.4;color:${textColor};"><strong>${escapeHtml(author || "Author Name")}</strong>${authorTitle ? `<br><span style="color:${textColor};opacity:0.62;">${escapeHtml(authorTitle)}</span>` : ""}</td></tr></table>` : ""}</div></div>`,
    );
  }

  return renderSection(
    backgroundColor,
    `<div class="mobile-padding" style="padding:${padding}px 24px;background-color:${backgroundColor};text-align:${centered ? "center" : "left"};">${centered ? `<div style="font-family:${getFontStack(designSystem, "headline")};font-size:${numberValue(block.quoteMarkSize, 48)}px;line-height:0.8;color:${accentColor};opacity:0.15;">&quot;</div>` : ""}<div style="${border}"><div style="font-family:${getFontStack(designSystem, "body")};font-size:${centered ? 24 : 19}px;line-height:${centered ? 1.42 : 1.55};font-style:${block.fontStyle || "italic"};color:${textColor};margin:0;">${quoteHtml}</div>${authorRow ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="${centered ? "center" : "left"}" style="margin-top:${centered ? 20 : 16}px;border-collapse:collapse;"><tr>${avatar ? `<td style="padding-right:12px;">${avatar}</td>` : ""}<td style="font-family:${getFontStack(designSystem, "subheading")};font-size:13px;line-height:1.4;color:${textColor};"><strong>${escapeHtml(author || "Author Name")}</strong>${authorTitle ? `<br><span style="color:${textColor};opacity:0.62;">${escapeHtml(authorTitle)}</span>` : ""}</td></tr></table>` : ""}</div></div>`,
  );
}

function renderProductCardBlock(
  block: StudioBlock,
  designSystem: StudioDesignSystem | null | undefined,
) {
  const backgroundColor = safeColor(block.backgroundColor, "#ffffff");
  const textColor = safeColor(block.textColor, "#111827");
  const imageUrl = safeUrl(block.imageUrl, { image: true });
  const productName = stringValue(
    block.productName || block.headline,
    "Product Name",
  );
  const price = stringValue(block.productPrice);
  const description = stringValue(block.productDescription || block.body);
  const descriptionHtml = hasRenderableRichText(description)
    ? sanitizeRichHtml(description, designSystem)
    : "";
  const border = block.showBorder === false ? "" : "border:1px solid #e5e7eb;";
  const badge = stringValue(block.badgeText)
    ? `<div style="display:inline-block;background-color:${safeColor(block.badgeColor, "#111827")};color:#ffffff;border-radius:999px;padding:5px 10px;font-family:${getFontStack(designSystem, "button")};font-size:11px;line-height:1;font-weight:700;margin-bottom:10px;">${textBlock(block.badgeText)}</div>`
    : "";

  return renderSection(
    backgroundColor,
    `<div class="mobile-padding" style="padding:24px;background-color:${backgroundColor};"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate;${border}border-radius:12px;background-color:${backgroundColor};"><tr>${imageUrl ? `<td class="responsive-column" width="46%" valign="top" style="width:46%;vertical-align:top;padding:24px 12px 24px 24px;"><img class="responsive-image" src="${escapeAttribute(imageUrl)}" alt="${escapeAttribute(block.imageAlt || productName)}" width="260" style="display:block;width:100%;max-width:260px;height:auto;border:0;outline:none;text-decoration:none;border-radius:10px;" /></td>` : ""}<td class="responsive-column" width="${imageUrl ? "54" : "100"}%" valign="middle" style="width:${imageUrl ? "54" : "100"}%;vertical-align:middle;padding:${imageUrl ? "24px 24px 24px 12px" : "24px"};">${badge}<h2 style="font-family:${getFontStack(designSystem, "headline")};font-size:22px;line-height:1.25;color:${textColor};margin:0 0 8px;">${escapeHtml(productName)}</h2>${price ? `<div style="font-family:${getFontStack(designSystem, "body")};font-size:16px;line-height:1.4;color:${textColor};font-weight:700;margin-bottom:8px;">${escapeHtml(price)}</div>` : ""}${descriptionHtml ? `<div style="font-family:${getFontStack(designSystem, "body")};font-size:14px;line-height:1.6;color:${textColor};opacity:0.74;">${descriptionHtml}</div>` : ""}${renderButton(block, designSystem, { align: "left", marginTop: 18 })}</td></tr></table></div>`,
  );
}

function chunkItems<T>(items: T[], size: number) {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

function renderImageGalleryBlock(block: StudioBlock) {
  const backgroundColor = safeColor(block.backgroundColor, "#ffffff");
  const images = (block.galleryImages || []).filter((image) =>
    safeUrl(image.url, { image: true }),
  );
  if (images.length === 0) return "";

  const layout = resolveImageGalleryLayout(block);
  const columns = getImageGalleryColumns(block, layout);
  const gap = numberValue(block.gridGap, 8);
  const radius = numberValue(block.borderRadius, 6);
  const imageHeight = numberValue(block.imageHeight, 180);

  if (layout === "feature-grid") {
    const featured = images[0];
    const sideImages = images.slice(1, 3);
    const sideRows = sideImages
      .map((image, index) => {
        const marginTop = index === 0 ? 0 : gap;

        return `<tr><td style="padding-top:${marginTop}px;">${renderGalleryImageCell(
          image,
          1,
          0,
          radius,
          imageHeight,
        )
          .replace(/^<td[^>]*>/, "")
          .replace(/<\/td>$/, "")}</td></tr>`;
      })
      .join("");

    return renderSection(
      backgroundColor,
      `<div class="mobile-padding" style="padding:16px;background-color:${backgroundColor};"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;"><tr><td class="responsive-column" width="66.666%" valign="top" style="width:66.666%;vertical-align:top;padding-right:${gap / 2}px;">${renderGalleryImageCell(
        featured,
        1,
        0,
        radius,
        imageHeight * 2 + gap,
      )
        .replace(/^<td[^>]*>/, "")
        .replace(
          /<\/td>$/,
          "",
        )}</td><td class="responsive-column" width="33.333%" valign="top" style="width:33.333%;vertical-align:top;padding-left:${gap / 2}px;">${sideRows ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">${sideRows}</table>` : ""}</td></tr></table></div>`,
    );
  }

  const rows = chunkItems(images, columns);
  const rowHtml = rows
    .map(
      (row) =>
        `<tr>${row.map((image) => renderGalleryImageCell(image, columns, gap, radius, imageHeight)).join("")}${Array.from(
          { length: columns - row.length },
        )
          .map(
            () =>
              `<td width="${100 / columns}%" style="width:${100 / columns}%;padding:${gap / 2}px;">&nbsp;</td>`,
          )
          .join("")}</tr>`,
    )
    .join("");

  return renderSection(
    backgroundColor,
    `<div class="mobile-padding" style="padding:16px;background-color:${backgroundColor};"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">${rowHtml}</table></div>`,
  );
}

function renderGalleryImageCell(
  image: GalleryImage,
  columns: number,
  gap: number,
  radius: number,
  imageHeight?: number,
) {
  const height = numberValue(imageHeight, 180);
  const src = safeUrl(image.url, { image: true });
  const imageHtml = `<img class="responsive-image" src="${escapeAttribute(src)}" alt="${escapeAttribute(image.alt || "Gallery image")}" width="${Math.floor((EMAIL_WIDTH - 64) / columns)}" height="${height}" style="display:block;width:100%;height:${height}px;object-fit:cover;border:0;outline:none;text-decoration:none;border-radius:${radius}px;" />`;
  const linked = safeUrl(image.linkUrl)
    ? `<a href="${escapeAttribute(safeUrl(image.linkUrl))}" target="_blank" style="text-decoration:none;">${imageHtml}</a>`
    : imageHtml;
  return `<td class="responsive-column" width="${100 / columns}%" valign="top" style="width:${100 / columns}%;vertical-align:top;padding:${gap / 2}px;">${linked}</td>`;
}

function renderProductGalleryBlock(
  block: StudioBlock,
  designSystem: StudioDesignSystem | null | undefined,
) {
  const backgroundColor = safeColor(block.backgroundColor, "#ffffff");
  const cardBackgroundColor = safeColor(block.cardBackgroundColor, "#ffffff");
  const textColor = safeColor(block.textColor, "#111827");
  const products = (block.galleryProducts || []).filter(
    (product) =>
      product.name || product.imageUrl || product.price || product.description,
  );
  if (products.length === 0) return "";

  const columns =
    block.layout === "feature-product"
      ? 1
      : Math.max(1, Math.min(3, numberValue(block.gridColumns, 2)));
  const rows = chunkItems(products, columns);
  const gap = numberValue(block.cardGap, 16);
  const rowHtml = rows
    .map(
      (row) =>
        `<tr>${row.map((product) => renderProductCell(product, block, designSystem, columns, gap, cardBackgroundColor, textColor)).join("")}${Array.from(
          { length: columns - row.length },
        )
          .map(
            () =>
              `<td width="${100 / columns}%" style="width:${100 / columns}%;padding:${gap / 2}px;">&nbsp;</td>`,
          )
          .join("")}</tr>`,
    )
    .join("");

  return renderSection(
    backgroundColor,
    `<div class="mobile-padding" style="padding:16px;background-color:${backgroundColor};"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">${rowHtml}</table></div>`,
  );
}

function renderProductCell(
  product: GalleryProduct,
  block: StudioBlock,
  designSystem: StudioDesignSystem | null | undefined,
  columns: number,
  gap: number,
  cardBackgroundColor: string,
  textColor: string,
) {
  const imageUrl = safeUrl(product.imageUrl, { image: true });
  const border = block.showBorder === false ? "" : "border:1px solid #e5e7eb;";
  const imageHeight = numberValue(block.imageHeight, 160);
  const ctaBlock: StudioBlock = {
    ...block,
    buttonText: product.buttonText,
    buttonUrl: product.buttonUrl,
    textAlign: "center",
  };

  return `<td class="responsive-column" width="${100 / columns}%" valign="top" style="width:${100 / columns}%;vertical-align:top;padding:${gap / 2}px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate;${border}border-radius:12px;background-color:${cardBackgroundColor};overflow:hidden;"><tr><td>${imageUrl ? `<img class="responsive-image" src="${escapeAttribute(imageUrl)}" alt="${escapeAttribute(product.name || "Product image")}" width="${Math.floor((EMAIL_WIDTH - 64) / columns)}" height="${imageHeight}" style="display:block;width:100%;height:${imageHeight}px;object-fit:cover;border:0;outline:none;text-decoration:none;border-radius:12px 12px 0 0;" />` : ""}</td></tr><tr><td align="center" style="padding:18px;text-align:center;">${block.showBadges !== false && product.badgeText ? `<div style="display:inline-block;background-color:${safeColor(product.badgeColor, "#111827")};color:#ffffff;border-radius:999px;padding:4px 9px;font-family:${getFontStack(designSystem, "button")};font-size:10px;font-weight:700;margin-bottom:8px;">${textBlock(product.badgeText)}</div>` : ""}${product.name ? `<div style="font-family:${getFontStack(designSystem, "headline")};font-size:16px;line-height:1.3;font-weight:700;color:${textColor};margin-bottom:6px;">${textBlock(product.name)}</div>` : ""}${block.showPrices !== false && product.price ? `<div style="font-family:${getFontStack(designSystem, "body")};font-size:14px;line-height:1.4;font-weight:700;color:${textColor};margin-bottom:8px;">${textBlock(product.price)}${product.originalPrice ? ` <span style="font-weight:400;text-decoration:line-through;opacity:0.45;">${textBlock(product.originalPrice)}</span>` : ""}</div>` : ""}${product.description ? `<div style="font-family:${getFontStack(designSystem, "body")};font-size:13px;line-height:1.55;color:${textColor};opacity:0.68;">${textBlock(product.description)}</div>` : ""}${block.showCtaButtons !== false ? renderButton(ctaBlock, designSystem, { align: "center", marginTop: 14 }) : ""}</td></tr></table></td>`;
}

function renderCtaBlock(
  block: StudioBlock,
  designSystem: StudioDesignSystem | null | undefined,
) {
  const backgroundColor = safeColor(block.backgroundColor, "#ffffff");
  const textColor = safeColor(block.textColor, "#111827");
  const align = getAlignment(block.textAlign, "center");
  const paddingY = numberValue(block.verticalPadding, 32);
  const layout = block.layout || "centered-hero";
  const copy = renderTextContent({ ...block, textColor }, designSystem, {
    compact: layout === "banner",
  });
  const secondary =
    block.showSecondaryLink && stringValue(block.secondaryLinkText)
      ? `<div style="font-family:${getFontStack(designSystem, "button")};font-size:14px;line-height:1.4;font-weight:700;margin-top:12px;"><a href="${escapeAttribute(safeUrl(block.secondaryLinkUrl) || "#")}" target="_blank" style="color:${textColor};text-decoration:underline;">${textBlock(block.secondaryLinkText)}</a></div>`
      : "";

  if (layout === "inline-button-only") {
    return renderSection(
      backgroundColor,
      `<div class="mobile-padding" style="padding:${paddingY}px 24px;background-color:${backgroundColor};text-align:${align};">${renderButton(block, designSystem, { align, marginTop: 0 })}${secondary}</div>`,
    );
  }

  if (layout === "banner" || layout === "split") {
    return renderSection(
      backgroundColor,
      `<div class="mobile-padding" style="padding:${paddingY}px 24px;background-color:${backgroundColor};"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;"><tr><td class="responsive-column" width="62%" valign="middle" style="width:62%;vertical-align:middle;padding-right:18px;">${copy}</td><td class="responsive-column" width="38%" valign="middle" align="right" style="width:38%;vertical-align:middle;text-align:right;">${renderButton(block, designSystem, { align: "right", marginTop: 0 })}${secondary}</td></tr></table></div>`,
    );
  }

  return renderSection(
    backgroundColor,
    `<div class="mobile-padding" style="padding:${paddingY}px 24px;background-color:${backgroundColor};text-align:${align};"><div style="max-width:540px;margin:${align === "center" ? "0 auto" : align === "right" ? "0 0 0 auto" : "0"};">${copy}${renderButton(block, designSystem, { align, marginTop: 24 })}${secondary}</div></div>`,
  );
}

function getResolvedSocialFollowLinks(
  block: StudioBlock,
  designSystem: StudioDesignSystem | null | undefined,
) {
  const sourceLinks =
    block.socialLinks?.length || getDesignSystemSocialLinks(designSystem).length
      ? block.socialLinks?.length
        ? block.socialLinks
        : getDesignSystemSocialLinks(designSystem)
      : DEFAULT_SOCIAL_PLATFORMS.map((platform) => ({
          platform,
          enabled: false,
          url: "",
        }));

  const mergedLinks = sourceLinks.map((link) => {
    const url = stringValue(
      link.url,
      getDesignSystemSocialUrl(designSystem, link.platform),
    );

    return {
      ...link,
      url,
      enabled: link.enabled || Boolean(url),
    } satisfies SocialLink;
  });
  const enabledLinks = mergedLinks.filter(
    (link) => link.enabled && Boolean(safeUrl(link.url)),
  );

  if (enabledLinks.length > 0) {
    return { links: enabledLinks, placeholder: false };
  }

  return { links: mergedLinks.slice(0, 4), placeholder: true };
}

function renderSocialFollowBlock(
  block: StudioBlock,
  designSystem: StudioDesignSystem | null | undefined,
) {
  const backgroundColor = safeColor(block.backgroundColor, "#ffffff");
  const textColor = safeColor(block.textColor, "#111827");
  const align = getAlignment(block.textAlign, "center");
  const paddingY = numberValue(block.verticalPadding, 24);
  const { links, placeholder } = getResolvedSocialFollowLinks(
    block,
    designSystem,
  );
  if (links.length === 0) return "";
  const label = stringValue(block.socialLabel);
  const iconSize =
    block.socialIconSize === "lg"
      ? 36
      : block.socialIconSize === "sm"
        ? 24
        : 30;
  const iconCells = links
    .map((link) => renderSocialLink(link, block, iconSize, designSystem))
    .join("");

  if (block.layout === "vertical-list") {
    const rows = links
      .map(
        (link) =>
          `<tr><td align="${align}" style="padding:5px 0;">${renderSocialLink(link, block, iconSize, designSystem, true, placeholder, false)}</td></tr>`,
      )
      .join("");
    return renderSection(
      backgroundColor,
      `<div class="mobile-padding" style="padding:${paddingY}px 16px;background-color:${backgroundColor};text-align:${align};">${label ? `<div style="font-family:${getFontStack(designSystem, "subheading")};font-size:14px;font-weight:700;color:${textColor};margin-bottom:10px;">${textBlock(label)}</div>` : ""}<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="${align}" style="border-collapse:collapse;">${rows}</table></div>`,
    );
  }

  return renderSection(
    backgroundColor,
    `<div class="mobile-padding" style="padding:${paddingY}px 16px;background-color:${backgroundColor};text-align:${align};">${label || block.layout === "label-row" ? `<div style="font-family:${getFontStack(designSystem, "subheading")};font-size:14px;font-weight:700;color:${textColor};margin-bottom:12px;">${textBlock(label || "Follow us")}</div>` : ""}<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="${align}" style="border-collapse:collapse;"><tr>${iconCells}</tr></table></div>`,
  );
}

function renderSocialLink(
  link: SocialLink,
  block: StudioBlock,
  size: number,
  designSystem: StudioDesignSystem | null | undefined,
  withLabel = false,
  placeholder = false,
  wrapInCell = true,
) {
  const href = safeUrl(link.url) || "#";
  const brandColor =
    block.socialColorMode === "custom"
      ? safeColor(block.customIconColor, "#111827")
      : block.socialColorMode === "monochrome"
        ? safeColor(designSystem?.colors.text || block.textColor, "#111827")
        : SOCIAL_COLORS[link.platform];
  const iconUrl = SOCIAL_ICON_URLS[link.platform];
  const icon = iconUrl
    ? `<img src="${escapeAttribute(iconUrl)}" alt="${escapeAttribute(SOCIAL_LABELS[link.platform])}" width="${size}" height="${size}" style="display:block;width:${size}px;height:${size}px;border:0;outline:none;text-decoration:none;" />`
    : `<span style="display:inline-block;width:${size}px;height:${size}px;line-height:${size}px;text-align:center;border-radius:${block.socialIconStyle === "square" ? "6px" : "999px"};background-color:${brandColor};color:#ffffff;font-family:${getFontStack(designSystem, "button")};font-size:${Math.max(11, Math.round(size * 0.42))}px;font-weight:700;">${link.platform === "twitter" ? "X" : "Th"}</span>`;
  const content = withLabel
    ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;"><tr><td style="padding-right:8px;">${icon}</td><td style="font-family:${getFontStack(designSystem, "body")};font-size:14px;line-height:1.3;font-weight:700;color:${safeColor(block.textColor, "#111827")};">${escapeHtml(SOCIAL_LABELS[link.platform])}</td></tr></table>`
    : icon;

  const anchor = `<a href="${escapeAttribute(href)}" target="_blank" style="display:inline-block;text-decoration:none;">${content}</a>`;

  if (!wrapInCell) {
    return anchor;
  }

  return `<td align="center" style="padding:0 6px;opacity:${placeholder ? 0.34 : 1};">${anchor}</td>`;
}

function renderDividerBlock(
  block: StudioBlock,
  designSystem: StudioDesignSystem | null | undefined,
) {
  const backgroundColor = safeColor(block.backgroundColor, "#ffffff");
  const lineColor = getDividerLineColor(block, designSystem);
  const paddingTop = numberValue(block.paddingTop, 20);
  const paddingBottom = numberValue(block.paddingBottom, 20);
  const lineWidth = Math.max(
    1,
    Math.min(100, numberValue(block.lineWidth, 100)),
  );
  const align = getAlignment(block.textAlign, "center");
  const margin =
    align === "center" ? "0 auto" : align === "right" ? "0 0 0 auto" : "0";

  if (block.layout === "ornamental") {
    return renderSection(
      backgroundColor,
      `<div style="padding:${paddingTop}px 32px ${paddingBottom}px;background-color:${backgroundColor};"><table role="presentation" width="${lineWidth}%" cellpadding="0" cellspacing="0" border="0" align="${align}" style="width:${lineWidth}%;border-collapse:collapse;margin:${margin};"><tr><td style="border-top:${numberValue(block.lineThickness, 1)}px ${block.lineStyle || "solid"} ${lineColor};font-size:0;line-height:0;">&nbsp;</td><td width="36" align="center" style="width:36px;font-family:${getFontStack(designSystem, "headline")};font-size:18px;line-height:1;color:${safeColor(block.ornamentColor, "#111827")};">${escapeHtml(block.ornamentSymbol || "✦")}</td><td style="border-top:${numberValue(block.lineThickness, 1)}px ${block.lineStyle || "solid"} ${lineColor};font-size:0;line-height:0;">&nbsp;</td></tr></table></div>`,
    );
  }

  return renderSection(
    backgroundColor,
    `<div style="padding:${paddingTop}px 32px ${paddingBottom}px;background-color:${backgroundColor};"><table role="presentation" width="${lineWidth}%" cellpadding="0" cellspacing="0" border="0" align="${align}" style="width:${lineWidth}%;border-collapse:collapse;margin:${margin};"><tr><td style="border-top:${numberValue(block.lineThickness, 1)}px ${block.lineStyle || "solid"} ${lineColor};font-size:0;line-height:0;">&nbsp;</td></tr></table></div>`,
  );
}

function renderSpacerBlock(block: StudioBlock) {
  const height = Math.max(0, numberValue(block.spacerHeight, 32));
  const backgroundColor = safeColor(block.backgroundColor, "transparent");
  return renderSection(
    backgroundColor,
    `<div style="height:${height}px;line-height:${height}px;font-size:${height}px;background-color:${backgroundColor};">&nbsp;</div>`,
  );
}

function getCompanyInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean).slice(0, 2);
  return parts.length > 0
    ? parts.map((part) => part[0]?.toUpperCase() || "").join("")
    : "B";
}

function renderFooterLogo(
  block: StudioBlock,
  designSystem: StudioDesignSystem | null | undefined,
  dark: boolean,
) {
  const logoUrl = safeUrl(block.logoUrl, { image: true });
  const businessName = stringValue(block.businessName, "Your Business");
  const size = Math.max(24, numberValue(block.logoSize, 40));
  if (logoUrl) {
    return `<img src="${escapeAttribute(logoUrl)}" alt="${escapeAttribute(businessName)} logo" width="${Math.round(size * 2.6)}" height="${size}" style="display:block;width:auto;max-width:${Math.round(size * 2.6)}px;height:${size}px;object-fit:contain;border:0;outline:none;text-decoration:none;" />`;
  }

  const logoBackgroundColor = safeColor(
    designSystem?.colors.footerLogoBackground,
    dark ? "rgba(255,255,255,0.12)" : "#f1f5f9",
  );
  const logoTextColor = safeColor(
    designSystem?.colors.footerLogoText,
    dark ? "#ffffff" : "#111827",
  );

  return `<div style="width:${size}px;height:${size}px;border-radius:10px;background-color:${logoBackgroundColor};border:1px solid ${dark ? "rgba(255,255,255,0.18)" : "#e5e7eb"};color:${logoTextColor};font-family:${getFontStack(designSystem, "brand")};font-size:14px;font-weight:800;line-height:${size}px;text-align:center;">${escapeHtml(getCompanyInitials(businessName))}</div>`;
}

function getFooterSocialLinks(
  block: StudioBlock,
  designSystem: StudioDesignSystem | null | undefined,
) {
  const links = block.footerSocialLinks ?? [];
  const enabledLinks = links.filter((link) => link.enabled);

  if (enabledLinks.length > 0) {
    return { links: enabledLinks, placeholder: false };
  }

  const designSystemLinks = getDesignSystemSocialLinks(designSystem).filter(
    (link) => Boolean(safeUrl(link.url)),
  );

  if (designSystemLinks.length > 0) {
    return { links: designSystemLinks, placeholder: false };
  }

  return {
    links: ["facebook", "instagram", "linkedin"].map((platform) => {
      const existing = links.find((link) => link.platform === platform);
      return {
        platform,
        enabled: false,
        url: existing?.url ?? "",
      } satisfies SocialLink;
    }),
    placeholder: true,
  };
}

function getFooterSocialGlyph(platform: SocialLink["platform"]) {
  switch (platform) {
    case "twitter":
      return "X";
    case "threads":
      return "Th";
    case "linkedin":
      return "in";
    default:
      return SOCIAL_LABELS[platform].slice(0, 1).toUpperCase();
  }
}

function renderFooterSocialIcons(
  block: StudioBlock,
  designSystem: StudioDesignSystem | null | undefined,
  centered = false,
) {
  if (!block.showSocialInFooter && !designSystem?.social.hasConfiguredLinks) {
    return "";
  }

  const { links, placeholder } = getFooterSocialLinks(block, designSystem);
  const iconColor = safeColor(
    block.footerIconColor,
    centered ? "#64748b" : "#cbd5e1",
  );
  const iconStyle = block.footerIconStyle || "filled";
  const borderRadius = iconStyle === "square" ? "8px" : "999px";

  return `<div style="text-align:${centered ? "center" : "left"};margin:${centered ? "0" : "0"};">${links
    .map((link, index) => {
      const href = safeUrl(link.url) || "#";
      const backgroundColor =
        iconStyle === "filled"
          ? colorWithOpacity(iconColor, centered ? 0.18 : 0.14)
          : "transparent";
      const borderColor = iconStyle === "outlined" ? iconColor : "transparent";

      return `<a href="${escapeAttribute(href)}" target="_blank" aria-label="${escapeAttribute(SOCIAL_LABELS[link.platform])}" style="display:inline-flex;align-items:center;justify-content:center;width:30px;height:30px;border-radius:${borderRadius};border:1px solid ${borderColor};background-color:${backgroundColor};color:${iconColor};font-family:${getFontStack(designSystem, "button")};font-size:11px;font-weight:700;line-height:1;text-decoration:none;opacity:${placeholder ? 0.38 : 1};margin:${index === 0 ? "0" : "0 0 0 8px"};">${escapeHtml(getFooterSocialGlyph(link.platform))}</a>`;
    })
    .join("")}</div>`;
}

function renderFooterLinks(
  block: StudioBlock,
  links: EmailFooterLinks,
  designSystem: StudioDesignSystem | null | undefined,
  centered = false,
) {
  const linkColor = safeColor(
    block.linkColor,
    centered ? "#0f766e" : "#cbd5e1",
  );
  const items = [
    {
      label: "Unsubscribe",
      href: links.unsubscribeUrl || "#unsubscribe",
      visible: true,
    },
    {
      label: "Manage Preferences",
      href: links.preferencesUrl || "#preferences",
      visible: block.showManagePreferences !== false,
    },
    {
      label: "Website",
      href:
        links.websiteUrl ||
        block.websiteUrl ||
        designSystem?.company.websiteUrl ||
        "#website",
      visible: Boolean(
        block.showWebsiteLink ||
        links.websiteUrl ||
        block.websiteUrl ||
        designSystem?.company.websiteUrl,
      ),
    },
  ].filter((item) => item.visible);

  return `<div style="font-family:${getFontStack(designSystem, "button")};font-size:12px;line-height:1.5;text-align:${centered ? "center" : "left"};">${items.map((item, index) => `${index > 0 ? `<span style="color:${linkColor};opacity:0.45;margin:0 8px;">|</span>` : ""}<a href="${escapeAttribute(safeUrl(item.href) || "#")}" target="_blank" style="color:${linkColor};text-decoration:underline;">${escapeHtml(item.label)}</a>`).join("")}</div>`;
}

export function renderFooterBlockToEmailHtml(
  block: StudioBlock,
  links: EmailFooterLinks = {},
  designSystem?: StudioDesignSystem | null,
) {
  const layout = resolveFooterLayout(block);
  const dark = layout === "standard-dark";
  const centered = layout === "centered-branded";
  const backgroundColor = safeColor(
    block.backgroundColor,
    dark ? "#1e293b" : "#ffffff",
  );
  const textColor = safeColor(block.textColor, dark ? "#ffffff" : "#111827");
  const mutedColor = dark ? "rgba(255,255,255,0.68)" : "#64748b";
  const dividerColor = safeColor(
    block.dividerBelowColor,
    dark ? "rgba(255,255,255,0.16)" : "#e2e8f0",
  );
  const paddingY = numberValue(block.verticalPadding, 32);
  const businessName = stringValue(block.businessName, "Your Business");
  const address = stringValue(block.address, "123 Main St\nCity, State");
  const complianceText = stringValue(
    block.complianceText,
    DEFAULT_COMPLIANCE_TEXT,
  ).replace("{name}", businessName);
  const complianceHtml = sanitizeRichHtml(complianceText, designSystem);
  const copyrightText = stringValue(
    block.copyright || block.copyrightText,
    `© ${new Date().getFullYear()} ${businessName}`,
  );
  const socialIconsHtml = renderFooterSocialIcons(
    block,
    designSystem,
    centered,
  );
  const linksHtml = renderFooterLinks(block, links, designSystem, centered);
  const contactInline = renderFooterContactContent(block, designSystem, true);
  const contactStack = renderFooterContactContent(block, designSystem);

  if (layout === "light-minimal") {
    return `<!-- BLOOMSUITE_FOOTER_START -->${renderSection(backgroundColor, `<div class="mobile-padding" style="padding:${paddingY}px 24px;background-color:${backgroundColor};"><table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;margin-bottom:10px;"><tr><td style="padding-right:12px;">${renderFooterLogo(block, designSystem, false)}</td><td valign="middle" style="vertical-align:middle;font-family:${getFontStack(designSystem, "headline")};font-size:15px;line-height:1.35;font-weight:800;color:${textColor};">${escapeHtml(businessName)}</td></tr></table><div style="font-family:${getFontStack(designSystem, "body")};font-size:12px;line-height:1.5;color:${mutedColor};margin-bottom:${socialIconsHtml ? 12 : 10}px;">${contactInline}</div>${socialIconsHtml ? `<div style="margin-bottom:12px;">${socialIconsHtml}</div>` : ""}<div style="margin-bottom:12px;">${linksHtml}</div><div style="font-family:${getFontStack(designSystem, "body")};font-size:11px;line-height:1.5;color:${mutedColor};">${escapeHtml(copyrightText)}</div></div>`)}<!-- BLOOMSUITE_FOOTER_END -->`;
  }

  if (centered) {
    return `<!-- BLOOMSUITE_FOOTER_START -->${renderSection(backgroundColor, `<div class="mobile-padding" style="padding:${paddingY}px 24px;background-color:${backgroundColor};text-align:center;"><table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="border-collapse:collapse;margin:0 auto 12px;"><tr><td align="center">${renderFooterLogo(block, designSystem, false)}</td></tr></table><div style="font-family:${getFontStack(designSystem, "headline")};font-size:16px;line-height:1.35;font-weight:800;color:${textColor};margin-bottom:4px;">${escapeHtml(businessName)}</div><div style="font-family:${getFontStack(designSystem, "body")};font-size:12px;line-height:1.55;color:${mutedColor};margin-bottom:${socialIconsHtml ? 12 : 10}px;">${contactStack}</div>${socialIconsHtml ? `<div style="margin-bottom:12px;">${socialIconsHtml}</div>` : ""}<div style="margin-bottom:12px;">${linksHtml}</div><div style="height:1px;background-color:${dividerColor};margin:0 auto 12px;max-width:520px;"></div><div style="font-family:${getFontStack(designSystem, "body")};font-size:12px;line-height:1.6;color:${mutedColor};margin-bottom:12px;">${complianceHtml}</div><div style="font-family:${getFontStack(designSystem, "body")};font-size:11px;line-height:1.5;color:${mutedColor};">${escapeHtml(copyrightText)}</div></div>`)}<!-- BLOOMSUITE_FOOTER_END -->`;
  }

  return `<!-- BLOOMSUITE_FOOTER_START -->${renderSection(backgroundColor, `<div class="mobile-padding" style="padding:${paddingY}px 24px;background-color:${backgroundColor};"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;"><tr><td class="responsive-column" width="50%" valign="top" style="width:50%;vertical-align:top;padding-right:16px;"><table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;"><tr><td style="padding-right:12px;">${renderFooterLogo(block, designSystem, true)}</td><td valign="middle" style="vertical-align:middle;font-family:${getFontStack(designSystem, "headline")};font-size:15px;line-height:1.35;font-weight:800;color:${textColor};">${escapeHtml(businessName)}</td></tr></table></td><td class="responsive-column" width="50%" valign="top" align="right" style="width:50%;vertical-align:top;text-align:right;font-family:${getFontStack(designSystem, "body")};font-size:12px;line-height:1.55;color:${mutedColor};">${contactStack}</td></tr></table><div style="height:1px;background-color:${dividerColor};margin:16px 0 12px;"></div><div style="font-family:${getFontStack(designSystem, "body")};font-size:12px;line-height:1.6;color:${mutedColor};margin-bottom:${socialIconsHtml ? 12 : 12}px;">${complianceHtml}</div>${socialIconsHtml ? `<div style="margin-bottom:12px;">${socialIconsHtml}</div>` : ""}<div style="margin-bottom:12px;">${linksHtml}</div><div style="font-family:${getFontStack(designSystem, "body")};font-size:11px;line-height:1.5;color:${mutedColor};">${escapeHtml(copyrightText)}</div></div>`)}<!-- BLOOMSUITE_FOOTER_END -->`;
}

export function createFooterBlockFromDesignSystem(
  designSystem: StudioDesignSystem | null | undefined,
  overrides: Partial<StudioBlock> = {},
): StudioBlock {
  if (!designSystem) {
    return createFooterBlockFromProfile(null, overrides);
  }

  const companyName = stringValue(designSystem.company.name, "Your Business");
  const address = stringValue(
    designSystem.company.addressLines,
    stringValue(designSystem.company.address),
  );

  return {
    id: "auto-footer",
    type: "footer",
    label: "Footer",
    order: 999,
    visible: true,
    businessName: companyName,
    address: address || "123 Main St\nCity, State",
    copyrightText: `© ${new Date().getFullYear()} ${companyName}`,
    complianceText:
      designSystem.company.footerLegalText || DEFAULT_COMPLIANCE_TEXT,
    logoUrl: designSystem.company.logoUrl || "",
    logoAlignment: "left",
    logoSize: 40,
    showUnsubscribe: true,
    showManagePreferences: true,
    showWebsiteLink: Boolean(designSystem.company.websiteUrl),
    websiteUrl: designSystem.company.websiteUrl,
    showSocialInFooter: designSystem.social.hasConfiguredLinks,
    footerSocialLinks: designSystem.social.links,
    footerIconStyle: "filled",
    footerIconColor: designSystem.colors.footerLink || "#cbd5e1",
    backgroundColor: designSystem.colors.footerBackground || "#1e293b",
    textColor: designSystem.colors.footerText || "#ffffff",
    linkColor: designSystem.colors.footerLink || "#cbd5e1",
    dividerBelowColor:
      designSystem.colors.footerDivider || "rgba(255,255,255,0.16)",
    verticalPadding: 32,
    layout: "standard-dark",
    layoutPreset: "footer-standard-dark",
    ...overrides,
  };
}

export function createFooterBlockFromProfile(
  profile: StudioFooterProfile | null | undefined,
  overrides: Partial<StudioBlock> = {},
): StudioBlock {
  const companyName = stringValue(profile?.company_name, "Your Business");
  const address = [
    profile?.street_address,
    [profile?.city, profile?.state_province, profile?.postal_code]
      .filter(Boolean)
      .join(", "),
    profile?.country,
  ]
    .map((value) => stringValue(value))
    .filter(Boolean)
    .join("\n");
  const footerColors = profile?.feature_flags?.footer_colors;

  return {
    id: "generated-footer",
    type: "footer",
    label: "Footer",
    order: 0,
    visible: true,
    businessName: companyName,
    address: address || "123 Main St\nCity, State",
    copyrightText: `© ${new Date().getFullYear()} ${companyName}`,
    complianceText:
      profile?.footer_legal_text ||
      profile?.feature_flags?.footer_settings?.complianceText ||
      DEFAULT_COMPLIANCE_TEXT,
    logoUrl: profile?.feature_flags?.company_logo_url || "",
    logoAlignment: "left",
    showUnsubscribe: true,
    showManagePreferences:
      profile?.feature_flags?.footer_settings?.showManagePreferences !== false,
    showWebsiteLink: Boolean(
      profile?.website_url ||
      profile?.feature_flags?.footer_settings?.websiteUrl,
    ),
    websiteUrl:
      profile?.website_url ||
      profile?.feature_flags?.footer_settings?.websiteUrl ||
      "",
    backgroundColor: footerColors?.backgroundColor || "#1e293b",
    textColor: footerColors?.textColor || "#ffffff",
    linkColor: footerColors?.linkColor || "#cbd5e1",
    layout: "standard-dark",
    layoutPreset: "footer-standard-dark",
    ...overrides,
  };
}

function renderBlock(
  block: StudioBlock,
  designSystem: StudioDesignSystem | null | undefined,
): string {
  if (block.visible === false) return "";

  switch (block.type as string) {
    case "email-safe-hero":
    case "header":
      return renderHeroBlock(block, designSystem);
    case "graphic-hero":
    case "full-width-image":
    case "image":
      return renderGraphicImageBlock(block, designSystem);
    case "newsletter-header":
      return renderNewsletterHeaderBlock(block, designSystem);
    case "image-text":
      return renderImageTextBlock(block, designSystem);
    case "plain-text":
    case "text":
      return renderPlainTextBlock(block, designSystem);
    case "quote":
      return renderQuoteBlock(block, designSystem);
    case "product-card":
    case "product":
      return renderProductCardBlock(block, designSystem);
    case "image-gallery":
      return renderImageGalleryBlock(block);
    case "product-gallery":
      return renderProductGalleryBlock(block, designSystem);
    case "call-to-action":
    case "cta":
    case "button":
      return renderCtaBlock(block, designSystem);
    case "social-follow":
      return renderSocialFollowBlock(block, designSystem);
    case "divider":
      return renderDividerBlock(block, designSystem);
    case "spacer":
      return renderSpacerBlock(block);
    case "footer":
      return "";
    default:
      return renderPlainTextBlock(block, designSystem);
  }
}

function isSelfSpacingBlock(block: StudioBlock) {
  return block.type === "divider" || block.type === "spacer";
}

function renderPreviewBlockGap() {
  return '<table role="presentation" class="email-block-gap" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;border-collapse:collapse;"><tr><td height="16" style="height:16px;line-height:16px;font-size:0;">&nbsp;</td></tr></table>';
}

function wrapPreviewBlock(block: StudioBlock, html: string) {
  return `<div class="email-block email-block-${block.type}">${html}</div>`;
}

export function renderStudioBlocksToEmailHtml(
  blocks: StudioBlock[],
  designSystem?: StudioDesignSystem | null,
) {
  const renderableBlocks = blocks
    .filter((block) => block.type !== "footer")
    .map((block) => ({ block, html: renderBlock(block, designSystem) }))
    .filter(({ html }) => Boolean(html));

  return renderableBlocks
    .flatMap(({ block, html }, index) => {
      const fragments = [wrapPreviewBlock(block, html)];
      const nextBlock = renderableBlocks[index + 1]?.block;

      if (
        nextBlock &&
        !isSelfSpacingBlock(block) &&
        !isSelfSpacingBlock(nextBlock)
      ) {
        fragments.push(renderPreviewBlockGap());
      }

      return fragments;
    })
    .join("");
}

export function generateEmailHtml({
  blocks,
  subject,
  previewText,
  footer,
  mergeData,
  footerLinks,
  designSystem,
}: GenerateEmailHtmlParams): string {
  const visibleBlocks = blocks.filter((block) => block.visible !== false);
  const footerBlock =
    footer ||
    visibleBlocks.find((block) => block.type === "footer") ||
    createFooterBlockFromDesignSystem(designSystem);
  const bodyBlocks = visibleBlocks.filter((block) => block.type !== "footer");
  const renderedBlocks = renderStudioBlocksToEmailHtml(
    bodyBlocks,
    designSystem,
  );
  const renderedFooter = renderFooterBlockToEmailHtml(
    footerBlock,
    footerLinks,
    designSystem,
  );
  const escapedSubject = escapeHtml(subject || "Campaign Preview");
  const escapedPreviewText = escapeHtml(previewText || "");
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>${escapedSubject}</title>
${buildFontLinks(designSystem)}  <!--[if !mso]><!-->
  <style type="text/css">
    *, *::before, *::after { box-sizing:border-box; }
    body, table, td, a { -webkit-text-size-adjust:100%; -ms-text-size-adjust:100%; }
    table, td { mso-table-lspace:0pt; mso-table-rspace:0pt; }
    img { -ms-interpolation-mode:bicubic; }
    img { border:0; height:auto; line-height:100%; outline:none; text-decoration:none; }
    table { border-collapse:collapse !important; }
    body { margin:0 !important; padding:0 !important; width:100% !important; }
    .email-block { margin:0 !important; }
    .email-block-divider, .email-block-spacer { margin:0 !important; }
    .email-block-gap { height:16px; line-height:16px; font-size:0; }
    @media only screen and (max-width: 599px) {
      .responsive-column { display:block !important; width:100% !important; max-width:100% !important; box-sizing:border-box !important; padding-left:0 !important; padding-right:0 !important; }
      .responsive-column + .responsive-column { padding-top:16px !important; }
      .responsive-image { width:100% !important; height:auto !important; }
      .mobile-padding { padding:16px !important; }
    }
  </style>
  <!--<![endif]-->
</head>
<body style="margin:0;padding:0;background-color:#f5f5f5;font-family:${getFontStack(designSystem, "body")};">
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;opacity:0;color:transparent;line-height:1px;font-size:1px;">${escapedPreviewText}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;background-color:#f5f5f5;border-collapse:collapse;">
    <tr>
      <td align="center" style="padding:24px 16px;background-color:#f5f5f5;">
        <table role="presentation" width="${EMAIL_WIDTH}" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:${EMAIL_WIDTH}px;background-color:#ffffff;border-collapse:collapse;">
          <tr>
            <td style="padding:0;background-color:#ffffff;">
              ${renderedBlocks}
            </td>
          </tr>
        </table>
        <table role="presentation" width="${EMAIL_WIDTH}" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:${EMAIL_WIDTH}px;border-collapse:collapse;">
          <tr>
            <td style="padding:0;">
              ${renderedFooter}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return resolveMergeTags(html, mergeData);
}
