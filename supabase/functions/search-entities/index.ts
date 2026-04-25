import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import { createClient } from "npm:@supabase/supabase-js@2";

import {
  buildCorsHeaders,
  handleCorsPreflight,
} from "../_shared/cors.ts";

type SearchEntityType =
  | "customer"
  | "campaign"
  | "campaign_recipient"
  | "product"
  | "segment"
  | "persona"
  | "automation"
  | "form"
  | "saved_block"
  | "sms_campaign"
  | "sms_automation"
  | "activity"
  | "ticket"
  | "integration"
  | "community_story"
  | "publish_item";

type SearchGroupKey =
  | "customers"
  | "campaigns"
  | "campaign_recipients"
  | "products"
  | "segments"
  | "personas"
  | "automations"
  | "forms"
  | "saved_blocks"
  | "sms_campaigns"
  | "sms_automations"
  | "activity"
  | "tickets"
  | "integrations"
  | "community"
  | "publish";

type SearchResultItem = {
  id: string;
  type: SearchEntityType;
  title: string;
  subtitle?: string;
  route: string;
  icon?: string;
  categoryIcon: string;
  metadata?: string;
  keywords?: string[];
  group: SearchGroupKey;
};

type SearchResultGroup = {
  category: SearchGroupKey;
  title: string;
  icon: string;
  results: SearchResultItem[];
};

type SearchRequestBody = {
  query?: unknown;
  entity_types?: unknown;
  campaign_id?: unknown;
  fuzzy?: unknown;
  limit?: unknown;
  offset?: unknown;
};

type TenantRow = {
  id: string;
  website: string | null;
};

type DomainRow = {
  domain: string;
  tenant_id: string;
};

type UserTenantMembershipRow = {
  tenant_id: string | null;
};

type CustomerSearchRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  city: string | null;
  preferred_channel: string | null;
};

type CampaignSearchRow = {
  id: string;
  name: string | null;
  subject_line: string | null;
  preheader_text: string | null;
  status: string | null;
};

type ProductSearchRow = {
  id: string;
  name: string;
  sku: string | null;
  category: string | null;
  subcategory: string | null;
  description: string | null;
  status: string | null;
};

type SegmentSearchRow = {
  id: string;
  name: string;
  description: string | null;
  status: string;
  customer_count: number | null;
};

type PersonaSearchRow = {
  id: string;
  persona_name: string;
  persona_description: string | null;
};

type AutomationSearchRow = {
  id: string;
  name: string;
  trigger_type: string;
  template_source: string | null;
  is_active: boolean | null;
};

type FormSearchRow = {
  id: string;
  name: string;
  status: string;
  embed_key: string | null;
};

type SavedBlockSearchRow = {
  id: string;
  name: string;
  block_type: string;
  tags: string[] | null;
  is_favorite: boolean | null;
};

type SmsCampaignSearchRow = {
  id: string;
  name: string;
  message: string;
  status: string;
  scheduled_at: string | null;
  sent_at: string | null;
  source: string | null;
};

type SmsAutomationSearchRow = {
  id: string;
  name: string;
  description: string | null;
  status: string | null;
  trigger_type: string;
};

type ActivitySearchRow = {
  id: string;
  title: string;
  activity_type: string;
  status: string;
  source: string;
  integration_name: string | null;
  timestamp: string;
  error_message: string | null;
};

type TicketSearchRow = {
  id: string;
  subject: string;
  ticket_number: string;
  priority: string | null;
  status: string | null;
  created_at: string | null;
};

type ProviderConnectionSearchRow = {
  id: string;
  provider: string;
  provider_account_id: string | null;
  provider_account_name: string | null;
  status: string;
  connected_at: string | null;
  updated_at: string | null;
};

type PosConnectionSearchRow = {
  id: string;
  name: string;
  platform: string;
  is_active: boolean;
  last_sync_at: string | null;
  sync_error: string | null;
  sync_status: string | null;
};

type SocialConnectionSearchRow = {
  id: string;
  platform: string;
  platform_account_id: string;
  platform_account_name: string | null;
  username: string | null;
  is_active: boolean;
  expires_at: string | null;
};

type CommunityStorySearchRow = {
  id: string;
  customer_name: string | null;
  caption_text: string | null;
  status: string;
  tags: string[] | null;
  created_at: string;
};

type PublishItemSearchRow = {
  id: string;
  ai_output: string | null;
  post_type: string | null;
  status: string;
  scheduled_date: string | null;
  hashtags: string | null;
  notes: string | null;
};

type CampaignRecipientRelationCampaign = {
  name: string | null;
};

type CampaignRecipientRelationCustomer = {
  first_name: string | null;
  last_name: string | null;
};

type CampaignRecipientMessageSearchRow = {
  id: string;
  campaign_id: string;
  email: string;
  status: string;
  sent_at: string | null;
  created_at: string;
  crm_campaigns?: CampaignRecipientRelationCampaign | CampaignRecipientRelationCampaign[] | null;
  crm_customers?: CampaignRecipientRelationCustomer | CampaignRecipientRelationCustomer[] | null;
};

type CampaignRecipientMatchRow = {
  recipient_id: string;
  customer_id: string;
  customer_name: string;
  customer_email: string;
  send_status: string;
  latest_event: string;
  latest_event_at: string;
  delivery_status: string;
  sent_at: string;
  all_events: string[];
};

type SupabaseClientLike = any;

type ScoredSearchResult = SearchResultItem & { score: number };

const SEARCH_GROUP_ORDER: SearchGroupKey[] = [
  "customers",
  "campaigns",
  "campaign_recipients",
  "products",
  "segments",
  "personas",
  "automations",
  "forms",
  "saved_blocks",
  "sms_campaigns",
  "sms_automations",
  "activity",
  "tickets",
  "integrations",
  "community",
  "publish",
];

const SEARCH_GROUP_METADATA: Record<
  SearchGroupKey,
  { title: string; icon: string }
> = {
  customers: { title: "Customers", icon: "customers" },
  campaigns: { title: "Campaigns", icon: "campaigns" },
  campaign_recipients: { title: "Campaign Recipients", icon: "mail" },
  products: { title: "Products", icon: "products" },
  segments: { title: "Segments", icon: "segments" },
  personas: { title: "Personas", icon: "personas" },
  automations: { title: "Automations", icon: "automations" },
  forms: { title: "Forms", icon: "forms" },
  saved_blocks: { title: "Saved Blocks", icon: "saved-block" },
  sms_campaigns: { title: "SMS Campaigns", icon: "sms" },
  sms_automations: { title: "SMS Automations", icon: "sms" },
  activity: { title: "Activity", icon: "activity" },
  tickets: { title: "Tickets", icon: "support" },
  integrations: { title: "Integrations", icon: "integrations" },
  community: { title: "Community", icon: "community" },
  publish: { title: "Publish", icon: "publish" },
};

