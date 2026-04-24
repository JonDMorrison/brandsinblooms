import { format, formatDistanceToNow } from "date-fns";
import {
  ArrowDownRight,
  ArrowUpRight,
  Minus,
  type LucideIcon,
} from "lucide-react";

export const ANALYTICS_PERIOD_OPTIONS = [
  { label: "7d", value: 7 },
  { label: "30d", value: 30 },
  { label: "90d", value: 90 },
  { label: "All", value: 3650 },
] as const;

export type AnalyticsPeriod =
  (typeof ANALYTICS_PERIOD_OPTIONS)[number]["value"];

export const getAnalyticsPeriodLabel = (period: number) => {
  const match = ANALYTICS_PERIOD_OPTIONS.find(
    (option) => option.value === period,
  );
  return match?.label ?? `${period}d`;
};

export const clampPercentage = (value: number) =>
  Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));

export const formatCompactNumber = (value: number) =>
  new Intl.NumberFormat("en-US", {
    notation: value >= 1000 ? "compact" : "standard",
    maximumFractionDigits: value >= 1000 ? 1 : 0,
  }).format(value);

export const formatCurrency = (
  value: number,
  options?: {
    compact?: boolean;
    maximumFractionDigits?: number;
  },
) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: options?.compact ? "compact" : "standard",
    maximumFractionDigits: options?.maximumFractionDigits ?? 0,
  }).format(value);

export const formatPercent = (value: number, maximumFractionDigits = 1) =>
  `${Number.isFinite(value) ? value.toFixed(maximumFractionDigits) : "0.0"}%`;

export const formatPercentage = formatPercent;

export const formatRelativeTimestamp = (value?: string | null) => {
  if (!value) {
    return "Not available";
  }

  const timestamp = new Date(value);

  if (Number.isNaN(timestamp.getTime())) {
    return "Not available";
  }

  return formatDistanceToNow(timestamp, { addSuffix: true });
};

export const formatRelativeTime = formatRelativeTimestamp;

export const formatAnalyticsDay = (value: string) => {
  const timestamp = new Date(value);

  if (Number.isNaN(timestamp.getTime())) {
    return value;
  }

  return format(timestamp, "MMM d");
};

export const formatDay = formatAnalyticsDay;

export const formatDurationLabel = (seconds: number) => {
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return "0:00";
  }

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.round(seconds % 60)
    .toString()
    .padStart(2, "0");

  return `${minutes}:${remainingSeconds}`;
};

export const formatDuration = formatDurationLabel;

export const normalizePlatformLabel = (platform: string) => {
  const normalized = platform.trim().toLowerCase();

  if (
    normalized === "google_business_profile" ||
    normalized === "google_my_business"
  ) {
    return "Google Business";
  }

  return normalized
    .split(/[_-]+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
};

export const normalizeProviderLabel = (provider: string) =>
  provider
    .split(/[_-]+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

export const getTrendMeta = (delta?: number | null) => {
  if (delta === null || delta === undefined || !Number.isFinite(delta)) {
    return {
      tone: "neutral" as const,
      direction: "flat" as const,
      label: "—",
    };
  }

  if (delta > 0) {
    return {
      tone: "success" as const,
      direction: "up" as const,
      label: `+${Math.round(delta)}%`,
    };
  }

  if (delta < 0) {
    return {
      tone: "danger" as const,
      direction: "down" as const,
      label: `${Math.round(delta)}%`,
    };
  }

  return {
    tone: "neutral" as const,
    direction: "flat" as const,
    label: "0%",
  };
};

export interface TrendInfo {
  tone: "success" | "danger" | "neutral";
  direction: "up" | "down" | "flat";
  label: string;
  delta: number | null;
  icon: LucideIcon;
}

export const getTrendInfo = (
  current?: number | null,
  previous?: number | null,
): TrendInfo => {
  if (
    current === null ||
    current === undefined ||
    previous === null ||
    previous === undefined ||
    !Number.isFinite(current) ||
    !Number.isFinite(previous)
  ) {
    return {
      ...getTrendMeta(null),
      delta: null,
      icon: Minus,
    };
  }

  if (previous === 0) {
    if (current === 0) {
      return {
        ...getTrendMeta(0),
        delta: 0,
        icon: Minus,
      };
    }

    return {
      tone: "success",
      direction: "up",
      label: "New",
      delta: 100,
      icon: ArrowUpRight,
    };
  }

  const delta = ((current - previous) / Math.abs(previous)) * 100;
  const meta = getTrendMeta(delta);

  return {
    ...meta,
    delta,
    icon:
      meta.direction === "up"
        ? ArrowUpRight
        : meta.direction === "down"
          ? ArrowDownRight
          : Minus,
  };
};

export const getProgressColor = (value: number) => {
  if (value >= 80) {
    return "success" as const;
  }

  if (value >= 50) {
    return "warning" as const;
  }

  return "danger" as const;
};
