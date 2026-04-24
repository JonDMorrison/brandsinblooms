export type PersonaAccent =
  | "primary"
  | "info"
  | "success"
  | "warning"
  | "danger"
  | "brandNavy";

export interface PersonaMetadata {
  icon?: string | null;
  color?: PersonaAccent | null;
  demographics?: {
    ageRange?: string | null;
    incomeRange?: string | null;
    locationType?: string | null;
    familyStatus?: string[];
  };
  behavior?: {
    preferredChannel?: string | null;
    shoppingFrequency?: string | null;
    averageOrderValue?: string | null;
    discountSensitivity?: string | null;
  };
  communication?: {
    preferredTone?: string | null;
    interests?: string[];
    avoidTopics?: string[];
  };
}

export interface PersonaRecord {
  id: string;
  persona_name: string;
  persona_description?: string | null;
  is_custom: boolean;
  created_at?: string;
  updated_at?: string;
  tenant_id?: string;
  user_id?: string;
  metadata?: PersonaMetadata | null;
}

export interface SystemPersona extends PersonaRecord {
  is_custom: false;
  emoji: string;
  accent: PersonaAccent;
  legacyAliases?: string[];
}

export interface PersonaAccentStyles {
  palette: PersonaAccent;
  softBg: string;
  softBorder: string;
  softText: string;
  strongBg: string;
  strongText: string;
  gradient: string;
  mutedGradient: string;
  shadow: string;
}

export const PERSONA_ACCENT_OPTIONS: Array<{
  value: PersonaAccent;
  label: string;
}> = [
  { value: "primary", label: "Teal" },
  { value: "info", label: "Blue" },
  { value: "success", label: "Green" },
  { value: "warning", label: "Amber" },
  { value: "danger", label: "Rose" },
  { value: "brandNavy", label: "Navy" },
];

export const PERSONA_ICON_OPTIONS = [
  "🌱",
  "🐾",
  "🥬",
  "♻️",
  "🏠",
  "🐝",
  "🌻",
  "🔧",
  "🧘",
  "🎯",
  "✨",
  "🌿",
  "🛒",
  "💡",
  "🍃",
] as const;

export const PERSONA_AGE_RANGE_OPTIONS = [
  "18-24",
  "25-34",
  "35-44",
  "45-54",
  "55-64",
  "65+",
];

export const PERSONA_INCOME_RANGE_OPTIONS = [
  "Under $50k",
  "$50k-$90k",
  "$90k-$150k",
  "$150k+",
];

export const PERSONA_LOCATION_OPTIONS = [
  "Urban",
  "Suburban",
  "Rural",
  "Small-town",
  "Mixed",
];

export const PERSONA_FAMILY_STATUS_OPTIONS = [
  "Single",
  "Couple",
  "Young family",
  "Established family",
  "Empty nester",
  "Pet parent",
  "Multi-generational",
];

export const PERSONA_CHANNEL_OPTIONS = [
  "Email",
  "SMS",
  "Social",
  "In-store",
  "Phone",
  "Direct mail",
];

export const PERSONA_FREQUENCY_OPTIONS = [
  "Weekly",
  "Bi-weekly",
  "Monthly",
  "Seasonal",
  "Project-based",
  "Impulse",
];

export const PERSONA_ORDER_VALUE_OPTIONS = [
  "Under $30",
  "$30-$75",
  "$75-$150",
  "$150-$300",
  "$300+",
];

export const PERSONA_DISCOUNT_SENSITIVITY_OPTIONS = [
  "Low",
  "Moderate",
  "High",
  "Deal-first",
];

export const PERSONA_TONE_OPTIONS = [
  "Encouraging",
  "Expert",
  "Friendly",
  "Practical",
  "Aspirational",
  "Educational",
  "Concise",
];

