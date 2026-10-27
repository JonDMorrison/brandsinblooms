const STORE_FIELDS: Record<string, string> = {
  name: "name",
  phone: "phone",
  address: "address",
  email: "email",
  website: "website",
  url: "website",
};
/** Canonical aliases preserve explicit fallback text and work on both render paths. */
export function normalizeStoreMergeFields(value: string): string {
  return value.replace(
    /\{\{\s*store\.([a-z]+)(\s*(?:\|\s*default:\s*["'][^"']*["'])?)\s*\}\}/gi,
    (whole, field: string, suffix: string) =>
      STORE_FIELDS[field.toLowerCase()]
        ? `{{ company.${STORE_FIELDS[field.toLowerCase()]}${suffix} }}`
        : whole,
  );
}
