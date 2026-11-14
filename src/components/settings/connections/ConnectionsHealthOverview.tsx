import Box from "@mui/joy/Box";
import Sheet from "@mui/joy/Sheet";
import Skeleton from "@mui/joy/Skeleton";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { AlertTriangle, CheckCircle2, RefreshCw } from "lucide-react";
import type { ReactNode } from "react";
import { JoyButton } from "@/components/joy/JoyButton";
import { formatDateTimeValue } from "@/components/integrations/shared/dataTabPrimitives";
import { type ConnectionInsight, type ConnectionsOverview, formatCount } from "./connectionsModel";
import { RelativeTime } from "./ConnectionsPrimitives";
import { softPressSx } from "./connectionsStyles";

const stripSx = {
  borderRadius: "24px",
  borderColor: "neutral.outlinedBorder",
  bgcolor: "background.surface",
  boxShadow: "none",
  overflow: "hidden",
  display: "grid",
  gridTemplateColumns: {
    xs: "minmax(0, 1fr)",
    sm: "repeat(3, minmax(0, 1fr))",
    lg: "minmax(0, 1.6fr) repeat(3, minmax(0, 1fr))",
  },
} as const;

const cellSx = {
  p: { xs: 2, md: 2.5 },
  minWidth: 0,
} as const;

const leadCellSx = { ...cellSx, gridColumn: { sm: "1 / -1", lg: "auto" } } as const;

/** Hairline separators that follow the grid at every breakpoint. */
const metricCellSx = (index: number) =>
  ({
    ...cellSx,
    borderColor: "divider",
    borderStyle: "solid",
    borderWidth: 0,
    borderTopWidth: { xs: "1px", lg: 0 },
    borderLeftWidth: { xs: 0, sm: index > 0 ? "1px" : 0, lg: "1px" },
  }) as const;

const Metric = ({ index, label, children }: { index: number; label: string; children: ReactNode }) => (
  <Stack spacing={0.5} sx={metricCellSx(index)}>
    <Typography level="body-xs" sx={{ color: "text.tertiary", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: "lg" }}>
      {label}
    </Typography>
    {children}
  </Stack>
);

interface ConnectionsHealthOverviewProps {
  overview: ConnectionsOverview;
  onFix: (insight: ConnectionInsight) => void;
}

export const ConnectionsHealthOverview = ({ overview, onFix }: ConnectionsHealthOverviewProps) => {
  const failing = overview.needsAttention;
  const hasIssue = failing.length > 0;
  const firstFailing = failing[0];

  const headline = hasIssue
    ? failing.length === 1
      ? `${firstFailing.connection.name || firstFailing.platform.name} needs attention`
      : `${failing.length} connections need attention`
    : overview.syncingCount > 0
      ? "Sync in progress"
      : "All connections healthy";

  const detail = hasIssue
    ? "Some customer or sales data may be out of date until this is fixed."
    : overview.syncingCount > 0
      ? "New customer and sales data is on its way into BloomSuite."
      : "Customer and sales data is flowing into BloomSuite.";

  const Icon = hasIssue ? AlertTriangle : overview.syncingCount > 0 ? RefreshCw : CheckCircle2;
  const tone = hasIssue ? "danger" : overview.syncingCount > 0 ? "primary" : "success";

  return (
    <Sheet aria-label="Integration health" component="section" sx={stripSx} variant="outlined">
      <Stack direction="row" spacing={1.75} alignItems="flex-start" sx={leadCellSx}>
        <Box
          sx={{
            width: 40,
            height: 40,
            borderRadius: "14px",
            display: "grid",
            placeItems: "center",
            flexShrink: 0,
            bgcolor: `${tone}.softBg`,
            color: `${tone}.softColor`,
          }}
        >
          <Icon aria-hidden size={20} strokeWidth={2} />
        </Box>
        <Stack spacing={0.75} sx={{ minWidth: 0, flex: 1 }}>
          <Stack spacing={0.25}>
            <Typography level="title-md" sx={{ color: "text.primary" }}>{headline}</Typography>
            <Typography level="body-sm" sx={{ color: "text.secondary" }}>
              {detail}
            </Typography>
          </Stack>
          {hasIssue ? (
            <Box>
              <JoyButton color="danger" onClick={() => onFix(firstFailing)} size="sm" sx={softPressSx} variant="solid">
                {failing.length === 1 ? "Fix connection" : "Review first issue"}
              </JoyButton>
            </Box>
          ) : null}
        </Stack>
      </Stack>

      <Metric index={0} label="Connected">
        <Typography level="h3" sx={{ color: "text.primary", fontWeight: "lg", lineHeight: 1.1 }}>
          {overview.total}
        </Typography>
        <Typography level="body-xs" sx={{ color: "text.tertiary" }}>
          {overview.total === 1 ? "integration" : "integrations"}
        </Typography>
      </Metric>

      <Metric index={1} label="Last successful sync">
        <RelativeTime
          fallback="Not yet"
          level="title-md"
          sx={{ color: "text.primary", fontWeight: "lg" }}
          value={overview.lastSuccessAt}
        />
        <Typography level="body-xs" sx={{ color: "text.tertiary" }}>
          {overview.lastSuccessAt ? formatDateTimeValue(overview.lastSuccessAt) : "Run a sync to import data"}
        </Typography>
      </Metric>

      <Metric index={2} label="Last import">
        {overview.lastImport ? (
          <>
            <Typography level="title-md" sx={{ color: "text.primary", fontWeight: "lg" }}>
              {formatCount(overview.lastImport.customers)} customers
            </Typography>
            <Typography level="body-xs" sx={{ color: "text.tertiary" }}>
              {formatCount(overview.lastImport.orders)} orders in the same sync
            </Typography>
          </>
        ) : (
          <>
            <Typography level="title-md" sx={{ fontWeight: "lg", color: "text.secondary" }}>
              —
            </Typography>
            <Typography level="body-xs" sx={{ color: "text.tertiary" }}>
              Counts appear after a sync
            </Typography>
          </>
        )}
      </Metric>
    </Sheet>
  );
};

export const ConnectionsHealthOverviewSkeleton = () => (
  <Sheet aria-busy component="section" sx={stripSx} variant="outlined">
    <Stack direction="row" spacing={1.75} sx={leadCellSx}>
      <Skeleton animation="wave" height={40} sx={{ borderRadius: "14px" }} variant="rectangular" width={40} />
      <Stack spacing={0.75} sx={{ flex: 1 }}>
        <Skeleton animation="wave" level="title-md" variant="text" width="60%" />
        <Skeleton animation="wave" level="body-sm" variant="text" width="85%" />
      </Stack>
    </Stack>
    {[0, 1, 2].map((index) => (
      <Stack key={index} spacing={0.75} sx={metricCellSx(index)}>
        <Skeleton animation="wave" level="body-xs" variant="text" width="55%" />
        <Skeleton animation="wave" level="title-md" variant="text" width="45%" />
        <Skeleton animation="wave" level="body-xs" variant="text" width="70%" />
      </Stack>
    ))}
  </Sheet>
);
