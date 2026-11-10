type JsonRecord = Record<string, unknown>;

const DISPLAY_ONLY_KEYS = new Set([
  "subtype",
  "segment_name",
  "persona_name",
  "form_name",
]);

function asRecord(value: unknown): JsonRecord | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : null;
}

function normalizedStrings(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.flatMap(normalizedStrings);
  }
  if (typeof value === "number") return [String(value)];
  if (typeof value !== "string") return [];
  return value
    .split(",")
    .map((part) => part.trim().toLocaleLowerCase())
    .filter(Boolean);
}

function itemValues(eventData: JsonRecord, keys: string[]): string[] {
  const direct = keys.flatMap((key) => normalizedStrings(eventData[key]));
  const items = Array.isArray(eventData.items) ? eventData.items : [];
  return [
    ...direct,
    ...items.flatMap((item) => {
      const record = asRecord(item);
      return record
        ? keys.flatMap((key) => normalizedStrings(record[key]))
        : [];
    }),
  ];
}

function matchesText(configured: unknown, actual: string[]): boolean {
  const expected = normalizedStrings(configured);
  if (!expected.length || !actual.length) return false;
  return expected.some((needle) =>
    actual.some((candidate) => candidate.includes(needle)),
  );
}

function matchesExact(configured: unknown, actual: unknown): boolean {
  const expected = normalizedStrings(configured);
  const candidates = normalizedStrings(actual);
  return (
    expected.length > 0 && expected.some((value) => candidates.includes(value))
  );
}

/**
 * Match persisted automation trigger conditions against one provider event.
 * Unknown conditions fail closed so adding a new builder field cannot silently
 * broaden an automation's audience before the executor understands it.
 */
export function matchesAutomationTriggerConditions(
  rawConditions: unknown,
  eventData: JsonRecord,
): boolean {
  const conditions = asRecord(rawConditions);
  if (!conditions || Object.keys(conditions).length === 0) return true;

  const products = itemValues(eventData, [
    "product_name",
    "name",
    "title",
    "product",
    "products",
    "product_names",
  ]);
  const categories = itemValues(eventData, [
    "category",
    "category_name",
    "product_category",
    "product_categories",
    "product_type",
  ]);
  const skus = itemValues(eventData, ["sku", "skus", "variation_sku"]);

  for (const [key, configured] of Object.entries(conditions)) {
    if (DISPLAY_ONLY_KEYS.has(key) || configured == null || configured === "") {
      continue;
    }

    if (
      ["product_match", "product", "product_name", "product_names"].includes(
        key,
      )
    ) {
      if (!matchesText(configured, products)) return false;
      continue;
    }
    if (
      [
        "category_match",
        "category",
        "product_category",
        "product_categories",
      ].includes(key)
    ) {
      if (!matchesText(configured, categories)) return false;
      continue;
    }
    if (["sku", "skus"].includes(key)) {
      if (!matchesExact(configured, skus)) return false;
      continue;
    }
    if (key === "min_order_amount") {
      const amount = Number(eventData.order_amount);
      if (!Number.isFinite(amount) || amount < Number(configured)) return false;
      continue;
    }
    if (key === "max_order_amount") {
      const amount = Number(eventData.order_amount);
      if (!Number.isFinite(amount) || amount > Number(configured)) return false;
      continue;
    }
    if (["segment_id", "persona_id", "form_id", "form_ids"].includes(key)) {
      if (!matchesExact(configured, eventData[key])) return false;
      continue;
    }

    if (!(key in eventData) || !matchesExact(configured, eventData[key])) {
      return false;
    }
  }

  return true;
}
