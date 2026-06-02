import { useEffect, useRef } from "react";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useIsSuperAdmin } from "@/hooks/useIsSuperAdmin";
import { useTenant } from "@/hooks/useTenant";
import {
  bloomSupabase,
  toBloomJsonObject,
  type BloomAdminAnalyticsPeriod,
  type BloomAdminDateRange,
  type BloomAuditEntry,
  type BloomAuditEventType,
  type BloomAuditLogFilters,
  type BloomAuditLogRow,
  type BloomAuditSecurityEventType,
  type BloomAuditUserRow,
  type BloomDailyVolume,
  type BloomModelDistribution,
  type BloomToolUsageStats,
  type BloomUsageOverview,
} from "@/hooks/bloom/types";

const BLOOM_AUDIT_LOG_COLUMNS =
  "id, tenant_id, user_id, conversation_id, message_id, event_type, event_data, model_used, tokens_input, tokens_output, latency_ms, created_at";

const BLOOM_AUDIT_BATCH_SIZE = 1000;
const BLOOM_AUDIT_PAGE_SIZE = 20;
const BLOOM_USAGE_OVERVIEW_STALE_TIME_MS = 120_000;
const BLOOM_DAILY_VOLUME_STALE_TIME_MS = 300_000;
const BLOOM_AUDIT_LOG_STALE_TIME_MS = 120_000;

interface BloomModelPricing {
  inputPerMillionTokens: number;
  outputPerMillionTokens: number;
}

export const BLOOM_MODEL_PRICING = Object.freeze({
  "gpt-4o": {
    inputPerMillionTokens: 5,
    outputPerMillionTokens: 15,
  },
  "gpt-4o-mini": {
    inputPerMillionTokens: 0.15,
    outputPerMillionTokens: 0.6,
  },
  "gpt-4.1-2025-04-14": {
    inputPerMillionTokens: 2,
    outputPerMillionTokens: 8,
  },
  "text-embedding-3-small": {
    inputPerMillionTokens: 0.02,
    outputPerMillionTokens: 0,
  },
} satisfies Record<string, BloomModelPricing>);

const EMPTY_BLOOM_USAGE_OVERVIEW: BloomUsageOverview = {
  conversation_count: 0,
  message_count: 0,
  total_tokens: 0,
  estimated_cost: 0,
  active_user_count: 0,
  avg_latency_ms: null,
};

const EMPTY_BLOOM_DAILY_VOLUME: BloomDailyVolume = [];
const EMPTY_BLOOM_MODEL_DISTRIBUTION: BloomModelDistribution = [];
const EMPTY_BLOOM_TOOL_USAGE: BloomToolUsageStats = [];
const EMPTY_BLOOM_AUDIT_LOG: BloomAuditEntry[] = [];

interface BloomAuditLogPage {
  entries: BloomAuditEntry[];
  totalCount: number;
  nextOffset?: number;
}

interface BloomAdminAccess {
  tenantId: string | null;
  isSuperAdmin: boolean;
  isLoading: boolean;
  canQuery: boolean;
}

const roundTo = (value: number, digits: number) => {
  const multiplier = 10 ** digits;
  return Math.round(value * multiplier) / multiplier;
};

const isDateOnlyString = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value);

const parseDate = (value: string | null | undefined) => {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const startOfUtcDay = (value: Date) =>
  new Date(
    Date.UTC(
      value.getUTCFullYear(),
      value.getUTCMonth(),
      value.getUTCDate(),
      0,
      0,
      0,
      0,
    ),
  );

const addUtcDays = (value: Date, days: number) => {
  const next = new Date(value);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
};

const startOfUtcMonth = (value: Date) =>
  new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), 1));

const addUtcMonths = (value: Date, months: number) =>
  new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth() + months, 1));

const startOfUtcWeek = (value: Date) => {
  const start = startOfUtcDay(value);
  const day = start.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  return addUtcDays(start, diff);
};

const formatUtcDateKey = (value: Date) => value.toISOString().slice(0, 10);

