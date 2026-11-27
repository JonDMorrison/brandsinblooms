import type { StudioBlock } from "../../../types/studioBlocks.ts";
import type {
  BlockAppearance,
  HeadingLevel,
  TextRole,
} from "../../../types/newsletterDesign.ts";
import {
  escapeHtml,
  formatDraftRichText,
  formatDraftText,
} from "../../crm/htmlContent.ts";
import {
  clampNumber,
  edgeCss,
  emailColor,
  emailFont,
  HEADING_SIZES,
  safeEmailUrl,
  textCss,
} from "./settings.ts";
import { sanitizeEmailHtml } from "./emailHtmlSanitizer.ts";
import { withOutlookWholePhoto } from "../emailImageCrop.ts";
import { barcodeFormatName, checkBarcode, couponBarcodeFormat } from "./barcode.ts";

const text = (value: unknown) =>
  formatDraftText(typeof value === "string" ? value : "");
const attr = (value: string) => escapeHtml(value);
const present = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;
const table = (rows: string, extra = "") =>
  `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" ${extra} style="width:100%;border-collapse:collapse;">${rows}</table>`;
/**
 * Text alignment picked for a block. Applied to each text element, never to a
 * wrapper, so a button keeps its own alignment. Navigation and button groups
 * use `textAlign` to place their links and are left alone here.
 */
export function blockTextAlign(block: StudioBlock): "left" | "center" | "right" | undefined {
  if (block.type === "navigation" || block.type === "button-group") return undefined;
  return block.textAlign === "left" || block.textAlign === "center" || block.textAlign === "right"
    ? block.textAlign
    : undefined;
}
function role(
  block: StudioBlock,
  key: TextRole,
  fallbackSize: number,
  weight = 400,
) {
  const align = blockTextAlign(block);
  return `${align ? `text-align:${align};` : ""}font-family:${emailFont(block.appearance?.text?.[key]?.fontFamily)};${textCss(block.appearance?.text?.[key], { size: fallbackSize, weight, lineHeight: 1.5, color: block.textColor || "#172d2c" })}`;
}
function paragraph(
  block: StudioBlock,
  value: unknown,
  key: TextRole = "body",
  size = 16,
) {
  return present(value)
    ? `<div data-newsletter-role="${key}" style="margin:0 0 10px;${role(block, key, size)}">${key === "body" ? formatDraftRichText(value) : text(value)}</div>`
    : "";
}
function heading(block: StudioBlock, value: unknown = block.headline) {
  if (!present(value)) return "";
  const level: HeadingLevel =
    block.headingLevel &&
    Object.keys(HEADING_SIZES).includes(block.headingLevel)
      ? block.headingLevel
      : "h2";
  return `<${level} data-newsletter-role="heading" style="margin:0 0 10px;${role(block, "heading", HEADING_SIZES[level], 700)}">${text(value)}</${level}>`;
}
export function renderNewsletterButton(
  block: StudioBlock,
  label = block.buttonText,
  url = block.buttonUrl,
  allowUnlinked = false,
): string {
  const href = safeEmailUrl(url);
  if ((!href && !allowUnlinked) || !present(label)) return "";
  const link = block.buttonStyle === "link";
  const outlined =
    block.buttonStyle === "outlined" || block.buttonStyle === "ghost";
  const fill = emailColor(block.buttonColor, "#1f4341");
  const color = emailColor(
    block.buttonTextColor || block.appearance?.text?.button?.color,
    link || outlined ? fill : "#ffffff",
  );
  const defaultY =
    block.buttonSize === "sm" ? 9 : block.buttonSize === "lg" ? 16 : 12;
  const defaultX =
    block.buttonSize === "sm" ? 16 : block.buttonSize === "lg" ? 30 : 22;
  const padding = `${clampNumber(block.appearance?.buttonPaddingY, link ? 0 : defaultY, 0, 48)}px ${clampNumber(block.appearance?.buttonPaddingX, link ? 0 : defaultX, 0, 96)}px`;
  // Never turn an unfinished or invalid destination into a clickable link.
  const tag = href ? "a" : "span";
  const destination = href ? ` href="${attr(href)}" target="_blank" rel="noopener noreferrer"` : "";
  return `<${tag} data-newsletter-role="button"${destination} style="display:${block.fullWidthButton ? "block" : "inline-block"};box-sizing:border-box;${block.fullWidthButton ? "width:100%;" : ""}text-align:center;text-decoration:${link ? (block.appearance?.linkDecoration === "none" ? "none" : "underline") : "none"};padding:${padding};border:${outlined ? `1px solid ${fill}` : "0"};background-color:${link || outlined ? "transparent" : fill};border-radius:${block.layoutPreset === "nav-pills" ? "999" : block.buttonRounded === false ? "4" : "8"}px;${role(block, "button", 14, 700)}color:${color};">${text(label)}</${tag}>`;
}
/** Wraps a button in its picked Button alignment; unset keeps today's layout. */
function alignedButton(block: StudioBlock, button: string): string {
  if (!button || !block.buttonAlign) return button;
  const align = block.buttonAlign === "center" || block.buttonAlign === "right" ? block.buttonAlign : "left";
  return `<div style="text-align:${align};">${button}</div>`;
}
/** Photo height for a cropped (Fill / Stretch) photo; unset keeps `fallback`. */
function croppedPhotoHeight(block: StudioBlock, fallback: number, min = 60, max = 600): number {
  return Math.round(clampNumber(block.imageHeight, fallback, min, max));
}
const sideVerticalAlign = (block: StudioBlock): "top" | "middle" | "bottom" =>
  block.appearance?.verticalAlign === "top" || block.appearance?.verticalAlign === "bottom"
    ? block.appearance.verticalAlign
    : "middle";
type PictureSizing = { height: number | null; fit: string; className: string };

