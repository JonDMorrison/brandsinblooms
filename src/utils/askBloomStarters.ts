import type {
  AskBloomResourceType,
  AskBloomStarterPrompt,
  ResourceFocus,
  ResourceStarterConfig,
} from "@/types/askBloom";

const buildGenericResourceStarters = (
  resourceType: AskBloomResourceType,
): AskBloomStarterPrompt[] => [
  {
    label: "Overview",
    description: `Get a high-level summary of this ${resourceType}.`,
    prompt: `Give me a complete overview of this ${resourceType}.`,
    icon: "FileText",
  },
  {
    label: "Performance",
    description: `Review metrics, trends, and recent changes.`,
    prompt: `Show me performance metrics for this ${resourceType}.`,
    icon: "TrendingUp",
  },
  {
    label: "Suggestions",
    description: "See improvement ideas based on the current data.",
    prompt: `Based on the data, what improvements would you suggest for this ${resourceType}?`,
    icon: "Lightbulb",
  },
  {
    label: "Next steps",
    description: "Find the most useful follow-up actions.",
    prompt: `What are the most useful next steps for this ${resourceType}?`,
    icon: "Sparkles",
  },
];

const RESOURCE_STARTERS: Record<AskBloomResourceType, ResourceStarterConfig> = {
  customer: {
    greeting: "What would you like to know about {label}?",
    starters: [
      {
        label: "Purchase history",
        description: "Review orders, cadence, and product mix.",
        prompt:
          "Give me a detailed summary of this customer's purchase history, including order frequency, average order value, and most-purchased product categories.",
        icon: "ShoppingBag",
      },
      {
        label: "Campaign engagement",
        description: "See opens, clicks, and conversion behavior.",
        prompt:
          "Show me which campaigns this customer has interacted with, including opens, clicks, and conversions.",
        icon: "Mail",
      },
      {
        label: "Draft follow-up email",
        description: "Create a personalized follow-up message.",
        prompt:
          "Draft a personalized follow-up email for this customer based on their recent purchase history and preferences.",
        icon: "PenLine",
      },
      {
        label: "Product recommendations",
        description: "Identify likely next-purchase products.",
        prompt:
          "Based on this customer's purchase history and browsing behavior, what products would they likely be interested in?",
        icon: "Sparkles",
      },
    ],
  },
  product: {
    greeting: "What would you like to know about {label}?",
    starters: [
      {
        label: "Sales performance",
        description: "Review units sold, revenue, and trend lines.",
        prompt:
          "Show me a detailed sales performance breakdown for this product, including units sold, revenue, and trends over the last 90 days.",
        icon: "TrendingUp",
      },
      {
        label: "Stock forecast",
        description: "Estimate sell-through and reorder timing.",
        prompt:
          "Based on current sell-through rate, when will this product's stock run out? Include reorder recommendations.",
        icon: "Package",
      },
      {
        label: "Compare with category",
        description: "Benchmark against similar products.",
        prompt:
          "How does this product's performance compare with other products in the same category?",
        icon: "BarChart3",
      },
      {
        label: "Draft product description",
        description: "Write storefront-ready product copy.",
        prompt:
          "Write a compelling product description for this product optimized for our storefront.",
        icon: "FileText",
      },
    ],
  },
  order: {
    greeting: "What would you like to know about this order?",
    starters: [
      {
        label: "Order timeline",
        description: "Trace the order from placement to status.",
        prompt:
          "Walk me through the full timeline of this order from placement to current status.",
        icon: "Clock",
      },
      {
        label: "Customer context",
        description: "See who ordered and their broader history.",
        prompt:
          "Tell me about the customer who placed this order - their history, preferences, and segment memberships.",
        icon: "User",
      },
      {
        label: "Similar orders",
        description: "Find matching orders and shared patterns.",
        prompt: "Find other orders with similar products, value, or patterns.",
        icon: "Search",
      },
      {
        label: "Draft shipping update",
        description: "Prepare a customer shipping message.",
        prompt:
          "Draft a shipping update email for this order that I can send to the customer.",
        icon: "Truck",
      },
    ],
  },
  campaign: {
    greeting: "What would you like to know about {label}?",
    starters: [
      {
        label: "Performance breakdown",
        description: "Inspect opens, clicks, conversions, and revenue.",
        prompt:
          "Give me a detailed performance breakdown of this campaign, including open rate, click rate, conversion rate, and revenue attributed.",
        icon: "BarChart3",
      },
      {
        label: "Audience analysis",
        description: "See who engaged and which segments performed.",
        prompt:
          "Analyze the audience for this campaign - who engaged, who didn't, and what segments performed best.",
        icon: "Users",
      },
      {
        label: "Suggest improvements",
        description: "Get practical ideas for the next send.",
        prompt:
          "Based on this campaign's performance data, suggest specific improvements for the next campaign.",
        icon: "Lightbulb",
      },
      {
        label: "Compare with past",
        description: "Benchmark against similar historical campaigns.",
        prompt:
          "Compare this campaign's performance with my previous campaigns of the same type.",
        icon: "GitCompare",
      },
    ],
  },
  segment: {
    greeting: "What would you like to know about this {resourceType}?",
    starters: buildGenericResourceStarters("segment"),
  },
  automation: {
    greeting: "What would you like to know about this {resourceType}?",
    starters: buildGenericResourceStarters("automation"),
  },
  invoice: {
    greeting: "What would you like to know about this {resourceType}?",
    starters: buildGenericResourceStarters("invoice"),
  },
};

const GENERAL_STARTERS: ResourceStarterConfig = {
  greeting: "How can I help you today?",
  starters: [
    {
      label: "Ask about a customer",
      description: "Find a customer and review their profile.",
      prompt: "I'd like to look up a customer. Can you help me find them?",
      icon: "User",
    },
    {
      label: "Check inventory",
      description: "See stock levels and low-inventory alerts.",
      prompt:
        "Give me a summary of my current inventory status, including any low-stock alerts.",
      icon: "Package",
    },
    {
      label: "Campaign insights",
      description: "Review recent campaign performance.",
      prompt: "Show me how my recent campaigns are performing.",
      icon: "Mail",
    },
    {
      label: "Draft content",
      description: "Generate marketing copy for your store.",
      prompt: "Help me draft marketing content for my store.",
      icon: "PenLine",
    },
  ],
};

function interpolateGreeting(
  template: string,
  resourceFocus: ResourceFocus,
): string {
  return template
    .split("{label}")
    .join(resourceFocus.resourceLabel)
    .split("{resourceType}")
    .join(resourceFocus.resourceType);
}

export function getAskBloomStarterConfig(
  resourceFocus: ResourceFocus | null,
): ResourceStarterConfig {
  if (!resourceFocus) {
    return GENERAL_STARTERS;
  }

  const config = RESOURCE_STARTERS[resourceFocus.resourceType];
  return {
    greeting: interpolateGreeting(config.greeting, resourceFocus),
    starters: config.starters,
  };
}