const resolvePeriodDateRange = (
  period: BloomAdminAnalyticsPeriod,
): BloomAdminDateRange => {
  const now = new Date();

  if (typeof period !== "string") {
    const fallback = resolvePeriodDateRange("this_month");
    const parsedStart = parseDate(period.start);
    const parsedEnd = parseDate(period.end);

    const start = parsedStart
      ? startOfUtcDay(parsedStart)
      : new Date(fallback.start);

    let end: Date;
    if (parsedEnd) {
      end = isDateOnlyString(period.end)
        ? addUtcDays(startOfUtcDay(parsedEnd), 1)
        : parsedEnd;
    } else {
      end = new Date(fallback.end);
    }

    if (end <= start) {
      end = addUtcDays(start, 1);
    }

    return {
      start: start.toISOString(),
      end: end.toISOString(),
    };
  }

  switch (period) {
    case "last_month": {
      const end = startOfUtcMonth(now);
      const start = addUtcMonths(end, -1);
      return { start: start.toISOString(), end: end.toISOString() };
    }
    case "this_week": {
      const start = startOfUtcWeek(now);
      return { start: start.toISOString(), end: now.toISOString() };
    }
    case "last_7_days": {
      const start = addUtcDays(startOfUtcDay(now), -6);
      return { start: start.toISOString(), end: now.toISOString() };
    }
    case "last_30_days": {
      const start = addUtcDays(startOfUtcDay(now), -29);
      return { start: start.toISOString(), end: now.toISOString() };
    }
    case "this_month":
    default: {
      const start = startOfUtcMonth(now);
      return { start: start.toISOString(), end: now.toISOString() };
    }
  }
};

const resolveAuditFilterDateRange = (
  dateRange: BloomAuditLogFilters["date_range"],
) => {
  const parsedStart = parseDate(dateRange?.start ?? null);
  const parsedEnd = parseDate(dateRange?.end ?? null);

  return {
    start: parsedStart ? startOfUtcDay(parsedStart).toISOString() : null,
    end: parsedEnd
      ? isDateOnlyString(dateRange?.end ?? "")
        ? addUtcDays(startOfUtcDay(parsedEnd), 1).toISOString()
        : parsedEnd.toISOString()
      : null,
  };
};

const resolveModelPricing = (model: string | null) => {
  if (!model) {
    return null;
  }

  if (model.startsWith("gpt-4o-mini")) {
    return BLOOM_MODEL_PRICING["gpt-4o-mini"];
  }

  if (model.startsWith("gpt-4o")) {
    return BLOOM_MODEL_PRICING["gpt-4o"];
  }

  if (model.startsWith("gpt-4.1-2025-04-14") || model.startsWith("gpt-4.1")) {
    return BLOOM_MODEL_PRICING["gpt-4.1-2025-04-14"];
  }

  if (model.startsWith("text-embedding-3-small")) {
    return BLOOM_MODEL_PRICING["text-embedding-3-small"];
  }

  return null;
};

const estimateModelCost = (
  model: string | null,
  inputTokens: number,
  outputTokens: number,
) => {
  const pricing = resolveModelPricing(model);

  if (!pricing) {
    return 0;
  }

  return (
    (inputTokens / 1_000_000) * pricing.inputPerMillionTokens +
    (outputTokens / 1_000_000) * pricing.outputPerMillionTokens
  );
};

const readJsonString = (value: unknown) =>
  typeof value === "string" && value.trim().length > 0 ? value.trim() : null;

const readJsonNumber = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

const isBloomAuditSecurityEventType = (
  value: BloomAuditLogFilters["event_type"] | null | undefined,
): value is BloomAuditSecurityEventType =>
  value === "injection_attempt" ||
  value === "output_violation" ||
  value === "cross_tenant_attempt" ||
  value === "rate_limit";

const serializePeriod = (period: BloomAdminAnalyticsPeriod) =>
  typeof period === "string" ? period : `${period.start}:${period.end}`;

const serializeAuditFilters = (filters: BloomAuditLogFilters) =>
  JSON.stringify({
    event_type: filters.event_type ?? null,
    user_id: filters.user_id ?? null,
    tool_name: filters.tool_name?.trim() ?? "",
    start: filters.date_range?.start ?? null,
    end: filters.date_range?.end ?? null,
  });

const getPromptTokenCount = (row: BloomAuditLogRow) => {
  const eventData = toBloomJsonObject(row.event_data);
  const estimatedInputTokens = readJsonNumber(
    eventData.context_estimated_input_tokens,
  );

  return (
    (row.tokens_input ?? 0) +
    (row.tokens_output ?? 0) +
    (estimatedInputTokens ?? 0)
  );
};

