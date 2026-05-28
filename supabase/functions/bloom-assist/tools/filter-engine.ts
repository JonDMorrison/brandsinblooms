import type { JsonArray, JsonObject, JsonValue } from "../types.ts";
import type {
  ApplyFiltersOptions,
  FilterFieldCatalog,
  FilterOperator,
  JunctionFilterValue,
  RelativeDateRange,
  ToolEntity,
  ToolFilter,
} from "./types.ts";
import {
  CAMPAIGN_FILTER_FIELDS,
  CUSTOMER_FILTER_FIELDS,
  ORDER_FILTER_FIELDS,
  PRODUCT_FILTER_FIELDS,
  SEGMENT_FILTER_FIELDS,
} from "./types.ts";

export const ALLOWED_FILTER_FIELDS: FilterFieldCatalog = {
  customer: CUSTOMER_FILTER_FIELDS,
  product: PRODUCT_FILTER_FIELDS,
  campaign: CAMPAIGN_FILTER_FIELDS,
  segment: SEGMENT_FILTER_FIELDS,
  order: ORDER_FILTER_FIELDS,
};

type ComparableValue = string | number | boolean;

type SupabaseFilterBuilder<Query> = {
  eq: (field: string, value: JsonValue) => Query;
  neq: (field: string, value: JsonValue) => Query;
  ilike: (field: string, pattern: string) => Query;
  not: (
    field: string,
    operator: string,
    value: JsonValue | string | null,
  ) => Query;
  gt: (field: string, value: ComparableValue) => Query;
  lt: (field: string, value: ComparableValue) => Query;
  gte: (field: string, value: ComparableValue) => Query;
  lte: (field: string, value: ComparableValue) => Query;
  in: (field: string, values: JsonArray) => Query;
  is: (field: string, value: null) => Query;
};

type ZonedDateParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isJsonPrimitive(
  value: unknown,
): value is string | number | boolean | null {
  return (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  );
}

function isJsonObject(value: unknown): value is JsonObject {
  if (!isRecord(value)) {
    return false;
  }

  return Object.values(value).every(isJsonValue);
}

function isJsonValue(value: unknown): value is JsonValue {
  if (isJsonPrimitive(value)) {
    return typeof value !== "number" || Number.isFinite(value);
  }

  if (Array.isArray(value)) {
    return value.every(isJsonValue);
  }

  return isJsonObject(value);
}

function isComparableValue(value: JsonValue): value is ComparableValue {
  return (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  );
}

function normalizeRelativeDateKey(value: string): string {
  return value.trim().toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ");
}

function getZonedDateParts(date: Date, timezone: string): ZonedDateParts {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(date);

  const readPart = (type: string) => {
    const value = parts.find((part) => part.type === type)?.value;
    return value ? Number(value) : 0;
  };

  const hour = readPart("hour");
  return {
    year: readPart("year"),
    month: readPart("month"),
    day: readPart("day"),
    hour: hour === 24 ? 0 : hour,
    minute: readPart("minute"),
    second: readPart("second"),
  };
}

function getTimezoneOffsetMs(timezone: string, date: Date): number {
  const parts = getZonedDateParts(date, timezone);
  const asUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );

  return asUtc - date.getTime();
}

function zonedDateToUtc(
  timezone: string,
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
  millisecond: number,
): Date {
  const utcGuess = new Date(
    Date.UTC(year, month - 1, day, hour, minute, second, millisecond),
  );
  const offset = getTimezoneOffsetMs(timezone, utcGuess);
  return new Date(utcGuess.getTime() - offset);
}

function startOfZonedDay(
  timezone: string,
  year: number,
  month: number,
  day: number,
): Date {
  return zonedDateToUtc(timezone, year, month, day, 0, 0, 0, 0);
}

function endBefore(nextStart: Date): Date {
  return new Date(nextStart.getTime() - 1);
}

