export const CUSTOMER_INTEREST_IDS = [
  "houseplants",
  "vegetable_gardening",
  "annuals",
  "perennials",
  "trees_shrubs",
  "native_plants",
  "pollinators",
  "containers",
  "workshops",
  "deals_promotions",
] as const;

export const GARDENING_EXPERIENCE_IDS = [
  "beginner",
  "intermediate",
  "experienced",
] as const;

const INTEREST_IDS = new Set<string>(CUSTOMER_INTEREST_IDS);
const EXPERIENCE_IDS = new Set<string>(GARDENING_EXPERIENCE_IDS);

export function normalizeCustomerInterests(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(
    new Set(
      value.filter(
        (interest): interest is string =>
          typeof interest === "string" && INTEREST_IDS.has(interest),
      ),
    ),
  );
}

export function normalizeGardeningExperience(value: unknown): string | null {
  return typeof value === "string" && EXPERIENCE_IDS.has(value) ? value : null;
}

export function readStoredCustomerPreferences(
  emailOptIn: unknown,
  customFields: unknown,
) {
  const fields =
    customFields &&
    typeof customFields === "object" &&
    !Array.isArray(customFields)
      ? (customFields as Record<string, unknown>)
      : {};

  return {
    emailOptIn: typeof emailOptIn === "boolean" ? emailOptIn : null,
    interests: normalizeCustomerInterests(fields.customer_selected_interests),
    gardeningExperience: normalizeGardeningExperience(
      fields.gardening_experience,
    ),
  };
}
