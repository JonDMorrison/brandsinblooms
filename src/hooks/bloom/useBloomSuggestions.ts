import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { BloomPageCategory, BloomPageContext } from "@/hooks/bloom/types";

const TENANT_SIGNAL_STALE_TIME_MS = 5 * 60 * 1000;
const SUGGESTION_COUNT = 4;
const MAX_CATEGORY_COUNT = 2;

export type BloomSuggestionCategory =
  | "analytics"
  | "business"
  | "campaign"
  | "customer"
  | "product";

export type BloomSuggestionIconHint =
  | "alert-triangle"
  | "badge-dollar-sign"
  | "bar-chart-3"
  | "clock"
  | "mail-plus"
  | "package"
  | "sparkles"
  | "users";

export interface ContextualSuggestion {
  prompt: string;
  label: string;
  description: string;
  category: BloomSuggestionCategory;
  iconHint: BloomSuggestionIconHint;
}

export interface BloomWorkspaceMemoryEntity {
  entityType: string;
  displayName: string;
}

export interface BloomWorkspaceMemoryAction {
  actionType: string;
  entityType: string | null;
  entityDisplayName: string;
}

export interface BloomWorkspaceMemory {
  recent_entities?: unknown;
  recentEntities?: unknown;
  recent_actions?: unknown;
  recentActions?: unknown;
}

export interface BloomSuggestionTenantSignals {
  draftCampaignCount: number;
  lowStockProductCount: number;
  daysSinceLastCampaignSent: number | null;
}

interface SuggestionCandidate extends ContextualSuggestion {
  id: string;
  isPageContextSuggestion?: boolean;
  pageCategories?: BloomSuggestionCategory[];
  timeBuckets?: TimeBucket[];
  priority: number;
  tenantSignal?: keyof BloomSuggestionTenantSignals;
}

interface GenerateBloomSuggestionsInput {
  pageContext: BloomPageContext | null | undefined;
  workspaceMemory: BloomWorkspaceMemory | null | undefined;
  tenantSignals?: BloomSuggestionTenantSignals | null;
  currentHour?: number;
}

type TimeBucket = "afternoon" | "evening" | "morning" | "night";

const EMPTY_TENANT_SIGNALS: BloomSuggestionTenantSignals = {
  draftCampaignCount: 0,
  lowStockProductCount: 0,
  daysSinceLastCampaignSent: null,
};