const getUserDisplayName = (
  user: BloomAuditUserRow | undefined,
  userId: string,
) => {
  const fullName = readJsonString(user?.full_name);
  if (fullName) {
    return fullName;
  }

  const name = readJsonString(user?.name);
  if (name) {
    return name;
  }

  const email = readJsonString(user?.email);
  if (email) {
    return email;
  }

  return userId;
};

async function loadBloomAuditUsers(userIds: string[]) {
  const uniqueUserIds = Array.from(new Set(userIds.filter(Boolean)));

  if (uniqueUserIds.length === 0) {
    return new Map<string, BloomAuditUserRow>();
  }

  const { data, error } = await bloomSupabase
    .from("users")
    .select(
      "id, email, full_name, name, tenant_id, role, created_at, created_by_user_id, last_sign_in_at",
    )
    .in("id", uniqueUserIds);

  if (error) {
    throw error;
  }

  return new Map((data ?? []).map((row) => [row.id, row]));
}

async function loadAllBloomAuditRows(options: {
  tenantId: string;
  dateRange: BloomAdminDateRange;
  eventTypes?: BloomAuditEventType[];
}) {
  const rows: BloomAuditLogRow[] = [];
  let offset = 0;

  while (true) {
    let query = bloomSupabase
      .from("bloom_audit_log")
      .select(BLOOM_AUDIT_LOG_COLUMNS)
      .eq("tenant_id", options.tenantId)
      .gte("created_at", options.dateRange.start)
      .lt("created_at", options.dateRange.end)
      .order("created_at", { ascending: false })
      .range(offset, offset + BLOOM_AUDIT_BATCH_SIZE - 1);

    if (options.eventTypes?.length === 1) {
      query = query.eq("event_type", options.eventTypes[0]);
    } else if (options.eventTypes && options.eventTypes.length > 1) {
      query = query.in("event_type", options.eventTypes);
    }

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    const page = data ?? [];
    rows.push(...page);

    if (page.length < BLOOM_AUDIT_BATCH_SIZE) {
      break;
    }

    offset += BLOOM_AUDIT_BATCH_SIZE;
  }

  return rows;
}

const toBloomAuditEntry = (
  row: BloomAuditLogRow,
  userMap: Map<string, BloomAuditUserRow>,
): BloomAuditEntry => {
  const eventData = toBloomJsonObject(row.event_data);

  return {
    id: row.id,
    timestamp: row.created_at,
    user_id: row.user_id,
    user_display_name: getUserDisplayName(
      userMap.get(row.user_id),
      row.user_id,
    ),
    event_type: row.event_type,
    tool_name: readJsonString(eventData.tool_name),
    model_used: row.model_used,
    tokens_input: row.tokens_input,
    tokens_output: row.tokens_output,
    latency_ms: row.latency_ms,
    event_data: eventData,
  };
};

const isClientMetricResponseRow = (row: BloomAuditLogRow) => {
  const eventData = toBloomJsonObject(row.event_data);
  return readJsonString(eventData.metric_source) === "client";
};

async function fetchBloomUsageOverview(
  tenantId: string,
  period: BloomAdminAnalyticsPeriod,
) {
  const dateRange = resolvePeriodDateRange(period);
  const [promptRows, responseRows] = await Promise.all([
    loadAllBloomAuditRows({
      tenantId,
      dateRange,
      eventTypes: ["prompt"],
    }),
    loadAllBloomAuditRows({
      tenantId,
      dateRange,
      eventTypes: ["response"],
    }),
  ]);
  const serverResponseRows = responseRows.filter(
    (row) => !isClientMetricResponseRow(row),
  );

  const conversationIds = new Set<string>();
  const userIds = new Set<string>();

  for (const row of promptRows) {
    if (row.conversation_id) {
      conversationIds.add(row.conversation_id);
    }

    userIds.add(row.user_id);
  }

  let totalTokens = 0;
  let estimatedCost = 0;
  let latencyTotal = 0;
  let latencyCount = 0;

  for (const row of serverResponseRows) {
    const inputTokens = row.tokens_input ?? 0;
    const outputTokens = row.tokens_output ?? 0;
    totalTokens += inputTokens + outputTokens;
    estimatedCost += estimateModelCost(
      row.model_used,
      inputTokens,
      outputTokens,
    );

    if (typeof row.latency_ms === "number") {
      latencyTotal += row.latency_ms;
      latencyCount += 1;
    }
  }

  return {
    conversation_count: conversationIds.size,
    message_count: promptRows.length,
    total_tokens: totalTokens,
    estimated_cost: roundTo(estimatedCost, 6),
    active_user_count: userIds.size,
    avg_latency_ms:
      latencyCount > 0 ? roundTo(latencyTotal / latencyCount, 2) : null,
  } satisfies BloomUsageOverview;
}

