import { subDays } from "date-fns";

export type CustomerDashboardTimeRange = "7d" | "30d" | "90d" | "all";

export interface CustomerDashboardSeriesResult<T> {
  data: T[];
  error: string | null;
}

export const getDashboardRangeStartDate = (
  timeRange: CustomerDashboardTimeRange = "30d",
) => {
  if (timeRange === "all") {
    return null;
  }

  if (timeRange === "7d") {
    return subDays(new Date(), 7);
  }

  if (timeRange === "90d") {
    return subDays(new Date(), 90);
  }

  return subDays(new Date(), 30);
};

export const getDashboardRangeMonths = (
  timeRange: CustomerDashboardTimeRange = "30d",
  fallbackMonths = 6,
) => {
  if (timeRange === "7d" || timeRange === "30d") {
    return 1;
  }

  if (timeRange === "90d") {
    return 3;
  }

  return Math.max(fallbackMonths, 120);
};

export const isOnOrAfterRangeStart = (
  value: string | Date | null | undefined,
  startDate: Date | null,
) => {
  if (!startDate || !value) {
    return true;
  }

  const normalized = value instanceof Date ? value : new Date(value);
  return !Number.isNaN(normalized.getTime()) && normalized >= startDate;
};
