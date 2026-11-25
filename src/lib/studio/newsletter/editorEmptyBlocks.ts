// Editor-only sample layouts for blocks that have just been added and hold no
// content yet. Instead of a dashed "This block is empty" box (or a lone
// button), the Studio canvas shows the block's real shape: grey photo frames
// and muted sample copy. renderNewsletterBlock calls this only when `editing`
// is true, so nothing here can reach Preview & Test or sent mail.
//
// Relative, extension-bearing imports: the send pipeline loads the generator
// (and so this module) in Deno.
import type { StudioBlock } from "../../../types/studioBlocks.ts";
import { editorImagePlaceholder, editorSampleCopy } from "./editorPlaceholders.ts";

type Align = "left" | "center" | "right";

const SAMPLE_BUTTON_BG = "#dfe4e8";
const SAMPLE_BUTTON_TEXT = "#7b8794";
const SAMPLE_TEXT = "#a9b3bd";
const SAMPLE_HEADING = "#9aa6b2";
const RULE = "#d5dbe0";

function present(value: unknown) {
  return typeof value === "string" && value.replace(/<[^>]*>/g, "").trim().length > 0;
}

function anyPresent(values: unknown[]) {
  return values.some(present);
}

/** True when a block of a supported type holds nothing a person has entered. */
export function isEditorEmptyBlock(block: StudioBlock): boolean {
  const links = block.links ?? [];
  const linksEmpty = !links.some((link) => present(link.label) || present(link.url));
  switch (block.type) {
    case "html":
      // Raw text, not tag-stripped: an HTML block may hold only an image.
      return !(block.customHtml ?? "").trim();
    case "plain-text":
      return !anyPresent([block.body, block.headline, (block as { content?: unknown }).content, block.buttonUrl]);
    case "full-width-image":
      return !present(block.imageUrl);
    case "image-text":
      return !anyPresent([block.imageUrl, block.headline, block.subheading, block.body, block.buttonText, block.buttonUrl]);
    case "text-columns":
      return !(block.textColumns ?? []).some(present);
    case "button-group":
    case "navigation":
      return linksEmpty && !anyPresent([block.headline, block.subheading]);
    case "youtube":
      return !anyPresent([block.videoUrl, block.imageUrl, block.headline, block.body]);
    case "image-gallery":
      return !(block.galleryImages ?? []).some((image) => present(image.url) || present(image.caption));
    case "product-gallery":
      return !(block.galleryProducts ?? []).some((product) =>
        anyPresent([product.imageUrl, product.name, product.price, product.description, product.buttonUrl]));
    case "data-table":
      return !present(block.tableCaption) &&
        !(block.tableHeaders ?? []).some(present) &&
        !(block.tableRows ?? []).some((row) => row.some(present));
    case "chart":
      return !present(block.headline) && !(block.chartData ?? []).length && !present(block.chartDataText);
    case "survey":
      return linksEmpty && !anyPresent([block.headline, block.body]);
    case "event":
    case "blog":
    case "announcement":
      return !anyPresent([
        block.imageUrl, block.headline, block.subheading, block.body, block.tagLabel,
        block.eventDate, block.eventLocation, block.buttonUrl,
      ]);
    case "product-card":
      return !anyPresent([
        block.imageUrl, block.productName, block.headline, block.productPrice,
        block.productDescription, block.buttonText, block.buttonUrl,
      ]);
    default:
      return false;
  }
}

function sampleButton(label: string, options: { full?: boolean; outlined?: boolean } = {}) {
  const look = options.outlined
    ? `background:#ffffff;border:1px solid ${RULE};`
    : `background:${SAMPLE_BUTTON_BG};`;
  return `<span data-editor-placeholder="copy" style="display:${options.full ? "block" : "inline-block"};box-sizing:border-box;padding:9px 18px;border-radius:6px;${look}color:${SAMPLE_BUTTON_TEXT};font-family:Arial,sans-serif;font-size:13px;font-weight:700;text-align:center;">${label}</span>`;
}

function sampleLine(width: string, height = 10) {
  return `<div style="width:${width};height:${height}px;border-radius:${height / 2}px;background:#e4e8ec;margin:0 0 8px;"></div>`;
}

