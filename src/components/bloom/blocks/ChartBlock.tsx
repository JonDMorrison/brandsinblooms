import Box from "@mui/joy/Box";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { BarChart3 } from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  JoyCard,
  JoyCardContent,
  JoyCardHeader,
} from "@/components/joy/JoyCard";
import { useBloomReducedMotion } from "@/components/bloom/BloomMotionContext";
import { JoyChip } from "@/components/joy/JoyChip";
import { JoyEmptyState } from "@/components/joy/JoyEmptyState";
import type {
  ChartDatum,
  ChartSeriesKey,
  ChartType,
} from "@/components/bloom/blocks/blockTypes";
import {
  formatCurrencyValue,
  formatLabel,
  formatNumberValue,
  formatPercentValue,
  isRecord,
  readBoolean,
  readNumber,
  readString,
  rowsFromValue,
} from "@/components/bloom/blocks/blockUtils";

export interface ChartBlockProps {
  title: string;
  description?: string | null;
  chartType: ChartType;
  data: ChartDatum[];
  xAxisKey: string;
  yAxisKeys: ChartSeriesKey[];
  legend: boolean;
  height: number;
}

type TooltipPayloadItem = {
  color?: string;
  dataKey?: string | number;
  name?: string;
  payload?: ChartDatum;
  value?: unknown;
};

const SERIES_COLORS = [
  "var(--joy-palette-primary-500)",
  "var(--joy-palette-neutral-800)",
  "var(--joy-palette-neutral-500)",
  "var(--joy-palette-primary-300)",
  "var(--joy-palette-neutral-300)",
] as const;

function normalizeChartType(
  value: unknown,
  rows: ChartDatum[],
  yAxisKeys: ChartSeriesKey[],
): ChartType {
  const chartType = readString(value)?.toLowerCase();
  if (
    chartType === "line" ||
    chartType === "bar" ||
    chartType === "area" ||
    chartType === "pie"
  ) {
    return chartType;
  }

  if (
    rows.length <= 6 &&
    yAxisKeys.length === 1 &&
    rows.some((row) => readString(row.label) || readString(row.name))
  ) {
    return "pie";
  }

  return "line";
}

function formatAxisValue(value: unknown): string {
  const text = readString(value);
  if (!text) {
    return String(value ?? "");
  }

  const time = Date.parse(text);
  if (Number.isFinite(time)) {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
    }).format(new Date(time));
  }

  return text.length > 18 ? `${text.slice(0, 18)}...` : text;
}

function formatChartValue(key: string, value: unknown): string {
  const normalizedKey = key.toLowerCase();
  if (
    normalizedKey.includes("revenue") ||
    normalizedKey.includes("amount") ||
    normalizedKey.includes("price") ||
    normalizedKey.includes("spent") ||
    normalizedKey.includes("value")
  ) {
    return formatCurrencyValue(value);
  }

  if (normalizedKey.includes("rate") || normalizedKey.includes("percent")) {
    return formatPercentValue(value);
  }

  return formatNumberValue(value);
}

