import React, { useEffect, useMemo } from "react";
import Box from "@mui/joy/Box";
import IconButton from "@mui/joy/IconButton";
import Sheet from "@mui/joy/Sheet";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  CalendarDays,
  Download,
  Filter,
  Plug,
  RefreshCcw,
} from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { ActivityFiltersBar } from "@/components/activity/ActivityFiltersBar";
import { ActivityFeedList } from "@/components/activity/ActivityFeedList";
import { CatalogStatsStrip } from "@/components/crm/catalog/CatalogStatsStrip";
import { JoyButton } from "@/components/joy/JoyButton";
import { JoyChip } from "@/components/joy/JoyChip";
import { PageContainer } from "@/components/joy/PageContainer";
import { useActivityFeed } from "@/hooks/useActivityFeed";
import { supabase } from "@/integrations/supabase/client";
import type { ActivityFeedFilters } from "@/types/activity";
import { parseCsvParam, parseDateParam } from "@/lib/activityUtils";
import type { ActivityGroupMode } from "@/lib/activityGrouping";
import { toast } from "sonner";

function getStatusBreakdown(
  events: ReturnType<typeof useActivityFeed>["data"],
) {
  const allEvents = events?.pages.flat() ?? [];
  const totals = new Map<string, number>();

  for (const event of allEvents) {
    const current = totals.get(event.status) ?? 0;
    totals.set(event.status, current + 1);
  }

  return Array.from(totals.entries()).sort((left, right) => right[1] - left[1]);
}

function getActivityFamilyBreakdown(
  events: ReturnType<typeof useActivityFeed>["data"],
) {
  const allEvents = events?.pages.flat() ?? [];
  const totals = new Map<string, number>();

  for (const event of allEvents) {
    const family = String(event.activity_type).split(".")[0] || "other";
    totals.set(family, (totals.get(family) ?? 0) + 1);
  }

  return Array.from(totals.entries())
    .sort((left, right) => right[1] - left[1])
    .slice(0, 5);
}