function row(cells: string[], gap = 16) {
  const width = `${Math.floor(100 / cells.length)}%`;
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;border-collapse:collapse;"><tr>${cells
    .map((cell, i) => `<td class="responsive-column" valign="top" width="${width}" style="padding:0 ${i === cells.length - 1 ? 0 : gap / 2}px 0 ${i === 0 ? 0 : gap / 2}px;">${cell}</td>`)
    .join("")}</tr></table>`;
}

function align(block: StudioBlock, fallback: Align): Align {
  return block.textAlign === "center" || block.textAlign === "right" || block.textAlign === "left"
    ? block.textAlign
    : fallback;
}

function columnCount(block: StudioBlock, fallback: number) {
  const value = block.layout === "grid-4" ? 2 : block.layout === "grid-6" ? 3 : block.gridColumns;
  const n = typeof value === "number" && Number.isFinite(value) ? Math.round(value) : fallback;
  return Math.max(1, Math.min(4, n));
}

function imageAndCopy(
  position: "left" | "right" | "top",
  image: string,
  copy: string,
) {
  if (position === "top") return `${image}<div style="height:16px;line-height:16px;">&nbsp;</div>${copy}`;
  const imageCell = `<td class="responsive-column" valign="middle" width="50%" style="padding:0 ${position === "left" ? 10 : 0}px 0 ${position === "right" ? 10 : 0}px;">${image}</td>`;
  const copyCell = `<td class="responsive-column" valign="middle" width="50%" style="padding:0 ${position === "right" ? 10 : 0}px 0 ${position === "left" ? 10 : 0}px;">${copy}</td>`;
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;border-collapse:collapse;"><tr>${position === "left" ? imageCell + copyCell : copyCell + imageCell}</tr></table>`;
}