function picture(block: StudioBlock, width = 220, sizing?: PictureSizing): string {
  const url = safeEmailUrl(block.imageUrl, true);
  if (!url) return "";
  const height = sizing
    ? sizing.height === null ? "auto" : `${sizing.height}px`
    // Product Card: "Fill the space" crops into a fixed box; "Show whole
    // photo" keeps the photo's own proportions (a tall 540x960 photo was
    // squeezed into a 220px-high box).
    : block.type === "product-card" && block.imageFit === "cover"
      ? `${clampNumber(block.imageHeight, 220, 120, 480)}px`
      // Blog and Announcement: "Show whole photo" (the default) keeps the
      // photo's own shape. Fill and Stretch use the chosen height.
      : (block.type === "blog" || block.type === "announcement" || block.type === "plant-care") &&
          (block.imageFit === "cover" || block.imageFit === "fill")
        ? `${croppedPhotoHeight(block, 240)}px`
        : "auto";
  const fit = sizing?.fit ?? block.imageFit ?? "contain";
  const image = `<img data-newsletter-image="imageUrl" class="responsive-image${sizing?.className ? ` ${sizing.className}` : ""}" src="${attr(url)}" alt="${attr(block.imageAlt || block.headline || block.productName || "")}" width="${width}"${sizing?.height ? ` height="${sizing.height}"` : ""} style="display:block;width:100%;max-width:${width}px;height:${height};object-fit:${fit};border:0;border-radius:${clampNumber(block.borderRadius, 6, 0, 48)}px;" />`;
  // A CSS-only crop (fixed height + cover) is squashed by desktop Outlook.
  const safeImage = height !== "auto" && fit === "cover"
    ? withOutlookWholePhoto(image, { src: attr(url), alt: attr(block.imageAlt || block.headline || block.productName || ""), width })
    : image;
  const linked = safeEmailUrl(block.linkUrl)
    ? `<a href="${attr(safeEmailUrl(block.linkUrl))}" target="_blank" rel="noopener noreferrer">${safeImage}</a>`
    : safeImage;
  return `<div style="padding:${edgeCss(block.appearance?.imagePadding)};margin:${edgeCss(block.appearance?.imageMargin)};">${linked}</div>`;
}
function badges(block: StudioBlock): string {
  const items = Array.isArray(block.badges)
    ? block.badges.slice(0, 3)
    : present(block.badgeText)
      ? [
          {
            id: "legacy",
            label: block.badgeText,
            color: block.badgeColor,
            textColor: block.badgeTextColor,
          },
        ]
      : [];
  return items
    .filter((item) => present(item.label))
    .map(
      (item) =>
        `<span style="display:inline-block;margin:0 6px 8px 0;padding:4px 9px;border-radius:4px;background:${emailColor(item.color, "#1f4341")};color:${emailColor(item.textColor, "#ffffff")};font-family:Arial,sans-serif;font-size:11px;font-weight:700;">${text(item.label)}</span>`,
    )
    .join("");
}
function imageAndContent(
  block: StudioBlock,
  content: string,
  side: "left" | "right" | "top",
  width: number,
  imagePercent = 38,
): string {
  const textPercent = 100 - imagePercent;
  // A Product Card with its photo on top fills the card width at the photo's
  // own proportions; the fixed 220px box left it small with wide margins.
  const photo = picture(
    block,
    side === "top" ? width : Math.floor((width * imagePercent) / 100),
    block.type === "product-card" && side === "top"
      ? { height: null, fit: block.imageFit ?? "contain", className: "" }
      : undefined,
  );
  if (!photo) return content;
  if (side === "top")
    return `${photo}<div style="padding-top:18px;">${content}</div>`;
  const vertical = ["top", "middle", "bottom"].includes(
    block.appearance?.verticalAlign || "",
  )
    ? block.appearance?.verticalAlign
    : "middle";
  // Keep image-first source order for reliable mobile stacking. Direction only
  // changes the desktop presentation when the image is configured on the right.
  const imageCell = `<td dir="ltr" class="responsive-column" width="${imagePercent}%" valign="top" style="width:${imagePercent}%;padding:${side === "right" ? "0 0 0 12px" : "0 12px 0 0"};">${photo}</td>`;
  const contentCell = `<td dir="ltr" class="responsive-column" width="${textPercent}%" valign="${vertical}" style="width:${textPercent}%;vertical-align:${vertical};padding:${side === "right" ? "0 12px 0 0" : "0 0 0 12px"};">${content}</td>`;
  return table(
    `<tr>${side === "right" ? contentCell + imageCell : imageCell + contentCell}</tr>`,
  );
}