const STATIC_SUGGESTION_POOL: SuggestionCandidate[] = [
  {
    id: "campaign-performance",
    prompt: "How are my campaigns performing?",
    label: "Campaign performance",
    description: "Review recent sends, engagement, and next steps.",
    category: "campaign",
    iconHint: "bar-chart-3",
    pageCategories: ["campaign"],
    priority: 10,
  },
  {
    id: "draft-campaign",
    prompt: "Draft a new campaign",
    label: "Draft a campaign",
    description: "Start a polished email from your current goals.",
    category: "campaign",
    iconHint: "mail-plus",
    pageCategories: ["campaign"],
    priority: 20,
  },
  {
    id: "campaign-next-send",
    prompt: "What campaign should I send next?",
    label: "Next campaign idea",
    description: "Find the strongest message to send next.",
    category: "campaign",
    iconHint: "sparkles",
    pageCategories: ["campaign"],
    priority: 30,
  },
  {
    id: "top-customers",
    prompt: "Show me my top customers",
    label: "Top customers",
    description: "Find high-value customers worth focusing on.",
    category: "customer",
    iconHint: "users",
    pageCategories: ["customer"],
    priority: 40,
  },
  {
    id: "customer-follow-up",
    prompt: "Which customers need follow-up?",
    label: "Customer follow-up",
    description: "Spot customers who may need attention.",
    category: "customer",
    iconHint: "users",
    pageCategories: ["customer"],
    priority: 50,
  },
  {
    id: "customer-segment",
    prompt: "Create a useful customer segment",
    label: "Customer segment",
    description: "Group customers for a more focused campaign.",
    category: "customer",
    iconHint: "users",
    pageCategories: ["customer"],
    priority: 60,
  },
  {
    id: "low-stock-products",
    prompt: "Show me low-stock products",
    label: "Low stock",
    description: "Check inventory that may need attention.",
    category: "product",
    iconHint: "package",
    pageCategories: ["product"],
    priority: 70,
  },
  {
    id: "product-sellers",
    prompt: "What products are selling best?",
    label: "Best sellers",
    description: "Use product momentum for your next move.",
    category: "product",
    iconHint: "package",
    pageCategories: ["product", "analytics"],
    priority: 80,
  },
  {
    id: "product-promotion",
    prompt: "Help me plan a product promotion",
    label: "Product promotion",
    description: "Turn product activity into a campaign angle.",
    category: "product",
    iconHint: "mail-plus",
    pageCategories: ["product"],
    priority: 90,
  },
  {
    id: "business-health",
    prompt: "How's business going?",
    label: "Business check-in",
    description: "Review the latest signals across the CRM.",
    category: "business",
    iconHint: "badge-dollar-sign",
    pageCategories: ["business"],
    priority: 100,
  },
  {
    id: "revenue-month",
    prompt: "What's my revenue this month?",
    label: "Monthly revenue",
    description: "Summarize revenue signals and order trends.",
    category: "analytics",
    iconHint: "badge-dollar-sign",
    pageCategories: ["analytics", "business"],
    priority: 110,
  },
  {
    id: "compare-month",
    prompt: "Compare this month to last month",
    label: "Month comparison",
    description: "See what changed from the prior period.",
    category: "analytics",
    iconHint: "bar-chart-3",
    pageCategories: ["analytics"],
    priority: 120,
  },
  {
    id: "yesterday-summary",
    prompt: "Show me yesterday's summary",
    label: "Yesterday summary",
    description: "Start the day with yesterday's highlights.",
    category: "business",
    iconHint: "clock",
    timeBuckets: ["morning"],
    priority: 130,
  },
  {
    id: "today-focus",
    prompt: "What should I focus on today?",
    label: "Today's focus",
    description: "Prioritize the highest-impact work.",
    category: "business",
    iconHint: "sparkles",
    timeBuckets: ["morning"],
    priority: 140,
  },
  {
    id: "today-tracking",
    prompt: "How is today tracking?",
    label: "Today so far",
    description: "Check progress while there is still time to act.",
    category: "analytics",
    iconHint: "bar-chart-3",
    timeBuckets: ["afternoon"],
    priority: 150,
  },
  {
    id: "afternoon-attention",
    prompt: "What needs attention this afternoon?",
    label: "Attention areas",
    description: "Find anything that needs a same-day follow-up.",
    category: "business",
    iconHint: "alert-triangle",
    timeBuckets: ["afternoon"],
    priority: 160,
  },
  {
    id: "today-recap",
    prompt: "How did today go?",
    label: "Today recap",
    description: "Review today's customer, campaign, and sales signals.",
    category: "analytics",
    iconHint: "bar-chart-3",
    timeBuckets: ["evening"],
    priority: 170,
  },
  {
    id: "tomorrow-priorities",
    prompt: "Prep tomorrow's priorities",
    label: "Tomorrow prep",
    description: "Set up the next useful action before you wrap.",
    category: "business",
    iconHint: "clock",
    timeBuckets: ["evening", "night"],
    priority: 180,
  },
  {
    id: "draft-email",
    prompt: "Draft an email for my next promotion",
    label: "Promotion draft",
    description: "Shape a polished email for your next offer.",
    category: "campaign",
    iconHint: "mail-plus",
    priority: 190,
  },
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

function toFiniteNumber(value: unknown): number {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : 0;
}

function clampPositiveInteger(value: number): number {
  return Math.max(0, Math.floor(value));
}

function getTimeBucket(hour: number): TimeBucket {
  if (hour >= 5 && hour < 12) {
    return "morning";
  }

  if (hour >= 12 && hour < 17) {
    return "afternoon";
  }

  if (hour >= 17 && hour < 22) {
    return "evening";
  }

  return "night";
}

function inferPageCategory(
  pageContext: BloomPageContext | null | undefined,
): BloomSuggestionCategory | null {
  const pageCategory = pageContext?.pageCategory;

  if (pageCategory) {
    return mapBloomPageCategory(pageCategory);
  }

  const pathname = pageContext?.pathname?.toLowerCase() ?? "";
  const entityType = pageContext?.entityType?.toLowerCase() ?? "";

  if (pathname.includes("campaign") || entityType.includes("campaign")) {
    return "campaign";
  }

  if (pathname.includes("product") || entityType.includes("product")) {
    return "product";
  }

  if (
    pathname.includes("customer") ||
    pathname.includes("contact") ||
    entityType.includes("customer")
  ) {
    return "customer";
  }

  if (pathname.includes("analytics") || pathname.includes("report")) {
    return "analytics";
  }

  if (pathname === "/" || pathname.includes("dashboard")) {
    return "business";
  }

  return null;
}

function mapBloomPageCategory(
  pageCategory: BloomPageCategory,
): BloomSuggestionCategory | null {
  switch (pageCategory) {
    case "dashboard":
    case "integrations":
    case "settings":
    case "bloom":
    case "other":
      return "business";
    case "customers":
      return "customer";
    case "products":
      return "product";
    case "campaigns":
      return "campaign";
    case "analytics":
      return "analytics";
    case "segments":
      return "customer";
  }
}

function normalizeEntity(value: unknown): BloomWorkspaceMemoryEntity | null {
  if (!isRecord(value)) {
    return null;
  }

  const entityType =
    readString(value.entity_type) ?? readString(value.entityType);
  const displayName =
    readString(value.display_name) ??
    readString(value.displayName) ??
    readString(value.name) ??
    readString(value.label);

  if (!entityType || !displayName) {
    return null;
  }

  return { entityType, displayName };
}

function normalizeAction(value: unknown): BloomWorkspaceMemoryAction | null {
  if (!isRecord(value)) {
    return null;
  }

  const actionType =
    readString(value.action_type) ?? readString(value.actionType);
  const entityDisplayName =
    readString(value.entity_display_name) ??
    readString(value.entityDisplayName) ??
    readString(value.display_name) ??
    readString(value.displayName);

  if (!actionType || !entityDisplayName) {
    return null;
  }

  return {
    actionType,
    entityType: readString(value.entity_type) ?? readString(value.entityType),
    entityDisplayName,
  };
}

function normalizeArray<T>(
  value: unknown,
  parser: (entry: unknown) => T | null,
): T[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map(parser).filter((entry): entry is T => entry !== null);
}

function normalizeWorkspaceMemory(
  memory: BloomWorkspaceMemory | null | undefined,
) {
  const source = memory ?? {};
  return {
    recentEntities: normalizeArray(
      source.recent_entities ?? source.recentEntities,
      normalizeEntity,
    ).slice(0, 3),
    recentActions: normalizeArray(
      source.recent_actions ?? source.recentActions,
      normalizeAction,
    ).slice(0, 2),
  };
}

function entityCategory(entityType: string): BloomSuggestionCategory {
  const normalizedType = entityType.toLowerCase();

  if (normalizedType.includes("campaign")) {
    return "campaign";
  }

  if (normalizedType.includes("product")) {
    return "product";
  }

  if (
    normalizedType.includes("customer") ||
    normalizedType.includes("contact")
  ) {
    return "customer";
  }

  return "business";
}

function memoryEntitySuggestion(
  entity: BloomWorkspaceMemoryEntity,
  index: number,
): SuggestionCandidate {
  const category = entityCategory(entity.entityType);

  if (category === "campaign") {
    return {
      id: `memory-campaign-${index}`,
      prompt: `Review ${entity.displayName} campaign results`,
      label: `Review ${entity.displayName}`,
      description: "Pick up from a recent campaign context.",
      category,
      iconHint: "bar-chart-3",
      priority: 200 + index,
    };
  }

  if (category === "product") {
    return {
      id: `memory-product-${index}`,
      prompt: `Tell me how ${entity.displayName} is performing`,
      label: `Check ${entity.displayName}`,
      description: "Continue from a product you recently touched.",
      category,
      iconHint: "package",
      priority: 200 + index,
    };
  }

  if (category === "customer") {
    return {
      id: `memory-customer-${index}`,
      prompt: `Tell me more about ${entity.displayName}`,
      label: `Review ${entity.displayName}`,
      description: "Open up recent customer context.",
      category,
      iconHint: "users",
      priority: 200 + index,
    };
  }

  return {
    id: `memory-entity-${index}`,
    prompt: `Tell me more about ${entity.displayName}`,
    label: `Review ${entity.displayName}`,
    description: "Continue from recent Bloom context.",
    category,
    iconHint: "sparkles",
    priority: 200 + index,
  };
}

function memoryActionSuggestion(
  action: BloomWorkspaceMemoryAction,
  index: number,
): SuggestionCandidate | null {
  const actionType = action.actionType.toLowerCase();
  const entityType = action.entityType?.toLowerCase() ?? "";
  const actionAndEntityType = `${actionType} ${entityType}`;

  if (
    actionType.includes("created") &&
    actionAndEntityType.includes("customer")
  ) {
    return {
      id: `memory-action-customer-segment-${index}`,
      prompt: `Add ${action.entityDisplayName} to a useful segment`,
      label: "Segment recent customer",
      description: "Turn a recent customer action into follow-up.",
      category: "customer",
      iconHint: "users",
      priority: 230 + index,
    };
  }

  if (
    actionType.includes("created") &&
    actionAndEntityType.includes("campaign")
  ) {
    return {
      id: `memory-action-campaign-review-${index}`,
      prompt: `Review ${action.entityDisplayName} before sending`,
      label: "Review recent draft",
      description: "Continue from a campaign you recently created.",
      category: "campaign",
      iconHint: "mail-plus",
      priority: 230 + index,
    };
  }

  return null;
}

function tenantSignalSuggestions(
  tenantSignals: BloomSuggestionTenantSignals,
): SuggestionCandidate[] {
  const suggestions: SuggestionCandidate[] = [];

  if (tenantSignals.draftCampaignCount > 0) {
    const draftCampaignSuffix =
      tenantSignals.draftCampaignCount === 1 ? "" : "s";

    suggestions.push({
      id: "tenant-draft-campaigns",
      prompt:
        "Review my " +
        tenantSignals.draftCampaignCount +
        " draft campaign" +
        draftCampaignSuffix,
      label: "Review drafts",
      description:
        tenantSignals.draftCampaignCount +
        " draft campaign" +
        draftCampaignSuffix +
        " may be ready to polish.",
      category: "campaign",
      iconHint: "mail-plus",
      priority: 240,
      tenantSignal: "draftCampaignCount",
    });
  }

  if (tenantSignals.lowStockProductCount > 0) {
    const lowStockSuffix = tenantSignals.lowStockProductCount === 1 ? "" : "s";

    suggestions.push({
      id: "tenant-low-stock",
      prompt:
        "Show me the " +
        tenantSignals.lowStockProductCount +
        " low-stock product" +
        lowStockSuffix,
      label: "Low-stock products",
      description:
        tenantSignals.lowStockProductCount +
        " product" +
        lowStockSuffix +
        " may need inventory attention.",
      category: "product",
      iconHint: "alert-triangle",
      priority: 250,
      tenantSignal: "lowStockProductCount",
    });
  }

  if (
    tenantSignals.daysSinceLastCampaignSent !== null &&
    tenantSignals.daysSinceLastCampaignSent >= 7
  ) {
    suggestions.push({
      id: "tenant-campaign-gap",
      prompt:
        "It's been " +
        tenantSignals.daysSinceLastCampaignSent +
        " days since my last campaign - what should I send?",
      label: "Campaign timing",
      description: "Use the campaign gap to plan the next message.",
      category: "campaign",
      iconHint: "clock",
      priority: 260,
      tenantSignal: "daysSinceLastCampaignSent",
    });
  }

  return suggestions;
}

function titleCaseWords(value: string): string {
  return value
    .trim()
    .replace(/[?!.]+$/g, "")
    .replace(/\s+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function iconHintForCategory(
  category: BloomSuggestionCategory,
): BloomSuggestionIconHint {
  switch (category) {
    case "analytics":
      return "bar-chart-3";
    case "campaign":
      return "mail-plus";
    case "customer":
      return "users";
    case "product":
      return "package";
    case "business":
      return "sparkles";
  }
}

function pageContextSuggestions(
  pageContext: BloomPageContext | null | undefined,
  pageCategory: BloomSuggestionCategory | null,
): SuggestionCandidate[] {
  if (!pageContext || !pageCategory || pageContext.suggestions.length === 0) {
    return [];
  }

  return pageContext.suggestions
    .map((prompt, index) => {
      const normalizedPrompt = readString(prompt) ?? prompt.trim();
      if (!normalizedPrompt) {
        return null;
      }

      return {
        id: `page-context-${pageContext.pageCategory}-${index}`,
        prompt: normalizedPrompt,
        label: titleCaseWords(normalizedPrompt),
        description: `Suggested from the ${pageContext.pageName} page.`,
        category: pageCategory,
        iconHint: iconHintForCategory(pageCategory),
        priority: index,
        isPageContextSuggestion: true,
        pageCategories: [pageCategory],
      } satisfies SuggestionCandidate;
    })
    .filter(
      (candidate): candidate is SuggestionCandidate => candidate !== null,
    );
}

function scoreSuggestion(args: {
  candidate: SuggestionCandidate;
  pageCategory: BloomSuggestionCategory | null;
  tenantSignals: BloomSuggestionTenantSignals;
  timeBucket: TimeBucket;
}) {
  let score = 1;

  if (args.candidate.isPageContextSuggestion) {
    score += 15;
  }

  if (
    args.pageCategory &&
    (args.candidate.pageCategories?.includes(args.pageCategory) ||
      args.candidate.category === args.pageCategory)
  ) {
    score += 10;
  }

  if (args.candidate.timeBuckets?.includes(args.timeBucket)) {
    score += 5;
  }

  if (args.candidate.id.startsWith("memory-")) {
    score += 8;
  }

  if (args.candidate.tenantSignal) {
    const signalValue = args.tenantSignals[args.candidate.tenantSignal];
    if (
      typeof signalValue === "number" ? signalValue > 0 : signalValue !== null
    ) {
      score += 7;
    }
  }

  return score;
}

function uniqueCandidates(candidates: SuggestionCandidate[]) {
  const seenPrompts = new Set<string>();
  const deduped: SuggestionCandidate[] = [];

  for (const candidate of candidates) {
    const key = candidate.prompt.trim().toLowerCase();
    if (seenPrompts.has(key)) {
      continue;
    }
    seenPrompts.add(key);
    deduped.push(candidate);
  }

  return deduped;
}

export function generateBloomSuggestions({
  currentHour = 12,
  pageContext,
  tenantSignals = EMPTY_TENANT_SIGNALS,
  workspaceMemory,
}: GenerateBloomSuggestionsInput): ContextualSuggestion[] {
  const normalizedTenantSignals = tenantSignals ?? EMPTY_TENANT_SIGNALS;
  const pageCategory = inferPageCategory(pageContext);
  const timeBucket = getTimeBucket(currentHour);
  const memory = normalizeWorkspaceMemory(workspaceMemory);
  const dynamicCandidates = [
    ...pageContextSuggestions(pageContext, pageCategory),
    ...memory.recentEntities.map(memoryEntitySuggestion),
    ...memory.recentActions
      .map(memoryActionSuggestion)
      .filter(
        (candidate): candidate is SuggestionCandidate => candidate !== null,
      ),
    ...tenantSignalSuggestions(normalizedTenantSignals),
  ];
  const scoredCandidates = uniqueCandidates([
    ...dynamicCandidates,
    ...STATIC_SUGGESTION_POOL,
  ])
    .map((candidate) => ({
      candidate,
      score: scoreSuggestion({
        candidate,
        pageCategory,
        tenantSignals: normalizedTenantSignals,
        timeBucket,
      }),
    }))
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }

      return left.candidate.priority - right.candidate.priority;
    });
  const selected: ContextualSuggestion[] = [];
  const categoryCounts = new Map<BloomSuggestionCategory, number>();

  for (const { candidate } of scoredCandidates) {
    if (candidate.isPageContextSuggestion) {
      selected.push({
        prompt: candidate.prompt,
        label: candidate.label,
        description: candidate.description,
        category: candidate.category,
        iconHint: candidate.iconHint,
      });

      if (selected.length === SUGGESTION_COUNT) {
        return selected;
      }

      continue;
    }

    const currentCount = categoryCounts.get(candidate.category) ?? 0;
    if (currentCount >= MAX_CATEGORY_COUNT) {
      continue;
    }

    selected.push({
      prompt: candidate.prompt,
      label: candidate.label,
      description: candidate.description,
      category: candidate.category,
      iconHint: candidate.iconHint,
    });
    categoryCounts.set(candidate.category, currentCount + 1);

    if (selected.length === SUGGESTION_COUNT) {
      return selected;
    }
  }

  return selected;
}