const ENTITY_GROUP_MAP: Record<SearchEntityType, SearchGroupKey> = {
  customer: "customers",
  campaign: "campaigns",
  campaign_recipient: "campaign_recipients",
  product: "products",
  segment: "segments",
  persona: "personas",
  automation: "automations",
  form: "forms",
  saved_block: "saved_blocks",
  sms_campaign: "sms_campaigns",
  sms_automation: "sms_automations",
  activity: "activity",
  ticket: "tickets",
  integration: "integrations",
  community_story: "community",
  publish_item: "publish",
};

const ENTITY_ICON_MAP: Record<SearchEntityType, string> = {
  customer: "customers",
  campaign: "campaigns",
  campaign_recipient: "mail",
  product: "products",
  segment: "segments",
  persona: "personas",
  automation: "automations",
  form: "forms",
  saved_block: "saved-block",
  sms_campaign: "sms",
  sms_automation: "sms",
  activity: "activity",
  ticket: "support",
  integration: "integrations",
  community_story: "community",
  publish_item: "publish",
};

const ALLOWED_ENTITY_TYPES: SearchEntityType[] = [
  "customer",
  "campaign",
  "campaign_recipient",
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

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 30;
const MAX_QUERY_LENGTH = 80;
const MIN_QUERY_LENGTH = 2;
const MAX_GROUP_RESULTS = 5;
const MAX_TOTAL_RESULTS = 30;
const MAX_OFFSET = 20;
const QUERY_TIMEOUT_MS = 1_750;
const ACTIVITY_LOOKBACK_MS = 90 * 24 * 60 * 60 * 1_000;

const rateLimitStore = new Map<string, { count: number; resetAt: number }>();
const searchEntitiesCorsHeaders = buildCorsHeaders(undefined, {
  allowMethods: "POST, OPTIONS",
});

function jsonResponse(
  body: Record<string, unknown>,
  status = 200,
  extraHeaders: Record<string, string> = {},
) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...searchEntitiesCorsHeaders,
      "Content-Type": "application/json",
      ...extraHeaders,
    },
  });
}

function normalizeQuery(input: unknown) {
  if (typeof input !== "string") {
    return "";
  }

  return input
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[,*()]/g, " ")
    .replace(/[%_]/g, "")
    .slice(0, MAX_QUERY_LENGTH)
    .trim();
}

function normalizeEntityTypes(input: unknown): SearchEntityType[] {
  if (!Array.isArray(input)) {
    return ALLOWED_ENTITY_TYPES;
  }

  const normalized = input
    .map((value) => String(value ?? "").trim())
    .filter((value): value is SearchEntityType =>
      ALLOWED_ENTITY_TYPES.includes(value as SearchEntityType)
    );

  return normalized.length > 0 ? normalized : ALLOWED_ENTITY_TYPES;
}

function normalizeLimit(input: unknown) {
  const parsed = Number(input);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return MAX_GROUP_RESULTS;
  }

  return Math.min(Math.floor(parsed), MAX_GROUP_RESULTS);
}

function normalizeOffset(input: unknown) {
  const parsed = Number(input);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 0;
  }

  return Math.min(Math.floor(parsed), MAX_OFFSET);
}

function normalizeCampaignId(input: unknown) {
  if (typeof input !== "string") {
    return null;
  }

  const trimmed = input.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeFuzzy(input: unknown) {
  if (typeof input === "boolean") {
    return input;
  }

  if (typeof input === "string") {
    const normalized = input.trim().toLowerCase();

    if (normalized === "false") {
      return false;
    }

    if (normalized === "true") {
      return true;
    }
  }

  return true;
}

function tokenizeSearchQuery(query: string) {
  return query
    .toLowerCase()
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean);
}

function scoreSearchResult(
  query: string,
  title: string,
  subtitle?: string,
  keywords: string[] = [],
) {
  const titleLower = title.toLowerCase();
  const subtitleLower = subtitle?.toLowerCase() ?? "";
  const loweredKeywords = keywords.map((keyword) => keyword.toLowerCase());

  return tokenizeSearchQuery(query).reduce((score, token) => {
    const exactTitleWord = titleLower.split(/\s+/).some((word) => word === token);
    const exactKeyword = loweredKeywords.some((keyword) => keyword === token);

    if (exactTitleWord) {
      return score + 10;
    }

    if (titleLower.startsWith(token)) {
      return score + 7;
    }

    if (exactKeyword) {
      return score + 5;
    }

    if (titleLower.includes(token)) {
      return score + 4;
    }

    if (loweredKeywords.some((keyword) => keyword.includes(token))) {
      return score + 3;
    }

    if (subtitleLower.includes(token)) {
      return score + 2;
    }

    return score;
  }, 0);
}

function createTimeoutSignal() {
  if (typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function") {
    return AbortSignal.timeout(QUERY_TIMEOUT_MS);
  }

  return undefined;
}

function applyTimeout<T extends { abortSignal?: (signal: AbortSignal) => T }>(
  query: T,
) {
  const signal = createTimeoutSignal();

  if (!signal || typeof query.abortSignal !== "function") {
    return query;
  }

  return query.abortSignal(signal);
}

function createSearchItem(
  type: SearchEntityType,
  item: Omit<SearchResultItem, "group" | "categoryIcon" | "icon" | "type">,
  query: string,
  keywords: string[] = [],
) {
  const group = ENTITY_GROUP_MAP[type];
  const icon = ENTITY_ICON_MAP[type];

  return {
    ...item,
    type,
    group,
    icon,
    categoryIcon: SEARCH_GROUP_METADATA[group].icon,
    keywords,
    score: scoreSearchResult(query, item.title, item.subtitle, keywords),
  } satisfies ScoredSearchResult;
}

