import Box from "@mui/joy/Box";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import {
  Activity,
  BarChart3,
  DollarSign,
  MailCheck,
  Megaphone,
  Minus,
  MousePointerClick,
  Package,
  ShieldCheck,
  ShoppingBag,
  TrendingDown,
  TrendingUp,
  Users,
  type LucideIcon,
} from "lucide-react";
import { JoyCard } from "@/components/joy/JoyCard";
import { JoyChip } from "@/components/joy/JoyChip";
import type {
  StatChangeDirection,
  StatMetric,
} from "@/components/bloom/blocks/blockTypes";
import {
  formatCurrencyValue,
  formatLabel,
  formatNumberValue,
  formatPercentValue,
  isRecord,
  readNumber,
  readString,
} from "@/components/bloom/blocks/blockUtils";

export interface StatCardBlockProps {
  title?: string | null;
  description?: string | null;
  metrics: StatMetric[];
}

const MAX_METRICS = 6;

const KNOWN_STAT_KEYS = [
  "unique_total",
  "raw_unique_total",
  "estimated_deliverable",
  "suppressed_or_opted_out_excluded",
  "selected_segment_count",
  "segment_membership_total",
  "segment_union_count",
  "overlapping_customer_count",
  "duplicated_membership_count",
  "sent_30d",
  "bounce_rate_30d",
  "complaint_rate_30d",
  "deliverability_score",
  "domains_count",
] as const;

function iconForMetric(metric: StatMetric): LucideIcon {
  const token =
    `${metric.icon ?? ""} ${metric.key} ${metric.label}`.toLowerCase();
  if (
    token.includes("customer") ||
    token.includes("audience") ||
    token.includes("member")
  )
    return Users;
  if (
    token.includes("revenue") ||
    token.includes("spent") ||
    token.includes("value") ||
    token.includes("amount")
  )
    return DollarSign;
  if (token.includes("campaign")) return Megaphone;
  if (token.includes("order") || token.includes("purchase")) return ShoppingBag;
  if (token.includes("product") || token.includes("inventory")) return Package;
  if (token.includes("open") || token.includes("deliver")) return MailCheck;
  if (token.includes("click")) return MousePointerClick;
  if (
    token.includes("score") ||
    token.includes("health") ||
    token.includes("reputation")
  )
    return ShieldCheck;
  if (token.includes("rate") || token.includes("trend")) return TrendingUp;
  return BarChart3;
}

function changeTone(
  direction: StatChangeDirection | null | undefined,
): "success" | "danger" | "neutral" {
  if (direction === "up") return "success";
  if (direction === "down") return "danger";
  return "neutral";
}

function ChangeIndicator({ metric }: { metric: StatMetric }) {
  if (!metric.changeLabel) {
    return null;
  }

  const direction = metric.changeDirection ?? "flat";
  const Icon =
    direction === "up"
      ? TrendingUp
      : direction === "down"
        ? TrendingDown
        : Minus;

  return (
    <JoyChip
      color={changeTone(direction)}
      size="sm"
      variant="soft"
      startDecorator={<Icon size={13} strokeWidth={1.9} />}
      sx={{ alignSelf: "flex-start" }}
    >
      {metric.changeLabel}
    </JoyChip>
  );
}

function StatMetricCard({ metric }: { metric: StatMetric }) {
  const Icon = iconForMetric(metric);

  return (
    <JoyCard
      variant="outlined"
      sx={{
        minHeight: 132,
        p: 1.5,
      }}
    >
      <Stack spacing={1.25} sx={{ height: "100%" }}>
        <Stack
          direction="row"
          spacing={1}
          alignItems="center"
          justifyContent="space-between"
        >
          <Box
            sx={{ display: "inline-flex", color: "neutral.500", flexShrink: 0 }}
          >
            <Icon size={18} strokeWidth={1.8} />
          </Box>
          <ChangeIndicator metric={metric} />
        </Stack>

        <Stack spacing={0.35} sx={{ mt: "auto", minWidth: 0 }}>
          <Typography
            level="h4"
            sx={{
              color: "neutral.900",
              fontVariantNumeric: "tabular-nums",
              overflowWrap: "anywhere",
            }}
          >
            {metric.value}
          </Typography>
          <Typography
            level="body-sm"
            sx={{ color: "neutral.600", overflowWrap: "anywhere" }}
          >
            {metric.label}
          </Typography>
        </Stack>
      </Stack>
    </JoyCard>
  );
}

function normalizeChangeDirection(value: unknown): StatChangeDirection | null {
  const direction = readString(value)?.toLowerCase();
  if (direction === "up" || direction === "down" || direction === "flat") {
    return direction;
  }
  return null;
}

function formatMetricValue(
  key: string,
  value: unknown,
  explicitValue?: unknown,
): string {
  const formatted = readString(explicitValue);
  if (formatted) {
    return formatted;
  }

  const normalizedKey = key.toLowerCase();
  if (
    normalizedKey.includes("revenue") ||
    normalizedKey.includes("spent") ||
    normalizedKey.includes("amount") ||
    normalizedKey.includes("price") ||
    normalizedKey.includes("value")
  ) {
    return formatCurrencyValue(value);
  }

  if (
    normalizedKey.includes("rate") ||
    normalizedKey.includes("percent") ||
    normalizedKey.includes("score")
  ) {
    return formatPercentValue(value);
  }

  return formatNumberValue(value);
}

