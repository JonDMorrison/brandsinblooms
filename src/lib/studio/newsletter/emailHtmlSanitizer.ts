// Cleans HTML typed or pasted into the HTML block so only email-safe markup
// reaches the canvas, Preview & Test and every recipient's inbox.
//
// Runs without a DOM (string tokenizer) because the send pipeline loads the
// renderers in Deno. Allowlist only: tags, attributes, URL schemes and CSS
// properties not listed below are dropped. Scripts, styles, forms, iframes
// and similar are removed together with their contents; comments (including
// Outlook conditional comments) are removed.
//
// No imports: the email generator (and so the Deno send pipeline) loads this.

const ALLOWED_TAGS = new Set([
  "a", "abbr", "b", "big", "blockquote", "br", "caption", "center", "code",
  "col", "colgroup", "dd", "del", "div", "dl", "dt", "em", "font", "h1", "h2",
  "h3", "h4", "h5", "h6", "hr", "i", "img", "ins", "li", "ol", "p", "pre", "s",
  "small", "span", "strike", "strong", "sub", "sup", "table", "tbody", "td",
  "tfoot", "th", "thead", "tr", "u", "ul",
]);

const VOID_TAGS = new Set(["br", "col", "hr", "img"]);

// Removed together with everything inside them.
const DISCARD_WITH_CONTENT = new Set([
  "script", "style", "iframe", "frame", "frameset", "object", "embed",
  "applet", "form", "textarea", "select", "option", "button", "noscript",
  "template", "svg", "math", "video", "audio", "canvas", "title", "head",
  "link", "meta", "base",
]);

const GLOBAL_ATTRIBUTES = new Set(["style", "class", "title", "dir", "lang", "align", "valign", "width", "height", "bgcolor"]);
const TAG_ATTRIBUTES: Record<string, Set<string>> = {
  a: new Set(["href", "target", "rel", "name"]),
  img: new Set(["src", "alt", "border"]),
  table: new Set(["border", "cellpadding", "cellspacing", "role", "background"]),
  td: new Set(["colspan", "rowspan", "background"]),
  th: new Set(["colspan", "rowspan", "scope", "background"]),
  col: new Set(["span"]),
  colgroup: new Set(["span"]),
  font: new Set(["color", "face", "size"]),
  ol: new Set(["start", "type"]),
  ul: new Set(["type"]),
};
const URL_ATTRIBUTES = new Set(["href", "src", "background"]);

const ALLOWED_CSS = new Set([
  "background", "background-color", "background-image", "background-position",
  "background-repeat", "background-size", "border", "border-bottom",
  "border-collapse", "border-color", "border-left", "border-radius",
  "border-right", "border-spacing", "border-style", "border-top", "border-width",
  "color", "display", "font", "font-family", "font-size", "font-style",
  "font-weight", "height", "letter-spacing", "line-height", "list-style",
  "list-style-type", "margin", "margin-bottom", "margin-left", "margin-right",
  "margin-top", "max-height", "max-width", "min-height", "min-width",
  "mso-line-height-rule", "object-fit", "opacity", "overflow", "padding",
  "padding-bottom", "padding-left", "padding-right", "padding-top",
  "table-layout", "text-align", "text-decoration", "text-indent",
  "text-transform", "vertical-align", "white-space", "width", "word-break",
  "word-wrap",
]);

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", colon: ":", tab: "\t",
  newline: "\n", lpar: "(", rpar: ")", sol: "/",
};

/** Decodes entities so "jav&#x61;script:" cannot hide a scheme. */
function decodeEntities(value: string): string {
  return value.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);?/gi, (whole, code: string) => {
    if (code[0] === "#") {
      const point = code[1].toLowerCase() === "x" ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(point) && point > 0 && point < 0x110000 ? String.fromCodePoint(point) : "";
    }
    return NAMED_ENTITIES[code.toLowerCase()] ?? whole;
  });
}

