/**
 * Lightspeed X-Series, pinned legacy product model (API 2.0).
 *
 * Source lanes stay separate: product records supply identity, SKU and price;
 * only a dedicated inventory read supplies outlet quantities. In particular,
 * inventory embedded in product.update is NOT used as current availability.
 * Source: https://x-series-api.lightspeedhq.com/docs/webhooks
 * New 2026-10 family/member payloads must use their own explicit decoder.
 */
export type SourceRecord = Record<string, unknown>;
export type LightspeedTaxBasis = "exclusive" | "inclusive";
export type LightspeedIssue =
  | "missing_name" | "missing_sku" | "invalid_price" | "unknown_active_state"
  | "unknown_inventory_tracking" | "invalid_variant_options";

export interface LightspeedProduct {
  externalId: string;
  groupId: string;
  name: string | null;
  sku: string | null;
  description: string | null;
  priceMinor: number | null;
  currency: string;
  taxBasis: LightspeedTaxBasis;
  active: boolean | null;
  trackInventory: boolean | null;
  variantOptions: Record<string, string>;
  departmentCode: string | null;
  departmentName: string | null;
  supplierCode: string | null;
  supplierItemNumber: string | null;
  imageUrls: string[];
  barcodes: string[];
  version: string | null;
  issues: LightspeedIssue[];
  raw: SourceRecord;
}

export interface LightspeedInventory {
  externalId: string;
  outletId: string;
  onHand: number;
  observedAt: string;
  version: string | null;
}

export class LightspeedShapeError extends Error {
  constructor(readonly code: string) {
    super(`Lightspeed returned an unsupported or incomplete ${code}.`);
    this.name = "LightspeedShapeError";
  }
}

export function asSourceRecord(value: unknown): SourceRecord | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as SourceRecord : null;
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim() : null;
}

export function sourceId(value: unknown): string | null {
  const s = text(value);
  if (s && s.length <= 200 && !/[\u0000-\u001f\u007f]/.test(s)) return s;
  if (typeof value === "number" && Number.isSafeInteger(value) && value >= 0) {
    return String(value);
  }
  return null;
}

/** Version cursors are int64: never round them through Number/parseInt. */
export function versionCursor(value: unknown): string | null {
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value) || value < 0) {
      throw new LightspeedShapeError("version_cursor");
    }
    return String(value);
  }
  if (value == null || value === "") return null;
  if (typeof value !== "string" || !/^\d{1,19}$/.test(value)) {
    throw new LightspeedShapeError("version_cursor");
  }
  const n = BigInt(value);
  if (n > BigInt("9223372036854775807")) throw new LightspeedShapeError("version_cursor");
  return n.toString();
}

/** Exact two-decimal prices. A missing/invalid price is never a free product. */
export function priceToMinor(value: unknown): number | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  if (typeof value === "number" && !Number.isFinite(value)) return null;
  const raw = String(value).trim();
  const match = /^(\d{1,10})(?:\.(\d{1,8}))?$/.exec(raw);
  if (!match) return null;
  const fraction = match[2] ?? "";
  if (/[^0]/.test(fraction.slice(2))) return null;
  const minor = BigInt(match[1]) * BigInt(100) + BigInt((fraction + "00").slice(0, 2));
  if (minor > BigInt(Number.MAX_SAFE_INTEGER)) return null;
  return Number(minor);
}

function httpsImage(value: unknown): string | null {
  const raw = text(value);
  if (!raw) return null;
  try {
    const url = new URL(raw);
    return url.protocol === "https:" && !url.username && !url.password
      ? url.toString() : null;
  } catch { return null; }
}