export default function ActivityCenterPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();

  const groupMode = (searchParams.get("group") ??
    "campaign") as ActivityGroupMode;

  const filters: ActivityFeedFilters = useMemo(() => {
    return {
      customerId: searchParams.get("customer"),
      search: searchParams.get("q") ?? undefined,
      status: parseCsvParam(searchParams.get("status")),
      actorTypes: parseCsvParam(searchParams.get("actor")),
      sources: parseCsvParam(searchParams.get("source")),
      activityTypes: parseCsvParam(searchParams.get("type")),
      segmentIds: parseCsvParam(searchParams.get("segment")),
      personaIds: parseCsvParam(searchParams.get("persona")),
      start: parseDateParam(searchParams.get("start")),
      end: parseDateParam(searchParams.get("end")),
    };
  }, [searchParams]);

  const feed = useActivityFeed(filters, { pageSize: 50 });
  const events = feed.data?.pages.flat() ?? [];

  const hasActiveFilters =
    Boolean(filters.customerId) ||
    Boolean(filters.search) ||
    Boolean(filters.start) ||
    Boolean(filters.end) ||
    Boolean(filters.status?.length) ||
    Boolean(filters.actorTypes?.length) ||
    Boolean(filters.sources?.length) ||
    Boolean(filters.activityTypes?.length) ||
    Boolean(filters.segmentIds?.length) ||
    Boolean(filters.personaIds?.length);

  const todayCount = useMemo(() => {
    const today = new Date();

    return events.filter((event) => {
      const timestamp = new Date(event.timestamp);
      return (
        timestamp.getFullYear() === today.getFullYear() &&
        timestamp.getMonth() === today.getMonth() &&
        timestamp.getDate() === today.getDate()
      );
    }).length;
  }, [events]);

  const sourceCount = useMemo(
    () => new Set(events.map((event) => event.source)).size,
    [events],
  );

  const statusBreakdown = useMemo(
    () => getStatusBreakdown(feed.data),
    [feed.data],
  );
  const familyBreakdown = useMemo(
    () => getActivityFamilyBreakdown(feed.data),
    [feed.data],
  );

  useEffect(() => {
    const channel = supabase
      .channel("activity-center-feed")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "crm_activity_events",
        },
        () => {
          void queryClient.invalidateQueries({ queryKey: ["activity-feed"] });
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const handleClearFilters = () => {
    const next = new URLSearchParams(searchParams);

    [
      "customer",
      "q",
      "status",
      "actor",
      "source",
      "type",
      "start",
      "end",
      "segment",
      "persona",
    ].forEach((key) => next.delete(key));

    setSearchParams(next, { replace: true });
  };

  const summaryMetrics = [
    {
      label: "events",
      value: events.length.toLocaleString(),
    },
    {
      label: "today",
      value: todayCount.toLocaleString(),
    },
    {
      label: "active filters",
      value: activeCountDisplay(filters).toLocaleString(),
    },
  ];

  const stats = [
    {
      label: "Loaded Events",
      value: events.length.toLocaleString(),
      icon: <Activity size={18} />,
    },
    {
      label: "Today",
      value: todayCount.toLocaleString(),
      icon: <CalendarDays size={18} />,
    },
    {
      label: "Active Filters",
      value: activeCountDisplay(filters).toLocaleString(),
      icon: <Filter size={18} />,
    },
    {
      label: "Sources",
      value: sourceCount.toLocaleString(),
      icon: <Plug size={18} />,
    },
  ];

  return (
    <PageContainer>
      <Stack
        spacing={3}
        sx={{ px: { xs: 2, md: 3 }, py: { xs: 2.5, md: 3.5 } }}
      >
        <Stack
          direction={{ xs: "column", md: "row" }}
          alignItems={{ xs: "stretch", md: "flex-start" }}
          justifyContent="space-between"
          spacing={2}
        >
          <Stack spacing={0.5} sx={{ maxWidth: 720 }}>
            <Typography level="h3" fontWeight="bold">
              Activity Center
            </Typography>
            <Typography level="body-sm" sx={{ color: "neutral.600" }}>
              Track CRM updates, campaigns, automations, and integrations in one
              continuous feed.
            </Typography>
            <Stack
              direction="row"
              spacing={2}
              useFlexGap
              flexWrap="wrap"
              sx={{ mt: 0.5 }}
            >
              {summaryMetrics.map((metric) => (
                <Typography
                  key={metric.label}
                  level="body-xs"
                  sx={{ color: "neutral.500" }}
                >
                  <Box
                    component="span"
                    sx={{ color: "neutral.900", fontWeight: 600 }}
                  >
                    {metric.value}
                  </Box>{" "}
                  {metric.label}
                </Typography>
              ))}
            </Stack>
          </Stack>

          <Stack direction="row" spacing={1} alignItems="center">
            <IconButton
              variant="outlined"
              color="neutral"
              size="sm"
              onClick={() => {
                void feed.refetch();
              }}
              aria-label="Refresh activity"
            >
              <Box
                component="span"
                sx={{
                  display: "inline-flex",
                  animation: feed.isRefetching
                    ? "activity-center-spin 1s linear infinite"
                    : "none",
                  "@keyframes activity-center-spin": {
                    from: { transform: "rotate(0deg)" },
                    to: { transform: "rotate(360deg)" },
                  },
                }}
              >
                <RefreshCcw size={16} />
              </Box>
            </IconButton>
            <JoyButton
              variant="solid"
              color="primary"
              size="sm"
              startDecorator={<Download size={16} />}
              onClick={() =>
                toast.info("Activity export tools are coming soon.")
              }
            >
              Export
            </JoyButton>
          </Stack>
        </Stack>

        <CatalogStatsStrip items={stats} />

        <ActivityFiltersBar />

        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", xl: "minmax(0, 1fr) 300px" },
            gap: 3,
            alignItems: "start",
          }}
        >
          <Sheet
            variant="outlined"
            sx={{
              borderRadius: "2xl",
              borderColor: "neutral.200",
              backgroundColor: "background.surface",
              boxShadow: "sm",
              px: { xs: 2, md: 3 },
              py: { xs: 2, md: 2.5 },
            }}
          >
            <Stack spacing={2.5}>
              <Stack
                direction="row"
                spacing={1}
                justifyContent="space-between"
                alignItems="center"
              >
                <Stack spacing={0.25}>
                  <Typography level="title-md">Timeline</Typography>
                  <Typography level="body-xs" color="neutral">
                    Most recent first
                    {groupMode === "campaign"
                      ? " · grouped by campaign"
                      : " · ungrouped"}
                  </Typography>
                </Stack>
                {hasActiveFilters ? (
                  <JoyChip size="sm" variant="soft" color="primary">
                    Filtered view
                  </JoyChip>
                ) : null}
              </Stack>

              <ActivityFeedList
                feed={feed}
                groupMode={groupMode}
                hasActiveFilters={hasActiveFilters}
                onClearFilters={handleClearFilters}
              />
            </Stack>
          </Sheet>

          <Stack spacing={2} sx={{ display: { xs: "none", xl: "flex" } }}>
            <Sheet
              variant="outlined"
              sx={{ borderRadius: "2xl", px: 2.5, py: 2.25, boxShadow: "sm" }}
            >
              <Stack spacing={1.5}>
                <Typography level="title-sm">Status breakdown</Typography>
                {statusBreakdown.length ? (
                  statusBreakdown.map(([label, total]) => (
                    <Stack
                      key={label}
                      direction="row"
                      spacing={1}
                      justifyContent="space-between"
                      alignItems="center"
                    >
                      <Typography level="body-sm">{label}</Typography>
                      <JoyChip size="sm" variant="soft" color="neutral">
                        {total}
                      </JoyChip>
                    </Stack>
                  ))
                ) : (
                  <Typography level="body-sm" color="neutral">
                    No events loaded yet.
                  </Typography>
                )}
              </Stack>
            </Sheet>

            <Sheet
              variant="outlined"
              sx={{ borderRadius: "2xl", px: 2.5, py: 2.25, boxShadow: "sm" }}
            >
              <Stack spacing={1.5}>
                <Typography level="title-sm">Top activity families</Typography>
                {familyBreakdown.length ? (
                  familyBreakdown.map(([label, total]) => (
                    <Stack key={label} spacing={0.5}>
                      <Stack
                        direction="row"
                        spacing={1}
                        justifyContent="space-between"
                        alignItems="center"
                      >
                        <Typography level="body-sm">{label}</Typography>
                        <Typography level="body-xs" color="neutral">
                          {total}
                        </Typography>
                      </Stack>
                      <Box
                        sx={{
                          height: 8,
                          borderRadius: "999px",
                          backgroundColor: "neutral.100",
                          overflow: "hidden",
                        }}
                      >
                        <Box
                          sx={{
                            height: "100%",
                            width: `${Math.max(8, (total / Math.max(events.length, 1)) * 100)}%`,
                            borderRadius: "inherit",
                            background:
                              "linear-gradient(90deg, rgba(var(--joy-palette-primary-mainChannel) / 0.85), rgba(var(--joy-palette-warning-mainChannel) / 0.75))",
                          }}
                        />
                      </Box>
                    </Stack>
                  ))
                ) : (
                  <Typography level="body-sm" color="neutral">
                    No activity loaded yet.
                  </Typography>
                )}
              </Stack>
            </Sheet>
          </Stack>
        </Box>
      </Stack>
    </PageContainer>
  );
}

function activeCountDisplay(filters: ActivityFeedFilters) {
  return [
    filters.customerId,
    filters.search,
    filters.start,
    filters.end,
    filters.status?.length,
    filters.actorTypes?.length,
    filters.sources?.length,
    filters.activityTypes?.length,
    filters.segmentIds?.length,
    filters.personaIds?.length,
  ].filter(Boolean).length;
}
