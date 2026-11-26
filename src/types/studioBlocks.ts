import type {
  BlockAppearance,
  BlockAudience,
  EdgeSpacing,
  ChartPoint,
  CouponOffer,
  HeadingLevel,
  NewsletterLink,
  NewsletterSettings,
  ProductBadge,
} from "./newsletterDesign.ts";
export type BlockType =
  | "preheader"
  | "html"
  | "headline"
  | "youtube"
  | "navigation"
  | "button-group"
  | "text-columns"
  | "data-table"
  | "chart"
  | "survey"
  | "event"
  | "blog"
  | "announcement"
  | "email-safe-hero"
  | "graphic-hero"
  | "full-width-image"
  | "newsletter-header"
  | "image-text"
  | "plain-text"
  | "quote"
  | "product-card"
  | "coupon"
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
  "solid" | "gradient" | "image-overlay" | "image-bottom";
export type StudioImageFit = "cover" | "contain" | "fill";
export type StudioImagePosition = "left" | "right" | "top" | "overlay";
export type StudioImageRatio = "auto" | "1:1" | "4:3" | "3:4" | "16:9" | "9:16";
export type StudioColumnSplit = "30/70" | "40/60" | "50/50" | "60/40" | "70/30";
export type StudioOverlayGradientDirection =
  | "uniform"
  | "top-to-bottom"
  | "bottom-to-top"
  | "left-to-right"
  | "right-to-left";
export type StudioTextPosition = "top" | "center" | "bottom";
export type StudioDividerLineStyle = "solid" | "dashed" | "dotted";
export type StudioDividerLineType = "solid" | "dashed" | "dotted";
export type StudioOrnamentSymbol = "✦" | "●" | "◆" | "★" | "─";
export type StudioSocialColorMode = "brand" | "monochrome" | "custom";
export type StudioIconColorMode = "brand" | "mono" | "custom";
export type StudioSocialIconStyle =
  "filled" | "outlined" | "square" | "minimal";
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
  caption?: string;
  linkUrl?: string;
  imagePadding?: EdgeSpacing;
  imageMargin?: EdgeSpacing;
}

export interface GalleryProduct {
  id: string;
  imageUrl: string;
  name: string;
  altName?: string;
  linkUrl?: string;
  price: string;
  originalPrice?: string;
  description?: string;
  badgeText?: string;
  badgeColor?: string;
  badgeTextColor?: string;
  imagePadding?: EdgeSpacing;
  imageMargin?: EdgeSpacing;
  buttonText?: string;
  buttonUrl?: string;
}

export interface SocialLink {
  platform: StudioSocialPlatform;
  url: string;
  enabled: boolean;
}

export interface StudioBlock {
  appearance?: BlockAppearance;
  audience?: BlockAudience;
  headingLevel?: HeadingLevel;
  couponPercent?: number;
  couponAmount?: string;
  couponBuyQuantity?: number;
  couponBundleQuantity?: number;
  couponBundlePrice?: string;
  couponMinimumQuantity?: number;
  couponRegularPrice?: string;
  couponSizing?: string;
  couponExpiry?: string;
  couponBarcode?: string;
  couponBarcodeImageUrl?: string;
  productSubtitle?: string;
  badges?: ProductBadge[];
  links?: NewsletterLink[];
  textColumns?: string[];
  tableHeaders?: string[];
  tableRows?: string[][];
  tableCaption?: string;
  chartData?: ChartPoint[];
  /** HTML block: typed or pasted HTML, cleaned to email-safe markup on render. */
  customHtml?: string;
  /** The Chart data box exactly as typed; chartData is parsed from it. */
  chartDataText?: string;
  chartUnit?: string;
  videoUrl?: string;
  eventDate?: string;
  /** ISO date and local time selected in the editor; older eventDate remains supported. */
  eventStartDate?: string;
  eventStartTime?: string;
  eventFeeType?: "unspecified" | "free" | "donation" | "paid";
  eventFeeAmount?: string;
  eventLocation?: string;
  headerBannerUrl?: string;
  newsletterSettings?: NewsletterSettings;

  /** Stable CMS publication provenance for website-to-campaign traceability. */
  connectedContent?: {
    siteId: string;
    itemId: string;
    type: "event"|"page"|"product"|"blog"|"fundraiser";
    updatedAt: string;
    publicUrl: string;
    startAt?: string | null;
    sourceTitle?: string;
    sourceDescription?: string;
    sourceImageUrl?: string | null;
    upcomingDateCount?: number;
    /** Name of the connected website the content came from. */
    siteName?: string;
  };
  id: string;
  type: BlockType;
  label: string;
  order: number;
  visible: boolean;
  couponOffer?: CouponOffer;
  couponPrice?: string;
  couponConditions?: string;
  couponImageSide?: "left" | "right" | "top";
  /** Photo / offer column widths beside each other. Unset = 38/62. */
  couponColumnSplit?: "25/75" | "33/67" | "50/50";
  couponBorder?: boolean;
  couponScissors?: boolean;
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
  hoursOfOperation?: string;
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
  /** Keep CTA colours synced with the account brand unless explicitly disabled. */
  useBrandButtonColor?: boolean;
  buttonSize?: StudioButtonSize;
  buttonAlign?: StudioTextAlign;
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
  showAccent?: boolean;
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
  logoWidthPercent?: number;
  /** Set by the editor when a user chooses an exact size, including 40px. */
  logoSizeExplicit?: boolean;
  logoShape?: StudioLogoShape;
  borderRadius?: number;
  cardBorderRadius?: number;
  boxBorderRadius?: number;
  contentPadding?: number;
  verticalPadding?: number;
  imageFit?: StudioImageFit;
  imageLinkEnabled?: boolean;
  imageFocalX?: number;
  imageFocalY?: number;
  /** A copy of imageUrl already cropped to this block's cover frame and focal
   *  point (see src/lib/studio/emailImageCrop.ts). Used in sent email because
   *  Gmail, Outlook desktop and Yahoo ignore CSS object-fit/object-position. */
  croppedImageUrl?: string;
  /** Where the block's content came from (manual, theme, template, cloned...). */
  source?: string;
  /** Identifies the source image, frame and focal point croppedImageUrl was
   *  made for; a stale crop is ignored. */
  croppedImageKey?: string;
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
  /** false hides the photo and keeps it saved. Unset means shown. */
  showImage?: boolean;
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
  /** Panel order of socialLinks; the saved legacy object form loses it. */
  socialLinkOrder?: StudioSocialPlatform[];
  footerSocialLinks?: SocialLink[];
  /** True once someone picks the footer Icon Colour in the panel. */
  footerIconColorPicked?: boolean;
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