function layoutFor(block: StudioBlock): string | null {
  switch (block.type) {
    case "html":
      return `<div data-editor-placeholder="copy" style="border:1px dashed ${RULE};border-radius:6px;padding:16px;font-family:Menlo,Consolas,monospace;font-size:13px;line-height:1.5;color:${SAMPLE_TEXT};">&lt;p&gt;Your HTML goes here&lt;/p&gt;</div>`;
    case "plain-text":
      return editorSampleCopy({
        heading: null,
        text: "Start typing your message here. This sample text is only shown while you edit.",
        button: null,
        align: align(block, "left"),
      });
    case "full-width-image":
      return editorImagePlaceholder({
        height: Math.max(160, Math.min(400, Number(block.maxHeight) || 280)),
        radius: Number(block.borderRadius) || 0,
        field: "imageUrl",
      });
    case "image-text": {
      const position = block.imagePosition === "right" || block.layout === "image-right"
        ? "right"
        : block.imagePosition === "top" || block.layout === "image-top"
          ? "top"
          : "left";
      return imageAndCopy(
        position,
        editorImagePlaceholder({ height: position === "top" ? 220 : 200, radius: Number(block.borderRadius) || 0, field: "imageUrl" }),
        editorSampleCopy({ heading: "Your headline", text: "A line of text about this section.", button: "Button", align: align(block, "left") }),
      );
    }
    case "text-columns": {
      const count = Math.max(2, Math.min(3, (block.textColumns ?? []).length || 2));
      return row(
        Array.from({ length: count }, (_, i) =>
          editorSampleCopy({ heading: `Column ${i + 1}`, text: "A short paragraph of text.", button: null, headingSize: 16 })),
        20,
      );
    }
    case "button-group": {
      const count = Math.max(2, Math.min(3, (block.links ?? []).length));
      return row(Array.from({ length: count }, (_, i) => sampleButton(`Button ${i + 1}`, { full: true })), 12);
    }
    case "navigation": {
      const center = align(block, "center");
      const links = ["Shop", "Events", "About us", "Visit"]
        .map((label) => `<span style="display:inline-block;padding:4px 10px;color:${SAMPLE_HEADING};font-family:Arial,sans-serif;font-size:14px;font-weight:700;text-decoration:underline;">${label}</span>`)
        .join("");
      return `<div data-editor-placeholder="copy" style="text-align:${center};">${links}</div>`;
    }
    case "youtube":
      return editorSampleCopy({ heading: "Video title", text: null, button: null, headingSize: 18 }) +
        editorImagePlaceholder({ height: 280, radius: 0, label: "Add a YouTube link" }) +
        `<div style="height:12px;line-height:12px;">&nbsp;</div>` +
        sampleButton(typeof block.buttonText === "string" && block.buttonText.trim() ? block.buttonText : "Watch video");
    case "image-gallery": {
      const columns = columnCount(block, 3);
      const height = Math.max(100, Math.min(260, Number(block.imageHeight) || 160));
      return row(
        Array.from({ length: columns }, () => editorImagePlaceholder({ height, radius: Number(block.borderRadius) || 6 })),
        Number(block.gridGap) || 8,
      );
    }
    case "product-gallery": {
      const columns = columnCount(block, 3);
      const card = editorImagePlaceholder({ height: columns >= 4 ? 120 : columns === 3 ? 160 : 220, radius: 6 }) +
        `<div style="height:10px;line-height:10px;">&nbsp;</div>` +
        editorSampleCopy({ heading: "Product name", text: "Price", button: "Shop now", align: "center", headingSize: 15 });
      return row(Array.from({ length: columns }, () => card), Number(block.cardGap) || 16);
    }
    case "data-table": {
      const cols = Math.max(2, Math.min(4, (block.tableHeaders ?? []).length || 3));
      const cell = (content: string, head = false) =>
        `<td style="border:1px solid ${RULE};padding:10px;${head ? "background:#edf1f0;" : ""}">${content}</td>`;
      const header = `<tr>${Array.from({ length: cols }, (_, i) => cell(`<span style="color:${SAMPLE_HEADING};font-family:Arial,sans-serif;font-size:13px;font-weight:700;">Column ${i + 1}</span>`, true)).join("")}</tr>`;
      const body = Array.from({ length: 2 }, () => `<tr>${Array.from({ length: cols }, () => cell(sampleLine("70%", 8))).join("")}</tr>`).join("");
      return `<table data-editor-placeholder="copy" width="100%" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;">${header}${body}</table>`;
    }
    case "chart": {
      const bars = [80, 55, 35]
        .map((value, i) => `<tr><td style="padding:6px 10px 6px 0;width:30%;color:${SAMPLE_TEXT};font-family:Arial,sans-serif;font-size:14px;">Item ${i + 1}</td><td style="padding:6px 0;width:70%;"><div style="width:${value}%;height:20px;border-radius:3px;background:#dfe4e8;"></div></td></tr>`)
        .join("");
      return editorSampleCopy({ heading: "Chart title", text: null, button: null, headingSize: 18 }) +
        `<table data-editor-placeholder="copy" role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;">${bars}</table>`;
    }
    case "survey":
      return editorSampleCopy({ heading: "Ask your question", text: "Pick the answer that fits best.", button: null }) +
        ["Answer one", "Answer two", "Answer three"]
          .map((label) => `<div style="margin:8px 0;">${sampleButton(label, { full: true, outlined: true })}</div>`)
          .join("");
    case "event":
    case "blog":
    case "announcement": {
      const heading = block.type === "event" ? "Event title" : block.type === "blog" ? "Article title" : "Announcement";
      const text = block.type === "event"
        ? "Date, time and place · A line about the event."
        : block.type === "blog"
          ? "A short summary of the article."
          : "A line of text about your news.";
      const button = typeof block.buttonText === "string" && block.buttonText.trim() ? block.buttonText : "Button";
      const position = block.imagePosition === "left" || block.imagePosition === "right" ? block.imagePosition : "top";
      const copy = (block.type === "event"
        ? `<div style="display:inline-block;margin:0 0 10px;padding:3px 8px;border-radius:4px;background:#e4e8ec;color:${SAMPLE_BUTTON_TEXT};font-family:Arial,sans-serif;font-size:11px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;">Workshop</div>`
        : "") + editorSampleCopy({ heading, text, button });
      return imageAndCopy(position, editorImagePlaceholder({ height: position === "top" ? 220 : 180, radius: 6, field: "imageUrl" }), copy);
    }
    case "product-card": {
      const copy = editorSampleCopy({ heading: "Product name", text: "Price · A line about the product.", button: "Shop now", align: "center", headingSize: 18 });
      const layout = block.layout === "horizontal" || block.layoutPreset === "product-horizontal" ? "left" : "top";
      return imageAndCopy(layout, editorImagePlaceholder({ height: 240, radius: 6, field: "imageUrl" }), copy);
    }
    default:
      return null;
  }
}

/**
 * The sample layout for an empty block, wrapped in the block's background and
 * padding, or null when the block has content (or has no sample layout).
 */
export function renderEditorEmptyBlock(block: StudioBlock): string | null {
  if (!isEditorEmptyBlock(block)) return null;
  const inner = layoutFor(block);
  if (inner === null) return null;
  const background = typeof block.backgroundColor === "string" && block.backgroundColor ? block.backgroundColor : "#ffffff";
  // Blocks with appearance padding get it applied by the caller.
  const padding = block.appearance?.padding ? 0 : 24;
  return `<table role="presentation" data-editor-sample="${block.type}" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;border-collapse:collapse;background-color:${background};"><tr><td style="padding:${padding}px;background-color:${background};">${inner}</td></tr></table>`;
}
