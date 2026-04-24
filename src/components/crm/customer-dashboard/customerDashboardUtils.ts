import type { ColorPaletteProp } from "@mui/joy/styles/types";
import { format, formatDistanceToNowStrict } from "date-fns";
import type { CustomerData } from "@/hooks/useCustomerDashboard";

export const buildCustomerName = (
  customer?: Pick<CustomerData, "first_name" | "last_name" | "email"> | null,
) => {
  if (!customer) {
    return "Customer";
  }

  const firstName = String(customer.first_name ?? "").trim();
  const lastName = String(customer.last_name ?? "").trim();
  const fullName = `${firstName} ${lastName}`.trim();

  return fullName || customer.email?.split("@")[0] || "Customer";
};

export const getInitials = (label?: string | null) => {
  if (!label) return "CU";

  const parts = label
    .split(/\s+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 2);

  if (parts.length === 0) {
    return "CU";
  }

  return parts.map((part) => part[0]?.toUpperCase() ?? "").join("") || "CU";
};

export const clampPercent = (value?: number | null) => {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return 0;
  }

  return Math.max(0, Math.min(100, value));
};

export const formatCurrency = (
  value?: number | null,
  fallback = "Data not available",
) => {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return fallback;
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: value >= 1000 ? 0 : 2,
  }).format(value);
};

export const formatPercent = (
  value?: number | null,
  digits = 0,
  fallback = "Data not available",
) => {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return fallback;
  }

  return `${value.toFixed(digits)}%`;
};

export const formatCompactNumber = (
  value?: number | null,
  fallback = "Data not available",
) => {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return fallback;
  }

  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: value >= 1000 ? 1 : 0,
  }).format(value);
};

export const formatDateLabel = (
  value?: string | null,
  pattern = "MMM d, yyyy",
  fallback = "Data not available",
) => {
  if (!value) return fallback;

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return fallback;
  }

  return format(parsed, pattern);
};

export const formatRelativeTimestamp = (
  value?: string | null,
  fallback = "Data not available",
) => {
  if (!value) return fallback;

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return fallback;
  }

  return formatDistanceToNowStrict(parsed, { addSuffix: true });
};

export const formatAccountAge = (days?: number | null) => {
  if (days === null || days === undefined || Number.isNaN(days)) {
    return "Data not available";
  }

  if (days < 30) {
    return `${days}d`;
  }

  const years = Math.floor(days / 365);
  const months = Math.floor((days % 365) / 30);

  if (years > 0 && months > 0) {
    return `${years}y ${months}m`;
  }

  if (years > 0) {
    return `${years}y`;
  }

  return `${months}m`;
};

export const formatDaysLabel = (
  days?: number | null,
  fallback = "Data not available",
) => {
  if (days === null || days === undefined || Number.isNaN(days)) {
    return fallback;
  }

  if (days === 0) {
    return "Today";
  }

  if (days === 1) {
    return "1 day";
  }

  return `${days} days`;
};

export const getScoreColor = (value?: number | null): ColorPaletteProp => {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "neutral";
  }

  if (value >= 70) {
    return "success";
  }

  if (value >= 40) {
    return "warning";
  }

  return "danger";
};

export const getRiskColor = (value?: number | null): ColorPaletteProp => {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "neutral";
  }

  if (value <= 30) {
    return "success";
  }

  if (value <= 60) {
    return "warning";
  }

  return "danger";
};

export const getLifecyclePresentation = (
  stage?: string | null,
  isVip = false,
): { label: string; color: ColorPaletteProp } => {
  if (isVip) {
    return { label: "VIP", color: "primary" };
  }

  const normalized = String(stage ?? "new")
    .trim()
    .toLowerCase();

  switch (normalized) {
    case "engaged":
    case "active_buyer":
      return { label: "Active", color: "success" };
    case "loyal":
      return { label: "Loyal", color: "primary" };
    case "at_risk":
      return { label: "At Risk", color: "warning" };
    case "dormant":
    case "churned":
      return {
        label: normalized === "dormant" ? "Dormant" : "Churned",
        color: "danger",
      };
    default:
      return { label: "New", color: "info" };
  }
};

export const humanizeChannel = (value?: string | null) => {
  if (!value) return "Unknown";

  const normalized = value.replace(/[_-]+/g, " ").trim();
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
};

export const getPersonaLabel = (value?: string | null) => {
  if (!value) {
    return "No persona assigned";
  }

  return value;
};
