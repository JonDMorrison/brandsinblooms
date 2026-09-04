import type { CustomerData } from "@/hooks/useCustomerDashboard";

export interface CustomerProfileAttribute {
  key: string;
  label: string;
  value: string;
}

export interface CustomerProfileAttributes {
  interests: string[];
  experience: string | null;
  tags: string[];
  purchaseTags: string[];
  customFields: CustomerProfileAttribute[];
}

const RESERVED_CUSTOM_FIELDS = new Set([
  "interests",
  "gardening_experience",
  "preference_center_source",
  "preference_center_updated_at",
]);

const uniqueLabels = (values: unknown): string[] => {
  if (!Array.isArray(values)) return [];

  return Array.from(
    new Set(
      values
        .filter((value): value is string => typeof value === "string")
        .map((value) => value.trim())
        .filter(Boolean),
    ),
  );
};

const titleize = (value: string) =>
  value
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

const formatCustomValue = (value: unknown): string | null => {
  if (typeof value === "string") return value.trim() || null;
  if (typeof value === "number" && Number.isFinite(value)) {
    return value.toLocaleString();
  }
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (Array.isArray(value)) {
    const values = uniqueLabels(value);
    return values.length ? values.join(", ") : null;
  }
  return null;
};

export function getCustomerProfileAttributes(
  customer: CustomerData,
): CustomerProfileAttributes {
  const customFields =
    customer.custom_fields &&
    typeof customer.custom_fields === "object" &&
    !Array.isArray(customer.custom_fields)
      ? (customer.custom_fields as Record<string, unknown>)
      : {};

  const experience =
    typeof customFields.gardening_experience === "string" &&
    customFields.gardening_experience.trim()
      ? titleize(customFields.gardening_experience.trim())
      : null;

  return {
    interests: uniqueLabels(customFields.interests).map(titleize),
    experience,
    tags: uniqueLabels(customer.tags),
    purchaseTags: uniqueLabels(customer.product_tags),
    customFields: Object.entries(customFields)
      .filter(([key]) => !RESERVED_CUSTOM_FIELDS.has(key) && !key.startsWith("_"))
      .map(([key, value]) => ({
        key,
        label: titleize(key),
        value: formatCustomValue(value),
      }))
      .filter(
        (field): field is CustomerProfileAttribute => field.value !== null,
      )
      .sort((left, right) => left.label.localeCompare(right.label)),
  };
}