function resolveRelativeDateRange(
  value: string,
  timezone = "UTC",
): RelativeDateRange | null {
  const key = normalizeRelativeDateKey(value);
  const now = new Date();
  const today = getZonedDateParts(now, timezone);
  const startToday = startOfZonedDay(
    timezone,
    today.year,
    today.month,
    today.day,
  );
  const startTomorrow = startOfZonedDay(
    timezone,
    today.year,
    today.month,
    today.day + 1,
  );

  if (key === "today") {
    return {
      start: startToday.toISOString(),
      end: endBefore(startTomorrow).toISOString(),
    };
  }

  if (key === "yesterday") {
    const start = startOfZonedDay(
      timezone,
      today.year,
      today.month,
      today.day - 1,
    );
    return {
      start: start.toISOString(),
      end: endBefore(startToday).toISOString(),
    };
  }

  if (key === "last 7 days" || key === "last seven days") {
    const start = startOfZonedDay(
      timezone,
      today.year,
      today.month,
      today.day - 6,
    );
    return {
      start: start.toISOString(),
      end: endBefore(startTomorrow).toISOString(),
    };
  }

  if (key === "last 30 days" || key === "last thirty days") {
    const start = startOfZonedDay(
      timezone,
      today.year,
      today.month,
      today.day - 29,
    );
    return {
      start: start.toISOString(),
      end: endBefore(startTomorrow).toISOString(),
    };
  }

  if (key === "this month") {
    const start = startOfZonedDay(timezone, today.year, today.month, 1);
    const next = startOfZonedDay(timezone, today.year, today.month + 1, 1);
    return { start: start.toISOString(), end: endBefore(next).toISOString() };
  }

  if (key === "this quarter") {
    const quarterStartMonth = Math.floor((today.month - 1) / 3) * 3 + 1;
    const start = startOfZonedDay(timezone, today.year, quarterStartMonth, 1);
    const next = startOfZonedDay(
      timezone,
      today.year,
      quarterStartMonth + 3,
      1,
    );
    return { start: start.toISOString(), end: endBefore(next).toISOString() };
  }

  if (key === "this year") {
    const start = startOfZonedDay(timezone, today.year, 1, 1);
    const next = startOfZonedDay(timezone, today.year + 1, 1, 1);
    return { start: start.toISOString(), end: endBefore(next).toISOString() };
  }

  return null;
}

function validateFilterField(
  filter: ToolFilter,
  options: ApplyFiltersOptions,
): void {
  const allowedFields =
    options.allowedFields ??
    (filter.entity || options.entity
      ? ALLOWED_FILTER_FIELDS[(filter.entity ?? options.entity) as ToolEntity]
      : Object.values(ALLOWED_FILTER_FIELDS).flat());

  if (!allowedFields.includes(filter.field)) {
    const entity = filter.entity ?? options.entity ?? "known CRM entities";
    throw new Error(`Unknown filter field "${filter.field}" for ${entity}`);
  }
}

function requireValue(filter: ToolFilter): JsonValue {
  if (filter.value === undefined) {
    throw new Error(
      `Filter ${filter.field}.${filter.operator} requires a value`,
    );
  }

  if (!isJsonValue(filter.value)) {
    throw new Error(
      `Filter ${filter.field}.${filter.operator} value must be JSON`,
    );
  }

  return filter.value;
}

function requireComparable(
  filter: ToolFilter,
  timezone?: string,
): ComparableValue {
  const value = requireValue(filter);
  if (typeof value === "string") {
    const range = resolveRelativeDateRange(value, timezone);
    if (range) {
      return filter.operator === "lt" || filter.operator === "lte"
        ? range.end
        : range.start;
    }
  }

  if (!isComparableValue(value)) {
    throw new Error(
      `Filter ${filter.field}.${filter.operator} requires a primitive value`,
    );
  }

  return value;
}

function requireValueArray(filter: ToolFilter): JsonArray {
  const value = requireValue(filter);
  if (!Array.isArray(value)) {
    throw new Error(
      `Filter ${filter.field}.${filter.operator} requires an array value`,
    );
  }

  return value;
}

function resolveBetweenValues(
  filter: ToolFilter,
  timezone?: string,
): [ComparableValue, ComparableValue] {
  const value = requireValue(filter);

  if (typeof value === "string") {
    const range = resolveRelativeDateRange(value, timezone);
    if (range) {
      return [range.start, range.end];
    }
  }

  if (!Array.isArray(value) || value.length !== 2) {
    throw new Error(
      `Filter ${filter.field}.between requires a two-value array or relative date phrase`,
    );
  }

  const [start, end] = value;
  if (!isComparableValue(start) || !isComparableValue(end)) {
    throw new Error(
      `Filter ${filter.field}.between values must be primitive values`,
    );
  }

  return [start, end];
}

function parseJunctionFilterValue(filter: ToolFilter): JunctionFilterValue {
  const value = requireValue(filter);
  if (!isJsonObject(value)) {
    throw new Error(
      `${filter.operator} filter for ${filter.field} requires a relationship object`,
    );
  }

  const relationship = value.relationship;
  const matchField = value.match_field;
  const matchingIds = value.matching_ids;
  const count = value.count;

  if (
    relationship !== "segment" &&
    relationship !== "tag" &&
    relationship !== "persona"
  ) {
    throw new Error(
      `${filter.operator} filter relationship must be segment, tag, or persona`,
    );
  }

  if (matchField !== "id" && matchField !== "name") {
    throw new Error(`${filter.operator} filter match_field must be id or name`);
  }

  return {
    relationship,
    match_field: matchField,
    match_value: value.match_value,
    matching_ids: Array.isArray(matchingIds)
      ? matchingIds.filter((item): item is string => typeof item === "string")
      : undefined,
    count:
      typeof count === "number" && Number.isFinite(count) ? count : undefined,
  };
}