function normalizeMetricRecord(
  record: Record<string, unknown>,
  fallbackKey: string,
): StatMetric | null {
  const key = readString(record.key) ?? readString(record.id) ?? fallbackKey;
  const label = readString(record.label) ?? formatLabel(key);
  const rawValue = record.raw_value ?? record.rawValue ?? record.value;

  return {
    key,
    label,
    value: formatMetricValue(key, rawValue, record.value),
    rawValue: readNumber(rawValue),
    changeLabel:
      readString(record.change_label) ?? readString(record.changeLabel),
    changeDirection: normalizeChangeDirection(
      record.change_direction ?? record.changeDirection,
    ),
    icon: readString(record.icon) ?? undefined,
  };
}

function metricsFromArray(value: unknown): StatMetric[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((entry, index) => {
    if (!isRecord(entry)) {
      return [];
    }

    const metric = normalizeMetricRecord(entry, `metric_${index + 1}`);
    return metric ? [metric] : [];
  });
}

function metricsFromRecord(value: unknown): StatMetric[] {
  if (!isRecord(value)) {
    return [];
  }

  return Object.entries(value).flatMap(([key, entry]) => {
    if (isRecord(entry)) {
      const metric = normalizeMetricRecord(
        { ...entry, key: entry.key ?? key },
        key,
      );
      return metric ? [metric] : [];
    }

    if (readNumber(entry) === null && !readString(entry)) {
      return [];
    }

    return [
      {
        key,
        label: formatLabel(key),
        value: formatMetricValue(key, entry),
        rawValue: readNumber(entry),
      },
    ];
  });
}

function knownMetricsFromRecord(record: Record<string, unknown>): StatMetric[] {
  const metrics = KNOWN_STAT_KEYS.flatMap((key) => {
    const value = record[key];
    if (value === undefined || value === null) {
      return [];
    }

    return [
      {
        key,
        label: formatLabel(key),
        value: formatMetricValue(key, value, record[`formatted_${key}`]),
        rawValue: readNumber(value),
      },
    ];
  });

  const overlap = isRecord(record.overlap)
    ? metricsFromRecord(record.overlap)
    : [];
  return [...metrics, ...overlap].slice(0, MAX_METRICS);
}

function dedupeMetrics(metrics: StatMetric[]): StatMetric[] {
  const seen = new Set<string>();
  return metrics.filter((metric) => {
    const key = metric.key.toLowerCase();
    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

export function normalizeStatCardPayload(
  payload: unknown,
): StatCardBlockProps | null {
  const source = isRecord(payload) ? payload : {};
  const dataRecord = isRecord(source.data) ? source.data : null;
  const title =
    readString(source.title) ?? readString(dataRecord?.title) ?? null;
  const description =
    readString(source.description) ??
    readString(dataRecord?.description) ??
    readString(source.message);

  const arrayMetrics = metricsFromArray(source.metrics)
    .concat(metricsFromArray(dataRecord?.metrics))
    .concat(metricsFromArray(source.metric_cards))
    .concat(metricsFromArray(dataRecord?.metric_cards));

  const objectMetrics = metricsFromRecord(source.key_metrics)
    .concat(metricsFromRecord(dataRecord?.key_metrics))
    .concat(metricsFromRecord(source.derived_metrics))
    .concat(metricsFromRecord(dataRecord?.derived_metrics));

  const knownMetrics = dataRecord
    ? knownMetricsFromRecord(dataRecord)
    : knownMetricsFromRecord(source);
  const metrics = dedupeMetrics([
    ...arrayMetrics,
    ...objectMetrics,
    ...knownMetrics,
  ]).slice(0, MAX_METRICS);

  return metrics.length > 0 ? { title, description, metrics } : null;
}

export function StatCardBlock({
  description,
  metrics,
  title,
}: StatCardBlockProps) {
  return (
    <Stack spacing={1.25}>
      {title || description ? (
        <Stack spacing={0.25}>
          {title ? (
            <Typography level="title-sm" sx={{ color: "neutral.900" }}>
              {title}
            </Typography>
          ) : null}
          {description ? (
            <Typography
              level="body-xs"
              sx={{ color: "neutral.500", overflowWrap: "anywhere" }}
            >
              {description}
            </Typography>
          ) : null}
        </Stack>
      ) : null}

      <Box
        sx={{
          display: "grid",
          gap: 1,
          gridTemplateColumns: {
            xs: "1fr",
            sm: "repeat(2, minmax(0, 1fr))",
            lg:
              metrics.length <= 3
                ? `repeat(${Math.max(metrics.length, 1)}, minmax(0, 1fr))`
                : "repeat(3, minmax(0, 1fr))",
          },
        }}
      >
        {metrics.map((metric) => (
          <StatMetricCard key={metric.key} metric={metric} />
        ))}
      </Box>
    </Stack>
  );
}
