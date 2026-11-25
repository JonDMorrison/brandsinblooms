// Single-colour social icon PNGs for email. Email clients do not render SVG
// and ignore CSS filters, so every style and colour is served as a real PNG.
// Masks come from api/_lib/socialIconMasks.js (generated, Simple Icons CC0).
import { deflateSync, inflateSync } from "node:zlib";
import { MASKS, MASK_SIZE } from "./socialIconMasks.js";

export const SOCIAL_ICON_PLATFORMS = [
  "facebook",
  "instagram",
  "twitter",
  "linkedin",
  "youtube",
  "tiktok",
  "pinterest",
  "threads",
];
export const SOCIAL_ICON_STYLES = ["filled", "square", "outlined", "minimal"];

const maskCache = new Map();
function mask(name) {
  let value = maskCache.get(name);
  if (!value) {
    value = inflateSync(Buffer.from(MASKS[name], "base64"));
    maskCache.set(name, value);
  }
  return value;
}

export function parseSocialIconRequest(platform, style, color) {
  const p = String(platform ?? "").toLowerCase();
  const s = String(style ?? "").toLowerCase();
  const c = String(color ?? "").replace(/^#/, "").replace(/\.png$/i, "").toLowerCase();
  if (!SOCIAL_ICON_PLATFORMS.includes(p)) return null;
  if (!SOCIAL_ICON_STYLES.includes(s)) return null;
  if (!/^[0-9a-f]{6}$/.test(c)) return null;
  return { platform: p, style: s, color: c };
}

/** RGBA pixels for one icon: the glyph in `color`, or a `color` shape with a white glyph. */
export function composeSocialIcon({ platform, style, color }) {
  const r = parseInt(color.slice(0, 2), 16);
  const g = parseInt(color.slice(2, 4), 16);
  const b = parseInt(color.slice(4, 6), 16);
  const n = MASK_SIZE * MASK_SIZE;
  const out = Buffer.alloc(n * 4);

  if (style === "minimal" || style === "outlined") {
    const glyph = mask(style === "minimal" ? `glyph:${platform}` : `inner:${platform}`);
    const ring = style === "outlined" ? mask("ring") : null;
    for (let i = 0; i < n; i += 1) {
      const a = ring ? Math.max(glyph[i], ring[i]) : glyph[i];
      out[i * 4] = r;
      out[i * 4 + 1] = g;
      out[i * 4 + 2] = b;
      out[i * 4 + 3] = a;
    }
    return out;
  }

  // Filled (circle) and square: a solid shape in the colour, white glyph on top.
  const shape = mask(style === "square" ? "tile" : "disc");
  const inner = mask(`inner:${platform}`);
  for (let i = 0; i < n; i += 1) {
    const w = inner[i] / 255;
    out[i * 4] = Math.round(r + (255 - r) * w);
    out[i * 4 + 1] = Math.round(g + (255 - g) * w);
    out[i * 4 + 2] = Math.round(b + (255 - b) * w);
    out[i * 4 + 3] = shape[i];
  }
  return out;
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buffer) {
  let c = 0xffffffff;
  for (const byte of buffer) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

/** Encodes 8-bit RGBA pixels as a PNG (no filtering; zlib does the work). */
export function encodePng(rgba, width = MASK_SIZE, height = MASK_SIZE) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8; // bit depth
  header[9] = 6; // RGBA
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * (width * 4 + 1)] = 0;
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const pngCache = new Map();
export function renderSocialIconPng(request) {
  const key = `${request.platform}/${request.style}/${request.color}`;
  let png = pngCache.get(key);
  if (!png) {
    png = encodePng(composeSocialIcon(request));
    if (pngCache.size > 500) pngCache.clear();
    pngCache.set(key, png);
  }
  return png;
}
