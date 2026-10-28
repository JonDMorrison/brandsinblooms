import type { StudioBlock, GalleryProduct } from "@/types/studioBlocks";
import type { StudioDesignSystem } from "@/lib/studio/designSystem";
import { createStudioBlock } from "@/lib/studio/blockFactory";
import { safeEmailUrl } from "./settings";
export const IMPORT_MAX_BYTES = 2_000_000;
export const IMPORT_MAX_ROWS = 100;
export type ImportRow = Record<string, string>;
export type ImportTarget =
  | "coupon"
  | "product-card"
  | "product-gallery"
  | "image-gallery"
  | "data-table";
export const IMPORT_FIELDS = {
  title: "Title / product name",
  subtitle: "Subtitle / botanical name",
  description: "Description",
  price: "Price",
  originalPrice: "Original price",
  image: "Image URL",
  url: "Website / image link",
  buttonText: "Button label",
  introduction: "Introduction",
  offer: "Offer preset",
  conditions: "Conditions",
  sizing: "Sizing",
  expiry: "Expiry",
  badge: "Badge",
} as const;
export type ImportField = keyof typeof IMPORT_FIELDS;
export type ImportMapping = Partial<Record<ImportField, string>>;
const aliases: Record<ImportField, string[]> = {
  title: ["title", "name", "productname", "commonname"],
  subtitle: ["subtitle", "altname", "botanicalname", "latinname"],
  description: ["description", "desc", "body"],
  price: ["price", "saleprice", "offerprice"],
  originalPrice: ["originalprice", "regularprice", "was"],
  image: ["image", "imageurl", "photo", "photourl"],
  url: ["url", "link", "linkurl", "buttonurl", "producturl"],
  buttonText: ["buttontext", "ctalabel"],
  introduction: ["introduction", "intro", "eyebrow"],
  offer: ["offer", "offerpreset", "discount"],
  conditions: ["conditions", "terms", "restrictions"],
  sizing: ["sizing", "size", "variant"],
  expiry: ["expiry", "expiration", "expires", "expirydate"],
  badge: ["badge", "badgetext"],
};
const headerKey = (value: string) =>
  value.toLowerCase().replace(/[^a-z0-9]/g, "");