async function fetchBloomDailyVolume(tenantId: string) {
  const today = new Date();
  const start = addUtcDays(startOfUtcDay(today), -29);
  const end = addUtcDays(startOfUtcDay(today), 1);
  const rows = await loadAllBloomAuditRows({
    tenantId,
    dateRange: {
      start: start.toISOString(),
      end: end.toISOString(),
    },
    eventTypes: ["prompt"],
  });

  const points = new Map<string, BloomDailyVolume[number]>();

  for (let index = 0; index < 30; index += 1) {
    const day = addUtcDays(start, index);
    const date = formatUtcDateKey(day);
    points.set(date, {
      date,
      message_count: 0,
      token_count: 0,
    });
  }

  for (const row of rows) {
    const date = formatUtcDateKey(new Date(row.created_at));
    const point = points.get(date);

    if (!point) {
      continue;
    }

    point.message_count += 1;
    point.token_count += getPromptTokenCount(row);
  }

  return Array.from(points.values());
}

async function fetchBloomModelDistribution(
  tenantId: string,
  period: BloomAdminAnalyticsPeriod,
) {
  const rows = await loadAllBloomAuditRows({
    tenantId,
    dateRange: resolvePeriodDateRange(period),
    eventTypes: ["response"],
  });
  const serverRows = rows.filter((row) => !isClientMetricResponseRow(row));

  const totals = new Map<
    string,
    {
      tokenCount: number;
      estimatedCost: number;
    }
  >();

  let totalTokens = 0;

  for (const row of serverRows) {
    const model = row.model_used?.trim() || "unknown";
    const inputTokens = row.tokens_input ?? 0;
    const outputTokens = row.tokens_output ?? 0;
    const tokenCount = inputTokens + outputTokens;
    const entry = totals.get(model) ?? { tokenCount: 0, estimatedCost: 0 };

    entry.tokenCount += tokenCount;
    entry.estimatedCost += estimateModelCost(
      row.model_used,
      inputTokens,
      outputTokens,
    );
    totals.set(model, entry);
    totalTokens += tokenCount;
  }

  return Array.from(totals.entries())
    .map(([model, entry]) => ({
      model,
      token_count: entry.tokenCount,
      percentage:
        totalTokens > 0
          ? roundTo((entry.tokenCount / totalTokens) * 100, 2)
          : 0,
      estimated_cost: roundTo(entry.estimatedCost, 6),
    }))
    .sort((left, right) => right.token_count - left.token_count);
}

async function fetchBloomToolUsage(
  tenantId: string,
  period: BloomAdminAnalyticsPeriod,
) {
  const rows = await loadAllBloomAuditRows({
    tenantId,
    dateRange: resolvePeriodDateRange(period),
    eventTypes: ["tool_call", "tool_result"],
  });

  const totals = new Map<
    string,
    {
      callCount: number;
      completedCount: number;
      executionTimeTotal: number;
      executionCount: number;
    }
  >();

  for (const row of rows) {
    const eventData = toBloomJsonObject(row.event_data);
    const toolName = readJsonString(eventData.tool_name) ?? "unknown";
    const entry = totals.get(toolName) ?? {
      callCount: 0,
      completedCount: 0,
      executionTimeTotal: 0,
      executionCount: 0,
    };

    if (row.event_type === "tool_call") {
      entry.callCount += 1;
    }

    if (row.event_type === "tool_result") {
      const status = readJsonString(eventData.status);
      const executionTime =
        row.latency_ms ?? readJsonNumber(eventData.execution_time_ms);

      if (status === "completed") {
        entry.completedCount += 1;
      }

      if (executionTime !== null) {
        entry.executionTimeTotal += executionTime;
        entry.executionCount += 1;
      }
    }

    totals.set(toolName, entry);
  }

  return Array.from(totals.entries())
    .map(([toolName, entry]) => ({
      tool_name: toolName,
      call_count: entry.callCount,
      avg_execution_time_ms:
        entry.executionCount > 0
          ? roundTo(entry.executionTimeTotal / entry.executionCount, 2)
          : null,
      success_rate:
        entry.callCount > 0
          ? roundTo(entry.completedCount / entry.callCount, 4)
          : 0,
    }))
    .filter((entry) => entry.call_count > 0)
    .sort((left, right) => right.call_count - left.call_count)
    .slice(0, 10);
}