/** Requires retailer currency and the site's confirmed tax basis; no USD default. */
export function normalizeLightspeedProduct(
  value: unknown,
  config: { currency: string; taxBasis: LightspeedTaxBasis },
): LightspeedProduct {
  const raw = asSourceRecord(value);
  if (!raw) throw new LightspeedShapeError("product");
  if (!/^[A-Z]{3}$/.test(config.currency) || !["exclusive", "inclusive"].includes(config.taxBasis)) {
    throw new LightspeedShapeError("retailer_currency_or_tax_basis");
  }
  // These currencies have two minor-unit digits. Others need a currency-aware decoder.
  if (!["CAD", "USD", "EUR", "GBP", "AUD", "NZD"].includes(config.currency)) {
    throw new LightspeedShapeError("currency_minor_units");
  }
  // Legacy 2.0 can also carry family_id; only the new structural objects identify
  // the incompatible codec. See the official 2026-10 migration guide.
  if (asSourceRecord(raw.active) || asSourceRecord(raw.prices)) {
    throw new LightspeedShapeError("product_api_version");
  }
  const externalId = sourceId(raw.id);
  if (!externalId) throw new LightspeedShapeError("product_id");
  const issues: LightspeedIssue[] = [];
  const name = text(raw.name);
  // A numeric SKU cannot preserve leading zeros; do not pretend it can.
  const sku = text(raw.sku);
  if (!name) issues.push("missing_name");
  if (!sku) issues.push("missing_sku");
  const priceMinor = priceToMinor(config.taxBasis === "exclusive"
    ? raw.price_excluding_tax : raw.price_including_tax);
  if (priceMinor === null) issues.push("invalid_price");
  const flags = [raw.is_active, raw.active].filter((v): v is boolean => typeof v === "boolean");
  const active = raw.deleted_at != null ? false
    : flags.includes(false) ? false : flags.includes(true) ? true : null;
  if (active === null) issues.push("unknown_active_state");
  const trackInventory = typeof raw.has_inventory === "boolean" ? raw.has_inventory : null;
  if (trackInventory === null) issues.push("unknown_inventory_tracking");

  const variantOptions: Record<string, string> = Object.create(null) as Record<string, string>;
  const options = raw.variant_options;
  if (options != null && !Array.isArray(options)) issues.push("invalid_variant_options");
  for (const option of Array.isArray(options) ? options : []) {
    const row = asSourceRecord(option);
    const key = text(row?.name);
    const optionValue = text(row?.value);
    if (!key || !optionValue || key.length > 100 || optionValue.length > 200 ||
        ["__proto__", "constructor", "prototype"].includes(key) || key in variantOptions) {
      if (!issues.includes("invalid_variant_options")) issues.push("invalid_variant_options");
      continue;
    }
    variantOptions[key] = optionValue;
  }
  const imageUrls = new Set<string>();
  const mainImage = httpsImage(raw.image_url);
  if (mainImage) imageUrls.add(mainImage);
  for (const image of Array.isArray(raw.images) ? raw.images : []) {
    const row = asSourceRecord(image);
    const url = httpsImage(typeof image === "string" ? image : row?.url);
    if (url) imageUrls.add(url);
  }
  const barcodes = new Set<string>();
  for (const code of Array.isArray(raw.product_codes) ? raw.product_codes : []) {
    const row = asSourceRecord(code);
    const codeText = text(row?.code);
    if (codeText && ["UPC", "EAN", "ISBN", "CUSTOM"].includes(String(row?.type).toUpperCase())) {
      barcodes.add(codeText);
    }
  }
  const type = asSourceRecord(raw.product_type);
  const supplier = asSourceRecord(raw.supplier);
  return {
    externalId,
    // Never group by name. Identical names can be different plants/SKUs.
    groupId: sourceId(raw.variant_parent_id) ?? externalId,
    name, sku, description: text(raw.description), priceMinor, currency: config.currency,
    taxBasis: config.taxBasis, active, trackInventory, variantOptions,
    departmentCode: sourceId(raw.product_type_id) ?? sourceId(type?.id),
    departmentName: text(type?.name) ?? text(raw.product_type) ?? text(raw.category_name),
    supplierCode: sourceId(raw.supplier_id) ?? sourceId(supplier?.id),
    supplierItemNumber: text(raw.supplier_code),
    imageUrls: [...imageUrls], barcodes: [...barcodes],
    version: versionCursor(raw.version), issues, raw,
  };
}

