/**
 * Turns spreadsheet rows into the customer payloads that the
 * `import_crm_customer_batch` RPC accepts.
 *
 * Shared by the CRM import dialog and Bloom chat's server-side import
 * (supabase/functions/bloom-assist), so both apply the same column rules,
 * email check and in-file de-duplication. Dependency-free on purpose: the
 * edge runtime imports this file directly.
 */

import {
  applyCustomImportField,
  applyField,
  CUSTOMER_FIELDS,
  inferCustomFieldType,
  normalizeCustomFieldKey,
} from "./customerImportSchema.ts";

/** Fields the import accepts beyond CUSTOMER_FIELDS (handled below). */
export const EXTRA_IMPORT_FIELDS = [
  "phone",
  "sms_opt_in",
  "tags",
  "persona",
  "notes",
] as const;

export const IMPORT_FIELD_ALIASES: Record<string, string> = {
  email_address: "email",
  e_mail: "email",
  e_mail_address: "email",
  emailaddress: "email",
  email_addr: "email",
  primary_email: "email",
  contact_email: "email",
  customer_email: "email",
  given_name: "first_name",
  surname: "last_name",
  family_name: "last_name",
  mobile_phone: "phone",
  mobile_number: "phone",
  cell: "phone",
  cell_phone: "phone",
  telephone: "phone",
  phone_1: "phone",
  zip: "postal_code",
  zip_code: "postal_code",
  postcode: "postal_code",
  firstname: "first_name",
  first: "first_name",
  lastname: "last_name",
  last: "last_name",
  mobile: "phone",
  phone_number: "phone",
  interests: "tags",
  labels: "tags",
  text_opt_in: "sms_opt_in",
  sms_consent: "sms_opt_in",
};

/** Deterministic header → field match. Unknown headers become custom fields. */
export function getDefaultImportField(header: string): string {
  const key = normalizeCustomFieldKey(header);
  const known = CUSTOMER_FIELDS.find(
    (field) =>
      field.key === key || normalizeCustomFieldKey(field.label) === key,
  );

  return known?.key || IMPORT_FIELD_ALIASES[key] || `custom:${key}`;
}

/**
 * True for a field the import knows how to write: "skip", a schema field, one
 * of EXTRA_IMPORT_FIELDS, or `custom:<normalized key>`.
 */
export function isAllowedImportField(field: string): boolean {
  if (field === "skip") return true;
  if (CUSTOMER_FIELDS.some((definition) => definition.key === field)) {
    return true;
  }
  if ((EXTRA_IMPORT_FIELDS as readonly string[]).includes(field)) return true;
  if (field.startsWith("custom:")) {
    const key = field.slice("custom:".length);
    return key.length > 0 && normalizeCustomFieldKey(key) === key;
  }
  return false;
}

export function isValidImportEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export interface ImportColumnMapping {
  csvHeader: string;
  databaseField: string;
  sampleData: string[];
  sourceIndex?: number;
}

export interface InvalidEmailRow {
  /** 1-based data row number (the header row is not counted). */
  row: number;
  value: string;
}

export interface BuiltImportCustomers {
  /** One payload per distinct email, in first-seen order. */
  customers: Array<Record<string, unknown>>;
  /** Data rows dropped because the email was missing or malformed. */
  invalidEmailRows: InvalidEmailRow[];
  /** Rows folded into an earlier row with the same email. */
  duplicatesMerged: number;
  /** Emails that appeared more than once in the file. */
  duplicateEmails: string[];
}

export function buildImportCustomers(
  dataRows: unknown[][],
  columnMappings: ImportColumnMapping[],
): BuiltImportCustomers {
  const customers: Array<Record<string, unknown>> = [];
  const invalidEmailRows: InvalidEmailRow[] = [];
  const emailMappingIndex = columnMappings.findIndex(
    (m) => m.databaseField === "email",
  );
  const emailMapping = columnMappings[emailMappingIndex];

  dataRows.forEach((row, rowIndex) => {
    const rawEmail = emailMapping
      ? row[emailMapping.sourceIndex ?? emailMappingIndex]
      : null;
    const email = rawEmail ? String(rawEmail).trim().toLowerCase() : "";

    if (!email || !isValidImportEmail(email)) {
      invalidEmailRows.push({
        row: rowIndex + 1,
        value: rawEmail ? String(rawEmail).trim() : "",
      });
      return;
    }

    const customer: Record<string, unknown> = {
      email,
      custom_fields: {},
    };

    columnMappings.forEach((mapping, index) => {
      const raw = row[mapping.sourceIndex ?? index];
      const fieldKey = mapping.databaseField;

      if (fieldKey === "skip" || fieldKey === "email") {
        return;
      }

      if (fieldKey.startsWith("custom:")) {
        applyCustomImportField(
          customer,
          fieldKey.slice("custom:".length),
          raw,
          inferCustomFieldType(mapping.csvHeader, mapping.sampleData),
        );
        return;
      }

      // Schema-defined fields
      applyField(customer, fieldKey, raw);

      // Fields not in the schema (phone, tags, persona, sms_opt_in, notes)
      const value = raw ? String(raw).trim() : "";
      if (!value) return;

      if (fieldKey === "email_opt_in") {
        customer.email_opt_in_explicit = true;
      }

      switch (fieldKey) {
        case "phone":
          customer.phone = value.replace(/\D/g, "");
          break;
        case "tags":
          customer.tags = value
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean);
          break;
        case "persona":
          customer.persona = value;
          break;
        case "sms_opt_in":
          customer.sms_opt_in = [
            "true",
            "1",
            "yes",
            "y",
            "subscribed",
            "opted-in",
            "opted_in",
          ].includes(value.toLowerCase());
          customer.sms_opt_in_explicit = true;
          break;
        case "notes":
          (customer.custom_fields as Record<string, unknown>).notes = value;
          break;
      }
    });

    customers.push(customer);
  });

  // De-duplicate by email and merge non-empty values into the first row.
  const customerMap = new Map<string, Record<string, unknown>>();
  const duplicateEmails = new Set<string>();
  for (const customer of customers) {
    const email = String(customer.email).toLowerCase();
    const existing = customerMap.get(email);
    if (!existing) {
      customerMap.set(email, customer);
      continue;
    }
    duplicateEmails.add(email);
    for (const [key, value] of Object.entries(customer)) {
      if (value === null || value === undefined || value === "") continue;
      if (key === "custom_fields" && typeof value === "object") {
        // Same rule as the other fields: the first row wins, later rows only fill blanks.
        existing.custom_fields = {
          ...(value as Record<string, unknown>),
          ...((existing.custom_fields as Record<string, unknown>) || {}),
        };
      } else if (
        existing[key] === null ||
        existing[key] === undefined ||
        existing[key] === ""
      ) {
        existing[key] = value;
      }
    }
  }

  const deduplicated = Array.from(customerMap.values());
  return {
    customers: deduplicated,
    invalidEmailRows,
    duplicatesMerged: customers.length - deduplicated.length,
    duplicateEmails: Array.from(duplicateEmails),
  };
}
