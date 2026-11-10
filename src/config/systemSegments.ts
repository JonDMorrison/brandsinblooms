export interface SystemSegmentPresentation {
  id: string;
  name: string;
  description: string;
  icon: string;
  aliases?: string[];
}

const normalizeSegmentName = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ");

export const SYSTEM_SEGMENT_PRESENTATIONS: SystemSegmentPresentation[] = [
  {
    id: "high-value",
    name: "High-Value Customers",
    description:
      "Customers with significant purchase history and lifetime value, representing your most valuable repeat buyers.",
    icon: "⭐",
    aliases: ["high value customers"],
  },
  {
    id: "new-customers",
    name: "New Customers",
    description:
      "Customers whose first recorded purchase was in the last 30 days. Imported customers without a first purchase date are not counted.",
    icon: "🆕",
  },
  {
    id: "lapsed-customers",
    name: "Lapsed Customers",
    description:
      "Customers whose last recorded purchase was more than 90 days ago, ideal for re-engagement campaigns. Imported customers without a last purchase date are not counted.",
    icon: "😴",
  },
  {
    id: "seasonal-shoppers",
    name: "Seasonal Shoppers",
    description:
      "Customers who primarily shop during spring and holiday seasons, responsive to seasonal promotions and reminders.",
    icon: "🌸",
  },
  {
    id: "frequent-buyers",
    name: "Frequent Buyers",
    description:
      "Customers with 3 or more recorded purchases, strong candidates for loyalty programs.",
    icon: "🔄",
  },
  {
    id: "loyalty-members",
    name: "Loyalty Members",
    description:
      "Customers enrolled in your loyalty or perks program, actively earning and redeeming points.",
    icon: "🏆",
  },
  {
    id: "perks-members",
    name: "Perks Members",
    description:
      "Customers enrolled in your perks program and actively using member-only benefits across repeat purchases.",
    icon: "🏆",
  },
  {
    id: "email-subscribers",
    name: "Email Subscribers",
    description:
      "Customers who have opted into marketing emails and actively engage with your email campaigns.",
    icon: "📧",
  },
];

const CUSTOM_SEGMENT_ICON_RULES = [
  { match: /newsletter|email|subscriber/, icon: "📧" },
  { match: /vip|high value|high-value|loyalty|perks/, icon: "🏆" },
  { match: /new|welcome/, icon: "🆕" },
  { match: /lapsed|inactive|win back|win-back/, icon: "😴" },
  { match: /season|spring|summer|fall|winter|holiday/, icon: "🌸" },
  { match: /frequent|repeat|returning/, icon: "🔄" },
  { match: /tag|club|member/, icon: "🏷️" },
] as const;

export function getSystemSegmentPresentation(name?: string | null) {
  if (!name) {
    return null;
  }

  const normalizedName = normalizeSegmentName(name);

  return (
    SYSTEM_SEGMENT_PRESENTATIONS.find((segment) => {
      if (normalizeSegmentName(segment.name) === normalizedName) {
        return true;
      }

      return (segment.aliases ?? []).some(
        (alias) => normalizeSegmentName(alias) === normalizedName,
      );
    }) ?? null
  );
}

export function getSegmentDisplayIcon(options: {
  isSystemSegment: boolean;
  name?: string | null;
}) {
  const presentation = getSystemSegmentPresentation(options.name);
  if (presentation) {
    return presentation.icon;
  }

  const normalizedName = normalizeSegmentName(options.name ?? "");
  const customMatch = CUSTOM_SEGMENT_ICON_RULES.find((rule) =>
    rule.match.test(normalizedName),
  );

  if (customMatch) {
    return customMatch.icon;
  }

  return options.isSystemSegment ? "📊" : "✦";
}

export function getSegmentDisplayDescription(options: {
  isSystemSegment: boolean;
  name?: string | null;
  description?: string | null;
  fallback?: string | null;
}) {
  const presentation = getSystemSegmentPresentation(options.name);

  if (options.isSystemSegment && presentation?.description) {
    return presentation.description;
  }

  return (
    options.description?.trim() ||
    options.fallback?.trim() ||
    "No description yet."
  );
}