async function fetchBloomSuggestionTenantSignals(
  tenantId: string,
): Promise<BloomSuggestionTenantSignals> {
  const [draftCampaigns, inventoryProducts, lastCampaign] = await Promise.all([
    supabase
      .from("crm_campaigns")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .eq("status", "draft"),
    supabase
      .from("products")
      .select("id, inventory_count, low_stock_threshold")
      .eq("tenant_id", tenantId)
      .eq("status", "active")
      .eq("track_inventory", true),
    supabase
      .from("crm_campaigns")
      .select("sent_at, send_completed_at")
      .eq("tenant_id", tenantId)
      .in("status", ["sent", "sent_with_errors"])
      .not("sent_at", "is", null)
      .order("sent_at", { ascending: false })
      .limit(1),
  ]);

  if (draftCampaigns.error) {
    throw draftCampaigns.error;
  }
  if (inventoryProducts.error) {
    throw inventoryProducts.error;
  }
  if (lastCampaign.error) {
    throw lastCampaign.error;
  }

  const lowStockProductCount = (inventoryProducts.data ?? []).filter(
    (product) => {
      const inventoryCount = toFiniteNumber(product.inventory_count);
      const threshold = toFiniteNumber(product.low_stock_threshold);
      return threshold > 0 && inventoryCount <= threshold;
    },
  ).length;
  const lastSentAt =
    lastCampaign.data?.[0]?.sent_at ??
    lastCampaign.data?.[0]?.send_completed_at;
  const daysSinceLastCampaignSent = lastSentAt
    ? Math.max(
        0,
        Math.floor((Date.now() - new Date(lastSentAt).getTime()) / 86_400_000),
      )
    : null;

  return {
    draftCampaignCount: clampPositiveInteger(draftCampaigns.count ?? 0),
    lowStockProductCount,
    daysSinceLastCampaignSent,
  };
}

export function useBloomSuggestions(
  pageContext: BloomPageContext | null | undefined,
  workspaceMemory: BloomWorkspaceMemory | null | undefined,
  tenantId: string | null | undefined,
) {
  const currentHour = new Date().getHours();
  const tenantSignalsQuery = useQuery({
    queryKey: ["bloom-suggestion-signals", tenantId],
    queryFn: () =>
      tenantId
        ? fetchBloomSuggestionTenantSignals(tenantId)
        : Promise.resolve(EMPTY_TENANT_SIGNALS),
    enabled: Boolean(tenantId),
    staleTime: TENANT_SIGNAL_STALE_TIME_MS,
    refetchOnWindowFocus: false,
  });
  const tenantSignals = tenantSignalsQuery.data ?? EMPTY_TENANT_SIGNALS;
  const data = React.useMemo(
    () =>
      generateBloomSuggestions({
        currentHour,
        pageContext,
        tenantSignals,
        workspaceMemory,
      }),
    [currentHour, pageContext, tenantSignals, workspaceMemory],
  );

  return {
    data,
    isLoading: tenantSignalsQuery.isLoading,
  };
}
