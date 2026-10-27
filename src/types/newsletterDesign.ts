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