/** Dedicated legacy inventory rows only; not an embedded product-update payload. */
export function normalizeLightspeedInventory(
  value: unknown,
  observedAt: string,
): LightspeedInventory {
  const row = asSourceRecord(value);
  const externalId = sourceId(row?.product_id);
  const outletId = sourceId(row?.outlet_id);
  if (!row || !externalId || !outletId || !Number.isFinite(Date.parse(observedAt))) {
    throw new LightspeedShapeError("outlet_inventory");
  }
  const count = row.count;
  if ((typeof count !== "string" && typeof count !== "number") ||
      !/^-?\d+(\.\d+)?$/.test(String(count)) || !Number.isFinite(Number(count)) ||
      Math.abs(Number(count)) > Number.MAX_SAFE_INTEGER) {
    throw new LightspeedShapeError("inventory_count");
  }
  return { externalId, outletId, onHand: Number(count), observedAt,
    version: versionCursor(row.version) };
}

export interface LightspeedAvailability {
  canPublishForSale: boolean;
  onHand: number | null;
  locations: Array<{ outletId: string; onHand: number }>;
  reasons: string[];
}

/** A source record is not purchasable until explicit locations and fresh stock agree. */
export function resolveLightspeedAvailability(input: {
  product: LightspeedProduct;
  inventory: readonly LightspeedInventory[];
  mappedOutletIds: readonly string[];
  now: number;
  maxAgeMs: number;
  allowUntracked?: boolean;
  allowFree?: boolean;
}): LightspeedAvailability {
  if (!Number.isFinite(input.now) || !Number.isFinite(input.maxAgeMs) || input.maxAgeMs <= 0) {
    throw new LightspeedShapeError("inventory_freshness_configuration");
  }
  const reasons: string[] = [...input.product.issues];
  if (input.product.active !== true) reasons.push("product_not_active");
  if (input.product.priceMinor === 0 && !input.allowFree) reasons.push("free_price_requires_approval");
  const outlets = [...new Set(input.mappedOutletIds)];
  if (outlets.length === 0) reasons.push("locations_not_mapped");
  if (input.product.trackInventory === false && !input.allowUntracked) {
    reasons.push("untracked_stock_requires_approval");
  }
  const locations: Array<{ outletId: string; onHand: number }> = [];
  if (input.product.trackInventory !== false || !input.allowUntracked) {
    for (const outletId of outlets) {
      const rows = input.inventory.filter(r => r.externalId === input.product.externalId && r.outletId === outletId);
      if (rows.length !== 1) { reasons.push(rows.length ? "ambiguous_outlet_stock" : "unknown_outlet_stock"); continue; }
      const row = rows[0];
      const observed = Date.parse(row.observedAt);
      if (!Number.isFinite(observed) || observed > input.now + 60_000 || input.now - observed > input.maxAgeMs) {
        reasons.push("stale_outlet_stock"); continue;
      }
      if (!Number.isSafeInteger(row.onHand)) {
        reasons.push("fractional_units_require_configuration"); continue;
      }
      locations.push({ outletId, onHand: Math.max(0, row.onHand) });
    }
  }
  const unknown = reasons.some(r => ["ambiguous_outlet_stock", "unknown_outlet_stock", "stale_outlet_stock", "fractional_units_require_configuration", "locations_not_mapped"].includes(r));
  let onHand = input.product.trackInventory === false || unknown ? null
    : locations.reduce((sum, row) => sum + row.onHand, 0);
  if (onHand !== null && !Number.isSafeInteger(onHand)) {
    reasons.push("inventory_quantity_overflow");
    onHand = null;
  }
  if (onHand === 0) reasons.push("out_of_stock");
  return { canPublishForSale: reasons.length === 0, onHand, locations,
    reasons: [...new Set(reasons)] };
}