const PERSONA_ACCENT_STYLE_MAP: Record<PersonaAccent, PersonaAccentStyles> = {
  primary: {
    palette: "primary",
    softBg: "rgba(var(--joy-palette-primary-mainChannel) / 0.08)",
    softBorder: "rgba(var(--joy-palette-primary-mainChannel) / 0.18)",
    softText: "var(--joy-palette-brandNavy-900)",
    strongBg: "var(--joy-palette-primary-500)",
    strongText: "var(--joy-palette-common-white)",
    gradient:
      "linear-gradient(135deg, var(--joy-palette-primary-50) 0%, rgba(var(--joy-palette-primary-mainChannel) / 0.16) 100%)",
    mutedGradient:
      "linear-gradient(180deg, rgba(var(--joy-palette-primary-mainChannel) / 0.08) 0%, rgba(var(--joy-palette-primary-mainChannel) / 0.02) 100%)",
    shadow: "0 18px 40px rgba(var(--joy-palette-primary-mainChannel) / 0.14)",
  },
  info: {
    palette: "info",
    softBg: "rgba(var(--joy-palette-info-mainChannel) / 0.08)",
    softBorder: "rgba(var(--joy-palette-info-mainChannel) / 0.18)",
    softText: "var(--joy-palette-info-800)",
    strongBg: "var(--joy-palette-info-500)",
    strongText: "var(--joy-palette-common-white)",
    gradient:
      "linear-gradient(135deg, var(--joy-palette-info-50) 0%, rgba(var(--joy-palette-info-mainChannel) / 0.16) 100%)",
    mutedGradient:
      "linear-gradient(180deg, rgba(var(--joy-palette-info-mainChannel) / 0.08) 0%, rgba(var(--joy-palette-info-mainChannel) / 0.02) 100%)",
    shadow: "0 18px 40px rgba(var(--joy-palette-info-mainChannel) / 0.14)",
  },
  success: {
    palette: "success",
    softBg: "rgba(var(--joy-palette-success-mainChannel) / 0.08)",
    softBorder: "rgba(var(--joy-palette-success-mainChannel) / 0.18)",
    softText: "var(--joy-palette-success-800)",
    strongBg: "var(--joy-palette-success-500)",
    strongText: "var(--joy-palette-common-white)",
    gradient:
      "linear-gradient(135deg, var(--joy-palette-success-50) 0%, rgba(var(--joy-palette-success-mainChannel) / 0.16) 100%)",
    mutedGradient:
      "linear-gradient(180deg, rgba(var(--joy-palette-success-mainChannel) / 0.08) 0%, rgba(var(--joy-palette-success-mainChannel) / 0.02) 100%)",
    shadow: "0 18px 40px rgba(var(--joy-palette-success-mainChannel) / 0.14)",
  },
  warning: {
    palette: "warning",
    softBg: "rgba(var(--joy-palette-warning-mainChannel) / 0.12)",
    softBorder: "rgba(var(--joy-palette-warning-mainChannel) / 0.24)",
    softText: "var(--joy-palette-warning-800)",
    strongBg: "var(--joy-palette-warning-500)",
    strongText: "var(--joy-palette-common-white)",
    gradient:
      "linear-gradient(135deg, var(--joy-palette-warning-50) 0%, rgba(var(--joy-palette-warning-mainChannel) / 0.18) 100%)",
    mutedGradient:
      "linear-gradient(180deg, rgba(var(--joy-palette-warning-mainChannel) / 0.09) 0%, rgba(var(--joy-palette-warning-mainChannel) / 0.02) 100%)",
    shadow: "0 18px 40px rgba(var(--joy-palette-warning-mainChannel) / 0.14)",
  },
  danger: {
    palette: "danger",
    softBg: "rgba(var(--joy-palette-danger-mainChannel) / 0.08)",
    softBorder: "rgba(var(--joy-palette-danger-mainChannel) / 0.18)",
    softText: "var(--joy-palette-danger-800)",
    strongBg: "var(--joy-palette-danger-500)",
    strongText: "var(--joy-palette-common-white)",
    gradient:
      "linear-gradient(135deg, var(--joy-palette-danger-50) 0%, rgba(var(--joy-palette-danger-mainChannel) / 0.16) 100%)",
    mutedGradient:
      "linear-gradient(180deg, rgba(var(--joy-palette-danger-mainChannel) / 0.08) 0%, rgba(var(--joy-palette-danger-mainChannel) / 0.02) 100%)",
    shadow: "0 18px 40px rgba(var(--joy-palette-danger-mainChannel) / 0.14)",
  },
  brandNavy: {
    palette: "brandNavy",
    softBg: "rgba(var(--joy-palette-brandNavy-mainChannel) / 0.08)",
    softBorder: "rgba(var(--joy-palette-brandNavy-mainChannel) / 0.16)",
    softText: "var(--joy-palette-brandNavy-800)",
    strongBg: "var(--joy-palette-brandNavy-500)",
    strongText: "var(--joy-palette-common-white)",
    gradient:
      "linear-gradient(135deg, var(--joy-palette-brandNavy-50) 0%, rgba(var(--joy-palette-brandNavy-mainChannel) / 0.16) 100%)",
    mutedGradient:
      "linear-gradient(180deg, rgba(var(--joy-palette-brandNavy-mainChannel) / 0.08) 0%, rgba(var(--joy-palette-brandNavy-mainChannel) / 0.02) 100%)",
    shadow: "0 18px 40px rgba(var(--joy-palette-brandNavy-mainChannel) / 0.14)",
  },
};