async function fetchBloomAuditLogPage(options: {
  tenantId: string;
  offset: number;
  filters: BloomAuditLogFilters;
}) {
  const trimmedToolName = options.filters.tool_name?.trim() ?? "";
  const dateRange = resolveAuditFilterDateRange(options.filters.date_range);

  let query = bloomSupabase
    .from("bloom_audit_log")
    .select(BLOOM_AUDIT_LOG_COLUMNS, { count: "exact" })
    .eq("tenant_id", options.tenantId)
    .order("created_at", { ascending: false })
    .range(options.offset, options.offset + BLOOM_AUDIT_PAGE_SIZE - 1);

  if (options.filters.event_type) {
    if (isBloomAuditSecurityEventType(options.filters.event_type)) {
      const securityEventType = options.filters.event_type;
      query = query.or(
        [
          `event_type.eq.${securityEventType}`,
          `event_data->>requested_event_type.eq.${securityEventType}`,
          `event_data->>security_event_type.eq.${securityEventType}`,
        ].join(","),
      );
    } else {
      query = query.eq("event_type", options.filters.event_type);
    }
  }

  if (options.filters.user_id) {
    query = query.eq("user_id", options.filters.user_id);
  }

  if (dateRange.start) {
    query = query.gte("created_at", dateRange.start);
  }

  if (dateRange.end) {
    query = query.lt("created_at", dateRange.end);
  }

  if (trimmedToolName) {
    query = query.filter(
      "event_data->>tool_name",
      "ilike",
      `%${trimmedToolName}%`,
    );
  }

  const { data, error, count } = await query;

  if (error) {
    throw error;
  }

  const rows = data ?? [];
  const userMap = await loadBloomAuditUsers(rows.map((row) => row.user_id));
  const totalCount = count ?? 0;
  const nextOffset =
    options.offset + rows.length < totalCount
      ? options.offset + BLOOM_AUDIT_PAGE_SIZE
      : undefined;

  return {
    entries: rows.map((row) => toBloomAuditEntry(row, userMap)),
    totalCount,
    nextOffset,
  } satisfies BloomAuditLogPage;
}

function useBloomAdminAccess(
  hookName: string,
  requestedTenantId?: string | null,
): BloomAdminAccess {
  const tenantQuery = useTenant();
  const superAdminQuery = useIsSuperAdmin();
  const warningLoggedRef = useRef(false);

  const tenantId = requestedTenantId ?? tenantQuery.tenant?.id ?? null;
  const isLoading =
    superAdminQuery.isLoading || (!requestedTenantId && tenantQuery.loading);
  const isSuperAdmin = superAdminQuery.data === true;

  useEffect(() => {
    if (
      !warningLoggedRef.current &&
      !superAdminQuery.isLoading &&
      superAdminQuery.data === false
    ) {
      console.warn(
        `[${hookName}] Bloom admin analytics require super-admin access.`,
      );
      warningLoggedRef.current = true;
    }
  }, [hookName, superAdminQuery.data, superAdminQuery.isLoading]);

  return {
    tenantId,
    isSuperAdmin,
    isLoading,
    canQuery: Boolean(tenantId && isSuperAdmin),
  };
}

export function useBloomUsageOverview(
  tenantId?: string | null,
  period: BloomAdminAnalyticsPeriod = "this_month",
) {
  const adminAccess = useBloomAdminAccess("useBloomUsageOverview", tenantId);
  const query = useQuery({
    queryKey: [
      "bloom-admin-usage-overview",
      adminAccess.tenantId,
      serializePeriod(period),
    ],
    enabled: adminAccess.canQuery,
    staleTime: BLOOM_USAGE_OVERVIEW_STALE_TIME_MS,
    queryFn: async () => {
      if (!adminAccess.tenantId) {
        return EMPTY_BLOOM_USAGE_OVERVIEW;
      }

      return fetchBloomUsageOverview(adminAccess.tenantId, period);
    },
  });

  return {
    data: query.data ?? EMPTY_BLOOM_USAGE_OVERVIEW,
    isLoading:
      adminAccess.isLoading || (adminAccess.canQuery && query.isLoading),
    error: adminAccess.isSuperAdmin ? (query.error ?? null) : null,
  };
}

