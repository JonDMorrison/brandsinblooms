import { matchPath } from "react-router-dom";
import type {
  BloomPageCategory,
  BloomPageContext,
  BloomPageEntityType,
} from "@/hooks/bloom/types";

interface PageContextRouteDescriptor {
  pattern: string;
  pageCategory: BloomPageCategory;
  entityType: BloomPageEntityType | null;
  pageName: string;
  availableActions: string[];
  suggestions: string[];
}

const DEFAULT_BLOOM_ACTIONS = [
  "Show today's summary",
  "Surface key trends",
  "Suggest a next step",
];

const DEFAULT_BLOOM_SUGGESTIONS = [
  "Show today's summary",
  "How's business going?",
  "What should I focus on today?",
];

const FALLBACK_PAGE_CONTEXT: Omit<BloomPageContext, "pathname"> = {
  pageCategory: "other",
  entityType: null,
  entityId: null,
  pageName: "CRM",
  availableActions: ["Ask a CRM question", "Summarize this page"],
  suggestions: [...DEFAULT_BLOOM_SUGGESTIONS],
};

const PAGE_CONTEXT_ROUTE_TABLE: PageContextRouteDescriptor[] = [
  {
    pattern: "/bloom/admin",
    pageCategory: "bloom",
    entityType: null,
    pageName: "Bloom Admin Dashboard",
    availableActions: [
      "Review usage overview",
      "Inspect audit events",
      "Check tool performance",
    ],
    suggestions: [
      "Show Bloom usage trends",
      "What tools are used most?",
      "Review recent audit events",
    ],
  },
  {
    pattern: "/crm/campaigns/:id/recipients/:recipientId",
    pageCategory: "campaigns",
    entityType: "campaign",
    pageName: "Campaign Recipients",
    availableActions: [
      "Inspect recipients",
      "Review engagement",
      "Export audience insights",
    ],
    suggestions: [
      "How are campaign recipients performing?",
      "Show engagement by recipient",
      "What should I optimize here?",
    ],
  },
  {
    pattern: "/crm/campaigns/:id/analytics",
    pageCategory: "campaigns",
    entityType: "campaign",
    pageName: "Campaign Report",
    availableActions: [
      "Review performance",
      "Compare results",
      "Identify drop-offs",
    ],
    suggestions: [
      "How is this campaign performing?",
      "Compare this campaign to others",
      "What stands out in this report?",
    ],
  },
  {
    pattern: "/crm/campaigns/:id/report",
    pageCategory: "campaigns",
    entityType: "campaign",
    pageName: "Campaign Report",
    availableActions: [
      "Review performance",
      "Compare results",
      "Identify drop-offs",
    ],
    suggestions: [
      "How is this campaign performing?",
      "Compare this campaign to others",
      "What stands out in this report?",
    ],
  },
  {
    pattern: "/crm/campaigns/:id/recipients",
    pageCategory: "campaigns",
    entityType: "campaign",
    pageName: "Campaign Recipients",
    availableActions: [
      "Inspect recipients",
      "Review engagement",
      "Spot delivery issues",
    ],
    suggestions: [
      "Summarize this recipient list",
      "Show engagement by recipient",
      "Are there delivery issues here?",
    ],
  },
  {
    pattern: "/crm/campaigns/:id/edit",
    pageCategory: "campaigns",
    entityType: "campaign",
    pageName: "Campaign Editor",
    availableActions: [
      "Generate content",
      "Preview audience",
      "Refine subject lines",
    ],
    suggestions: [
      "Generate content for this campaign",
      "Preview this campaign's audience",
      "Improve this campaign copy",
    ],
  },
  {
    pattern: "/crm/campaigns/:id/studio",
    pageCategory: "campaigns",
    entityType: "campaign",
    pageName: "Campaign Studio",
    availableActions: [
      "Generate content",
      "Refine layout",
      "Suggest stronger copy",
    ],
    suggestions: [
      "Help me refine this campaign layout",
      "Generate stronger campaign copy",
      "What should I improve before sending?",
    ],
  },
  {
    pattern: "/crm/campaigns/new",
    pageCategory: "campaigns",
    entityType: null,
    pageName: "Campaign Editor",
    availableActions: [
      "Generate content",
      "Preview audience",
      "Draft campaign strategy",
    ],
    suggestions: [
      "Help me draft a campaign",
      "Generate content for this campaign",
      "Who should receive this campaign?",
    ],
  },
  {
    pattern: "/crm/campaigns/:id",
    pageCategory: "campaigns",
    entityType: "campaign",
    pageName: "Campaign Editor",
    availableActions: [
      "Generate content",
      "Preview audience",
      "Refine subject lines",
    ],
    suggestions: [
      "Generate content for this campaign",
      "Preview this campaign's audience",
      "Improve this campaign copy",
    ],
  },
  {
    pattern: "/crm/segments/:id/members",
    pageCategory: "segments",
    entityType: "segment",
    pageName: "Segment Members",
    availableActions: [
      "View members",
      "Compare segment performance",
      "Use in campaign",
    ],
    suggestions: [
      "Summarize this segment",
      "Who is in this segment?",
      "How should I use this segment in a campaign?",
    ],
  },
  {
    pattern: "/crm/segments/new",
    pageCategory: "segments",
    entityType: null,
    pageName: "Segment Builder",
    availableActions: [
      "Create segment",
      "Compare segments",
      "Suggest targeting rules",
    ],
    suggestions: [
      "Help me create a segment",
      "Compare segments for this campaign",
      "What filters should I use here?",
    ],
  },
  {
    pattern: "/crm/segments/:id",
    pageCategory: "segments",
    entityType: "segment",
    pageName: "Segment Details",
    availableActions: ["View members", "Use in campaign", "Compare segments"],
    suggestions: [
      "Summarize this segment",
      "View members in this segment",
      "How should I use this segment in a campaign?",
    ],
  },
  {
    pattern: "/crm/customers/new",
    pageCategory: "customers",
    entityType: null,
    pageName: "Add Customer",
    availableActions: [
      "Review required details",
      "Suggest follow-up steps",
      "Plan next actions",
    ],
    suggestions: [
      "What should I do after creating this customer?",
      "How should I follow up with a new customer?",
      "What customer details matter most here?",
    ],
  },
  {
    pattern: "/crm/customers/:id",
    pageCategory: "customers",
    entityType: "customer",
    pageName: "Customer Details",
    availableActions: [
      "Tell me about this customer",
      "View orders",
      "Suggest follow-up",
    ],
    suggestions: [
      "Tell me about this customer",
      "Show this customer's orders",
      "What should I do next for this customer?",
    ],
  },
  {
    pattern: "/products/:id",
    pageCategory: "products",
    entityType: "product",
    pageName: "Product Details",
    availableActions: [
      "Generate description",
      "Update price",
      "Review performance",
    ],
    suggestions: [
      "Generate a description for this product",
      "Should I update this product's price?",
      "How is this product performing?",
    ],
  },
  {
    pattern: "/crm/analytics",
    pageCategory: "analytics",
    entityType: null,
    pageName: "Analytics",
    availableActions: ["Revenue breakdown", "Email health", "Compare periods"],
    suggestions: [
      "Show a revenue breakdown",
      "How is email health looking?",
      "Compare this month to last month",
    ],
  },
  {
    pattern: "/integrations/*",
    pageCategory: "integrations",
    entityType: null,
    pageName: "Integrations",
    availableActions: [
      "Check integration status",
      "Review sync health",
      "Find attention items",
    ],
    suggestions: [
      "Show integration status",
      "How healthy are my syncs?",
      "What needs reconnecting?",
    ],
  },
  {
    pattern: "/settings/*",
    pageCategory: "settings",
    entityType: null,
    pageName: "Settings",
    availableActions: [
      "Review settings",
      "Check configuration",
      "Suggest next setup steps",
    ],
    suggestions: [
      "Review my settings",
      "What should I configure next?",
      "Summarize my current setup",
    ],
  },
  {
    pattern: "/dashboard",
    pageCategory: "dashboard",
    entityType: null,
    pageName: "Dashboard",
    availableActions: [
      "Show today's summary",
      "Revenue this month",
      "Highlight priorities",
    ],
    suggestions: [
      "Show today's summary",
      "What's my revenue this month?",
      "What should I focus on today?",
    ],
  },
  {
    pattern: "/crm",
    pageCategory: "dashboard",
    entityType: null,
    pageName: "Dashboard",
    availableActions: [
      "Show today's summary",
      "Revenue this month",
      "Highlight priorities",
    ],
    suggestions: [
      "Show today's summary",
      "What's my revenue this month?",
      "What should I focus on today?",
    ],
  },
  {
    pattern: "/crm/customers",
    pageCategory: "customers",
    entityType: null,
    pageName: "Customer List",
    availableActions: [
      "Search customers",
      "Create a segment",
      "Find follow-up opportunities",
    ],
    suggestions: [
      "Search customers",
      "Create a segment from this list",
      "Which customers need follow-up?",
    ],
  },
  {
    pattern: "/products",
    pageCategory: "products",
    entityType: null,
    pageName: "Product List",
    availableActions: [
      "Show low stock",
      "Update pricing",
      "Review top performers",
    ],
    suggestions: [
      "Show low-stock products",
      "Which products need price updates?",
      "What products are selling best?",
    ],
  },
  {
    pattern: "/crm/campaigns",
    pageCategory: "campaigns",
    entityType: null,
    pageName: "Campaign List",
    availableActions: [
      "Campaign performance",
      "Draft campaign",
      "Plan next send",
    ],
    suggestions: [
      "How are my campaigns performing?",
      "Help me draft a campaign",
      "What should I send next?",
    ],
  },
  {
    pattern: "/crm/segments",
    pageCategory: "segments",
    entityType: null,
    pageName: "Segment List",
    availableActions: [
      "Compare segments",
      "Create segment",
      "Review audience overlap",
    ],
    suggestions: [
      "Compare segments",
      "Help me create a segment",
      "Which segment should I use next?",
    ],
  },
  {
    pattern: "/analytics",
    pageCategory: "analytics",
    entityType: null,
    pageName: "Analytics",
    availableActions: ["Revenue breakdown", "Email health", "Compare periods"],
    suggestions: [
      "Show a revenue breakdown",
      "How is email health looking?",
      "Compare this month to last month",
    ],
  },
  {
    pattern: "/integrations",
    pageCategory: "integrations",
    entityType: null,
    pageName: "Integrations",
    availableActions: [
      "Check integration status",
      "Review sync health",
      "Find attention items",
    ],
    suggestions: [
      "Show integration status",
      "How healthy are my syncs?",
      "What needs reconnecting?",
    ],
  },
  {
    pattern: "/settings",
    pageCategory: "settings",
    entityType: null,
    pageName: "Settings",
    availableActions: [
      "Review settings",
      "Check configuration",
      "Suggest next setup steps",
    ],
    suggestions: [
      "Review my settings",
      "What should I configure next?",
      "Summarize my current setup",
    ],
  },
  {
    pattern: "/bloom/:id",
    pageCategory: "bloom",
    entityType: null,
    pageName: "Bloom",
    availableActions: [...DEFAULT_BLOOM_ACTIONS],
    suggestions: [...DEFAULT_BLOOM_SUGGESTIONS],
  },
  {
    pattern: "/bloom",
    pageCategory: "bloom",
    entityType: null,
    pageName: "Bloom",
    availableActions: [...DEFAULT_BLOOM_ACTIONS],
    suggestions: [...DEFAULT_BLOOM_SUGGESTIONS],
  },
];

const isUuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );

export function resolvePageContext(pathname: string): BloomPageContext {
  const normalizedPathname = pathname.trim() || "/";

  for (const route of PAGE_CONTEXT_ROUTE_TABLE) {
    const match = matchPath(route.pattern, normalizedPathname);
    if (!match) {
      continue;
    }

    const rawEntityId = route.entityType ? (match.params.id ?? null) : null;

    return {
      pathname: normalizedPathname,
      pageCategory: route.pageCategory,
      entityType: route.entityType,
      entityId: rawEntityId && isUuid(rawEntityId) ? rawEntityId : null,
      pageName: route.pageName,
      availableActions: [...route.availableActions],
      suggestions: [...route.suggestions],
    };
  }

  return {
    pathname: normalizedPathname,
    ...FALLBACK_PAGE_CONTEXT,
  };
}