function ChartTooltip({
  active,
  label,
  payload,
  yAxisKeys,
}: {
  active?: boolean;
  label?: unknown;
  payload?: TooltipPayloadItem[];
  yAxisKeys: ChartSeriesKey[];
}) {
  if (!active || !payload?.length) {
    return null;
  }

  const labelsByKey = new Map(
    yAxisKeys.map((series) => [series.key, series.label]),
  );

  return (
    <Box
      sx={{
        borderRadius: "md",
        border: "1px solid",
        borderColor: "neutral.200",
        backgroundColor: "background.surface",
        boxShadow: "var(--joy-shadow-md)",
        px: 1.25,
        py: 1,
      }}
    >
      <Typography level="body-xs" sx={{ color: "neutral.500", mb: 0.5 }}>
        {formatAxisValue(label)}
      </Typography>
      <Stack spacing={0.35}>
        {payload.map((item, index) => {
          const dataKey = String(
            item.dataKey ?? yAxisKeys[index]?.key ?? "value",
          );
          return (
            <Stack
              key={`${dataKey}-${index}`}
              direction="row"
              spacing={1}
              alignItems="center"
              justifyContent="space-between"
            >
              <Stack
                direction="row"
                spacing={0.6}
                alignItems="center"
                sx={{ minWidth: 0 }}
              >
                <Box
                  sx={{
                    width: 7,
                    height: 7,
                    borderRadius: "50%",
                    backgroundColor:
                      item.color ?? SERIES_COLORS[index % SERIES_COLORS.length],
                    flexShrink: 0,
                  }}
                />
                <Typography level="body-xs" sx={{ color: "neutral.600" }}>
                  {labelsByKey.get(dataKey) ??
                    formatLabel(item.name ?? dataKey)}
                </Typography>
              </Stack>
              <Typography
                level="body-xs"
                sx={{
                  color: "neutral.900",
                  fontWeight: 600,
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {formatChartValue(dataKey, item.value)}
              </Typography>
            </Stack>
          );
        })}
      </Stack>
    </Box>
  );
}

function normalizeSeriesKeys(value: unknown): ChartSeriesKey[] {
  if (Array.isArray(value)) {
    return value.flatMap((entry) => {
      if (typeof entry === "string" && entry.trim()) {
        const key = entry.trim();
        return [{ key, label: formatLabel(key) }];
      }

      if (!isRecord(entry)) {
        return [];
      }

      const key =
        readString(entry.key) ??
        readString(entry.data_key) ??
        readString(entry.dataKey);
      if (!key) {
        return [];
      }

      return [{ key, label: readString(entry.label) ?? formatLabel(key) }];
    });
  }

  const key = readString(value);
  return key ? [{ key, label: formatLabel(key) }] : [];
}

function inferNumericSeriesKeys(
  rows: ChartDatum[],
  xAxisKey: string,
): ChartSeriesKey[] {
  const sample = rows[0];
  if (!sample) {
    return [];
  }

  return Object.entries(sample).flatMap(([key, value]) => {
    if (
      key === xAxisKey ||
      key.endsWith("_id") ||
      isRecord(value) ||
      Array.isArray(value)
    ) {
      return [];
    }

    return readNumber(value) === null ? [] : [{ key, label: formatLabel(key) }];
  });
}

function inferXAxisKey(rows: ChartDatum[]): string {
  const preferredKeys = [
    "date",
    "send_date",
    "label",
    "name",
    "category",
    "channel",
    "source",
    "campaign_name",
  ];
  const sample = rows[0] ?? {};
  const preferredKey = preferredKeys.find((key) => sample[key] !== undefined);
  if (preferredKey) {
    return preferredKey;
  }

  return (
    Object.entries(sample).find(([, value]) => readString(value))?.[0] ??
    "label"
  );
}

function normalizeChartRows(
  rows: Record<string, unknown>[],
  yAxisKeys: ChartSeriesKey[],
): ChartDatum[] {
  return rows.map((row) => {
    const normalizedRow: ChartDatum = { ...row };
    const metrics = isRecord(row.metrics) ? row.metrics : null;

    yAxisKeys.forEach((series, index) => {
      if (normalizedRow[series.key] !== undefined) {
        return;
      }

      const metricValue = metrics?.[series.key];
      if (metricValue !== undefined) {
        normalizedRow[series.key] = metricValue;
        return;
      }

      if (index === 0 && row.value !== undefined) {
        normalizedRow[series.key] = row.value;
      }
    });

    return normalizedRow;
  });
}

function chartDataFromPayload(
  source: Record<string, unknown>,
  dataRecord: Record<string, unknown> | null,
): Record<string, unknown>[] {
  const rows = rowsFromValue(
    source.series ?? dataRecord?.series ?? source.rows ?? dataRecord?.rows,
  );
  if (rows.length > 0) {
    return rows;
  }

  return rowsFromValue(source.data);
}

export function normalizeChartPayload(
  payload: unknown,
): ChartBlockProps | null {
  const source: Record<string, unknown> = isRecord(payload) ? payload : {};
  const dataRecord = isRecord(source.data) ? source.data : null;
  const rawRows = chartDataFromPayload(source, dataRecord);
  if (rawRows.length === 0) {
    return null;
  }

  const xAxisKey =
    readString(source.x_axis) ??
    readString(source.xAxis) ??
    readString(dataRecord?.x_axis) ??
    readString(dataRecord?.xAxis) ??
    inferXAxisKey(rawRows);
  const yAxisKeys = normalizeSeriesKeys(
    source.y_axis ??
      source.yAxis ??
      dataRecord?.y_axis ??
      dataRecord?.yAxis ??
      source.series_keys ??
      dataRecord?.series_keys,
  );
  const resolvedYAxisKeys =
    yAxisKeys.length > 0
      ? yAxisKeys
      : inferNumericSeriesKeys(rawRows, xAxisKey);
  if (resolvedYAxisKeys.length === 0) {
    return null;
  }

  const data = normalizeChartRows(rawRows, resolvedYAxisKeys);
  const chartType = normalizeChartType(
    source.chart_type ??
      source.chartType ??
      dataRecord?.chart_type ??
      dataRecord?.chartType,
    data,
    resolvedYAxisKeys,
  );
  const primaryLabel = resolvedYAxisKeys[0]?.label ?? "Value";
  const dateRange = isRecord(dataRecord?.date_range)
    ? dataRecord.date_range
    : isRecord(source.date_range)
      ? source.date_range
      : null;
  const rangeLabel = readString(dateRange?.label);

  return {
    title:
      readString(source.title) ??
      readString(dataRecord?.title) ??
      `${primaryLabel} Trend`,
    description:
      readString(source.description) ??
      readString(dataRecord?.description) ??
      rangeLabel,
    chartType,
    data,
    xAxisKey,
    yAxisKeys: resolvedYAxisKeys.slice(0, 5),
    legend:
      readBoolean(source.legend) ??
      readBoolean(dataRecord?.legend) ??
      resolvedYAxisKeys.length > 1,
    height: Math.min(
      Math.max(
        readNumber(source.height) ?? readNumber(dataRecord?.height) ?? 300,
        220,
      ),
      380,
    ),
  };
}

function ChartBody({
  chartType,
  data,
  height,
  legend,
  xAxisKey,
  yAxisKeys,
}: ChartBlockProps) {
  const reducedMotion = useBloomReducedMotion();
  const commonAxis = (
    <>
      <CartesianGrid stroke="var(--joy-palette-neutral-200)" vertical={false} />
      <XAxis
        axisLine={false}
        dataKey={xAxisKey}
        minTickGap={20}
        tick={{ fill: "var(--joy-palette-neutral-500)", fontSize: 12 }}
        tickFormatter={formatAxisValue}
        tickLine={false}
      />
      <YAxis
        axisLine={false}
        tick={{ fill: "var(--joy-palette-neutral-500)", fontSize: 12 }}
        tickFormatter={(value) => formatNumberValue(value)}
        tickLine={false}
        width={64}
      />
      <Tooltip
        content={<ChartTooltip yAxisKeys={yAxisKeys} />}
        cursor={{ stroke: "var(--joy-palette-primary-200)" }}
      />
      {legend ? (
        <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
      ) : null}
    </>
  );

  if (chartType === "bar") {
    return (
      <Box sx={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            margin={{ top: 8, right: 12, left: 0, bottom: 0 }}
          >
            {commonAxis}
            {yAxisKeys.map((series, index) => (
              <Bar
                key={series.key}
                dataKey={series.key}
                fill={SERIES_COLORS[index % SERIES_COLORS.length]}
                isAnimationActive={!reducedMotion}
                name={series.label}
                radius={[6, 6, 0, 0]}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </Box>
    );
  }

  if (chartType === "area") {
    return (
      <Box sx={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={data}
            margin={{ top: 8, right: 12, left: 0, bottom: 0 }}
          >
            <defs>
              {yAxisKeys.map((series, index) => (
                <linearGradient
                  key={series.key}
                  id={`bloom-chart-fill-${index}`}
                  x1="0"
                  x2="0"
                  y1="0"
                  y2="1"
                >
                  <stop
                    offset="0%"
                    stopColor={SERIES_COLORS[index % SERIES_COLORS.length]}
                    stopOpacity={0.22}
                  />
                  <stop
                    offset="100%"
                    stopColor={SERIES_COLORS[index % SERIES_COLORS.length]}
                    stopOpacity={0}
                  />
                </linearGradient>
              ))}
            </defs>
            {commonAxis}
            {yAxisKeys.map((series, index) => (
              <Area
                key={series.key}
                dataKey={series.key}
                fill={`url(#bloom-chart-fill-${index})`}
                isAnimationActive={!reducedMotion}
                name={series.label}
                stroke={SERIES_COLORS[index % SERIES_COLORS.length]}
                strokeWidth={2.25}
                type="monotone"
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </Box>
    );
  }

  if (chartType === "pie") {
    const valueKey = yAxisKeys[0]?.key ?? "value";
    return (
      <Box sx={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey={valueKey}
              innerRadius="58%"
              isAnimationActive={!reducedMotion}
              nameKey={xAxisKey}
              outerRadius="82%"
              paddingAngle={3}
            >
              {data.map((row, index) => (
                <Cell
                  key={`${readString(row[xAxisKey]) ?? index}`}
                  fill={SERIES_COLORS[index % SERIES_COLORS.length]}
                />
              ))}
            </Pie>
            <Tooltip content={<ChartTooltip yAxisKeys={yAxisKeys} />} />
            {legend ? (
              <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
            ) : null}
          </PieChart>
        </ResponsiveContainer>
      </Box>
    );
  }

  return (
    <Box sx={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={data}
          margin={{ top: 8, right: 12, left: 0, bottom: 0 }}
        >
          {commonAxis}
          {yAxisKeys.map((series, index) => (
            <Line
              key={series.key}
              activeDot={{ r: 4 }}
              dataKey={series.key}
              dot={false}
              isAnimationActive={!reducedMotion}
              name={series.label}
              stroke={SERIES_COLORS[index % SERIES_COLORS.length]}
              strokeWidth={2.25}
              type="monotone"
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </Box>
  );
}

export function ChartBlock(props: ChartBlockProps) {
  if (props.data.length === 0) {
    return (
      <JoyCard variant="outlined">
        <JoyCardHeader
          title={props.title}
          description={props.description}
          sx={{ px: 2, pt: 2 }}
        />
        <JoyCardContent sx={{ px: 2, pb: 2, pt: 2 }}>
          <JoyEmptyState
            icon={<BarChart3 />}
            title="No chart data yet"
            description="Bloom did not receive enough data points to draw this view."
          />
        </JoyCardContent>
      </JoyCard>
    );
  }

  return (
    <JoyCard variant="outlined">
      <JoyCardHeader
        title={props.title}
        description={props.description}
        actions={
          <JoyChip color="neutral" size="sm" variant="soft">
            {formatLabel(props.chartType)}
          </JoyChip>
        }
        sx={{ px: 2, pt: 2 }}
      />
      <JoyCardContent sx={{ px: 2, pb: 2, pt: 2 }}>
        <ChartBody {...props} />
      </JoyCardContent>
    </JoyCard>
  );
}