export const SYSTEM_PERSONAS: SystemPersona[] = [
  {
    id: "plant-killer-pam",
    persona_name: "Plant-Killer Pam",
    persona_description:
      "Customers who want living spaces full of greenery without the guilt spiral when care routines fall apart.",
    is_custom: false,
    emoji: "🌱",
    accent: "primary",
    legacyAliases: ["Plant Killer Pam"],
    metadata: {
      icon: "🌱",
      color: "primary",
      demographics: {
        ageRange: "25-44",
        incomeRange: "$50k-$90k",
        locationType: "Urban",
        familyStatus: ["Single", "Pet parent"],
      },
      behavior: {
        preferredChannel: "Email",
        shoppingFrequency: "Monthly",
        averageOrderValue: "$30-$75",
        discountSensitivity: "Moderate",
      },
      communication: {
        preferredTone: "Encouraging",
        interests: [
          "Low-maintenance plants",
          "Care reminders",
          "Indoor styling",
        ],
        avoidTopics: [
          "High-maintenance routines",
          "Complicated pruning guides",
        ],
      },
    },
  },
  {
    id: "pet-friendly-hannah",
    persona_name: "Pet-Friendly Hannah",
    persona_description:
      "Households with pets that need safe plant picks, confident recommendations, and quick reassurance in-store and online.",
    is_custom: false,
    emoji: "🐾",
    accent: "info",
    metadata: {
      icon: "🐾",
      color: "info",
      demographics: {
        ageRange: "25-54",
        incomeRange: "$50k-$90k",
        locationType: "Suburban",
        familyStatus: ["Couple", "Pet parent", "Young family"],
      },
      behavior: {
        preferredChannel: "SMS",
        shoppingFrequency: "Monthly",
        averageOrderValue: "$30-$75",
        discountSensitivity: "Low",
      },
      communication: {
        preferredTone: "Expert",
        interests: ["Non-toxic plants", "Pet-safe landscaping", "Care tips"],
        avoidTopics: ["Toxic varieties", "Ambiguous safety advice"],
      },
    },
  },
  {
    id: "vegetable-garden-veronica",
    persona_name: "Vegetable Garden Veronica",
    persona_description:
      "Edible-garden shoppers who plan ahead, compare varieties, and return often through the growing season.",
    is_custom: false,
    emoji: "🥬",
    accent: "success",
    metadata: {
      icon: "🥬",
      color: "success",
      demographics: {
        ageRange: "35-64",
        incomeRange: "$90k-$150k",
        locationType: "Suburban",
        familyStatus: ["Established family", "Empty nester"],
      },
      behavior: {
        preferredChannel: "Email",
        shoppingFrequency: "Bi-weekly",
        averageOrderValue: "$75-$150",
        discountSensitivity: "Moderate",
      },
      communication: {
        preferredTone: "Educational",
        interests: ["Raised beds", "Organic fertilizer", "Harvest timing"],
        avoidTopics: ["Purely decorative content"],
      },
    },
  },
  {
    id: "sustainable-susie",
    persona_name: "Sustainable Susie",
    persona_description:
      "Eco-minded customers who value native plants, responsible inputs, and brands that make stewardship easy to act on.",
    is_custom: false,
    emoji: "♻️",
    accent: "brandNavy",
    metadata: {
      icon: "♻️",
      color: "brandNavy",
      demographics: {
        ageRange: "25-54",
        incomeRange: "$90k-$150k",
        locationType: "Mixed",
        familyStatus: ["Couple", "Young family"],
      },
      behavior: {
        preferredChannel: "Email",
        shoppingFrequency: "Seasonal",
        averageOrderValue: "$75-$150",
        discountSensitivity: "Low",
      },
      communication: {
        preferredTone: "Educational",
        interests: [
          "Native plants",
          "Water-wise gardening",
          "Organic soil care",
        ],
        avoidTopics: ["Wasteful promotions", "Single-use garden products"],
      },
    },
  },
  {
    id: "patio-gardener-gail",
    persona_name: "Patio Gardener Gail",
    persona_description:
      "Balcony and small-space gardeners looking for compact abundance, elevated styling, and practical container wins.",
    is_custom: false,
    emoji: "🏠",
    accent: "warning",
    metadata: {
      icon: "🏠",
      color: "warning",
      demographics: {
        ageRange: "25-44",
        incomeRange: "$50k-$90k",
        locationType: "Urban",
        familyStatus: ["Single", "Couple"],
      },
      behavior: {
        preferredChannel: "Social",
        shoppingFrequency: "Monthly",
        averageOrderValue: "$30-$75",
        discountSensitivity: "Moderate",
      },
      communication: {
        preferredTone: "Aspirational",
        interests: ["Container recipes", "Patio styling", "Vertical gardening"],
        avoidTopics: ["Large acreage projects", "Heavy equipment"],
      },
    },
  },
  {
    id: "pollinator-paula",
    persona_name: "Pollinator Paula",
    persona_description:
      "Shoppers building vibrant habitats for bees, butterflies, birds, and the stories they share with their community.",
    is_custom: false,
    emoji: "🐝",
    accent: "info",
    metadata: {
      icon: "🐝",
      color: "info",
      demographics: {
        ageRange: "35-64",
        incomeRange: "$50k-$90k",
        locationType: "Suburban",
        familyStatus: ["Established family", "Empty nester"],
      },
      behavior: {
        preferredChannel: "Email",
        shoppingFrequency: "Seasonal",
        averageOrderValue: "$75-$150",
        discountSensitivity: "Low",
      },
      communication: {
        preferredTone: "Educational",
        interests: [
          "Native wildflowers",
          "Habitat design",
          "Pollinator events",
        ],
        avoidTopics: ["Broad pesticide promotions"],
      },
    },
  },
  {
    id: "curb-appeal-ashley",
    persona_name: "Curb Appeal Ashley",
    persona_description:
      "Homeowners using plants and seasonal installs to make the outside of the home feel polished, welcoming, and valuable.",
    is_custom: false,
    emoji: "🌻",
    accent: "danger",
    metadata: {
      icon: "🌻",
      color: "danger",
      demographics: {
        ageRange: "35-64",
        incomeRange: "$90k-$150k",
        locationType: "Suburban",
        familyStatus: ["Established family", "Empty nester"],
      },
      behavior: {
        preferredChannel: "Email",
        shoppingFrequency: "Seasonal",
        averageOrderValue: "$150-$300",
        discountSensitivity: "Low",
      },
      communication: {
        preferredTone: "Aspirational",
        interests: [
          "Seasonal color",
          "Front entrance styling",
          "Landscape upgrades",
        ],
        avoidTopics: ["Messy DIY shortcuts"],
      },
    },
  },
  {
    id: "diy-dana",
    persona_name: "DIY Dana",
    persona_description:
      "Project-driven gardeners who enjoy the build as much as the bloom and want materials, plans, and confidence to execute.",
    is_custom: false,
    emoji: "🔧",
    accent: "brandNavy",
    metadata: {
      icon: "🔧",
      color: "brandNavy",
      demographics: {
        ageRange: "25-54",
        incomeRange: "$50k-$90k",
        locationType: "Suburban",
        familyStatus: ["Couple", "Established family"],
      },
      behavior: {
        preferredChannel: "SMS",
        shoppingFrequency: "Project-based",
        averageOrderValue: "$75-$150",
        discountSensitivity: "High",
      },
      communication: {
        preferredTone: "Practical",
        interests: ["Garden projects", "How-to workshops", "Tool checklists"],
        avoidTopics: ["Vague inspiration without instructions"],
      },
    },
  },
  {
    id: "wellness-whitney",
    persona_name: "Wellness Whitney",
    persona_description:
      "Customers drawn to the calming, restorative side of gardening and the rituals that make home feel better.",
    is_custom: false,
    emoji: "🧘",
    accent: "primary",
    metadata: {
      icon: "🧘",
      color: "primary",
      demographics: {
        ageRange: "25-54",
        incomeRange: "$50k-$90k",
        locationType: "Mixed",
        familyStatus: ["Single", "Couple", "Young family"],
      },
      behavior: {
        preferredChannel: "Social",
        shoppingFrequency: "Monthly",
        averageOrderValue: "$30-$75",
        discountSensitivity: "Moderate",
      },
      communication: {
        preferredTone: "Friendly",
        interests: ["Mindful routines", "Fragrant plants", "Indoor wellness"],
        avoidTopics: ["Hard-sell urgency"],
      },
    },
  },
];