export function useBloomDailyVolume(tenantId?: string | null) {
  const adminAccess = useBloomAdminAccess("useBloomDailyVolume", tenantId);
  const query = useQuery({
    queryKey: ["bloom-admin-daily-volume", adminAccess.tenantId],
    enabled: adminAccess.canQuery,
    staleTime: BLOOM_DAILY_VOLUME_STALE_TIME_MS,
    queryFn: async () => {
      if (!adminAccess.tenantId) {
        return EMPTY_BLOOM_DAILY_VOLUME;
      }

      return fetchBloomDailyVolume(adminAccess.tenantId);
    },
  });

  return {
    data: query.data ?? EMPTY_BLOOM_DAILY_VOLUME,
    isLoading:
      adminAccess.isLoading || (adminAccess.canQuery && query.isLoading),
    error: adminAccess.isSuperAdmin ? (query.error ?? null) : null,
  };
}

export function useBloomModelDistribution(
  tenantId?: string | null,
  period: BloomAdminAnalyticsPeriod = "this_month",
) {
  const adminAccess = useBloomAdminAccess(
    "useBloomModelDistribution",
    tenantId,
  );
  const query = useQuery({
    queryKey: [
      "bloom-admin-model-distribution",
      adminAccess.tenantId,
      serializePeriod(period),
    ],
    enabled: adminAccess.canQuery,
    staleTime: BLOOM_USAGE_OVERVIEW_STALE_TIME_MS,
    queryFn: async () => {
      if (!adminAccess.tenantId) {
        return EMPTY_BLOOM_MODEL_DISTRIBUTION;
      }

      return fetchBloomModelDistribution(adminAccess.tenantId, period);
    },
  });

  return {
    data: query.data ?? EMPTY_BLOOM_MODEL_DISTRIBUTION,
    isLoading:
      adminAccess.isLoading || (adminAccess.canQuery && query.isLoading),
    error: adminAccess.isSuperAdmin ? (query.error ?? null) : null,
  };
}

export function useBloomToolUsage(
  tenantId?: string | null,
  period: BloomAdminAnalyticsPeriod = "this_month",
) {
  const adminAccess = useBloomAdminAccess("useBloomToolUsage", tenantId);
  const query = useQuery({
    queryKey: [
      "bloom-admin-tool-usage",
      adminAccess.tenantId,
      serializePeriod(period),
    ],
    enabled: adminAccess.canQuery,
    staleTime: BLOOM_USAGE_OVERVIEW_STALE_TIME_MS,
    queryFn: async () => {
      if (!adminAccess.tenantId) {
        return EMPTY_BLOOM_TOOL_USAGE;
      }

      return fetchBloomToolUsage(adminAccess.tenantId, period);
    },
  });

  return {
    data: query.data ?? EMPTY_BLOOM_TOOL_USAGE,
    isLoading:
      adminAccess.isLoading || (adminAccess.canQuery && query.isLoading),
    error: adminAccess.isSuperAdmin ? (query.error ?? null) : null,
  };
}

export function useBloomAuditLog(
  tenantId?: string | null,
  filters: BloomAuditLogFilters = {},
) {
  const adminAccess = useBloomAdminAccess("useBloomAuditLog", tenantId);
  const query = useInfiniteQuery({
    queryKey: [
      "bloom-admin-audit-log",
      adminAccess.tenantId,
      serializeAuditFilters(filters),
    ],
    enabled: adminAccess.canQuery,
    staleTime: BLOOM_AUDIT_LOG_STALE_TIME_MS,
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      if (!adminAccess.tenantId) {
        return {
          entries: EMPTY_BLOOM_AUDIT_LOG,
          totalCount: 0,
          nextOffset: undefined,
        } satisfies BloomAuditLogPage;
      }

      return fetchBloomAuditLogPage({
        tenantId: adminAccess.tenantId,
        offset: pageParam,
        filters,
      });
    },
    getNextPageParam: (lastPage) => lastPage.nextOffset,
  });

  return {
    data:
      query.data?.pages.flatMap((page) => page.entries) ??
      EMPTY_BLOOM_AUDIT_LOG,
    isLoading:
      adminAccess.isLoading || (adminAccess.canQuery && query.isLoading),
    error: adminAccess.isSuperAdmin ? (query.error ?? null) : null,
    totalCount: query.data?.pages[0]?.totalCount ?? 0,
    fetchNextPage: query.fetchNextPage,
    hasNextPage: query.hasNextPage,
    isFetchingNextPage: query.isFetchingNextPage,
  };
}