export function inferImportMapping(headers: string[]): ImportMapping {
  const mapping: ImportMapping = {};
  for (const field of Object.keys(aliases) as ImportField[]) {
    const match = headers.find((header) =>
      aliases[field].includes(headerKey(header)),
    );
    if (match) mapping[field] = match;
  }
  return mapping;
}
export function rowsFromMatrix(matrix: unknown[][]): ImportRow[] {
  const nonempty = matrix.filter((row) =>
    row.some(
      (cell) => cell !== null && cell !== undefined && String(cell).trim(),
    ),
  );
  if (nonempty.length < 2)
    throw new Error("Include column headings and at least one data row.");
  if (nonempty.length > IMPORT_MAX_ROWS + 1)
    throw new Error(`Import up to ${IMPORT_MAX_ROWS} rows at a time.`);
  const headers = nonempty[0].map(
    (cell, i) => String(cell ?? "").trim() || `Column ${i + 1}`,
  );
  if (headers.length > 30) throw new Error("Use no more than 30 columns.");
  if (new Set(headers).size !== headers.length)
    throw new Error("Column headings must be unique.");
  return nonempty.slice(1).map((row, index) => {
    if (row.length > headers.length)
      throw new Error(`Row ${index + 2} has more values than column headings.`);
    const record: ImportRow = Object.create(null);
    headers.forEach((key, i) => {
      const cell = row[i];
      const value =
        cell instanceof Date
          ? cell.toISOString().slice(0, 10)
          : String(cell ?? "");
      if (value.length > 10000)
        throw new Error(`Row ${index + 2} contains an oversized cell.`);
      record[key] = value;
    });
    return record;
  });
}
export function parseDelimited(input: string, delimiter?: string): ImportRow[] {
  if (new TextEncoder().encode(input).length > IMPORT_MAX_BYTES)
    throw new Error("Keep imports below 2 MB.");
  const source = input.replace(/^\uFEFF/, "");
  const separator =
    delimiter || (source.split(/\r?\n/, 1)[0].includes("\t") ? "\t" : ",");
  const matrix: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < source.length; i++) {
    const char = source[i];
    if (char === '"') {
      if (quoted && source[i + 1] === '"') {
        field += '"';
        i++;
      } else if (!quoted && field.length) {
        field += '"';
      } else quoted = !quoted;
    } else if (!quoted && char === separator) {
      row.push(field);
      field = "";
    } else if (!quoted && (char === "\n" || char === "\r")) {
      if (char === "\r" && source[i + 1] === "\n") i++;
      row.push(field);
      matrix.push(row);
      row = [];
      field = "";
      if (matrix.length > IMPORT_MAX_ROWS + 2)
        throw new Error(`Import up to ${IMPORT_MAX_ROWS} rows at a time.`);
    } else field += char;
  }
  if (quoted)
    throw new Error("A quoted CSV value is missing its closing quote.");
  if (field || row.length) {
    row.push(field);
    matrix.push(row);
  }
  return rowsFromMatrix(matrix);
}
export function parseJsonFeed(input: string): ImportRow[] {
  if (new TextEncoder().encode(input).length > IMPORT_MAX_BYTES)
    throw new Error("Keep imports below 2 MB.");
  let parsed: unknown;
  try {
    parsed = JSON.parse(input);
  } catch {
    throw new Error("The feed is not valid JSON.");
  }
  const rows = Array.isArray(parsed)
    ? parsed
    : parsed && typeof parsed === "object"
      ? (parsed as Record<string, unknown>).items
      : null;
  if (!Array.isArray(rows) || !rows.length || rows.length > IMPORT_MAX_ROWS)
    throw new Error(
      `Provide an array of 1–${IMPORT_MAX_ROWS} objects, or an object with an items array.`,
    );
  if (rows.some((row) => !row || typeof row !== "object" || Array.isArray(row)))
    throw new Error("Each feed item must be an object.");
  const headers = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  return rowsFromMatrix([
    headers,
    ...rows.map((row) =>
      headers.map((key) => {
        const value = (row as Record<string, unknown>)[key];
        if (
          value != null &&
          !["string", "number", "boolean"].includes(typeof value)
        )
          throw new Error("Use plain text or numbers for feed fields.");
        return value ?? "";
      }),
    ),
  ]);
}
export function publicFeedUrl(value: string): string {
  const safe = safeEmailUrl(value);
  if (!safe) throw new Error("Enter a public HTTPS feed URL.");
  const url = new URL(safe);
  const host = url.hostname.toLowerCase().replace(/\.$/, "");
  // A browser fetch uses CORS and no credentials, but must still never target a local device.
  if (
    url.protocol !== "https:" ||
    !host.includes(".") ||
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    host.includes(":") ||
    /^\d+(?:\.\d+){3}$/.test(host)
  )
    throw new Error(
      "Use a public HTTPS hostname, not an IP address or local network URL.",
    );
  return url.href;
}
export async function loadPublicFeed(
  value: string,
  signal?: AbortSignal,
): Promise<ImportRow[]> {
  const response = await fetch(publicFeedUrl(value), {
    credentials: "omit",
    referrerPolicy: "no-referrer",
    redirect: "error",
    signal,
    headers: { Accept: "application/json,text/csv,text/tab-separated-values" },
  });
  if (!response.ok)
    throw new Error(`The feed returned HTTP ${response.status}.`);
  if (Number(response.headers.get("content-length") || 0) > IMPORT_MAX_BYTES)
    throw new Error("Keep feeds below 2 MB.");
  const reader = response.body?.getReader();
  if (!reader) throw new Error("The feed response is empty.");
  let size = 0;
  const chunks: Uint8Array[] = [];
  try {
    while (true) {
      const { done, value: chunk } = await reader.read();
      if (done) break;
      size += chunk.byteLength;
      if (size > IMPORT_MAX_BYTES) {
        await reader.cancel();
        throw new Error("Keep feeds below 2 MB.");
      }
      chunks.push(chunk);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  const text = new TextDecoder().decode(bytes);
  return /^\s*[\[{]/.test(text) ? parseJsonFeed(text) : parseDelimited(text);
}
export function importRowsToBlocks(
  rows: ImportRow[],
  target: ImportTarget,
  mapping: ImportMapping,
  designSystem?: StudioDesignSystem | null,
  columns = 3,
): StudioBlock[] {
  columns = Math.max(
    1,
    Math.min(4, Math.floor(Number.isFinite(columns) ? columns : 3)),
  );
  if (!rows.length || rows.length > IMPORT_MAX_ROWS)
    throw new Error("Choose 1–100 rows to import.");
  const get = (row: ImportRow, key: ImportField) =>
    mapping[key] ? String(row[mapping[key]!] ?? "").trim() : "";
  const checkedUrl = (row: ImportRow, key: "image" | "url", index: number) => {
    const value = get(row, key);
    if (!value) return "";
    const url = safeEmailUrl(value, key === "image");
    if (!url)
      throw new Error(
        `Row ${index + 2}: ${key === "image" ? "image" : "website"} URL must be a complete http or https URL.`,
      );
    return url;
  };
  if (target === "data-table") {
    const headers = Object.keys(rows[0]);
    if (headers.length > 12)
      throw new Error(
        "Data tables support up to 12 columns. Split this sheet into smaller tables before importing.",
      );
    return [
      {
        ...createStudioBlock("data-table", designSystem),
        tableHeaders: headers,
        tableRows: rows.map((row) =>
          headers.map((header) => row[header] || ""),
        ),
      },
    ];
  }
  const entries = rows.map((row, index) => ({
    row,
    image: checkedUrl(row, "image", index),
    url: checkedUrl(row, "url", index),
  }));
  if (target === "image-gallery") {
    return entries.reduce<StudioBlock[]>((blocks, entry, index) => {
      if (index % columns === 0)
        blocks.push({
          ...createStudioBlock("image-gallery", designSystem),
          layout: `row-${columns}`,
          gridColumns: columns,
          galleryImages: [],
        });
      blocks.at(-1)!.galleryImages!.push({
        id: crypto.randomUUID(),
        url: entry.image,
        alt: get(entry.row, "title"),
        caption: get(entry.row, "description"),
        linkUrl: entry.url,
      });
      return blocks;
    }, []);
  }
  if (target === "product-gallery") {
    const products: GalleryProduct[] = entries.map(({ row, image, url }) => ({
      id: crypto.randomUUID(),
      name: get(row, "title"),
      altName: get(row, "subtitle"),
      price: get(row, "price"),
      originalPrice: get(row, "originalPrice"),
      imageUrl: image,
      description: get(row, "description"),
      linkUrl: url,
      buttonUrl: url,
      buttonText: get(row, "buttonText") || "View product",
      badgeText: get(row, "badge"),
    }));
    const blocks: StudioBlock[] = [];
    for (let i = 0; i < products.length; i += columns)
      blocks.push({
        ...createStudioBlock("product-gallery", designSystem),
        layout: `row-${columns}`,
        gridColumns: columns,
        galleryProducts: products.slice(i, i + columns),
      });
    return blocks;
  }
  return entries.map(({ row, image, url }) => {
    const block = createStudioBlock(target, designSystem);
    const title = get(row, "title");
    if (!title)
      throw new Error(
        "Map a title column before importing product or coupon cards.",
      );
    Object.assign(block, {
      label: title,
      headline: title,
      imageUrl: image,
      imageAlt: title,
      linkUrl: url,
      buttonUrl: url,
      buttonText: get(row, "buttonText") || "View offer",
      originalPrice: get(row, "originalPrice"),
      badgeText: get(row, "badge"),
      subheading: get(row, "subtitle"),
    });
    if (target === "product-card")
      Object.assign(block, {
        productName: title,
        productSubtitle: get(row, "subtitle"),
        productDescription: get(row, "description"),
        productPrice: get(row, "price"),
        badgeText: get(row, "badge"),
      });
    else {
      const offer = get(row, "offer").toLowerCase();
      const percent = offer.match(/^(\d+(?:\.\d+)?)\s*%(?:\s*off)?$/);
      if (
        offer &&
        !percent &&
        !["price", "just price", "bogo", "buy one get one free"].includes(offer)
      ) {
        throw new Error(
          `Unrecognized offer “${get(row, "offer")}” for “${title}”. Use a price, percentage (such as 25% off), or BOGO, then configure other offer types in the editor.`,
        );
      }
      Object.assign(block, {
        tagLabel: get(row, "introduction"),
        body: get(row, "description"),
        couponPrice: get(row, "price"),
        couponConditions: get(row, "conditions"),
        couponExpiry: get(row, "expiry"),
        couponSizing: get(row, "sizing"),
        couponOffer: percent
          ? "percent"
          : ["bogo", "buy one get one free"].includes(offer)
            ? "bogo"
            : "price",
        couponPercent: percent ? Math.min(100, Number(percent[1])) : undefined,
      });
    }
    return block;
  });
}