/** The facts a Plant Care Spotlight shows, in order. Empty ones are left out. */
export function plantCareFacts(block: StudioBlock): Array<{ label: string; value: string }> {
  const rows: Array<[string, unknown]> = [
    ["Light", block.careLight],
    ["Water", block.careWater],
    ["Soil", block.careSoil],
    ["Hardiness", block.careHardiness],
    ["This season", block.careSeason],
  ];
  return rows
    .filter((row): row is [string, string] => present(row[1]))
    .map(([label, value]) => ({ label, value: value.trim() }));
}
export function plantCareTips(block: StudioBlock): string[] {
  return present(block.careTips)
    ? block.careTips.split(/\r?\n/).map((tip) => tip.replace(/^\s*[-*\u2022]\s*/, "").trim()).filter(Boolean).slice(0, 8)
    : [];
}
function renderPlantCare(block: StudioBlock, width: number, editing = false): string {
  const layout = block.careLayout === "compact" || block.careLayout === "feature" ? block.careLayout : "beside";
  const facts = plantCareFacts(block);
  const tips = layout === "compact" ? [] : plantCareTips(block);
  const align = blockTextAlign(block);
  const alignCss = align ? `text-align:${align};` : "";
  const label = (value: string) =>
    `<span style="font-weight:700;">${text(value)}</span>`;
  const factText = `font-family:${emailFont(block.appearance?.text?.body?.fontFamily)};font-size:14px;line-height:1.45;color:${emailColor(block.textColor, "#172d2c")};${alignCss}`;
  const line = `border-top:1px solid ${emailColor(block.accentColor, "#dfe6e2")};`;
  let factHtml = "";
  if (facts.length && layout === "compact") {
    // One short line keeps the compact card small.
    factHtml = `<div data-newsletter-role="label" style="margin:0 0 10px;${factText}">${facts.map((fact) => `${label(fact.label)}: ${text(fact.value)}`).join(" &nbsp;&middot;&nbsp; ")}</div>`;
  } else if (facts.length && layout === "feature") {
    // Two facts per row under the wide photo. Cells stack on a phone.
    const rows: string[] = [];
    for (let i = 0; i < facts.length; i += 2) {
      const pair = facts.slice(i, i + 2);
      rows.push(`<tr>${pair.map((fact) => `<td class="responsive-column" width="50%" valign="top" style="width:50%;padding:10px 12px 10px 0;${line}${factText}"><div style="font-size:11px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;">${text(fact.label)}</div>${text(fact.value)}</td>`).join("")}${pair.length === 1 ? `<td class="responsive-column" width="50%" style="width:50%;${line}">&nbsp;</td>` : ""}</tr>`);
    }
    factHtml = `<div style="margin:6px 0 12px;">${table(rows.join(""))}</div>`;
  } else if (facts.length) {
    factHtml = `<div style="margin:6px 0 12px;">${table(facts.map((fact) => `<tr><td valign="top" width="34%" style="width:34%;padding:7px 10px 7px 0;${line}${factText}font-weight:700;">${text(fact.label)}</td><td valign="top" style="padding:7px 0;${line}${factText}">${text(fact.value)}</td></tr>`).join(""))}</div>`;
  }
  const tipHtml = tips.length
    ? `<div data-newsletter-role="label" style="margin:0 0 6px;${factText}font-weight:700;">Care tips</div>${table(tips.map((tip) => `<tr><td valign="top" width="18" style="width:18px;padding:0 0 6px;${factText}">&bull;</td><td valign="top" style="padding:0 0 6px;${factText}text-align:left;">${text(tip)}</td></tr>`).join(""))}`
    : "";
  const source = present(block.careSource)
    ? `<div style="margin:8px 0 12px;${factText}font-size:12px;opacity:0.75;">Source: ${text(block.careSource)}</div>`
    : "";
  const botanical = present(block.subheading)
    ? `<div data-newsletter-role="subheading" style="margin:0 0 10px;font-style:italic;${role(block, "subheading", 16)}">${text(block.subheading)}</div>`
    : "";
  const content =
    paragraph(block, block.tagLabel, "label", 12) +
    heading(block) +
    botanical +
    (layout === "compact" ? "" : paragraph(block, block.body)) +
    factHtml +
    tipHtml +
    source +
    (block.showButton === false ? "" : alignedButton(block, renderNewsletterButton(block, undefined, undefined, editing)));
  const shown = block.showImage === false ? { ...block, imageUrl: "" } : block;
  const side = layout === "feature" ? "top" : block.imagePosition === "right" ? "right" : "left";
  return imageAndContent(shown, content, side, width, layout === "compact" ? 26 : 38);
}

