// Editor-only placeholders. The Studio canvas shows these where a block has
// no content yet, so a new block looks like its real layout. They carry
// data-editor-placeholder and are only rendered when `editing` is true; sent
// mail and Preview & Test never receive them.
//
// No imports: the email generator (and so the Deno send pipeline) loads this.

const FRAME_BG = "#eef1f3";
export const EDITOR_PLACEHOLDER_FRAME_BG = FRAME_BG;
const FRAME_BORDER = "#d5dbe0";
const MUTED = "#8a96a3";

const IMAGE_ICON =
  '<svg aria-hidden="true" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#8a96a3" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" style="display:block;margin:0 auto 6px;"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21"/></svg>';

/**
 * Light grey frame with an image icon and "Add a photo". `field` marks which
 * block field a click on the frame should fill (the canvas opens the picker).
 */
export function editorImagePlaceholder(options: {
  height?: number;
  radius?: number;
  label?: string;
  field?: string;
  /** Which gallery slot a click fills. Defaults to the first. */
  index?: number;
} = {}): string {
  const height = Math.max(80, Math.round(options.height ?? 220));
  const radius = Math.max(0, Math.round(options.radius ?? 6));
  const field = options.field ? ` data-newsletter-image="${escapeText(options.field)}" data-newsletter-index="${Math.max(0, Math.round(options.index ?? 0))}"` : "";
  return `<div data-editor-placeholder="image"${field} style="display:flex;flex-direction:column;align-items:center;justify-content:center;box-sizing:border-box;width:100%;height:${height}px;background:${FRAME_BG};border:1px solid ${FRAME_BORDER};border-radius:${radius}px;color:${MUTED};font-family:Arial,sans-serif;font-size:13px;font-weight:600;text-align:center;${options.field ? "cursor:pointer;" : ""}">${IMAGE_ICON}${escapeText(options.label ?? "Add a photo")}</div>`;
}

/** Muted sample heading, line of text and button. null leaves a part out. */
export function editorSampleCopy(options: {
  heading?: string | null;
  text?: string | null;
  button?: string | null;
  align?: "left" | "center" | "right";
  headingSize?: number;
} = {}): string {
  const align = options.align ?? "left";
  const heading = options.heading === undefined ? "Your headline" : options.heading;
  const text = options.text === undefined ? "A line of text about this section." : options.text;
  const button = options.button === undefined ? "Button" : options.button;
  return `<div data-editor-placeholder="copy" style="text-align:${align};font-family:Arial,sans-serif;">` +
    (heading ? `<div style="font-size:${options.headingSize ?? 20}px;line-height:1.3;font-weight:700;color:#9aa6b2;margin:0 0 8px;">${escapeText(heading)}</div>` : "") +
    (text ? `<div style="font-size:14px;line-height:1.55;color:#a9b3bd;margin:0 0 12px;">${escapeText(text)}</div>` : "") +
    (button ? `<span style="display:inline-block;padding:9px 18px;border-radius:6px;background:#dfe4e8;color:#7b8794;font-size:13px;font-weight:700;">${escapeText(button)}</span>` : "") +
    `</div>`;
}

export const EDITOR_PLACEHOLDER_ATTRIBUTE = "data-editor-placeholder";

function escapeText(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