const accentValues = new Set(
  PERSONA_ACCENT_OPTIONS.map((option) => option.value),
);

const normalizeString = (value: unknown) => {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const normalizeStringArray = (value: unknown) => {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(
    new Set(
      value
        .map((entry) => normalizeString(entry))
        .filter((entry): entry is string => Boolean(entry)),
    ),
  );
};

export function createEmptyPersonaMetadata(): PersonaMetadata {
  return {
    icon: null,
    color: "primary",
    demographics: {
      ageRange: null,
      incomeRange: null,
      locationType: null,
      familyStatus: [],
    },
    behavior: {
      preferredChannel: null,
      shoppingFrequency: null,
      averageOrderValue: null,
      discountSensitivity: null,
    },
    communication: {
      preferredTone: null,
      interests: [],
      avoidTopics: [],
    },
  };
}

export function normalizePersonaMetadata(
  value: unknown,
): PersonaMetadata | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const metadata = value as PersonaMetadata;
  const color = accentValues.has(metadata.color ?? "")
    ? (metadata.color as PersonaAccent)
    : null;

  return {
    icon: normalizeString(metadata.icon),
    color,
    demographics: {
      ageRange: normalizeString(metadata.demographics?.ageRange),
      incomeRange: normalizeString(metadata.demographics?.incomeRange),
      locationType: normalizeString(metadata.demographics?.locationType),
      familyStatus: normalizeStringArray(metadata.demographics?.familyStatus),
    },
    behavior: {
      preferredChannel: normalizeString(metadata.behavior?.preferredChannel),
      shoppingFrequency: normalizeString(metadata.behavior?.shoppingFrequency),
      averageOrderValue: normalizeString(metadata.behavior?.averageOrderValue),
      discountSensitivity: normalizeString(
        metadata.behavior?.discountSensitivity,
      ),
    },
    communication: {
      preferredTone: normalizeString(metadata.communication?.preferredTone),
      interests: normalizeStringArray(metadata.communication?.interests),
      avoidTopics: normalizeStringArray(metadata.communication?.avoidTopics),
    },
  };
}