function applyNoMatches<Query extends SupabaseFilterBuilder<Query>>(
  query: Query,
): Query {
  return query.eq("id", "00000000-0000-4000-8000-000000000000");
}

function applyJunctionFilter<Query extends SupabaseFilterBuilder<Query>>(
  query: Query,
  filter: ToolFilter,
): Query {
  const junction = parseJunctionFilterValue(filter);
  const matchingIds = junction.matching_ids;

  if (!matchingIds) {
    throw new Error(
      `${filter.operator} filter for ${junction.relationship} must be resolved to matching_ids before applying CRM filters`,
    );
  }

  if (filter.operator === "has") {
    return matchingIds.length > 0
      ? query.in("id", matchingIds)
      : applyNoMatches(query);
  }

  if (filter.operator === "has_not") {
    let next = query;
    for (const id of matchingIds) {
      next = next.neq("id", id);
    }
    return next;
  }

  if (filter.operator === "has_count") {
    if (junction.count === 0 && matchingIds.length === 0) {
      return query;
    }

    return matchingIds.length > 0
      ? query.in("id", matchingIds)
      : applyNoMatches(query);
  }

  return query;
}

function applyEquals<Query extends SupabaseFilterBuilder<Query>>(
  query: Query,
  filter: ToolFilter,
  timezone?: string,
): Query {
  const value = requireValue(filter);
  if (typeof value === "string") {
    const range = resolveRelativeDateRange(value, timezone);
    if (range) {
      return query.gte(filter.field, range.start).lte(filter.field, range.end);
    }
  }

  return query.eq(filter.field, value);
}

function applyNotIn<Query extends SupabaseFilterBuilder<Query>>(
  query: Query,
  field: string,
  values: JsonArray,
): Query {
  let next = query;
  for (const value of values) {
    next = next.neq(field, value);
  }
  return next;
}

export function resolveRelativeDateValue(
  value: string,
  timezone = "UTC",
): RelativeDateRange | null {
  return resolveRelativeDateRange(value, timezone);
}

export function applyFilters<Query extends SupabaseFilterBuilder<Query>>(
  query: Query,
  filters: ToolFilter[],
  options: ApplyFiltersOptions = {},
): Query {
  let next = query;

  for (const filter of filters) {
    validateFilterField(filter, options);

    switch (filter.operator as FilterOperator) {
      case "equals":
        next = applyEquals(next, filter, options.timezone);
        break;
      case "not_equals": {
        const value = requireValue(filter);
        if (
          typeof value === "string" &&
          resolveRelativeDateRange(value, options.timezone)
        ) {
          throw new Error("not_equals does not support relative date ranges");
        }
        next = next.neq(filter.field, value);
        break;
      }
      case "contains":
        next = next.ilike(
          filter.field,
          `%${String(requireComparable(filter, options.timezone))}%`,
        );
        break;
      case "not_contains":
        next = next.not(
          filter.field,
          "ilike",
          `%${String(requireComparable(filter, options.timezone))}%`,
        );
        break;
      case "starts_with":
        next = next.ilike(
          filter.field,
          `${String(requireComparable(filter, options.timezone))}%`,
        );
        break;
      case "ends_with":
        next = next.ilike(
          filter.field,
          `%${String(requireComparable(filter, options.timezone))}`,
        );
        break;
      case "gt":
        next = next.gt(
          filter.field,
          requireComparable(filter, options.timezone),
        );
        break;
      case "lt":
        next = next.lt(
          filter.field,
          requireComparable(filter, options.timezone),
        );
        break;
      case "gte":
        next = next.gte(
          filter.field,
          requireComparable(filter, options.timezone),
        );
        break;
      case "lte":
        next = next.lte(
          filter.field,
          requireComparable(filter, options.timezone),
        );
        break;
      case "between": {
        const [start, end] = resolveBetweenValues(filter, options.timezone);
        next = next.gte(filter.field, start).lte(filter.field, end);
        break;
      }
      case "in":
        next = next.in(filter.field, requireValueArray(filter));
        break;
      case "not_in":
        next = applyNotIn(next, filter.field, requireValueArray(filter));
        break;
      case "is_null":
        next = next.is(filter.field, null);
        break;
      case "is_not_null":
        next = next.not(filter.field, "is", null);
        break;
      case "has":
      case "has_not":
      case "has_count":
        next = applyJunctionFilter(next, filter);
        break;
    }
  }

  return next;
}
