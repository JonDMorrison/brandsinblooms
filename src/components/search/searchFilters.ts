import {
  SEARCH_GROUP_ORDER,
  type SearchEntityType,
  type SearchGroupKey,
  type SearchResultGroup,
} from "@/components/search/types";

export type SearchFilterValue = "all" | SearchGroupKey;

interface SearchRequestConfig {
  cacheKey: string;
  campaignId: string | null;
  entityTypes: SearchEntityType[];
  skipDatabase: boolean;
}

const DEFAULT_DATABASE_ENTITY_TYPES: SearchEntityType[] = [
  "customer",
  "campaign",
  "product",
  "segment",
  "persona",
  "automation",
  "form",
  "saved_block",
  "sms_campaign",
  "sms_automation",
  "activity",
  "ticket",
  "integration",
  "community_story",
  "publish_item",
];

const GROUP_ENTITY_TYPES: Partial<Record<SearchGroupKey, SearchEntityType[]>> = {
  customers: ["customer"],
  campaigns: ["campaign", "campaign_recipient"],
  campaign_recipients: ["campaign_recipient"],
  products: ["product"],
  segments: ["segment"],
  personas: ["persona"],
  automations: ["automation"],
  forms: ["form"],
  saved_blocks: ["saved_block"],
  sms_campaigns: ["sms_campaign"],
  sms_automations: ["sms_automation"],
  activity: ["activity"],
  tickets: ["ticket"],
  integrations: ["integration"],
  community: ["community_story"],
  publish: ["publish_item"],
};

function uniqEntityTypes(entityTypes: SearchEntityType[]) {
  return Array.from(new Set(entityTypes));
}

function countResults(groups: SearchResultGroup[]) {
  return groups.reduce((total, group) => total + group.results.length, 0);
}

export function extractCampaignIdFromPath(pathname: string) {
  const segments = pathname.split("/").filter(Boolean);
  const campaignsIndex = segments.indexOf("campaigns");

  if (campaignsIndex === -1) {
    return null;
  }

  const candidate = segments[campaignsIndex + 1] ?? null;

  if (!candidate || candidate === "new" || candidate === "blocks") {
    return null;
  }

  return candidate;
}

export function isCampaignDetailRoute(pathname: string) {
  return extractCampaignIdFromPath(pathname) !== null;
}

export function getContextualSearchFilter(pathname: string): SearchFilterValue {
  if (pathname.startsWith("/crm/customers")) return "customers";
  if (pathname.startsWith("/crm/campaigns/blocks")) return "saved_blocks";
  if (pathname.startsWith("/crm/campaigns")) return "campaigns";
  if (pathname.startsWith("/products")) return "products";
  if (pathname.startsWith("/crm/segments")) return "segments";
  if (pathname.startsWith("/crm/personas")) return "personas";
  if (pathname.startsWith("/crm/automations")) return "automations";
  if (pathname.startsWith("/crm/forms")) return "forms";
  if (pathname.startsWith("/sms/automations")) return "sms_automations";
  if (pathname.startsWith("/sms")) return "sms_campaigns";
  if (pathname.startsWith("/activity")) return "activity";
  if (pathname.startsWith("/helpdesk")) return "tickets";
  if (pathname.startsWith("/integrations")) return "integrations";
  if (pathname.startsWith("/community")) return "community";
  if (pathname.startsWith("/publish")) return "publish";

  return "all";
}

export function filterSearchGroups(
  groups: SearchResultGroup[],
  filter: SearchFilterValue,
  pathname: string,
) {
  if (filter === "all") {
    return isCampaignDetailRoute(pathname)
      ? groups
      : groups.filter((group) => group.category !== "campaign_recipients");
  }

  if (filter === "campaigns") {
    return groups.filter(
      (group) =>
        group.category === "campaigns" || group.category === "campaign_recipients",
    );
  }

  return groups.filter((group) => group.category === filter);
}

export function getFilterResultCount(
  filter: SearchFilterValue,
  groups: SearchResultGroup[],
  pathname: string,
) {
  return countResults(filterSearchGroups(groups, filter, pathname));
}

export function getVisibleSearchFilters(
  groups: SearchResultGroup[],
  pathname: string,
) {
  return [
    "all" as const,
    ...SEARCH_GROUP_ORDER.filter(
      (groupKey) => getFilterResultCount(groupKey, groups, pathname) > 0,
    ),
  ];
}

export function coerceSearchFilter(
  filter: SearchFilterValue,
  groups: SearchResultGroup[],
  pathname: string,
) {
  return getFilterResultCount(filter, groups, pathname) > 0 ? filter : "all";
}

export function buildSearchRequestConfig(
  filter: SearchFilterValue,
  pathname: string,
): SearchRequestConfig {
  const campaignId = extractCampaignIdFromPath(pathname);
  const entityTypes =
    filter === "all"
      ? campaignId
        ? uniqEntityTypes([...DEFAULT_DATABASE_ENTITY_TYPES, "campaign_recipient"])
        : DEFAULT_DATABASE_ENTITY_TYPES
      : uniqEntityTypes(GROUP_ENTITY_TYPES[filter] ?? []);

  return {
    cacheKey: `${campaignId ?? "global"}|${filter}|${entityTypes.join(",")}`,
    campaignId,
    entityTypes,
    skipDatabase: entityTypes.length === 0,
  };
}