// Pre-send message check (Preview & Test → "Check message").
//
// Renders each block the way it is sent and reports problems a person should
// fix before sending: images without a description (alt text), links that go
// nowhere or look wrong, images that are missing, insecure, placeholders or
// fail to load, and buttons with words but no link (or a link but no words).
// Spelling is a separate, later check.
//
// Links are checked by their address only; the check does not visit pages.
import type { StudioBlock } from "@/types/studioBlocks";
import type { StudioDesignSystem } from "@/lib/studio/designSystem";
import type { NewsletterSettings } from "@/types/newsletterDesign";
import { getBlockDisplayLabel } from "@/components/crm/studio/blockLibraryData";
import {
  renderFooterBlockToEmailHtml,
  renderNewsletterBlock,
} from "@/lib/studio/emailHtmlGenerator";
import { isSocialHomepageOnly } from "@/lib/studio/socialIcons";

export type MessageCheckKind = "alt-text" | "link" | "image" | "button";
export type MessageCheckSeverity = "problem" | "warning";

export type MessageCheckIssue = {
  kind: MessageCheckKind;
  severity: MessageCheckSeverity;
  blockId: string;
  blockLabel: string;
  message: string;
  /** The address or image involved, when there is one. */
  detail?: string;
};

// Descriptions the renderers fill in when a person wrote none. They say
// nothing about the photo, so they count as missing.
const GENERIC_ALT_TEXT = new Set([
  "campaign image",
  "product image",
  "gallery image",
  "event photo",
  "image",
  "photo",
]);
const PLACEHOLDER_HOSTS = /(^|\.)(example\.(com|org|net)|placehold\.co|placeholder\.com|via\.placeholder\.com|yourstore\.com|yourwebsite\.com)$|\.(test|example|invalid|localhost)$/i;
const MERGE_TAG = /\{\{[^}]+\}\}/;
// Footer system links are filled in per recipient when the email is sent.
const SYSTEM_ANCHORS = new Set(["#unsubscribe", "#preferences"]);

function hostOf(url: string) {
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
}

function present(value: unknown) {
  return typeof value === "string" && value.trim().length > 0;
}

