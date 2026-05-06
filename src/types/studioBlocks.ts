export type BlockType =
  | "email-safe-hero"
  | "graphic-hero"
  | "full-width-image"
  | "newsletter-header"
  | "image-text"
  | "plain-text"
  | "quote"
  | "product-card"
  | "image-gallery"
  | "product-gallery"
  | "call-to-action"
  | "social-follow"
  | "divider"
  | "spacer"
  | "footer";
export type StudioTextAlign = "left" | "center" | "right";
export type StudioButtonSize = "sm" | "md" | "lg";
export type StudioButtonStyle = "filled" | "outlined" | "link" | "ghost";
export type StudioFontSize = "sm" | "md" | "lg";
export type StudioFontStyle = "italic" | "normal";
export type StudioFontWeightPreset = "normal" | "medium";
export type StudioHeroStyle =
  | "solid"
  | "gradient"
  | "image-overlay"
  | "image-bottom";
export type StudioImageFit = "cover" | "contain" | "fill";
export type StudioImagePosition = "left" | "right" | "top" | "overlay";
export type StudioImageRatio = "auto" | "1:1" | "4:3" | "16:9";
export type StudioColumnSplit = "40/60" | "50/50" | "60/40";
export type StudioOverlayGradientDirection =
  | "uniform"
  | "top-to-bottom"
  | "bottom-to-top";
export type StudioTextPosition = "top" | "center" | "bottom";
export type StudioDividerLineStyle = "solid" | "dashed" | "dotted";
export type StudioDividerLineType = "solid" | "dashed" | "dotted";
export type StudioOrnamentSymbol = "✦" | "●" | "◆" | "★" | "─";
export type StudioSocialColorMode = "brand" | "monochrome" | "custom";
export type StudioIconColorMode = "brand" | "mono" | "custom";
export type StudioSocialIconStyle =
  | "filled"
  | "outlined"
  | "square"
  | "minimal";
export type StudioIconStyle = "filled" | "outlined" | "square" | "minimal";
export type StudioSocialPlatform =
  | "facebook"
  | "instagram"
  | "twitter"
  | "linkedin"
  | "youtube"
  | "tiktok"
  | "pinterest"
  | "threads";
export type StudioLogoAlignment = "left" | "center" | "right";
export type StudioLogoShape = "square" | "rounded" | "circle";
export type StudioBadgePosition = "top-left" | "top-right";

export interface GalleryImage {
  id: string;
  url: string;
  alt: string;
  linkUrl?: string;
}

export interface GalleryProduct {
  id: string;
  imageUrl: string;
  name: string;
  price: string;
  originalPrice?: string;
  description?: string;
  badgeText?: string;
  badgeColor?: string;
  buttonText?: string;
  buttonUrl?: string;
}

export interface SocialLink {
  platform: StudioSocialPlatform;
  url: string;
  enabled: boolean;
}

export interface StudioBlock {
  id: string;
  type: BlockType;
  label: string;
  order: number;
  visible: boolean;
  headline?: string;
  subheading?: string;
  body?: string;
  tagLabel?: string;
  tagline?: string;
  dateLabel?: string;
  imageUrl?: string;
  imageAlt?: string;
  linkUrl?: string;
  caption?: string;
  showCaption?: boolean;
  captionAlignment?: StudioTextAlign;
  captionColor?: string;
  businessName?: string;
  address?: string;
  copyright?: string;
  copyrightText?: string;
  complianceText?: string;
  showUnsubscribe?: boolean;
  showManagePreferences?: boolean;
  showWebsiteLink?: boolean;
  websiteUrl?: string;
  linkColor?: string;
  buttonText?: string;
  buttonUrl?: string;
  buttonColor?: string;
  buttonTextColor?: string;
  buttonSize?: StudioButtonSize;
  buttonStyle?: StudioButtonStyle;
  buttonRounded?: boolean;
  fullWidthButton?: boolean;
  showSecondaryLink?: boolean;
  secondaryLinkText?: string;
  secondaryLinkUrl?: string;
  backgroundColor?: string;
  textColor?: string;
  textAlign?: StudioTextAlign;
  accentColor?: string;
  accentThickness?: number;
  overlayColor?: string;
  overlayOpacity?: number;
  showOverlay?: boolean;
  overlayGradientDirection?: StudioOverlayGradientDirection;
  heroStyle?: StudioHeroStyle;
  gradientFrom?: string;
  gradientTo?: string;
  layout?: string;
  layoutPreset?: string;
  logoUrl?: string;
  logoAlignment?: StudioLogoAlignment;
  logoSize?: number;
  logoShape?: StudioLogoShape;
  borderRadius?: number;
  cardBorderRadius?: number;
  boxBorderRadius?: number;
  contentPadding?: number;
  verticalPadding?: number;
  imageFit?: StudioImageFit;
  imagePosition?: StudioImagePosition;
  imageRatio?: StudioImageRatio;
  imagePadding?: boolean;
  insetPadding?: boolean;
  imageHeight?: number;
  maxHeight?: number;
  columnSplit?: StudioColumnSplit;
  gridColumns?: number;
  gridGap?: number;
  cardGap?: number;
  cardBackgroundColor?: string;
  lineColor?: string;
  dividerBelowColor?: string;
  lineStyle?: StudioDividerLineStyle;
  lineType?: StudioDividerLineType;
  lineThickness?: number;
  lineWidth?: number;
  paddingTop?: number;
  paddingBottom?: number;
  showOrnament?: boolean;
  ornamentSymbol?: StudioOrnamentSymbol;
  ornamentColor?: string;
  ornamentSize?: number;
  spacerHeight?: number;
  showDottedOutline?: boolean;
  showDivider?: boolean;
  showDividerBelow?: boolean;
  showBorder?: boolean;
  showCardBorder?: boolean;
  showShadow?: boolean;
  showBadges?: boolean;
  showPrices?: boolean;
  showOriginalPrice?: boolean;
  showCtaButtons?: boolean;
  showDescription?: boolean;
  showTextOverlay?: boolean;
  textPosition?: StudioTextPosition;
  textShadow?: boolean;
  showButton?: boolean;
  showCaptionBar?: boolean;
  captionBarColor?: string;
  fontSize?: StudioFontSize;
  fontSizePreset?: StudioFontSize;
  fontStyle?: StudioFontStyle;
  fontWeightPreset?: StudioFontWeightPreset;
  lineHeight?: number;
  lineHeightValue?: number;
  quoteText?: string;
  authorName?: string;
  authorTitle?: string;
  authorImageUrl?: string;
  authorAvatarSize?: number;
  showAuthorImage?: boolean;
  quoteMarkSize?: number;
  authorAvatarUrl?: string;
  productName?: string;
  productPrice?: string;
  originalPrice?: string;
  productDescription?: string;
  badgeText?: string;
  badgeColor?: string;
  badgeTextColor?: string;
  badgePosition?: StudioBadgePosition;
  galleryImages?: GalleryImage[];
  galleryProducts?: GalleryProduct[];
  socialLinks?: SocialLink[];
  footerSocialLinks?: SocialLink[];
  socialLabel?: string;
  iconStyle?: StudioIconStyle;
  footerIconStyle?: StudioIconStyle | "filled" | "outlined" | "minimal";
  iconSize?: StudioButtonSize;
  iconColorMode?: StudioIconColorMode;
  iconSpacing?: number;
  footerIconColor?: string;
  showSocialInFooter?: boolean;
  socialIconStyle?: StudioSocialIconStyle;
  socialIconSize?: StudioButtonSize;
  socialColorMode?: StudioSocialColorMode;
  customIconColor?: string;
}
