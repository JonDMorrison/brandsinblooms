import Box from "@mui/joy/Box";
import Typography from "@mui/joy/Typography";
import { BarChart3 } from "lucide-react";
import { ResultCardShell } from "@/components/bloom/content/cards/ResultCardShell";
import {
  formatCurrency,
  formatLabel,
  formatNumber,
  formatPercent,
  getValue,
  isRecord,
  readNumber,
  readString,
  type NormalizedToolResult,
} from "@/components/bloom/content/cards/cardUtils";

type Metric = {
  key: string;
  label: string;
  value: string;
  trend: number | null;
  trendLabel: string | null;
};

function metricFromRecord(
  record: Record<string, unknown>,
  index: number,
): Metric | null {
  const label =
    readString(record.label) ??
    readString(record.title) ??
    formatLabel(record.key, `Metric ${index + 1}`);
  const rawValue = getValue(record, [
    "value",
    "rawValue",
    "raw_value",
    "amount",
  ]);
  const value =
    readString(rawValue) ??
    (String(record.key ?? "").includes("rate")
      ? formatPercent(rawValue)
      : String(record.key ?? "").includes("revenue") ||
          String(record.key ?? "").includes("value")
        ? formatCurrency(rawValue)
        : formatNumber(rawValue));
  if (!value) {
    return null;
  }

  const trend =
    readNumber(record.change_percent) ??
    readNumber(record.changePercent) ??
    readNumber(record.trend) ??
    readNumber(record.delta_percent);
  const direction =
    readString(record.changeDirection) ?? readString(record.change_direction);
  const normalizedTrend =
    trend ??
    (direction === "up"
      ? 1
      : direction === "down"
        ? -1
        : direction === "flat"
          ? 0
          : null);

  return {
    key: readString(record.key) ?? `${label}-${index}`,
    label,
    value,
    trend: normalizedTrend,
    trendLabel:
      readString(record.changeLabel) ?? readString(record.change_label),
  };
}

function metricsFromData(data: unknown): Metric[] {
  if (!isRecord(data)) {
    return [];
  }

  const metricSources = [
    data.metrics,
    data.metric_cards,
    data.kpis,
    data.cards,
  ];
  for (const source of metricSources) {
    if (Array.isArray(source)) {
      const metrics = source
        .filter(isRecord)
        .map(metricFromRecord)
        .filter((metric): metric is Metric => Boolean(metric));
      if (metrics.length > 0) {
        return metrics;
      }
    }
  }

  const totals = isRecord(data.totals) ? data.totals : data;
  return [
    {
      key: "revenue",
      label: "Revenue",
      value: formatCurrency(
        getValue(totals, ["revenue", "total_revenue", "sales"]),
      ),
    },
    {
      key: "orders",
      label: "Orders",
      value: formatNumber(
        getValue(totals, ["orders", "order_count", "total_orders"]),
      ),
    },
    {
      key: "customers",
      label: "Customers",
      value: formatNumber(
        getValue(totals, ["customers", "customer_count", "new_customers"]),
      ),
    },
    {
      key: "average_order",
      label: "Avg order",
      value: formatCurrency(
        getValue(totals, ["average_order_value", "avg_order_value"]),
      ),
    },
  ]
    .filter((metric): metric is { key: string; label: string; value: string } =>
      Boolean(metric.value),
    )
    .map((metric) => ({ ...metric, trend: null, trendLabel: null }));
}

function trendText(metric: Metric) {
  if (metric.trendLabel) {
    return metric.trendLabel;
  }

  if (metric.trend === null) {
    return null;
  }

  const arrow = metric.trend > 0 ? "↑" : metric.trend < 0 ? "↓" : "→";
  return `${arrow} ${Math.abs(metric.trend)}%`;
}

export function AnalyticsResultCard({
  result,
}: {
  result: NormalizedToolResult;
}) {
  const metrics = metricsFromData(result.data).slice(0, 4);

  return (
    <ResultCardShell
      icon={<BarChart3 size={15} strokeWidth={1.9} />}
      title="Business Overview"
      meta={result.message ?? "Result"}
    >
      {metrics.length > 0 ? (
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: {
              xs: "repeat(2, minmax(0, 1fr))",
              sm: "repeat(4, minmax(0, 1fr))",
            },
            border: "1px solid",
            borderColor: "neutral.outlinedBorder",
            borderRadius: "var(--joy-radius-md)",
            overflow: "hidden",
          }}
        >
          {metrics.map((metric, index) => {
            const trend = trendText(metric);
            return (
              <Box
                key={metric.key}
                sx={{
                  px: 1.5,
                  py: 1.25,
                  borderLeft: {
                    xs: index % 2 === 1 ? "1px solid" : "none",
                    sm: index > 0 ? "1px solid" : "none",
                  },
                  borderTop: {
                    xs: index > 1 ? "1px solid" : "none",
                    sm: "none",
                  },
                  borderColor: "neutral.outlinedBorder",
                }}
              >
                <Typography
                  level="body-sm"
                  noWrap
                  sx={{
                    color: "neutral.800",
                    fontWeight: 500,
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {metric.value}
                </Typography>
                <Typography
                  level="body-xs"
                  noWrap
                  sx={{ color: "neutral.500" }}
                >
                  {metric.label}
                </Typography>
                {trend ? (
                  <Typography
                    level="body-xs"
                    sx={{
                      color:
                        metric.trend && metric.trend > 0
                          ? "success.600"
                          : metric.trend && metric.trend < 0
                            ? "danger.600"
                            : "neutral.500",
                      fontSize: "11px",
                      mt: 0.25,
                    }}
                  >
                    {trend}
                  </Typography>
                ) : null}
              </Box>
            );
          })}
        </Box>
      ) : (
        <Typography level="body-sm" sx={{ color: "neutral.500" }}>
          No analytics metrics were returned.
        </Typography>
      )}
    </ResultCardShell>
  );
}