function renderEventCard(block: StudioBlock, width: number, editing = false): string {
  const imageUrl = block.showImage === false ? "" : safeEmailUrl(block.imageUrl, true);
  const imageSide = block.imagePosition === "right" ? "right" : "left";
  const onTop = block.imagePosition === "top";
  // On top the photo spans the card. Beside the words it takes 42%.
  const imageWidth = onTop ? Math.max(120, width - 36) : Math.floor(width * 0.42);
  // Unset keeps the original look: the photo fills a 252px-high box.
  const fit = block.imageFit === "contain" || block.imageFit === "fill" ? block.imageFit : "cover";
  const wholePhoto = fit === "contain";
  const imageHeight = croppedPhotoHeight(block, 252);
  const image = imageUrl
    ? `<img data-newsletter-image="imageUrl" class="responsive-image${wholePhoto ? "" : " responsive-crop-image"}" src="${attr(imageUrl)}" alt="${attr(block.imageAlt || block.headline || "Event photo")}" width="${imageWidth}"${wholePhoto ? "" : ` height="${imageHeight}"`} style="display:block;width:100%;max-width:${imageWidth}px;height:${wholePhoto ? "auto" : `${imageHeight}px`};${wholePhoto ? "" : `object-fit:${fit};object-position:50% 50%;`}border:0;outline:none;text-decoration:none;border-radius:12px;" />`
    : "";
  // A CSS-only crop is squashed by desktop Outlook; give it the whole photo.
  const eventImage = image && fit === "cover"
    ? withOutlookWholePhoto(image, { src: attr(imageUrl), alt: attr(block.imageAlt || block.headline || "Event photo"), width: imageWidth })
    : image;
  const chosenDate = /^\d{4}-\d{2}-\d{2}$/.test(block.eventStartDate ?? "")
    ? new Date(`${block.eventStartDate}T12:00:00Z`).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" })
    : "";
  const chosenTime = /^([01]\d|2[0-3]):[0-5]\d$/.test(block.eventStartTime ?? "")
    ? new Date(`2000-01-01T${block.eventStartTime}:00Z`).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "UTC" })
    : "";
  const dateLabel = [chosenDate, chosenTime].filter(Boolean).join(" at ") || block.eventDate;
  const date = present(dateLabel)
    ? `<div data-newsletter-role="label" style="margin:0 0 5px;letter-spacing:0.06em;text-transform:uppercase;${role(block, "label", 12, 700)}">${text(dateLabel)}</div>`
    : "";
  const fee = block.eventFeeType === "free" ? "Free" : block.eventFeeType === "donation" ? "By donation" : block.eventFeeType === "paid" ? block.eventFeeAmount || "Price to be announced" : "";
  const location = present(block.eventLocation)
    ? `<div data-newsletter-role="label" style="margin:0 0 14px;opacity:0.68;${role(block, "label", 13, 400)}">${text(block.eventLocation)}</div>`
    : "";
  const content =
    paragraph(block, block.tagLabel, "label", 12) +
    heading(block) +
    paragraph(block, block.subheading, "subheading", 16) +
    date +
    location +
    paragraph(block, fee, "label", 13) +
    paragraph(block, block.body) +
    (block.showButton === false ? "" : alignedButton(block, renderNewsletterButton(block, undefined, undefined, editing)));

  if (!image) {
    return `<div class="mobile-padding" style="padding:28px 30px;border:1px solid #e4e7e2;border-radius:14px;background-color:${emailColor(block.backgroundColor, "#ffffff")};">${content}</div>`;
  }

  const vertical = sideVerticalAlign(block);
  const imageCell = `<td dir="ltr" class="responsive-column product-card-image event-card-cell" width="42%" valign="middle" style="width:42%;vertical-align:middle;padding:${imageSide === "right" ? "22px 22px 22px 11px" : "22px 11px 22px 22px"};">${eventImage}</td>`;
  const contentCell = `<td dir="ltr" class="responsive-column product-card-details event-card-cell" width="58%" valign="${vertical}" style="width:58%;vertical-align:${vertical};padding:${imageSide === "right" ? "26px 11px 26px 26px" : "26px 26px 26px 11px"};">${content}</td>`;
  if (block.imagePosition === "top") {
    return `<div class="mobile-padding" style="padding:18px;border:1px solid #e4e7e2;border-radius:14px;background-color:${emailColor(block.backgroundColor, "#ffffff")};">${eventImage}<div style="padding:18px 8px;">${content}</div></div>`;
  }
  return `<table role="presentation" class="product-card-row" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;border-collapse:separate;border:1px solid #e4e7e2;border-radius:14px;background-color:${emailColor(block.backgroundColor, "#ffffff")};"><tr>${imageSide === "right" ? contentCell + imageCell : imageCell + contentCell}</tr></table>`;
}
/**
 * The Product Card price box shows a "$" in front of what is typed. A bare
 * number ("29.99") is rendered with that symbol; anything already carrying a
 * symbol or words ("€25", "From $10") is left as typed.
 */
