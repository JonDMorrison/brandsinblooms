/** JSON-only contracts shared by the editor, saved designs and Deno send workers. */
export type HeadingLevel = "h1" | "h2" | "h3" | "h4" | "h5" | "h6";
export type TextRole =
  | HeadingLevel
  | "heading"
  | "subheading"
  | "body"
  | "price"
  | "smallPrint"
  | "button"
  | "label";
export interface EdgeSpacing {
  top?: number;
  right?: number;
  bottom?: number;
  left?: number;
}
export interface TextAppearance {
  size?: number;
  weight?: number;
  lineHeight?: number;
  color?: string;
  fontFamily?: string;
}
export interface BlockAppearance {
  margin?: EdgeSpacing;
  padding?: EdgeSpacing;
  border?: {
    style?: "none" | "solid" | "dashed" | "dotted" | "double";
    width?: number;
    color?: string;
    radius?: number;
    legend?: string;
  };
  text?: Partial<Record<TextRole, TextAppearance>>;
  background?: string;
  linkColor?: string;
  linkDecoration?: "none" | "underline";
  imagePadding?: EdgeSpacing;
  imageMargin?: EdgeSpacing;
  verticalAlign?: "top" | "middle" | "bottom";
  buttonPaddingX?: number;
  buttonPaddingY?: number;
}
export interface NewsletterSettings {
  version: 1;
  width?: number;
  backgroundColor?: string;
  contentBackgroundColor?: string;
  fontFamily?: string;
  allowedFonts?: string[];
  blockGap?: number;
  defaults?: BlockAppearance;
  assetLocations?: Array<{ id: string; name: string; url: string }>;
  /**
   * "skip": blocks with no content render nothing (no wrapper, no gap) in
   * preview, test and send. Stamped on drafts by ensureFooterBlockCompliance;
   * absent on campaigns sent before this flag, so they re-render unchanged.
   */
  emptyBlocks?: "skip";
  /**
   * "natural": on phones (<600px) cropped photos show at their natural height
   * instead of being forced to 240px. Stamped only on footers created for new
   * drafts (blockFactory and ensureFooterBlockCompliance), so existing drafts
   * and sent campaigns keep the 240px rule and re-render unchanged.
   */
  mobileImageHeight?: "natural";
  /**
   * true: text that would read below 4.5:1 is switched to a readable colour
   * (footer text and links, brand-coloured buttons), and brand buttons use the
   * neutral dark preset when no brand colour is set. Stamped on drafts by
   * ensureFooterBlockCompliance and on new footers; absent on sent campaigns,
   * so they re-render unchanged.
   */
  contrastGuard?: true;
  /**
   * "left": on phones, where the footer's two columns stack, the address
   * column is left-aligned instead of hugging the right edge. Stamped on
   * drafts like contrastGuard; sent campaigns lack it and render unchanged.
   */
  mobileFooterAlign?: "left";
}
export interface NewsletterLink {
  id: string;
  label: string;
  url: string;
  color?: string;
  textColor?: string;
}
export interface ProductBadge {
  id: string;
  label: string;
  color?: string;
  textColor?: string;
}
export interface BlockAudience {
  mode: "all" | "segments";
  segmentIds?: string[];
}
export interface ChartPoint {
  label: string;
  value: number;
}
export type CouponOffer =
  | "bogo"
  | "25"
  | "50"
  | "price"
  | "percent"
  | "amount"
  | "buy-x-get-one"
  | "multi-buy"
  | "tiered";