function formatStatus(value: string | null | undefined) {
  if (!value) {
    return undefined;
  }

  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function joinSubtitle(parts: Array<string | null | undefined>) {
  return parts
    .map((part) => String(part ?? "").trim())
    .filter(Boolean)
    .join(" • ") || undefined;
}

function excerptText(value: string | null | undefined, maxLength = 96) {
  const normalized = String(value ?? "").replace(/\s+/g, " ").trim();

  if (!normalized) {
    return undefined;
  }

  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

function getRelationRecord<T extends Record<string, unknown>>(value: unknown) {
  if (Array.isArray(value)) {
    const firstValue = value[0];
    return firstValue && typeof firstValue === "object"
      ? (firstValue as T)
      : null;
  }

  return value && typeof value === "object" ? (value as T) : null;
}

function slugifyProviderSegment(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function getIntegrationSlug(value: string | null | undefined) {
  const normalized = slugifyProviderSegment(String(value ?? ""));

  switch (normalized) {
    case "facebook":
    case "instagram":
    case "meta":
    case "facebook-instagram":
      return "meta";
    case "google-analytics":
    case "google-analytics-4":
    case "google-analytics4":
    case "ga4":
      return "google-analytics";
    case "constant-contact":
    case "constantcontact":
      return "constant-contact";
    case "custom-webhook":
    case "custom-webhooks":
    case "webhooks":
      return "custom-webhooks";
    case "email-infrastructure":
    case "resend":
    case "domains":
      return "email-infrastructure";
    case "lightspeed-x-series":
    case "lightspeed-series":
      return "lightspeed";
    default:
      return normalized || "integrations";
  }
}

function formatProviderLabel(value: string | null | undefined) {
  const slug = getIntegrationSlug(value);

  switch (slug) {
    case "meta":
      return "Meta";
    case "google-analytics":
      return "Google Analytics 4";
    case "constant-contact":
      return "Constant Contact";
    case "custom-webhooks":
      return "Custom Webhooks";
    case "email-infrastructure":
      return "Email Infrastructure";
    case "lightspeed":
      return "Lightspeed";
    default:
      return slug
        .split("-")
        .filter(Boolean)
        .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
        .join(" ");
  }
}

function getRouteWithQuery(pathname: string, params: Record<string, string>) {
  const searchParams = new URLSearchParams(params);
  return `${pathname}?${searchParams.toString()}`;
}

function isTimeoutError(error: unknown) {
  const name =
    error instanceof Error
      ? error.name
      : typeof error === "object" && error !== null && "name" in error
        ? String((error as { name?: unknown }).name ?? "")
        : "";
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "object" && error !== null && "message" in error
        ? String((error as { message?: unknown }).message ?? "")
        : "";

  return /abort|timeout/i.test(name) || /abort|timeout/i.test(message);
}

function normalizeHostCandidate(value: string | null) {
  if (!value) {
    return null;
  }

  try {
    const asUrl = new URL(value);
    return asUrl.host.toLowerCase();
  } catch {
    return value.split(",")[0]?.trim().toLowerCase().replace(/^https?:\/\//, "")
      .split("/")[0]
      ?.replace(/:\d+$/, "") || null;
  }
}

function extractCandidateHosts(req: Request) {
  const candidates = new Set<string>();
  const supabaseHost = normalizeHostCandidate(Deno.env.get("SUPABASE_URL") ?? null);

  const rawValues = [
    req.headers.get("x-forwarded-host"),
    req.headers.get("host"),
    req.headers.get("origin"),
    req.headers.get("referer"),
  ];

  for (const value of rawValues) {
    const normalized = normalizeHostCandidate(value);

    if (!normalized) {
      continue;
    }

    const withoutPort = normalized.replace(/:\d+$/, "");

    if (
      withoutPort === "localhost" ||
      withoutPort === "127.0.0.1" ||
      withoutPort === supabaseHost
    ) {
      continue;
    }

    candidates.add(withoutPort);

    if (withoutPort.startsWith("www.")) {
      candidates.add(withoutPort.slice(4));
    }
  }

  return Array.from(candidates);
}

function normalizeWebsiteHost(value: string | null) {
  if (!value) {
    return null;
  }

  try {
    return new URL(value).host.toLowerCase();
  } catch {
    try {
      return new URL(`https://${value}`).host.toLowerCase();
    } catch {
      return null;
    }
  }
}

async function resolveUserTenantId(
  supabase: SupabaseClientLike,
  userId: string,
) {
  const { data, error } = await supabase
    .from("users")
    .select("tenant_id")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to resolve tenant membership: ${error.message}`);
  }

  const membership = data as UserTenantMembershipRow | null;

  return membership?.tenant_id ?? null;
}

async function resolveHostTenantId(
  supabase: SupabaseClientLike,
  candidateHosts: string[],
) {
  if (candidateHosts.length === 0) {
    return null;
  }

  try {
    const { data: domainRows, error: domainError } = await supabase
      .from("domains")
      .select("domain, tenant_id")
      .in("domain", candidateHosts);

    if (domainError) {
      throw domainError;
    }

    const matchedDomain = (domainRows as DomainRow[] | null)?.find((row) =>
      candidateHosts.includes(row.domain.toLowerCase())
    );

    if (matchedDomain?.tenant_id) {
      return matchedDomain.tenant_id;
    }
  } catch (error) {
    console.warn("[search-entities] Failed domains host lookup:", error);
  }

  try {
    const { data: tenantRows, error: tenantError } = await supabase
      .from("tenants")
      .select("id, website")
      .not("website", "is", null);

    if (tenantError) {
      throw tenantError;
    }

    const matchedTenant = (tenantRows as TenantRow[] | null)?.find((row) => {
      const websiteHost = normalizeWebsiteHost(row.website);
      return websiteHost ? candidateHosts.includes(websiteHost) : false;
    });

    return matchedTenant?.id ?? null;
  } catch (error) {
    console.warn("[search-entities] Failed tenant website host lookup:", error);
    return null;
  }
}

function enforceRateLimit(userId: string) {
  const now = Date.now();

  for (const [key, record] of rateLimitStore.entries()) {
    if (now > record.resetAt) {
      rateLimitStore.delete(key);
    }
  }

  const record = rateLimitStore.get(userId);

  if (!record || now > record.resetAt) {
    rateLimitStore.set(userId, {
      count: 1,
      resetAt: now + RATE_LIMIT_WINDOW_MS,
    });

    return { limited: false, retryAfterSeconds: 0 };
  }

  if (record.count >= RATE_LIMIT_MAX_REQUESTS) {
    return {
      limited: true,
      retryAfterSeconds: Math.max(1, Math.ceil((record.resetAt - now) / 1_000)),
    };
  }

  record.count += 1;
  return { limited: false, retryAfterSeconds: 0 };
}

function buildOrFilter(columns: string[], query: string, fuzzy = true) {
  const clauses = new Set(columns.map((column) => `${column}.ilike.*${query}*`));

  if (fuzzy) {
    for (const token of tokenizeSearchQuery(query)) {
      if (token.length < 2) {
        continue;
      }

      const relaxedPrefix = token.length >= 5 ? token.slice(0, token.length - 2) : token;

      for (const column of columns) {
        clauses.add(`${column}.ilike.${token}*`);

        if (relaxedPrefix.length >= 3 && relaxedPrefix !== token) {
          clauses.add(`${column}.ilike.${relaxedPrefix}*`);
        }
      }
    }
  }

  return Array.from(clauses).join(",");
}

function buildPrefixOnlyFilter(columns: string[], query: string) {
  const trimmedQuery = query.trim();
  const clauses = new Set<string>();

  if (!trimmedQuery) {
    return "";
  }

  for (const column of columns) {
    clauses.add(`${column}.ilike.${trimmedQuery}*`);
  }

  for (const token of tokenizeSearchQuery(trimmedQuery)) {
    if (token.length < 2) {
      continue;
    }

    for (const column of columns) {
      clauses.add(`${column}.ilike.${token}*`);
    }
  }

  return Array.from(clauses).join(",");
}

function sortAndSliceResults(
  results: ScoredSearchResult[],
  limit: number,
  offset: number,
) {
  return results
    .filter((result) => result.score > 0)
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }

      return left.title.localeCompare(right.title);
    })
    .slice(offset, offset + limit)
    .map(({ score: _score, ...result }) => result);
}

async function searchCustomers(
  supabase: SupabaseClientLike,
  tenantId: string,
  query: string,
  limit: number,
  offset: number,
  fuzzy = true,
) {
  const runCustomerRequest = async (prefixOnly = false) => {
    const filter = prefixOnly
      ? buildPrefixOnlyFilter(["first_name", "last_name", "email", "phone"], query)
      : buildOrFilter(["first_name", "last_name", "email", "phone"], query, fuzzy);

    let request = supabase
      .from("crm_customers")
      .select("id, first_name, last_name, email, phone, city, preferred_channel")
      .eq("tenant_id", tenantId)
      .is("deleted_at", null)
      .or(filter)
      .limit(limit + offset);

    request = applyTimeout(request);

    return request;
  };

  let data: CustomerSearchRow[] | null = null;

  try {
    const response = await runCustomerRequest(false);

    if (response.error) {
      throw response.error;
    }

    data = (response.data ?? []) as CustomerSearchRow[];
  } catch (error) {
    if (!isTimeoutError(error)) {
      throw error;
    }

    const fallbackResponse = await runCustomerRequest(true);

    if (fallbackResponse.error) {
      throw fallbackResponse.error;
    }

    data = (fallbackResponse.data ?? []) as CustomerSearchRow[];
  }

  const rows = data ?? [];

  const results = rows.map((customer) => {
    const fullName = [customer.first_name, customer.last_name]
      .map((part) => String(part ?? "").trim())
      .filter(Boolean)
      .join(" ");

    return createSearchItem(
      "customer",
      {
        id: `db:customer:${customer.id}`,
        title: fullName || customer.email || customer.phone || "Untitled customer",
        subtitle: joinSubtitle([
          customer.email,
          customer.phone,
          customer.city,
        ]),
        route: `/crm/customers/${customer.id}`,
        metadata: customer.preferred_channel
          ? `Prefers ${customer.preferred_channel}`
          : undefined,
      },
      query,
      [customer.email, customer.phone, customer.city].filter(Boolean) as string[],
    );
  });

  return sortAndSliceResults(results, limit, offset);
}

async function searchCampaigns(
  supabase: SupabaseClientLike,
  tenantId: string,
  query: string,
  limit: number,
  offset: number,
  fuzzy = true,
) {
  let request = supabase
    .from("crm_campaigns")
    .select("id, name, subject_line, preheader_text, status")
    .eq("tenant_id", tenantId)
    .or(buildOrFilter(["name", "subject_line", "preheader_text"], query, fuzzy))
    .limit(limit + offset);

  request = applyTimeout(request);

  const { data, error } = await request;

  if (error) {
    throw error;
  }

  const rows = (data ?? []) as CampaignSearchRow[];

  const results = rows.map((campaign) =>
    createSearchItem(
      "campaign",
      {
        id: `db:campaign:${campaign.id}`,
        title: campaign.name || campaign.subject_line || "Untitled campaign",
        subtitle: joinSubtitle([campaign.subject_line, campaign.preheader_text]),
        route: `/crm/campaigns/${campaign.id}`,
        metadata: formatStatus(campaign.status),
      },
      query,
      [campaign.subject_line, campaign.preheader_text].filter(Boolean) as string[],
    )
  );

  return sortAndSliceResults(results, limit, offset);
}

async function searchProducts(
  supabase: SupabaseClientLike,
  tenantId: string,
  query: string,
  limit: number,
  offset: number,
  fuzzy = true,
) {
  let request = supabase
    .from("products")
    .select("id, name, sku, category, subcategory, description, status")
    .eq("tenant_id", tenantId)
    .or(
      buildOrFilter(
        ["name", "sku", "category", "subcategory", "description"],
        query,
        fuzzy,
      ),
    )
    .limit(limit + offset);

  request = applyTimeout(request);

  const { data, error } = await request;

  if (error) {
    throw error;
  }

  const rows = (data ?? []) as ProductSearchRow[];

  const results = rows.map((product) =>
    createSearchItem(
      "product",
      {
        id: `db:product:${product.id}`,
        title: product.name,
        subtitle: joinSubtitle([product.sku, product.category, product.subcategory]),
        route: `/products/${product.id}`,
        metadata: formatStatus(product.status),
      },
      query,
      [product.sku, product.category, product.subcategory, product.description].filter(
        Boolean,
      ) as string[],
    )
  );

  return sortAndSliceResults(results, limit, offset);
}

async function searchSegments(
  supabase: SupabaseClientLike,
  tenantId: string,
  query: string,
  limit: number,
  offset: number,
  fuzzy = true,
) {
  let request = supabase
    .from("crm_segments")
    .select("id, name, description, status, customer_count")
    .eq("tenant_id", tenantId)
    .eq("is_system_segment", false)
    .is("deleted_at", null)
    .or(buildOrFilter(["name", "description"], query, fuzzy))
    .limit(limit + offset);

  request = applyTimeout(request);

  const { data, error } = await request;

  if (error) {
    throw error;
  }

  const rows = (data ?? []) as SegmentSearchRow[];

  const results = rows.map((segment) =>
    createSearchItem(
      "segment",
      {
        id: `db:segment:${segment.id}`,
        title: segment.name,
        subtitle: segment.description ?? undefined,
        route: `/crm/segments/${segment.id}`,
        metadata:
          typeof segment.customer_count === "number"
            ? `${segment.customer_count} members`
            : formatStatus(segment.status),
      },
      query,
      [segment.description, segment.status].filter(Boolean) as string[],
    )
  );

  return sortAndSliceResults(results, limit, offset);
}

async function searchPersonas(
  supabase: SupabaseClientLike,
  tenantId: string,
  query: string,
  limit: number,
  offset: number,
  fuzzy = true,
) {
  let request = supabase
    .from("crm_personas")
    .select("id, persona_name, persona_description")
    .eq("tenant_id", tenantId)
    .eq("is_custom", true)
    .or(buildOrFilter(["persona_name", "persona_description"], query, fuzzy))
    .limit(limit + offset);

  request = applyTimeout(request);

  const { data, error } = await request;

  if (error) {
    throw error;
  }

  const rows = (data ?? []) as PersonaSearchRow[];

  const results = rows.map((persona) =>
    createSearchItem(
      "persona",
      {
        id: `db:persona:${persona.id}`,
        title: persona.persona_name,
        subtitle: persona.persona_description ?? undefined,
        route: `/crm/personas/${persona.id}`,
      },
      query,
      [persona.persona_description].filter(Boolean) as string[],
    )
  );

  return sortAndSliceResults(results, limit, offset);
}

async function searchAutomations(
  supabase: SupabaseClientLike,
  tenantId: string,
  query: string,
  limit: number,
  offset: number,
  fuzzy = true,
) {
  let request = supabase
    .from("crm_automations")
    .select("id, name, trigger_type, template_source, is_active")
    .eq("tenant_id", tenantId)
    .or(buildOrFilter(["name", "trigger_type", "template_source"], query, fuzzy))
    .limit(limit + offset);

  request = applyTimeout(request);

  const { data, error } = await request;

  if (error) {
    throw error;
  }

  const rows = (data ?? []) as AutomationSearchRow[];

  const results = rows.map((automation) =>
    createSearchItem(
      "automation",
      {
        id: `db:automation:${automation.id}`,
        title: automation.name,
        subtitle: joinSubtitle([
          formatStatus(automation.trigger_type),
          automation.template_source,
        ]),
        route: `/crm/automations/${automation.id}`,
        metadata: automation.is_active ? "Active" : "Inactive",
      },
      query,
      [automation.trigger_type, automation.template_source].filter(Boolean) as string[],
    )
  );

  return sortAndSliceResults(results, limit, offset);
}

async function searchForms(
  supabase: SupabaseClientLike,
  tenantId: string,
  query: string,
  limit: number,
  offset: number,
  fuzzy = true,
) {
  let request = supabase
    .from("forms")
    .select("id, name, status, embed_key")
    .eq("tenant_id", tenantId)
    .or(buildOrFilter(["name", "status", "embed_key"], query, fuzzy))
    .limit(limit + offset);

  request = applyTimeout(request);

  const { data, error } = await request;

  if (error) {
    throw error;
  }

  const rows = (data ?? []) as FormSearchRow[];

  const results = rows.map((form) =>
    createSearchItem(
      "form",
      {
        id: `db:form:${form.id}`,
        title: form.name,
        subtitle: form.embed_key ? `Embed key ${form.embed_key}` : undefined,
        route: `/crm/forms/${form.id}`,
        metadata: formatStatus(form.status),
      },
      query,
      [form.status, form.embed_key].filter(Boolean) as string[],
    )
  );

  return sortAndSliceResults(results, limit, offset);
}

async function searchSavedBlocks(
  supabase: SupabaseClientLike,
  tenantId: string,
  query: string,
  limit: number,
  offset: number,
  fuzzy = true,
) {
  let request = supabase
    .from("saved_blocks")
    .select("id, name, block_type, tags, is_favorite")
    .eq("tenant_id", tenantId)
    .eq("is_bloomsuite_block", false)
    .or(buildOrFilter(["name", "block_type"], query, fuzzy))
    .limit(limit + offset);

  request = applyTimeout(request);

  const { data, error } = await request;

  if (error) {
    throw error;
  }

  const rows = (data ?? []) as SavedBlockSearchRow[];

  const results = rows.map((block) =>
    createSearchItem(
      "saved_block",
      {
        id: `db:saved_block:${block.id}`,
        title: block.name,
        subtitle: Array.isArray(block.tags) && block.tags.length > 0
          ? block.tags.slice(0, 3).join(" • ")
          : undefined,
        route: `/crm/campaigns/blocks?highlight=${block.id}`,
        metadata: block.is_favorite ? "Favorite" : formatStatus(block.block_type),
      },
      query,
      Array.isArray(block.tags) ? block.tags : [],
    )
  );

  return sortAndSliceResults(results, limit, offset);
}

async function searchCampaignRecipients(
  supabase: SupabaseClientLike,
  tenantId: string,
  query: string,
  limit: number,
  offset: number,
  fuzzy = true,
  campaignId?: string | null,
) {
  if (campaignId) {
    let request = supabase.rpc("get_campaign_recipient_matches" as any, {
      p_campaign_id: campaignId,
      p_search: query,
    } as any);

    request = applyTimeout(request);

    const { data, error } = await request;

    if (error) {
      throw error;
    }

    const rows = (data ?? []) as CampaignRecipientMatchRow[];
    const results = rows.map((recipient) =>
      createSearchItem(
        "campaign_recipient",
        {
          id: `db:campaign_recipient:${campaignId}:${recipient.recipient_id}`,
          title: recipient.customer_name || recipient.customer_email,
          subtitle: joinSubtitle([
            recipient.customer_email,
            formatStatus(recipient.latest_event),
          ]),
          route: `/crm/campaigns/${campaignId}/recipients/${recipient.recipient_id}`,
          metadata: formatStatus(recipient.delivery_status || recipient.send_status),
        },
        query,
        [
          recipient.customer_email,
          recipient.customer_name,
          recipient.latest_event,
          ...(recipient.all_events ?? []),
        ].filter(Boolean) as string[],
      )
    );

    return sortAndSliceResults(results, limit, offset);
  }

  let request = supabase
    .from("email_messages")
    .select(
      "id, campaign_id, email, status, sent_at, created_at, crm_campaigns(name), crm_customers(first_name, last_name)",
    )
    .eq("tenant_id", tenantId)
    .is("retry_of_message_id", null)
    .or(buildOrFilter(["email"], query, fuzzy))
    .limit(limit + offset);

  request = applyTimeout(request);

  const { data, error } = await request;

  if (error) {
    throw error;
  }

  const rows = (data ?? []) as CampaignRecipientMessageSearchRow[];
  const results = rows.map((recipient) => {
    const campaign = getRelationRecord<CampaignRecipientRelationCampaign>(
      recipient.crm_campaigns,
    );
    const customer = getRelationRecord<CampaignRecipientRelationCustomer>(
      recipient.crm_customers,
    );
    const fullName = [customer?.first_name, customer?.last_name]
      .map((part) => String(part ?? "").trim())
      .filter(Boolean)
      .join(" ");

    return createSearchItem(
      "campaign_recipient",
      {
        id: `db:campaign_recipient:${recipient.campaign_id}:${recipient.id}`,
        title: fullName || recipient.email,
        subtitle: joinSubtitle([recipient.email, campaign?.name ?? undefined]),
        route: `/crm/campaigns/${recipient.campaign_id}/recipients/${recipient.id}`,
        metadata: formatStatus(recipient.status),
      },
      query,
      [recipient.email, fullName, campaign?.name ?? undefined].filter(Boolean) as string[],
    );
  });

  return sortAndSliceResults(results, limit, offset);
}

async function searchSmsCampaigns(
  supabase: SupabaseClientLike,
  tenantId: string,
  query: string,
  limit: number,
  offset: number,
  fuzzy = true,
) {
  let request = supabase
    .from("crm_sms_campaigns")
    .select("id, name, message, status, scheduled_at, sent_at, source")
    .eq("tenant_id", tenantId)
    .or(buildOrFilter(["name", "message", "status", "source"], query, fuzzy))
    .limit(limit + offset);

  request = applyTimeout(request);

  const { data, error } = await request;

  if (error) {
    throw error;
  }

  const rows = (data ?? []) as SmsCampaignSearchRow[];
  const results = rows.map((campaign) =>
    createSearchItem(
      "sms_campaign",
      {
        id: `db:sms_campaign:${campaign.id}`,
        title: campaign.name,
        subtitle: joinSubtitle([
          excerptText(campaign.message),
          campaign.source,
        ]),
        route: `/sms/${campaign.id}`,
        metadata: formatStatus(campaign.status),
      },
      query,
      [campaign.message, campaign.source, campaign.status].filter(Boolean) as string[],
    )
  );

  return sortAndSliceResults(results, limit, offset);
}

async function searchSmsAutomations(
  supabase: SupabaseClientLike,
  tenantId: string,
  query: string,
  limit: number,
  offset: number,
  fuzzy = true,
) {
  let request = supabase
    .from("sms_automations")
    .select("id, name, description, status, trigger_type")
    .eq("tenant_id", tenantId)
    .or(buildOrFilter(["name", "description", "status", "trigger_type"], query, fuzzy))
    .limit(limit + offset);

  request = applyTimeout(request);

  const { data, error } = await request;

  if (error) {
    throw error;
  }

  const rows = (data ?? []) as SmsAutomationSearchRow[];
  const results = rows.map((automation) =>
    createSearchItem(
      "sms_automation",
      {
        id: `db:sms_automation:${automation.id}`,
        title: automation.name,
        subtitle: joinSubtitle([
          formatStatus(automation.trigger_type),
          excerptText(automation.description),
        ]),
        route: `/sms/automations/${automation.id}`,
        metadata: formatStatus(automation.status),
      },
      query,
      [automation.description, automation.status, automation.trigger_type].filter(
        Boolean,
      ) as string[],
    )
  );

  return sortAndSliceResults(results, limit, offset);
}

async function searchActivityEvents(
  supabase: SupabaseClientLike,
  tenantId: string,
  query: string,
  limit: number,
  offset: number,
  fuzzy = true,
) {
  const lowerBound = new Date(Date.now() - ACTIVITY_LOOKBACK_MS).toISOString();

  let request = supabase
    .from("crm_activity_events")
    .select(
      "id, title, activity_type, status, source, integration_name, timestamp, error_message",
    )
    .eq("tenant_id", tenantId)
    .gte("timestamp", lowerBound)
    .or(buildOrFilter(["title", "activity_type", "status", "source", "integration_name"], query, fuzzy))
    .limit(limit + offset);

  request = applyTimeout(request);

  const { data, error } = await request;

  if (error) {
    throw error;
  }

  const rows = (data ?? []) as ActivitySearchRow[];
  const results = rows.map((event) =>
    createSearchItem(
      "activity",
      {
        id: `db:activity:${event.id}`,
        title: event.title,
        subtitle: joinSubtitle([
          formatStatus(event.activity_type),
          formatStatus(event.source),
          event.integration_name,
        ]),
        route: `/activity/${event.id}`,
        metadata: formatStatus(event.status),
      },
      query,
      [
        event.activity_type,
        event.status,
        event.source,
        event.integration_name,
        event.error_message,
      ].filter(Boolean) as string[],
    )
  );

  return sortAndSliceResults(results, limit, offset);
}

async function searchTickets(
  supabase: SupabaseClientLike,
  tenantId: string,
  query: string,
  limit: number,
  offset: number,
  fuzzy = true,
) {
  let request = supabase
    .from("support_tickets")
    .select("id, subject, ticket_number, priority, status, created_at")
    .eq("tenant_id", tenantId)
    .or(buildOrFilter(["subject", "ticket_number", "description"], query, fuzzy))
    .limit(limit + offset);

  request = applyTimeout(request);

  const { data, error } = await request;

  if (error) {
    throw error;
  }

  const rows = (data ?? []) as TicketSearchRow[];
  const results = rows.map((ticket) =>
    createSearchItem(
      "ticket",
      {
        id: `db:ticket:${ticket.id}`,
        title: ticket.subject,
        subtitle: joinSubtitle([
          ticket.ticket_number,
          formatStatus(ticket.priority),
        ]),
        route: `/helpdesk/tickets/${ticket.id}`,
        metadata: formatStatus(ticket.status),
      },
      query,
      [ticket.ticket_number, ticket.priority, ticket.status].filter(Boolean) as string[],
    )
  );

  return sortAndSliceResults(results, limit, offset);
}

async function searchIntegrationConnections(
  supabase: SupabaseClientLike,
  tenantId: string,
  userId: string,
  query: string,
  limit: number,
  offset: number,
  fuzzy = true,
) {
  let providerRequest = supabase
    .from("provider_connections")
    .select(
      "id, provider, provider_account_id, provider_account_name, status, connected_at, updated_at",
    )
    .eq("tenant_id", tenantId)
    .or(buildOrFilter(["provider", "provider_account_id", "provider_account_name", "status"], query, fuzzy))
    .limit(limit + offset);

  let posRequest = supabase
    .from("pos_connections")
    .select("id, name, platform, is_active, last_sync_at, sync_error, sync_status")
    .eq("tenant_id", tenantId)
    .or(buildOrFilter(["name", "platform", "sync_status", "sync_error"], query, fuzzy))
    .limit(limit + offset);

  let socialRequest = supabase
    .from("social_connections")
    .select(
      "id, platform, platform_account_id, platform_account_name, username, is_active, expires_at",
    )
    .eq("user_id", userId)
    .is("deleted_at", null)
    .or(buildOrFilter(["platform", "platform_account_id", "platform_account_name", "username"], query, fuzzy))
    .limit(limit + offset);

  providerRequest = applyTimeout(providerRequest);
  posRequest = applyTimeout(posRequest);
  socialRequest = applyTimeout(socialRequest);

  const [providerResult, posResult, socialResult] = await Promise.all([
    providerRequest,
    posRequest,
    socialRequest,
  ]);

  if (providerResult.error) {
    throw providerResult.error;
  }

  if (posResult.error) {
    throw posResult.error;
  }

  if (socialResult.error) {
    throw socialResult.error;
  }

  const providerRows = (providerResult.data ?? []) as ProviderConnectionSearchRow[];
  const posRows = (posResult.data ?? []) as PosConnectionSearchRow[];
  const socialRows = (socialResult.data ?? []) as SocialConnectionSearchRow[];

  const results = [
    ...providerRows.map((connection) => {
      const providerLabel = formatProviderLabel(connection.provider);
      const slug = getIntegrationSlug(connection.provider);

      return createSearchItem(
        "integration",
        {
          id: `db:integration:provider:${connection.id}`,
          title: connection.provider_account_name || providerLabel,
          subtitle: joinSubtitle([
            providerLabel,
            connection.provider_account_id,
          ]),
          route: getRouteWithQuery(`/integrations/${slug}`, {
            connection: connection.id,
          }),
          metadata: formatStatus(connection.status),
        },
        query,
        [
          connection.provider,
          connection.provider_account_id,
          connection.provider_account_name,
          connection.status,
        ].filter(Boolean) as string[],
      );
    }),
    ...posRows.map((connection) => {
      const providerLabel = formatProviderLabel(connection.platform);
      const slug = getIntegrationSlug(connection.platform);

      return createSearchItem(
        "integration",
        {
          id: `db:integration:pos:${connection.id}`,
          title: connection.name,
          subtitle: joinSubtitle([
            providerLabel,
            formatStatus(connection.sync_status),
          ]),
          route: getRouteWithQuery(`/integrations/${slug}`, {
            connection: connection.id,
          }),
          metadata: connection.is_active ? "Active" : "Inactive",
        },
        query,
        [
          connection.platform,
          connection.sync_status,
          connection.sync_error,
          connection.name,
        ].filter(Boolean) as string[],
      );
    }),
    ...socialRows.map((connection) => {
      const providerLabel = formatProviderLabel(connection.platform);
      const slug = getIntegrationSlug(connection.platform);

      return createSearchItem(
        "integration",
        {
          id: `db:integration:social:${connection.id}`,
          title:
            connection.platform_account_name || connection.username || providerLabel,
          subtitle: joinSubtitle([
            providerLabel,
            connection.platform_account_id,
          ]),
          route: getRouteWithQuery(`/integrations/${slug}`, {
            connection: connection.id,
          }),
          metadata: connection.is_active ? "Active" : "Inactive",
        },
        query,
        [
          connection.platform,
          connection.platform_account_id,
          connection.platform_account_name,
          connection.username,
        ].filter(Boolean) as string[],
      );
    }),
  ];

  return sortAndSliceResults(results, limit, offset);
}

async function searchCommunityStories(
  supabase: SupabaseClientLike,
  query: string,
  limit: number,
  offset: number,
  fuzzy = true,
) {
  let request = supabase
    .from("ugc_submissions")
    .select("id, customer_name, caption_text, status, tags, created_at")
    .or(buildOrFilter(["customer_name", "caption_text", "status"], query, fuzzy))
    .limit(limit + offset);

  request = applyTimeout(request);

  const { data, error } = await request;

  if (error) {
    throw error;
  }

  const rows = (data ?? []) as CommunityStorySearchRow[];
  const results = rows.map((story) =>
    createSearchItem(
      "community_story",
      {
        id: `db:community_story:${story.id}`,
        title: story.customer_name || excerptText(story.caption_text, 40) || "Community story",
        subtitle: excerptText(story.caption_text),
        route: getRouteWithQuery("/community", { storyId: story.id, tab: "gallery" }),
        metadata: formatStatus(story.status),
      },
      query,
      [story.customer_name, story.status, ...(story.tags ?? [])].filter(Boolean) as string[],
    )
  );

  return sortAndSliceResults(results, limit, offset);
}

async function searchPublishItems(
  supabase: SupabaseClientLike,
  tenantId: string,
  query: string,
  limit: number,
  offset: number,
  fuzzy = true,
) {
  let request = supabase
    .from("content_tasks")
    .select("id, ai_output, post_type, status, scheduled_date, hashtags, notes")
    .eq("tenant_id", tenantId)
    .is("deleted_at", null)
    .neq("status", "published")
    .neq("status", "archived")
    .or(buildOrFilter(["ai_output", "post_type", "hashtags", "notes"], query, fuzzy))
    .limit(limit + offset);

  request = applyTimeout(request);

  const { data, error } = await request;

  if (error) {
    throw error;
  }

  const rows = (data ?? []) as PublishItemSearchRow[];
  const results = rows.map((item) =>
    createSearchItem(
      "publish_item",
      {
        id: `db:publish_item:${item.id}`,
        title: excerptText(item.ai_output, 56) || "Publish item",
        subtitle: joinSubtitle([
          formatStatus(item.post_type),
          item.scheduled_date,
        ]),
        route: getRouteWithQuery("/publish", { highlight: item.id, tab: "ready" }),
        metadata: formatStatus(item.status),
      },
      query,
      [item.ai_output, item.post_type, item.hashtags, item.notes, item.status].filter(
        Boolean,
      ) as string[],
    )
  );

  return sortAndSliceResults(results, limit, offset);
}

async function runEntitySearch(
  type: SearchEntityType,
  execute: () => Promise<SearchResultItem[]>,
) {
  try {
    return {
      type,
      results: await execute(),
      warning: null as string | null,
      timedOut: false,
    };
  } catch (error) {
    console.error(`[search-entities] ${type} search failed:`, error);

    return {
      type,
      results: [] as SearchResultItem[],
      warning: `Some ${SEARCH_GROUP_METADATA[ENTITY_GROUP_MAP[type]].title.toLowerCase()} results may be missing.`,
      timedOut: isTimeoutError(error),
    };
  }
}

function groupResults(results: SearchResultItem[]) {
  const grouped = new Map<SearchGroupKey, SearchResultItem[]>();

  for (const result of results) {
    const current = grouped.get(result.group) ?? [];
    grouped.set(result.group, [...current, result]);
  }

  return SEARCH_GROUP_ORDER.flatMap((group) => {
    const items = grouped.get(group);

    if (!items || items.length === 0) {
      return [];
    }

    return [{
      category: group,
      title: SEARCH_GROUP_METADATA[group].title,
      icon: SEARCH_GROUP_METADATA[group].icon,
      results: items,
    } satisfies SearchResultGroup];
  });
}

function flattenAndCap(groups: SearchResultGroup[]) {
  const cappedGroups: SearchResultGroup[] = [];
  let totalCount = 0;

  for (const group of groups) {
    if (totalCount >= MAX_TOTAL_RESULTS) {
      break;
    }

    const remaining = MAX_TOTAL_RESULTS - totalCount;
    const cappedResults = group.results.slice(0, Math.min(MAX_GROUP_RESULTS, remaining));

    if (cappedResults.length === 0) {
      continue;
    }

    totalCount += cappedResults.length;
    cappedGroups.push({
      ...group,
      results: cappedResults,
    });
  }

  return {
    groups: cappedGroups,
    results: cappedGroups.flatMap((group) => group.results),
    totalCount,
  };
}

Deno.serve(async (req) => {
  const corsPreflightResponse = handleCorsPreflight(req, {
    allowMethods: "POST, OPTIONS",
  });

  if (corsPreflightResponse) {
    return corsPreflightResponse;
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const startedAt = Date.now();

  try {
    const authHeader = req.headers.get("Authorization");

    if (!authHeader) {
      return jsonResponse({ error: "Authentication required" }, 401);
    }

    const body = (await req.json()) as SearchRequestBody;
    const query = normalizeQuery(body?.query);
    const entityTypes = normalizeEntityTypes(body?.entity_types);
    const campaignId = normalizeCampaignId(body?.campaign_id);
    const fuzzy = normalizeFuzzy(body?.fuzzy);
    const limit = normalizeLimit(body?.limit);
    const offset = normalizeOffset(body?.offset);

    if (query.length < MIN_QUERY_LENGTH) {
      return jsonResponse({
        results: [],
        groups: [],
        warnings: [],
        meta: {
          duration_ms: Date.now() - startedAt,
          entity_types: entityTypes,
          fuzzy,
          total: 0,
          query,
        },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

    const supabase = createClient(supabaseUrl, anonKey, {
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
    });

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return jsonResponse({ error: "Invalid session" }, 401);
    }

    const rateLimit = enforceRateLimit(user.id);

    if (rateLimit.limited) {
      return jsonResponse(
        {
          error: "Too many search requests. Please try again shortly.",
        },
        429,
        { "Retry-After": String(rateLimit.retryAfterSeconds) },
      );
    }

    const userTenantId = await resolveUserTenantId(supabase, user.id);

    if (!userTenantId) {
      return jsonResponse({ error: "No tenant membership found for user." }, 403);
    }

    const candidateHosts = extractCandidateHosts(req);
    const hostTenantId = await resolveHostTenantId(supabase, candidateHosts);

    if (hostTenantId && hostTenantId !== userTenantId) {
      return jsonResponse(
        { error: "Tenant mismatch for the current request host." },
        403,
      );
    }

    const searchTasks = entityTypes.map((entityType) => {
      switch (entityType) {
        case "customer":
          return runEntitySearch(entityType, () =>
            searchCustomers(supabase, userTenantId, query, limit, offset, fuzzy)
          );
        case "campaign":
          return runEntitySearch(entityType, () =>
            searchCampaigns(supabase, userTenantId, query, limit, offset, fuzzy)
          );
        case "campaign_recipient":
          return runEntitySearch(entityType, () =>
            searchCampaignRecipients(
              supabase,
              userTenantId,
              query,
              limit,
              offset,
              fuzzy,
              campaignId,
            )
          );
        case "product":
          return runEntitySearch(entityType, () =>
            searchProducts(supabase, userTenantId, query, limit, offset, fuzzy)
          );
        case "segment":
          return runEntitySearch(entityType, () =>
            searchSegments(supabase, userTenantId, query, limit, offset, fuzzy)
          );
        case "persona":
          return runEntitySearch(entityType, () =>
            searchPersonas(supabase, userTenantId, query, limit, offset, fuzzy)
          );
        case "automation":
          return runEntitySearch(entityType, () =>
            searchAutomations(supabase, userTenantId, query, limit, offset, fuzzy)
          );
        case "form":
          return runEntitySearch(entityType, () =>
            searchForms(supabase, userTenantId, query, limit, offset, fuzzy)
          );
        case "saved_block":
          return runEntitySearch(entityType, () =>
            searchSavedBlocks(supabase, userTenantId, query, limit, offset, fuzzy)
          );
        case "sms_campaign":
          return runEntitySearch(entityType, () =>
            searchSmsCampaigns(supabase, userTenantId, query, limit, offset, fuzzy)
          );
        case "sms_automation":
          return runEntitySearch(entityType, () =>
            searchSmsAutomations(supabase, userTenantId, query, limit, offset, fuzzy)
          );
        case "activity":
          return runEntitySearch(entityType, () =>
            searchActivityEvents(supabase, userTenantId, query, limit, offset, fuzzy)
          );
        case "ticket":
          return runEntitySearch(entityType, () =>
            searchTickets(supabase, userTenantId, query, limit, offset, fuzzy)
          );
        case "integration":
          return runEntitySearch(entityType, () =>
            searchIntegrationConnections(
              supabase,
              userTenantId,
              user.id,
              query,
              limit,
              offset,
              fuzzy,
            )
          );
        case "community_story":
          return runEntitySearch(entityType, () =>
            searchCommunityStories(supabase, query, limit, offset, fuzzy)
          );
        case "publish_item":
          return runEntitySearch(entityType, () =>
            searchPublishItems(supabase, userTenantId, query, limit, offset, fuzzy)
          );
      }
    });

    const searchResults = await Promise.all(searchTasks);
    const timeoutCount = searchResults.filter((result) => result.timedOut).length;
    const degraded = timeoutCount > 3;
    const warnings = searchResults
      .map((result) => result.warning)
      .filter((warning): warning is string => Boolean(warning));

    if (degraded) {
      warnings.unshift("Search results are partially degraded due to slow data sources.");
    }

    const grouped = groupResults(searchResults.flatMap((result) => result.results));
    const { groups, results, totalCount } = flattenAndCap(grouped);

    return jsonResponse({
      results,
      groups,
      warnings,
      meta: {
        duration_ms: Date.now() - startedAt,
        degraded,
        entity_types: entityTypes,
        fuzzy,
        total: totalCount,
        query,
      },
    });
  } catch (error) {
    console.error("[search-entities] Unexpected error:", error);

    return jsonResponse(
      {
        error: "Search failed unexpectedly.",
      },
      500,
    );
  }
});