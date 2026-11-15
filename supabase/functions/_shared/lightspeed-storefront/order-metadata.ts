import { asSourceRecord, versionCursor, type SourceRecord } from "./normalize.ts";

// Official X-Series 2026-10 list endpoints. Keep provider credentials and arbitrary
// payment configuration, user email, permissions and security fields private.
export const ORDER_METADATA_SCOPES = {
  registers: "registers:read", users: "users:read",
  payment_types: "payment_types:read", taxes: "taxes:read",
} as const;
export type OrderMetadataResource = keyof typeof ORDER_METADATA_SCOPES;
export function orderMetadataResource(value: unknown): value is OrderMetadataResource {
  return typeof value === "string" && Object.hasOwn(ORDER_METADATA_SCOPES, value);
}
function pick(row: SourceRecord, fields: readonly string[]): SourceRecord {
  return Object.fromEntries(fields.filter(key => Object.hasOwn(row, key)).map(key => {
    const value = row[key];
    const safe = value === null || typeof value === "boolean" ||
      (typeof value === "number" && Number.isFinite(value)) ||
      (typeof value === "string" && value.length <= 256) ||
      (["outlet_ids", "restricted_outlet_ids"].includes(key) && Array.isArray(value) &&
        value.length <= 200 && value.every(id => typeof id === "string" && id.length <= 64));
    if (!safe) throw new Error("invalid_metadata_field");
    return [key, value];
  }));
}
export function projectOrderMetadata(resource: OrderMetadataResource, payload: unknown, after: string | null) {
  const page = asSourceRecord(payload);
  if (!page || !Array.isArray(page.data) || page.data.length > 200) throw new Error("invalid_metadata_page");
  const records = page.data.map(value => {
    const row = asSourceRecord(value);
    if (!row || typeof row.id !== "string" || !row.id) throw new Error("invalid_metadata_record");
    if (resource === "registers") return pick(row, ["id", "name", "outlet_id", "is_open", "deleted_at"]);
    if (resource === "users") return pick(row, ["id", "display_name", "username", "enabled", "deleted_at", "restricted_outlet_ids"]);
    if (resource === "payment_types") {
      const result = pick(row, ["id", "name", "type_id", "disabled", "gateway", "internal", "deleted_at", "outlet_ids"]);
      const type = asSourceRecord(row.payment_type);
      if (type) result.payment_type = pick(type, ["id", "name", "category", "subcategory", "internal", "online_only"]);
      return result;
    }
    const result = pick(row, ["id", "name", "display_name", "is_default", "deleted_at"]);
    if (!Array.isArray(row.rates)) throw new Error("invalid_metadata_tax_rates");
    result.rates = row.rates.map(value => {
      const rate = asSourceRecord(value);
      if (!rate) throw new Error("invalid_metadata_tax_rate");
      const projected = pick(rate, ["id", "name", "display_name", "rate"]);
      if (Array.isArray(rate.rules)) projected.rules = rate.rules.map(value => {
        const rule = asSourceRecord(value);
        if (!rule) throw new Error("invalid_metadata_tax_rule");
        return pick(rule, ["tax_code", "type", "value"]);
      });
      return projected;
    });
    return result;
  });
  // Continue until an empty page, not a guessed short-page termination. Require
  // a strictly advancing cursor so a malformed provider response cannot loop.
  const nextCursor = records.length ? versionCursor(asSourceRecord(page.version)?.max) : null;
  if (records.length && (nextCursor === null || (after !== null && BigInt(nextCursor) <= BigInt(after))))
    throw new Error("invalid_metadata_cursor");
  return { records, nextCursor, complete: records.length === 0 };
}
