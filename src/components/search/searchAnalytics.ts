import { AnalyticsTracker } from "@/lib/analytics/AnalyticsTracker";
import { isTelemetryDisabled } from "@/utils/uptrace";

export type SearchOpenSource = "keyboard" | "click";

const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const PHONE_PATTERN = /(?:\+?\d[\d().\s-]{6,}\d)/g;

function sanitizeText(value: string | undefined) {
  if (!value) {
    return undefined;
  }

  const withoutPii = value
    .replace(EMAIL_PATTERN, "[redacted-email]")
    .replace(PHONE_PATTERN, "[redacted-phone]")
    .replace(/\s+/g, " ")
    .trim();

  return withoutPii ? withoutPii.slice(0, 50) : undefined;
}

async function trackSearchEvent(
  eventType:
    | "search_opened"
    | "search_query_changed"
    | "search_result_selected"
    | "search_action_used"
    | "search_command_used"
    | "search_no_results"
    | "search_closed",
  payload: Record<string, unknown>,
) {
  if (isTelemetryDisabled()) {
    return false;
  }

  return AnalyticsTracker.trackEvent({
    event_type: eventType,
    payload: {
      ...payload,
      timestamp: new Date().toISOString(),
    },
  });
}

export function sanitizeSearchAnalyticsQuery(query: string) {
  return sanitizeText(query) ?? "";
}

export function trackSearchOpened(source: SearchOpenSource, currentRoute: string) {
  return trackSearchEvent("search_opened", {
    current_route: currentRoute,
    source,
  });
}

export function trackSearchClosed(params: {
  currentRoute: string;
  query: string;
  resultCount: number;
  source: SearchOpenSource;
}) {
  return trackSearchEvent("search_closed", {
    current_route: params.currentRoute,
    query: sanitizeSearchAnalyticsQuery(params.query),
    result_count: params.resultCount,
    source: params.source,
  });
}

export function trackSearchQueryChanged(params: {
  activeFilter: string;
  currentRoute: string;
  hasDatabaseResults: boolean;
  isFuzzyMatch: boolean;
  query: string;
  resultCount: number;
  source: SearchOpenSource;
}) {
  return trackSearchEvent("search_query_changed", {
    active_filter: params.activeFilter,
    current_route: params.currentRoute,
    has_database_results: params.hasDatabaseResults,
    is_fuzzy_match: params.isFuzzyMatch,
    query: sanitizeSearchAnalyticsQuery(params.query),
    result_count: params.resultCount,
    source: params.source,
  });
}

export function trackSearchNoResults(params: {
  activeFilter: string;
  currentRoute: string;
  query: string;
  source: SearchOpenSource;
}) {
  return trackSearchEvent("search_no_results", {
    active_filter: params.activeFilter,
    current_route: params.currentRoute,
    query: sanitizeSearchAnalyticsQuery(params.query),
    source: params.source,
  });
}

export function trackSearchResultSelected(params: {
  activeFilter: string;
  currentRoute: string;
  entityType: string;
  query: string;
  rankPosition: number;
  resultRoute: string;
  resultTitle: string;
}) {
  return trackSearchEvent("search_result_selected", {
    active_filter: params.activeFilter,
    current_route: params.currentRoute,
    entity_type: params.entityType,
    query: sanitizeSearchAnalyticsQuery(params.query),
    rank_position: params.rankPosition,
    result_route: params.resultRoute,
    result_title: sanitizeText(params.resultTitle),
  });
}

export function trackSearchActionUsed(params: {
  actionLabel: string;
  actionType: string;
  currentRoute: string;
  query: string;
  resultTitle?: string;
}) {
  return trackSearchEvent("search_action_used", {
    action_label: sanitizeText(params.actionLabel),
    action_type: params.actionType,
    current_route: params.currentRoute,
    query: sanitizeSearchAnalyticsQuery(params.query),
    result_title: sanitizeText(params.resultTitle),
  });
}

export function trackSearchCommandUsed(params: {
  commandLabel: string;
  currentRoute: string;
  query: string;
}) {
  return trackSearchEvent("search_command_used", {
    command_label: sanitizeText(params.commandLabel),
    current_route: params.currentRoute,
    query: sanitizeSearchAnalyticsQuery(params.query),
  });
}