export interface CustomerExportPage {
  items: Array<Record<string, unknown>>;
  nextCursor: string | null;
  hasMore: boolean;
  pageSize: number;
}

const STANDARD_COLUMNS: Array<[string, string]> = [
  ["id", "Customer ID"],
  ["first_name", "First Name"],
  ["last_name", "Last Name"],
  ["email", "Email"],
  ["phone", "Mobile"],
  ["city", "City"],
  ["state_region", "State / Province"],
  ["postal_code", "Postal / ZIP Code"],
  ["country_code", "Country"],
  ["timezone", "Timezone"],
  ["store_id", "Store ID"],
  ["store_name", "Store Name"],
  ["signup_source", "Signup Source"],
  ["preferred_channel", "Preferred Channel"],
  ["tags", "Tags"],
  ["product_tags", "Product Tags"],
  ["segments", "Segments"],
  ["email_opt_in", "Email Opt In"],
  ["email_consent", "Email Consent"],
  ["email_opt_in_at", "Email Opt In At"],
  ["email_opt_out_at", "Email Opt Out At"],
  ["email_consent_source", "Email Consent Source"],
  ["email_consent_method", "Email Consent Method"],
  ["sms_opt_in", "SMS Opt In"],
  ["sms_consent", "SMS Consent"],
  ["sms_opt_in_at", "SMS Opt In At"],
  ["sms_opt_out_at", "SMS Opt Out At"],
  ["sms_consent_source", "SMS Consent Source"],
  ["sms_consent_method", "SMS Consent Method"],
  ["is_vip", "VIP"],
  ["lifetime_value", "Lifetime Value"],
  ["total_spent", "Total Spend"],
  ["first_purchase_date", "First Purchase"],
  ["last_purchase_date", "Last Purchase"],
  ["pos_order_count", "POS Order Count"],
  ["pos_total_spent", "POS Total Spend"],
  ["pos_source", "POS Source"],
  ["external_id", "Primary POS Customer ID"],
  ["square_customer_id", "Square Customer ID"],
  ["clover_customer_id", "Clover Customer ID"],
  ["linked_pos_identities", "Linked POS Identities"],
  ["loyalty_member", "Loyalty Member"],
  ["loyalty_tier", "Loyalty Tier"],
  ["loyalty_points_balance", "Loyalty Points Balance"],
  ["loyalty_points_earned", "Loyalty Points Earned"],
  ["loyalty_points_redeemed", "Loyalty Points Redeemed"],
  ["loyalty_enrolled_at", "Loyalty Enrolled At"],
  ["created_at", "Created At"],
  ["updated_at", "Updated At"],
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function normalizeCustomerExportPage(
  value: unknown,
): CustomerExportPage {
  if (!isRecord(value)) {
    throw new Error("Customer export returned an invalid page.");
  }

  const items = Array.isArray(value.items) ? value.items.filter(isRecord) : [];
  const nextCursor =
    typeof value.nextCursor === "string" && value.nextCursor
      ? value.nextCursor
      : null;

  return {
    items,
    nextCursor,
    hasMore: value.hasMore === true,
    pageSize:
      typeof value.pageSize === "number" && Number.isFinite(value.pageSize)
        ? value.pageSize
        : items.length,
  };
}

function serializeCell(value: unknown): string | number | boolean {
  if (value == null) return "";
  if (Array.isArray(value)) {
    return value
      .map((item) =>
        item && typeof item === "object" ? JSON.stringify(item) : String(item),
      )
      .join("; ");
  }
  if (typeof value === "object") return JSON.stringify(value);
  return value as string | number | boolean;
}

export function toSafeCsvValue(value: unknown): string {
  const serialized = serializeCell(value);
  let text = String(serialized);

  // Prevent spreadsheet formula execution without changing numeric cells.
  if (typeof serialized === "string" && /^[\t\r ]*[=+\-@]/.test(text)) {
    text = `'${text}`;
  }

  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function buildCustomerExportCsv(
  customers: Array<Record<string, unknown>>,
): string {
  const customFieldKeys = Array.from(
    customers.reduce((keys, customer) => {
      const customFields = customer.custom_fields;
      if (isRecord(customFields)) {
        Object.keys(customFields).forEach((key) => keys.add(key));
      }
      return keys;
    }, new Set<string>()),
  ).sort((left, right) => left.localeCompare(right));

  const headers = [
    ...STANDARD_COLUMNS.map(([, label]) => label),
    ...customFieldKeys.map((key) => `Custom: ${key}`),
  ];
  const lines = [headers.map(toSafeCsvValue).join(",")];

  for (const customer of customers) {
    const customFields = isRecord(customer.custom_fields)
      ? customer.custom_fields
      : {};
    const values = [
      ...STANDARD_COLUMNS.map(([key]) => customer[key]),
      ...customFieldKeys.map((key) => customFields[key]),
    ];
    lines.push(values.map(toSafeCsvValue).join(","));
  }

  return lines.join("\r\n");
}
