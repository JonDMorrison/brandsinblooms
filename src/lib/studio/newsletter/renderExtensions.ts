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

const text = (value: unknown) =>
  formatDraftText(typeof value === "string" ? value : "");
const attr = (value: string) => escapeHtml(value);
const present = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;
const table = (rows: string, extra = "") =>
  `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" ${extra} style="width:100%;border-collapse:collapse;">${rows}</table>`;
function role(
  block: StudioBlock,
  key: TextRole,
  fallbackSize: number,
  weight = 400,
) {
  return `font-family:${emailFont(block.appearance?.text?.[key]?.fontFamily)};${textCss(block.appearance?.text?.[key], { size: fallbackSize, weight, lineHeight: 1.5, color: block.textColor || "#172d2c" })}`;
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
): string {
  const href = safeEmailUrl(url);
  if (!href || !present(label)) return "";
  const link = block.buttonStyle === "link";
  const outlined =
    block.buttonStyle === "outlined" || block.buttonStyle === "ghost";
  const fill = emailColor(block.buttonColor, "#1f4341");
  const color = emailColor(
    block.appearance?.text?.button?.color || block.buttonTextColor,
    link || outlined ? fill : "#ffffff",
  );
  const defaultY =
    block.buttonSize === "sm" ? 9 : block.buttonSize === "lg" ? 16 : 12;
  const defaultX =
    block.buttonSize === "sm" ? 16 : block.buttonSize === "lg" ? 30 : 22;
  const padding = link
    ? "0"
    : `${clampNumber(block.appearance?.buttonPaddingY, defaultY, 0, 48)}px ${clampNumber(block.appearance?.buttonPaddingX, defaultX, 0, 96)}px`;
  return `<a data-newsletter-role="button" href="${attr(href)}" target="_blank" rel="noopener noreferrer" style="display:${block.fullWidthButton ? "block" : "inline-block"};box-sizing:border-box;${block.fullWidthButton ? "width:100%;" : ""}text-align:center;text-decoration:${link ? block.appearance?.linkDecoration || "underline" : "none"};padding:${padding};border:${outlined ? `1px solid ${fill}` : "0"};background-color:${link || outlined ? "transparent" : fill};border-radius:${block.buttonRounded === false ? "4" : "8"}px;${role(block, "button", 14, 700)}color:${color};">${text(label)}</a>`;
}
function picture(block: StudioBlock, width = 220): string {
  const url = safeEmailUrl(block.imageUrl, true);
  if (!url) return "";
  const image = `<img data-newsletter-image="imageUrl" class="responsive-image" src="${attr(url)}" alt="${attr(block.imageAlt || block.headline || block.productName || "")}" width="${width}" style="display:block;width:100%;max-width:${width}px;height:auto;border:0;border-radius:${clampNumber(block.borderRadius, 6, 0, 48)}px;" />`;
  const linked = safeEmailUrl(block.linkUrl)
    ? `<a href="${attr(safeEmailUrl(block.linkUrl))}" target="_blank" rel="noopener noreferrer">${image}</a>`
    : image;
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
): string {
  const photo = picture(
    block,
    side === "top" ? width : Math.floor(width * 0.38),
  );
  if (!photo) return content;
  if (side === "top")
    return `${photo}<div style="padding-top:18px;">${content}</div>`;
  const vertical = ["top", "middle", "bottom"].includes(
    block.appearance?.verticalAlign || "",
  )
    ? block.appearance?.verticalAlign
    : "middle";
  const imageCell = `<td class="responsive-column" width="38%" valign="top" style="width:38%;padding:${side === "right" ? "0 0 0 12px" : "0 12px 0 0"};">${photo}</td>`;
  const contentCell = `<td class="responsive-column" width="62%" valign="${vertical}" style="width:62%;vertical-align:${vertical};padding:${side === "right" ? "0 12px 0 0" : "0 0 0 12px"};">${content}</td>`;
  return table(
    `<tr>${side === "right" ? contentCell + imageCell : imageCell + contentCell}</tr>`,
  );
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
export function renderCoupon(block: StudioBlock, width: number): string {
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
  const barcode =
    block.couponBarcode && validUpcA(block.couponBarcode) && barcodeUrl
      ? `<div style="padding-top:16px;text-align:center;"><img src="${attr(barcodeUrl)}" width="250" alt="UPC ${attr(block.couponBarcode)}" style="max-width:100%;height:auto;" /><div style="font-family:monospace;font-size:13px;">${text(block.couponBarcode)}</div></div>`
      : "";
  const content =
    badges(block) +
    paragraph(block, block.tagLabel, "label", 12) +
    heading(block) +
    paragraph(block, block.subheading, "subheading", 17) +
    paragraph(block, block.body) +
    `${price ? `<div data-newsletter-role="price" style="margin:12px 0;${role(block, "price", 28, 800)}">${text(price)}</div>` : ""}${block.originalPrice ? `<div style="margin-bottom:8px;"><s>${text(block.originalPrice)}</s></div>` : ""}${block.couponPrice && block.couponOffer !== "price" && block.couponOffer !== "tiered" ? paragraph(block, block.couponPrice, "price", 20) : ""}` +
    paragraph(block, block.couponSizing, "label", 13) +
    renderNewsletterButton(block) +
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
  return `<div style="border:${border};">${cut}<div style="padding:${block.appearance?.padding ? "0" : "22px"};">${imageAndContent(block, content, block.couponImageSide || "left", width - 44)}</div></div>`;
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
export function renderExtendedBlock(
  block: StudioBlock,
  width = 640,
): string | null {
  switch (block.type) {
    case "product-card": {
      const content =
        badges(block) +
        heading(block, block.productName || block.headline) +
        paragraph(
          block,
          block.productSubtitle || block.subheading,
          "subheading",
          16,
        ) +
        (block.productPrice
          ? `<div data-newsletter-role="price" style="margin:8px 0;${role(block, "price", 22, 700)}">${text(block.productPrice)}${block.originalPrice ? ` <s style="font-size:14px;font-weight:400;">${text(block.originalPrice)}</s>` : ""}</div>`
          : "") +
        paragraph(block, block.productDescription || block.body) +
        renderNewsletterButton(block);
      const side =
        block.imagePosition === "top" || block.layout === "image-top"
          ? "top"
          : block.imagePosition === "right" || block.layout === "image-right"
            ? "right"
            : "left";
      const border =
        block.appearance?.border || block.showBorder === false
          ? "none"
          : "1px solid #cbd5e1";
      return `<div style="padding:${block.appearance?.padding ? "0" : "24px"};border:${border};border-radius:${clampNumber(block.cardBorderRadius, 10, 0, 48)}px;background:${emailColor(block.backgroundColor, "#ffffff")};">${imageAndContent(block, content, side, width - 48)}</div>`;
    }
    case "product-gallery": {
      const columns = Math.floor(clampNumber(block.gridColumns, 3, 1, 4));
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
          badges: undefined,
        };
        const image = picture(
          productBlock,
          Math.floor((width - gap * (columns + 1)) / columns),
        ).replace(
          'data-newsletter-image="imageUrl"',
          `data-newsletter-image="galleryProducts" data-newsletter-index="${index}"`,
        );
        const body =
          (block.showBadges !== false ? badges(productBlock) : "") +
          paragraph(block, product.name, "heading", 17) +
          paragraph(block, product.altName, "subheading", 13) +
          (block.showPrices !== false && product.price
            ? `<div data-newsletter-role="price" style="${role(block, "price", 16, 700)}">${text(product.price)}${product.originalPrice ? ` <s style="font-weight:400;font-size:13px;">${text(product.originalPrice)}</s>` : ""}</div>`
            : "") +
          paragraph(block, product.description, "body", 13) +
          (block.showCtaButtons !== false
            ? renderNewsletterButton(productBlock)
            : "");
        return `<td class="responsive-column" width="${100 / columns}%" valign="top" style="width:${100 / columns}%;padding:${gap / 2}px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:separate;border:${block.showBorder === false ? "0" : "1px solid #cbd5e1"};background:${emailColor(block.cardBackgroundColor, "#ffffff")};"><tr><td>${image}</td></tr><tr><td style="padding:14px;">${body}</td></tr></table></td>`;
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
        const link = safeEmailUrl(item.image.linkUrl);
        return (
          (link
            ? `<a href="${attr(link)}" target="_blank" rel="noopener noreferrer">${image}</a>`
            : image) + paragraph(block, item.image.caption, "smallPrint", 12)
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
      return renderCoupon(block, width);
    case "preheader":
      return paragraph(block, block.body, "smallPrint", 12);
    case "headline":
      return heading(block);
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
        renderNewsletterButton({
          ...block,
          buttonUrl: `https://www.youtube.com/watch?v=${id}`,
          buttonText: block.buttonText || "Watch video",
        })
      );
    }
    case "navigation":
    case "button-group": {
      const links = (block.links || [])
        .slice(0, block.type === "navigation" ? 5 : 3)
        .filter((link) => present(link.label) && safeEmailUrl(link.url));
      if (!links.length) return "";
      return (
        heading(block) +
        paragraph(block, block.subheading, "subheading", 17) +
        table(
          `<tr>${links.map((link) => `<td class="responsive-column" valign="middle" align="center" width="${100 / links.length}%" style="padding:6px;">${renderNewsletterButton({ ...block, buttonColor: link.color || block.buttonColor, buttonTextColor: link.textColor || block.buttonTextColor, buttonStyle: block.type === "navigation" ? "link" : block.buttonStyle, fullWidthButton: true }, link.label, link.url)}</td>`).join("")}</tr>`,
        )
      );
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
    case "blog":
    case "announcement":
      return imageAndContent(
        block,
        paragraph(block, block.tagLabel, "label", 12) +
          heading(block) +
          paragraph(block, block.subheading, "subheading", 17) +
          paragraph(block, block.eventDate, "label", 13) +
          paragraph(block, block.eventLocation, "label", 13) +
          paragraph(block, block.body) +
          renderNewsletterButton(block),
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
      let additions = Object.keys(overrides).length ? textCss(overrides) : "";
      if (tag === "a" && explicit !== "button") {
        if (appearance.linkColor)
          additions += `color:${emailColor(appearance.linkColor)};`;
        if (appearance.linkDecoration)
          additions += `text-decoration:${appearance.linkDecoration === "none" ? "none" : "underline"};`;
      }
      if (!additions) return whole;
      return /\sstyle="[^"]*"/.test(attrs)
        ? `<${tag}${attrs.replace(/\sstyle="([^"]*)"/, (_m: string, css: string) => ` style="${css};${additions}"`)}>`
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
