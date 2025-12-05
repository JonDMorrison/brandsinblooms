export type FieldType = 'string' | 'number' | 'date' | 'boolean';
export type FieldTarget = 'column' | 'custom';

export type FieldDefinition = {
  key: string;         // internal key, e.g. "lifetime_value"
  label: string;       // human readable label for UI
  target: FieldTarget; // 'column' or 'custom'
  column?: string;     // database column name if target === 'column'
  type: FieldType;
};

export const CUSTOMER_FIELDS: FieldDefinition[] = [
  // Core identity
  { key: 'email', label: 'Email', target: 'column', column: 'email', type: 'string' },
  { key: 'first_name', label: 'First Name', target: 'column', column: 'first_name', type: 'string' },
  { key: 'last_name', label: 'Last Name', target: 'column', column: 'last_name', type: 'string' },

  // Financial and visit info
  { key: 'lifetime_value', label: 'Lifetime Value', target: 'column', column: 'lifetime_value', type: 'number' },
  { key: 'first_purchase_date', label: 'First Purchase Date', target: 'column', column: 'first_purchase_date', type: 'date' },
  { key: 'last_purchase_date', label: 'Last Purchase Date', target: 'column', column: 'last_purchase_date', type: 'date' },

  // Marketing consent
  { key: 'email_opt_in', label: 'Email Opt-In', target: 'column', column: 'email_opt_in', type: 'boolean' },

  // True custom fields - stored in custom_fields jsonb
  { key: 'date_of_birth', label: 'Birthday', target: 'custom', type: 'string' },
  { key: 'company_name', label: 'Company Name', target: 'custom', type: 'string' },
  { key: 'address_line1', label: 'Address Line 1', target: 'custom', type: 'string' },
  { key: 'address_line2', label: 'Address Line 2', target: 'custom', type: 'string' },
  { key: 'city', label: 'City', target: 'custom', type: 'string' },
  { key: 'state', label: 'State / Province', target: 'custom', type: 'string' },
  { key: 'postal_code', label: 'Postal Code', target: 'custom', type: 'string' },

  // Extra Square/Mailchimp metadata we want to preserve
  { key: 'reference_id', label: 'Reference ID', target: 'custom', type: 'string' },
  { key: 'square_customer_id', label: 'Square Customer ID', target: 'custom', type: 'string' },
  { key: 'creation_source', label: 'Creation Source', target: 'custom', type: 'string' },
  { key: 'transaction_count', label: 'Transaction Count', target: 'custom', type: 'number' },
  { key: 'memo', label: 'Memo', target: 'custom', type: 'string' },
  { key: 'instant_profile', label: 'Instant Profile', target: 'custom', type: 'string' },
];

export const customerFieldByKey = Object.fromEntries(
  CUSTOMER_FIELDS.map((f) => [f.key, f])
) as Record<string, FieldDefinition>;

export function parseValue(type: FieldType, raw: unknown): string | number | boolean | null {
  if (raw === null || raw === undefined) return null;
  const value = String(raw).trim();
  if (!value) return null;

  if (type === 'number') {
    // strip currency symbols and commas
    const cleaned = value.replace(/[^0-9.-]/g, '');
    if (!cleaned) return null;
    const num = Number(cleaned);
    return Number.isNaN(num) ? null : num;
  }

  if (type === 'date') {
    // basic date parsing; CSV already mostly uses YYYY-MM-DD
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return null;
    return d.toISOString().slice(0, 10); // YYYY-MM-DD
  }

  if (type === 'boolean') {
    const lower = value.toLowerCase();
    // For Email Subscription Status in Christine's CSV:
    // "subscribed" => true, everything else => false
    if (['subscribed', 'yes', 'true', 'y', '1'].includes(lower)) return true;
    return false;
  }

  // string
  return value;
}

export function applyField(
  customer: Record<string, unknown>,
  fieldKey: string,
  raw: unknown
): void {
  const def = customerFieldByKey[fieldKey];
  if (!def) return;

  const parsed = parseValue(def.type, raw);
  if (parsed === null || parsed === undefined) return;

  if (def.target === 'column' && def.column) {
    if (customer[def.column] == null || customer[def.column] === '') {
      customer[def.column] = parsed;
    }
  } else {
    if (!customer.custom_fields || typeof customer.custom_fields !== 'object') {
      customer.custom_fields = {};
    }
    const customFields = customer.custom_fields as Record<string, unknown>;
    if (
      customFields[fieldKey] === undefined ||
      customFields[fieldKey] === null ||
      customFields[fieldKey] === ''
    ) {
      customFields[fieldKey] = parsed;
    }
  }
}