export function withCurrencySymbol(price: string | undefined, symbol = "$"): string {
  const value = (price ?? "").trim();
  return /^\d[\d,]*(?:\.\d+)?$/.test(value) ? `${symbol}${value}` : value;
}
/** Offer types whose label is built from the "Price" field. */
export function couponUsesPrice(offer: StudioBlock["couponOffer"]): boolean {
  return offer === "price" || offer === "tiered";
}
/** Only a plain sale price is shown against a crossed-out old price. */
export function couponUsesOldPrice(offer: StudioBlock["couponOffer"]): boolean {
  return offer === "price";
}
export function couponOfferLabel(block: StudioBlock): string {
  switch (block.couponOffer) {
    case "price":
      return block.couponPrice || "";
    case "bogo":
      return "Buy one, get one free";
    case "25":
      return "25% OFF";
    case "50":
      return "50% OFF";
    case "percent":
      return `${clampNumber(block.couponPercent, 25, 0, 100)}% OFF`;
    case "amount":
      return present(block.couponAmount) ? `${block.couponAmount} OFF` : "";
    case "buy-x-get-one":
      return `Buy ${Math.floor(clampNumber(block.couponBuyQuantity, 2, 1, 1000))}, get 1 free`;
    case "multi-buy":
      return present(block.couponBundlePrice)
        ? `${Math.floor(clampNumber(block.couponBundleQuantity, 3, 1, 1000))} for ${block.couponBundlePrice}`
        : "";
    case "tiered":
      return present(block.couponPrice)
        ? `${block.couponPrice} each when you buy ${Math.floor(clampNumber(block.couponMinimumQuantity, 3, 1, 1000))} or more${block.couponRegularPrice ? `; otherwise ${block.couponRegularPrice} each` : ""}`
        : "";
    default:
      return "25% OFF";
  }
}
export function validUpcA(code: string): boolean {
  if (!/^\d{12}$/.test(code)) return false;
  const sum = code
    .slice(0, 11)
    .split("")
    .reduce((n, d, i) => n + Number(d) * (i % 2 === 0 ? 3 : 1), 0);
  return (10 - (sum % 10)) % 10 === Number(code[11]);
}
/** Coupon photo share beside the offer; unset keeps the original 38%. */
export function couponImagePercent(split: StudioBlock["couponColumnSplit"]): number {
  switch (split) {
    case "25/75":
      return 25;
    case "33/67":
      return 33;
    case "50/50":
      return 50;
    default:
      return 38;
  }
}
export function renderCoupon(block: StudioBlock, width: number, editing = false): string {
  const price = couponOfferLabel(block);
  const finePrint =
    paragraph(block, block.couponConditions, "smallPrint", 11) +
    paragraph(
      block,
      block.couponExpiry ? `Expires: ${block.couponExpiry}` : "",
      "smallPrint",
      11,
    );
  const barcodeUrl = safeEmailUrl(block.couponBarcodeImageUrl, true);
  // The picture is shown only while the saved code is valid for its format.
  // Coupons saved before formats existed are UPC-A.
  const barcodeFormat = couponBarcodeFormat(block.couponBarcodeFormat);
  const barcodeCheck = checkBarcode(barcodeFormat, block.couponBarcode || "");
  const barcode =
    barcodeCheck.ok && barcodeCheck.code === (block.couponBarcode || "").trim() && barcodeUrl
      ? `<div style="padding-top:16px;text-align:center;"><img data-newsletter-readonly="true" src="${attr(barcodeUrl)}" width="250" alt="${attr(barcodeFormatName(barcodeFormat))} barcode ${attr(barcodeCheck.code)}" style="display:block;margin:0 auto;max-width:100%;height:auto;" /><div style="font-family:monospace;font-size:13px;">${text(barcodeCheck.code)}</div></div>`
      : "";
  const content =
    badges(block) +
    paragraph(block, block.tagLabel, "label", 12) +
    heading(block) +
    paragraph(block, block.subheading, "subheading", 17) +
    paragraph(block, block.body) +
    // Only "Sale price" shows an old price, after the new one. Price fields
    // left over from another offer type are ignored.
    (price
      ? `<div data-newsletter-role="price" style="margin:12px 0;${role(block, "price", 28, 800)}">${text(price)}${couponUsesOldPrice(block.couponOffer) && present(block.originalPrice) ? ` <s data-newsletter-role="smallPrint" style="font-size:0.6em;font-weight:400;opacity:0.75;">${text(block.originalPrice)}</s>` : ""}</div>`
      : "") +
    paragraph(block, block.couponSizing, "label", 13) +
    (block.showButton === false ? "" : alignedButton(block, renderNewsletterButton(block, undefined, undefined, editing))) +
    `<div style="padding-top:12px;">${finePrint}</div>` +
    barcode;
  const border =
    block.couponBorder === false || block.appearance?.border?.style
      ? "none"
      : "2px dashed #71817d";
  const cut =
    block.couponScissors === false
      ? ""
      : '<div style="padding:6px 12px;border-bottom:1px dashed #71817d;font-size:12px;color:#46595a;">&#9986;&#xfe0e; &nbsp; Cut or save this coupon</div>';
  return `<div style="border:${border};">${cut}<div style="padding:${block.appearance?.padding ? "0" : "22px"};">${imageAndContent(block, content, block.couponImageSide || "left", width - 44, couponImagePercent(block.couponColumnSplit))}</div></div>`;
}
export function youtubeVideoId(value: string): string | null {
  try {
    const url = new URL(value);
    let id = "";
    if (url.hostname === "youtu.be") id = url.pathname.slice(1);
    else if (
      ["youtube.com", "www.youtube.com", "m.youtube.com"].includes(url.hostname)
    )
      id =
        url.searchParams.get("v") ||
        url.pathname.match(/^\/(?:shorts|embed)\/([^/]+)/)?.[1] ||
        "";
    return /^[\w-]{11}$/.test(id) ? id : null;
  } catch {
    return null;
  }
}
/** Email-compatible content only. No scripts, forms, iframes or recipient tracking pixels. */
// Width / height for each gallery image ratio ("auto" is the photo's own).
const GALLERY_RATIOS: Record<string, [number, number]> = {
  "1:1": [1, 1],
  "4:3": [4, 3],
  "3:4": [3, 4],
  "16:9": [16, 9],
  "9:16": [9, 16],
};

/**
 * Product Gallery image box. A chosen ratio always wins over the older
 * "Image height (px)"; galleries that set only a height keep that height; a
 * gallery that set neither gets the current default (Square). Photos fill
 * the box unless the gallery chose another fit. The classes carry the same
 * ratio / height and fit to phones (see the generator's mobile CSS).
 */
export function productGalleryImageSizing(
  block: StudioBlock,
  cellWidth: number,
): PictureSizing {
  const fit = block.imageFit ?? "cover";
  const ratio =
    block.imageRatio ?? (block.imageHeight == null ? "1:1" : undefined);
  if (ratio === "auto") {
    return { height: null, fit, className: "nl-product-image nl-r-auto" };
  }
  const dims = ratio ? GALLERY_RATIOS[ratio] : undefined;
  if (dims) {
    return {
      height: Math.round((cellWidth * dims[1]) / dims[0]),
      fit,
      className: `nl-product-image nl-r-${dims[0]}x${dims[1]}`,
    };
  }
  const height = Math.round(clampNumber(block.imageHeight, 220, 120, 480));
  return { height, fit, className: `nl-product-image nl-h-${height}` };
}