function shorten(value: string, max = 80) {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

/** Problems with one link address, or null when it looks fine. */
export function checkLinkAddress(href: string | null): { severity: MessageCheckSeverity; message: string } | null {
  const value = (href ?? "").trim();
  if (MERGE_TAG.test(value)) return null;
  if (SYSTEM_ANCHORS.has(value)) return null;
  if (!value || value === "#" || value.startsWith("#")) {
    return { severity: "problem", message: "A link has no web address, so it goes nowhere." };
  }
  if (/^(mailto:|tel:)/i.test(value)) {
    return value.replace(/^(mailto:|tel:)/i, "").trim()
      ? null
      : { severity: "problem", message: "An email or phone link is empty." };
  }
  if (!/^https?:\/\//i.test(value)) {
    return { severity: "problem", message: "A link is not a full web address (it should start with https://)." };
  }
  const host = hostOf(value);
  if (!host || !host.includes(".")) {
    return { severity: "problem", message: "A link's web address is not valid." };
  }
  if (PLACEHOLDER_HOSTS.test(host)) {
    return { severity: "warning", message: "A link points to a placeholder address." };
  }
  if (isSocialHomepageOnly(value)) {
    return { severity: "warning", message: "A social link goes to the network's home page, not your page." };
  }
  if (/^http:\/\//i.test(value)) {
    return { severity: "warning", message: "A link uses http:// instead of https://." };
  }
  return null;
}

/** Problems with one image address, or null when it looks fine. */
export function checkImageAddress(src: string | null): { severity: MessageCheckSeverity; message: string } | null {
  const value = (src ?? "").trim();
  if (!value) return { severity: "problem", message: "An image has no picture." };
  if (/^data:/i.test(value)) {
    return { severity: "problem", message: "An image is embedded in the email; most inboxes block these. Upload it instead." };
  }
  if (/^http:\/\//i.test(value)) {
    return { severity: "warning", message: "An image uses http:// and may be blocked. Use an https:// image." };
  }
  if (!/^https:\/\//i.test(value)) {
    return { severity: "problem", message: "An image is not a full web address." };
  }
  if (PLACEHOLDER_HOSTS.test(hostOf(value))) {
    return { severity: "warning", message: "An image is still a placeholder. Replace it before sending." };
  }
  return null;
}

/** Button words without a link, or a link without words, from block settings. */
export function checkBlockButtons(block: StudioBlock): Array<{ severity: MessageCheckSeverity; message: string }> {
  const issues: Array<{ severity: MessageCheckSeverity; message: string }> = [];
  // Photo Banner buttons are opt-in; coupon buttons are on unless hidden.
  const buttonShown =
    block.type === "graphic-hero"
      ? block.showButton === true
      : block.type === "coupon"
        ? block.showButton !== false
        : true;
  if (block.type !== "youtube" && block.type !== "footer" && buttonShown) {
    const text = present(block.buttonText);
    const url = present(block.buttonUrl);
    if (text && !url) {
      issues.push({ severity: "problem", message: `The button "${shorten(block.buttonText!.trim(), 40)}" has no web address, so it leads nowhere.` });
    } else if (url && !text) {
      issues.push({ severity: "problem", message: "A button has a web address but no words, so it does not show." });
    }
  }
  if (block.type === "youtube" && !present(block.videoUrl)) {
    issues.push({ severity: "problem", message: "The YouTube block has no video address, so it will not be sent." });
  }
  if (block.type === "button-group" || block.type === "navigation" || block.type === "survey") {
    for (const link of block.links ?? []) {
      const label = present(link.label);
      const url = present(link.url);
      if (label && !url) {
        issues.push({ severity: "problem", message: `The link "${shorten(link.label!.trim(), 40)}" has no web address.` });
      } else if (url && !label) {
        issues.push({ severity: "problem", message: "A link has a web address but no words." });
      }
    }
  }
  if (block.type === "product-gallery") {
    (block.galleryProducts ?? []).forEach((product, i) => {
      if (present(product.buttonText) && !present(product.buttonUrl)) {
        issues.push({ severity: "problem", message: `Product ${i + 1}'s button "${shorten(product.buttonText!.trim(), 40)}" has no web address.` });
      }
    });
  }
  return issues;
}

/** The sent HTML for one block (footer included). */
function blockHtml(
  block: StudioBlock,
  designSystem: StudioDesignSystem | null | undefined,
  settings: NewsletterSettings | undefined,
) {
  return block.type === "footer"
    ? renderFooterBlockToEmailHtml(block, {}, designSystem)
    : renderNewsletterBlock(block, designSystem, settings);
}

/**
 * Checks every visible block. Image loading is checked separately (see
 * findBrokenImages) because it needs the network.
 */
export function checkMessage(
  blocks: StudioBlock[],
  designSystem?: StudioDesignSystem | null,
  settings?: NewsletterSettings,
): MessageCheckIssue[] {
  const issues: MessageCheckIssue[] = [];
  const parser = new DOMParser();
  for (const block of blocks) {
    if (block.visible === false) continue;
    const blockLabel = getBlockDisplayLabel(block);
    // One entry per problem per block: a photo and its button often share
    // the same link, which should be listed once.
    const seen = new Set<string>();
    const add = (kind: MessageCheckKind, found: { severity: MessageCheckSeverity; message: string } | null, detail?: string) => {
      if (!found) return;
      const key = `${kind}|${found.message}|${detail ?? ""}`;
      if (seen.has(key)) return;
      seen.add(key);
      issues.push({ kind, blockId: block.id, blockLabel, ...found, ...(detail ? { detail: shorten(detail) } : {}) });
    };
    const html = blockHtml(block, designSystem, settings);
    const doc = parser.parseFromString(html, "text/html");
    for (const image of Array.from(doc.querySelectorAll("img"))) {
      const src = image.getAttribute("src");
      add("image", checkImageAddress(src), src ?? undefined);
      // Tiny 1×1 images are spacers or trackers and need no description.
      const tiny = image.getAttribute("width") === "1" && image.getAttribute("height") === "1";
      const alt = (image.getAttribute("alt") ?? "").trim();
      if (!tiny && (!alt || GENERIC_ALT_TEXT.has(alt.toLowerCase()))) {
        add("alt-text", {
          severity: "warning",
          message: "An image has no description (alt text) for people who cannot see images.",
        }, src ?? undefined);
      }
    }
    const buttonIssues = checkBlockButtons(block);
    // A button with words and no address is already reported as a button
    // problem; its empty ("#") link is the same problem, so skip that one.
    const buttonMissingAddress = buttonIssues.some((issue) => issue.message.includes("has no web address"));
    for (const link of Array.from(doc.querySelectorAll("a"))) {
      const href = link.getAttribute("href");
      const found = checkLinkAddress(href);
      if (buttonMissingAddress && found && (!href || href.trim() === "#")) continue;
      add("link", found, href || (link.textContent ?? "").trim() || undefined);
    }
    for (const found of buttonIssues) add("button", found);
  }
  return issues;
}

/** Every distinct image address in the message, for the load check. */
export function messageImageAddresses(
  blocks: StudioBlock[],
  designSystem?: StudioDesignSystem | null,
  settings?: NewsletterSettings,
): Array<{ src: string; blockId: string; blockLabel: string }> {
  const parser = new DOMParser();
  const seen = new Set<string>();
  const out: Array<{ src: string; blockId: string; blockLabel: string }> = [];
  for (const block of blocks) {
    if (block.visible === false) continue;
    const doc = parser.parseFromString(blockHtml(block, designSystem, settings), "text/html");
    for (const image of Array.from(doc.querySelectorAll("img"))) {
      const src = (image.getAttribute("src") ?? "").trim();
      if (!/^https?:\/\//i.test(src) || seen.has(src)) continue;
      seen.add(src);
      out.push({ src, blockId: block.id, blockLabel: getBlockDisplayLabel(block) });
    }
  }
  return out;
}

export type ImageLoader = (src: string, timeoutMs: number) => Promise<boolean>;

/** Loads an image in the browser; false when it fails or times out. */
export const browserImageLoader: ImageLoader = (src, timeoutMs) =>
  new Promise((resolve) => {
    const image = new Image();
    const timer = window.setTimeout(() => resolve(false), timeoutMs);
    image.onload = () => {
      window.clearTimeout(timer);
      resolve(image.naturalWidth > 0);
    };
    image.onerror = () => {
      window.clearTimeout(timer);
      resolve(false);
    };
    image.src = src;
  });

/** Images that could not be loaded, as issues. */
export async function findBrokenImages(
  images: Array<{ src: string; blockId: string; blockLabel: string }>,
  loader: ImageLoader = browserImageLoader,
  timeoutMs = 8000,
): Promise<MessageCheckIssue[]> {
  const results = await Promise.all(images.map(async (image) => ({ image, ok: await loader(image.src, timeoutMs) })));
  return results
    .filter(({ ok }) => !ok)
    .map(({ image }) => ({
      kind: "image" as const,
      severity: "problem" as const,
      blockId: image.blockId,
      blockLabel: image.blockLabel,
      message: "An image could not be loaded. Recipients would see a broken image.",
      detail: shorten(image.src),
    }));
}