function escapeAttribute(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** https, http, mailto and tel only; relative and protocol-relative are dropped. */
export function isSafeEmailUrl(raw: string, attribute: string): boolean {
  // eslint-disable-next-line no-control-regex
  const value = decodeEntities(raw).replace(/[\u0000- \u007f-\u009f]/g, "").toLowerCase();
  if (!value) return false;
  if (attribute === "href") return /^(https?:\/\/|mailto:|tel:)/.test(value) || value.startsWith("#");
  return /^https?:\/\//.test(value);
}

type Removed = Set<string>;

function sanitizeStyle(raw: string, removed: Removed): string {
  // Comments removed and entities decoded first, so "expr/**/ession(" and
  // "&#106;avascript:" cannot slip past the value checks below.
  const decoded = decodeEntities(raw).replace(/\/\*[\s\S]*?\*\//g, "");
  const kept: string[] = [];
  for (const declaration of decoded.split(";")) {
    const index = declaration.indexOf(":");
    if (index < 0) continue;
    const property = declaration.slice(0, index).trim().toLowerCase();
    const value = declaration.slice(index + 1).trim();
    if (!property || !value) continue;
    if (!ALLOWED_CSS.has(property)) {
      removed.add(`style "${property}"`);
      continue;
    }
    if (/expression\s*\(|javascript:|vbscript:|behavior|-moz-binding|@import|[<>\\]/i.test(value)) {
      removed.add(`unsafe style value for "${property}"`);
      continue;
    }
    // url(...) only to an https/http image.
    const urls = value.match(/url\s*\(([^)]*)\)/gi) ?? [];
    if (urls.some((u) => !/^url\s*\(\s*['"]?https?:\/\//i.test(u))) {
      removed.add(`unsafe style value for "${property}"`);
      continue;
    }
    kept.push(`${property}:${value}`);
  }
  return kept.join(";");
}

const ATTRIBUTE_PATTERN = /([^\s"'>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;

function sanitizeAttributes(tag: string, raw: string, removed: Removed): string {
  const allowed = TAG_ATTRIBUTES[tag];
  const out: string[] = [];
  const seen = new Set<string>();
  let target = "";
  for (const match of raw.matchAll(ATTRIBUTE_PATTERN)) {
    const name = match[1].toLowerCase();
    const value = match[2] ?? match[3] ?? match[4] ?? "";
    if (seen.has(name)) continue;
    if (!GLOBAL_ATTRIBUTES.has(name) && !allowed?.has(name)) {
      removed.add(name.startsWith("on") ? `event handler "${name}"` : `"${name}" on <${tag}>`);
      continue;
    }
    if (name === "role" && value !== "presentation") continue;
    if (URL_ATTRIBUTES.has(name) && !isSafeEmailUrl(value, name)) {
      removed.add(`unsafe or incomplete address in "${name}" on <${tag}>`);
      continue;
    }
    let clean = value;
    if (name === "style") {
      clean = sanitizeStyle(value, removed);
      if (!clean) continue;
    } else {
      clean = decodeEntities(value);
    }
    if (name === "target") {
      if (clean !== "_blank") continue;
      target = clean;
    }
    if (name === "rel") continue; // set below for new-tab links
    seen.add(name);
    out.push(`${name}="${escapeAttribute(clean)}"`);
  }
  if (tag === "a" && target === "_blank") out.push('rel="noopener noreferrer"');
  return out.length ? ` ${out.join(" ")}` : "";
}

const TOKEN_PATTERN = /<!--[\s\S]*?(?:-->|$)|<!\[CDATA\[[\s\S]*?\]\]>|<![^>]*>|<\?[\s\S]*?\?>|<\/?([a-zA-Z][a-zA-Z0-9:-]*)((?:\s+[^\s"'>/=]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'=<>`]+))?)*)\s*\/?>/g;

function escapeText(text: string): string {
  return text.replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Email-safe HTML from anything typed or pasted. */
export function sanitizeEmailHtml(input: string | null | undefined): string {
  return sanitizeEmailHtmlWithReport(input).html;
}

/**
 * The cleaned HTML plus a plain-language list of what was left out, so the
 * editor can tell the person exactly what will not be sent.
 */
export function sanitizeEmailHtmlWithReport(input: string | null | undefined): { html: string; removed: string[] } {
  const removed: Removed = new Set();
  const html = String(input ?? "");
  if (!html.trim()) return { html: "", removed: [] };
  let out = "";
  let last = 0;
  let discardUntil: string | null = null;
  let discardDepth = 0;
  const open: string[] = [];
  for (const match of html.matchAll(TOKEN_PATTERN)) {
    const index = match.index ?? 0;
    const textBefore = html.slice(last, index);
    last = index + match[0].length;
    if (!discardUntil) out += escapeText(textBefore);
    const tagName = match[1]?.toLowerCase();
    if (!tagName) {
      // Comment, doctype, CDATA or processing instruction.
      if (!discardUntil) removed.add(match[0].startsWith("<!--") ? "comments" : "document declarations");
      continue;
    }
    const closing = match[0][1] === "/";
    if (discardUntil) {
      if (tagName === discardUntil) discardDepth += closing ? -1 : 1;
      if (discardDepth === 0) discardUntil = null;
      continue;
    }
    if (DISCARD_WITH_CONTENT.has(tagName)) {
      if (!closing) removed.add(`<${tagName}> and its contents`);
      const selfClosing = /\/>$/.test(match[0]) || VOID_TAGS.has(tagName) || ["link", "meta", "base"].includes(tagName);
      if (!closing && !selfClosing) {
        discardUntil = tagName;
        discardDepth = 1;
      }
      continue;
    }
    if (!ALLOWED_TAGS.has(tagName)) {
      // Drop the tag, keep its text.
      if (!closing) removed.add(`<${tagName}> tag (its text is kept)`);
      continue;
    }
    if (closing) {
      const at = open.lastIndexOf(tagName);
      if (at < 0) continue;
      // Close anything left open inside it, so markup stays balanced.
      while (open.length > at) out += `</${open.pop()}>`;
      continue;
    }
    out += `<${tagName}${sanitizeAttributes(tagName, match[2] ?? "", removed)}>`;
    if (!VOID_TAGS.has(tagName)) open.push(tagName);
  }
  if (!discardUntil) out += escapeText(html.slice(last));
  while (open.length) out += `</${open.pop()}>`;
  return { html: out, removed: Array.from(removed) };
}