export function renderExtendedBlock(
  block: StudioBlock,
  width = 640,
  editing = false,
): string | null {
  switch (block.type) {
    case "product-card": {
      const content =
        (block.showBadges === false ? "" : `<div style="text-align:${block.badgePosition === "top-right" ? "right" : "left"};">${badges(block)}</div>`) +
        heading(block, block.productName ?? block.headline) +
        paragraph(
          block,
          block.productSubtitle ?? block.subheading,
          "subheading",
          16,
        ) +
        (block.productPrice
          ? `<div data-newsletter-role="price" style="margin:8px 0;${role(block, "price", 22, 700)}">${text(withCurrencySymbol(block.productPrice))}${block.originalPrice ? ` <s style="font-size:14px;font-weight:400;">${text(withCurrencySymbol(block.originalPrice))}</s>` : ""}</div>`
          : "") +
        paragraph(block, block.productDescription ?? block.body) +
        `<div style="text-align:${block.buttonAlign ?? (block.layout === "centered" ? "center" : "left")};">${renderNewsletterButton(block, undefined, undefined, editing)}</div>`;
      const side =
        block.imagePosition === "left" ||
        block.imagePosition === "right" ||
        block.imagePosition === "top"
          ? block.imagePosition
          : block.layout === "image-top"
            ? "top"
            : block.layout === "image-right"
              ? "right"
              : "left";
      // A drawn block border (style other than None) replaces the card
      // border; merely touching the border settings no longer hides it.
      const drawnBorder = ["solid", "dashed", "dotted", "double"].includes(block.appearance?.border?.style || "");
      const border =
        drawnBorder ||
        block.showBorder === false ||
        block.showCardBorder === false
          ? "none"
          : "1px solid #cbd5e1";
      const displayContent = block.layout === "centered" ? `<div style="text-align:center;">${content}</div>` : content;
      const displayBlock = block.layout === "minimal" ? { ...block, imageUrl: "" } : block;
      return `<div style="padding:${block.appearance?.padding ? "0" : "24px"};border:${border};border-radius:${clampNumber(block.cardBorderRadius, 10, 0, 48)}px;background:${emailColor(block.backgroundColor, "#ffffff")};">${imageAndContent(displayBlock, displayContent, side, width - 48)}</div>`;
    }
    case "product-gallery": {
      const feature = block.layout === "feature-product";
      const columns = feature ? 1 : Math.floor(clampNumber(block.gridColumns, 3, 1, 4));
      const products = (block.galleryProducts || [])
        .map((product, index) => ({ product, index }))
        .filter(
          ({ product }) =>
            product && (product.name || product.imageUrl || product.price),
        );
      const gap = clampNumber(block.cardGap, 16, 0, 48);
      const cells = products.map(({ product, index }) => {
        const productBlock: StudioBlock = {
          ...block,
          type: "product-card",
          imageUrl: product.imageUrl,
          imageAlt: product.name || "",
          linkUrl: product.linkUrl || product.buttonUrl,
          headline: product.name,
          productName: product.name,
          productSubtitle: product.altName,
          productPrice: product.price,
          originalPrice: product.originalPrice,
          productDescription: product.description,
          buttonText: product.buttonText,
          buttonUrl: product.buttonUrl,
          badgeText: product.badgeText,
          badgeColor: product.badgeColor,
          badgeTextColor: product.badgeTextColor,
          appearance: { ...block.appearance,
            imagePadding: product.imagePadding ?? block.appearance?.imagePadding,
            imageMargin: product.imageMargin ?? block.appearance?.imageMargin },
          badges: undefined,
        };
        const cellWidth = Math.floor(
          (width - gap * (columns + 1)) / columns * (feature ? 0.42 : 1),
        );
        const image = picture(
          productBlock,
          cellWidth,
          productGalleryImageSizing(block, cellWidth),
        ).replace(
          'data-newsletter-image="imageUrl"',
          `data-newsletter-image="galleryProducts" data-newsletter-index="${index}"`,
        );
        const body =
          (block.showBadges !== false ? badges(productBlock) : "") +
          paragraph(block, product.name, "heading", 17) +
          paragraph(block, product.altName, "subheading", 13) +
          (block.showPrices !== false && product.price
            ? `<div data-newsletter-role="price" style="${role(block, "price", 16, 700)}">${text(product.price)}${block.showOriginalPrice !== false && product.originalPrice ? ` <s style="font-weight:400;font-size:13px;">${text(product.originalPrice)}</s>` : ""}</div>`
            : "") +
          (block.showDescription !== false
            ? paragraph(block, product.description, "body", 13)
            : "") +
          (block.showCtaButtons !== false
            ? `<div style="text-align:${block.buttonAlign ?? "left"};">${renderNewsletterButton(productBlock, undefined, undefined, editing)}</div>`
            : "");
        const cardRows = feature && image
          ? `<tr><td class="responsive-column" width="42%" valign="top" style="width:42%;">${image}</td><td class="responsive-column" width="58%" valign="middle" style="width:58%;padding:14px;">${body}</td></tr>`
          : `<tr><td>${image}</td></tr><tr><td valign="top" style="padding:14px;height:100%;vertical-align:top;">${body}</td></tr>`;
        // Cards in a row share the row's height (the table cell stretches and
        // the card table fills it), so borders and backgrounds line up.
        return `<td class="responsive-column nl-product-cell" width="${100 / columns}%" valign="top" style="width:${100 / columns}%;height:100%;padding:${gap / 2}px;"><table role="presentation" width="100%" height="100%" cellpadding="0" cellspacing="0" style="width:100%;height:100%;border-collapse:separate;border:${block.showBorder === false || block.showCardBorder === false ? "0" : "1px solid #cbd5e1"};background:${emailColor(block.cardBackgroundColor, "#ffffff")};">${cardRows}</table></td>`;
      });
      const rows: string[] = [];
      for (let i = 0; i < cells.length; i += columns)
        rows.push(
          `<tr>${cells.slice(i, i + columns).join("")}${"<td></td>".repeat(Math.max(0, columns - Math.min(columns, cells.length - i)))}</tr>`,
        );
      return rows.length ? table(rows.join("")) : "";
    }
    case "image-gallery": {
      const items = (block.galleryImages || []).map((image, index) => ({
        image,
        index,
      }));
      const gap = clampNumber(block.gridGap, 12, 0, 48);
      const imageHtml = (index: number, available: number) => {
        const item = items[index];
        if (!item) return "";
        const url = safeEmailUrl(item.image.url, true);
        if (!url) return "";
        const image = `<img data-newsletter-image="galleryImages" data-newsletter-index="${item.index}" class="responsive-image" src="${attr(url)}" alt="${attr(item.image.alt || "")}" width="${Math.floor(available)}" style="display:block;width:100%;height:auto;border:0;border-radius:${clampNumber(block.borderRadius, 6, 0, 48)}px;"/>`;
        const spacedImage = `<div style="padding:${edgeCss(item.image.imagePadding ?? block.appearance?.imagePadding)};margin:${edgeCss(item.image.imageMargin ?? block.appearance?.imageMargin)};">${image}</div>`;
        const link = safeEmailUrl(item.image.linkUrl);
        return (
          (link
            ? `<a href="${attr(link)}" target="_blank" rel="noopener noreferrer">${spacedImage}</a>`
            : spacedImage) + paragraph(block, item.image.caption, "smallPrint", 12)
        );
      };
      if (
        block.layout === "feature-grid" ||
        block.layoutPreset === "gallery-feature-grid"
      ) {
        const featured = imageHtml(0, width * 0.6 - gap);
        const side = items
          .slice(1)
          .map(
            (_, i) =>
              `<tr><td style="padding:0 0 ${gap}px ${gap}px;">${imageHtml(i + 1, width * 0.4 - gap)}</td></tr>`,
          )
          .join("");
        return featured || side
          ? table(
              `<tr><td class="responsive-column" valign="top" width="60%">${featured}</td><td class="responsive-column" valign="top" width="40%">${table(side)}</td></tr>`,
            )
          : "";
      }
      const columns = Math.floor(
        clampNumber(
          block.layout === "grid-4"
            ? 2
            : block.layout === "grid-6"
              ? 3
              : block.gridColumns,
          3,
          1,
          4,
        ),
      );
      const cells = items
        .map((_, i) => imageHtml(i, (width - gap * (columns + 1)) / columns))
        .filter(Boolean)
        .map(
          (image) =>
            `<td class="responsive-column" width="${100 / columns}%" valign="top" style="padding:${gap / 2}px;">${image}</td>`,
        );
      const rows: string[] = [];
      for (let i = 0; i < cells.length; i += columns)
        rows.push(
          `<tr>${cells.slice(i, i + columns).join("")}${"<td></td>".repeat(Math.max(0, columns - Math.min(columns, cells.length - i)))}</tr>`,
        );
      return rows.length ? table(rows.join("")) : "";
    }

    case "coupon":
      return renderCoupon(block, width, editing);
    case "preheader":
      return paragraph(block, block.body, "smallPrint", 12);
    case "headline":
      return heading(block);
    case "html": {
      // Only email-safe markup survives (see emailHtmlSanitizer).
      const clean = sanitizeEmailHtml(block.customHtml);
      return clean ? `<div data-newsletter-html="true">${clean}</div>` : "";
    }
    case "youtube": {
      const id = youtubeVideoId(block.videoUrl || "");
      if (!id) return "";
      const thumbnail =
        safeEmailUrl(block.imageUrl, true) ||
        `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
      return (
        heading(block) +
        `<a href="https://www.youtube.com/watch?v=${id}" target="_blank" rel="noopener noreferrer"><img data-newsletter-image="imageUrl" class="responsive-image" src="${attr(thumbnail)}" alt="${attr(block.imageAlt || block.headline || "Watch video on YouTube")}" width="${width}" style="display:block;width:100%;max-width:${width}px;height:auto;" /></a>` +
        paragraph(block, block.body) +
        alignedButton(block, renderNewsletterButton({
          ...block,
          buttonUrl: `https://www.youtube.com/watch?v=${id}`,
          buttonText: block.buttonText || "Watch video",
        }))
      );
    }
    case "navigation":
    case "button-group": {
      const navigation = block.type === "navigation";
      const links = (block.links || [])
        .slice(0, navigation ? 5 : 3)
        .filter((link) => present(link.label) && (editing || safeEmailUrl(link.url)));
      const copy = heading(block) + paragraph(block, block.subheading, "subheading", 17);
      if (!links.length) return copy;
      const navAlign = block.textAlign || "center";
      const cells = links.map((link) => {
        const button = renderNewsletterButton({
          ...block,
          buttonColor: link.color || block.buttonColor,
          buttonTextColor: link.textColor || (navigation ? block.linkColor : undefined) || block.buttonTextColor,
          buttonStyle: navigation ? (block.buttonStyle ?? "link") : block.buttonStyle,
          // Navigation links should never occupy their own full-width buttons.
          // Retain the historical button-group rendering below.
          fullWidthButton: navigation && block.layoutPreset ? false : (block.fullWidthButton ?? true),
        }, link.label, link.url, editing);
        return `<td class="responsive-column" valign="middle" align="${navAlign}" width="${100 / links.length}%" style="padding:6px;">${button}</td>`;
      });
      // A single aligned cell makes Left/Centred/Right presets move the entire
      // navigation rather than only adjusting text within equal-width columns.
      // Keep existing newsletters with no preset on their original table layout.
      if (navigation && block.layoutPreset?.startsWith("nav-")) {
        const items = cells.map((cell) => cell.replace(/^<td[^>]*>/, "").replace("</td>", ""));
        return copy + table(`<tr><td align="${navAlign}" style="text-align:${navAlign};padding:6px;">${items.map((item) => `<span style="display:inline-block;padding:0 6px 8px 0;">${item}</span>`).join("")}</td></tr>`);
      }
      return copy + table(`<tr>${cells.join("")}</tr>`);
    }
    case "text-columns": {
      const columns = (block.textColumns || [""]).slice(0, 3);
      return table(
        `<tr>${columns.map((value) => `<td class="responsive-column" width="${100 / columns.length}%" valign="top" style="padding:0 10px;${role(block, "body", 16)}">${formatDraftRichText(value)}</td>`).join("")}</tr>`,
      );
    }
    case "data-table": {
      const headers = (block.tableHeaders || []).slice(0, 12);
      const rows = (block.tableRows || []).slice(0, 100);
      if (!headers.length && !rows.length) return "";
      const count =
        headers.length ||
        Math.min(12, Math.max(...rows.map((row) => row.length)));
      return `<table width="100%" cellpadding="8" cellspacing="0" style="width:100%;border-collapse:collapse;${role(block, "body", 14)}">${block.tableCaption ? `<caption style="text-align:left;padding-bottom:12px;${role(block, "heading", 20, 700)}">${text(block.tableCaption)}</caption>` : ""}${headers.length ? `<thead><tr>${headers.map((value) => `<th scope="col" style="border:1px solid #cbd5e1;text-align:left;background:#edf1f0;">${text(value)}</th>`).join("")}</tr></thead>` : ""}<tbody>${rows.map((row) => `<tr>${Array.from({ length: count }, (_, i) => `<td style="border:1px solid #cbd5e1;vertical-align:top;">${text(row[i])}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
    }
    case "chart": {
      const points = (block.chartData || [])
        .filter(
          (point) =>
            typeof point.value === "number" &&
            Number.isFinite(point.value) &&
            point.value >= 0,
        )
        .slice(0, 20);
      const max = Math.max(1, ...points.map((point) => point.value));
      return (
        heading(block) +
        table(
          points
            .map(
              (point) =>
                `<tr><td style="padding:6px 10px 6px 0;width:30%;${role(block, "body", 14)}">${text(point.label)}</td><td style="padding:6px 0;width:70%;">${table(`<tr><td width="${Math.max(1, (point.value / max) * 100)}%" bgcolor="${emailColor(block.accentColor, "#1f4341")}" style="height:20px;background:${emailColor(block.accentColor, "#1f4341")};"></td>${point.value < max ? "<td></td>" : ""}</tr>`)}<span style="${role(block, "smallPrint", 12)}">${point.value}${text(block.chartUnit)}</span></td></tr>`,
            )
            .join(""),
        )
      );
    }
    case "survey": {
      const links = (block.links || [])
        .slice(0, 6)
        .filter((link) => present(link.label) && safeEmailUrl(link.url));
      return (
        heading(block) +
        paragraph(block, block.body) +
        links
          .map(
            (link) =>
              `<div style="margin:8px 0;">${renderNewsletterButton({ ...block, fullWidthButton: true, buttonStyle: "outlined" }, link.label, link.url)}</div>`,
          )
          .join("")
      );
    }
    case "event":
      return renderEventCard(block, width, editing);
    case "plant-care":
      return renderPlantCare(block, width, editing);
    case "blog":
    case "announcement":
      return imageAndContent(
        // "Show photo" off hides the photo and keeps the saved one.
        block.showImage === false ? { ...block, imageUrl: "" } : block,
        paragraph(block, block.tagLabel, "label", 12) +
          heading(block) +
          paragraph(block, block.subheading, "subheading", 17) +
          paragraph(block, block.eventDate, "label", 13) +
          paragraph(block, block.eventLocation, "label", 13) +
          paragraph(block, block.body) +
          (block.showButton === false ? "" : alignedButton(block, renderNewsletterButton(block, undefined, undefined, editing))),
        block.imagePosition === "right"
          ? "right"
          : block.imagePosition === "left"
            ? "left"
            : "top",
        width,
      );
    default:
      return null;
  }
}
export function applyBlockAppearance(
  html: string,
  appearance?: BlockAppearance,
): string {
  if (!html || !appearance) return html;
  let styled = html.replace(
    /<(h[1-6]|p|a|div|td|span)\b([^>]*)>/gi,
    (whole, tag: string, attrs: string) => {
      const explicit = attrs.match(
        /data-newsletter-role="([a-zA-Z]+)"/,
      )?.[1] as TextRole | undefined;
      const inferred: TextRole | undefined = /^h[1-6]$/.test(tag)
        ? (tag as HeadingLevel)
        : tag === "p"
          ? "body"
          : undefined;
      const overrides = {
        ...(inferred ? appearance.text?.[inferred] : {}),
        ...(explicit ? appearance.text?.[explicit] : {}),
      };
      // Newsletter typography may set fonts and sizes, but must not overwrite
      // a button's explicitly chosen text colour (including per-link colours).
      const additionsForRole =
        explicit === "button" ? { ...overrides, color: undefined } : overrides;
      let additions = Object.keys(additionsForRole).length
        ? textCss(additionsForRole)
        : "";
      if (tag === "a" && explicit !== "button") {
        if (appearance.linkColor && !attrs.includes('data-newsletter-secondary-color="true"'))
          additions += `color:${emailColor(appearance.linkColor)};`;
        if (appearance.linkDecoration)
          additions += `text-decoration:${appearance.linkDecoration === "none" ? "none" : "underline"};`;
      }
      if (!additions) return whole;
      return /\sstyle="[^"]*"/.test(attrs)
        ? `<${tag}${attrs.replace(/\sstyle="([^"]*)"/, (_m: string, css: string) => ` style="${css.trimEnd().replace(/;?$/, ";")}${additions}"`)}>`
        : `<${tag}${attrs} style="${additions}">`;
    },
  );
  const border = appearance.border;
  const style = ["solid", "dashed", "dotted", "double"].includes(
    border?.style || "",
  )
    ? border?.style
    : "none";
  const borderCss =
    style === "none"
      ? "border:0;"
      : `border:${clampNumber(border?.width, 1, 0, 12)}px ${style} ${emailColor(border?.color, "#71817d")};`;
  const legend = border?.legend
    ? `<div style="font-size:13px;font-weight:700;padding:0 8px 8px;">${text(border.legend)}</div>`
    : "";
  const innerStyle = `padding:${edgeCss(appearance.padding)};${borderCss}border-radius:${clampNumber(border?.radius, 0, 0, 48)}px;${appearance.background ? `background-color:${emailColor(appearance.background, "transparent")};` : ""}`;
  // Table-cell spacing survives Outlook's inconsistent CSS margin support.
  styled = table(
    `<tr><td style="padding:${edgeCss(appearance.margin)};"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:separate;"><tr><td style="${innerStyle}">${legend}${styled}</td></tr></table></td></tr>`,
  );
  return styled;
}