export function getSystemPersonaById(personaId: string) {
  return SYSTEM_PERSONAS.find((persona) => persona.id === personaId) ?? null;
}

export function isSystemPersonaId(personaId: string) {
  return SYSTEM_PERSONAS.some((persona) => persona.id === personaId);
}

export function getPersonaMatchCandidates(
  persona: Pick<PersonaRecord, "id" | "persona_name">,
) {
  const systemPersona = getSystemPersonaById(persona.id);
  const candidates = [persona.persona_name];

  if (systemPersona?.legacyAliases?.length) {
    candidates.push(...systemPersona.legacyAliases);
  }

  return Array.from(
    new Set(
      candidates
        .map((candidate) => candidate.trim())
        .filter((candidate) => candidate.length > 0),
    ),
  );
}

export function getPersonaAccent(
  persona: Pick<PersonaRecord, "id" | "metadata">,
): PersonaAccent {
  const metadata = normalizePersonaMetadata(persona.metadata);

  if (metadata?.color && accentValues.has(metadata.color)) {
    return metadata.color;
  }

  return getSystemPersonaById(persona.id)?.accent ?? "primary";
}

export function getPersonaAccentStyles(accent: PersonaAccent) {
  return PERSONA_ACCENT_STYLE_MAP[accent] ?? PERSONA_ACCENT_STYLE_MAP.primary;
}

export function getPersonaEmoji(
  persona: Pick<PersonaRecord, "id" | "is_custom" | "metadata">,
) {
  const metadata = normalizePersonaMetadata(persona.metadata);

  if (metadata?.icon) {
    return metadata.icon;
  }

  return (
    getSystemPersonaById(persona.id)?.emoji ?? (persona.is_custom ? "🎯" : "🌿")
  );
}
