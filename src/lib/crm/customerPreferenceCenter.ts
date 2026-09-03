export const CUSTOMER_INTEREST_OPTIONS = [
  { id: "houseplants", label: "Houseplants" },
  { id: "vegetable_gardening", label: "Vegetable Gardening" },
  { id: "annuals", label: "Annuals" },
  { id: "perennials", label: "Perennials" },
  { id: "trees_shrubs", label: "Trees & Shrubs" },
  { id: "native_plants", label: "Native Plants" },
  { id: "pollinators", label: "Pollinators" },
  { id: "containers", label: "Container Gardening" },
  { id: "workshops", label: "Workshops" },
  { id: "deals_promotions", label: "Deals & Promotions" },
] as const;

export const GARDENING_EXPERIENCE_OPTIONS = [
  { id: "beginner", label: "Beginner" },
  { id: "intermediate", label: "Intermediate" },
  { id: "experienced", label: "Experienced" },
] as const;

export type CustomerInterestId =
  (typeof CUSTOMER_INTEREST_OPTIONS)[number]["id"];
export type GardeningExperience =
  (typeof GARDENING_EXPERIENCE_OPTIONS)[number]["id"];

export interface CustomerPreferenceSnapshot {
  emailOptIn: boolean | null;
  interests: CustomerInterestId[];
  gardeningExperience: GardeningExperience | null;
}

const INTEREST_IDS = new Set<string>(
  CUSTOMER_INTEREST_OPTIONS.map((option) => option.id),
);
const EXPERIENCE_IDS = new Set<string>(
  GARDENING_EXPERIENCE_OPTIONS.map((option) => option.id),
);

export function normalizeCustomerInterests(
  value: unknown,
): CustomerInterestId[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(
    new Set(
      value.filter(
        (interest): interest is CustomerInterestId =>
          typeof interest === "string" && INTEREST_IDS.has(interest),
      ),
    ),
  );
}

export function normalizeGardeningExperience(
  value: unknown,
): GardeningExperience | null {
  return typeof value === "string" && EXPERIENCE_IDS.has(value)
    ? (value as GardeningExperience)
    : null;
}

export function normalizeCustomerPreferenceSnapshot(
  value: unknown,
): CustomerPreferenceSnapshot {
  const record =
    value && typeof value === "object"
      ? (value as Record<string, unknown>)
      : {};

  return {
    emailOptIn:
      typeof record.emailOptIn === "boolean" ? record.emailOptIn : null,
    interests: normalizeCustomerInterests(record.interests),
    gardeningExperience: normalizeGardeningExperience(
      record.gardeningExperience,
    ),
  };
}
