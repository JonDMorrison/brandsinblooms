import React, { useEffect, useMemo, useState } from "react";
import Box from "@mui/joy/Box";
import Button from "@mui/joy/Button";
import CircularProgress from "@mui/joy/CircularProgress";
import Divider from "@mui/joy/Divider";
import Link from "@mui/joy/Link";
import Sheet from "@mui/joy/Sheet";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { format } from "date-fns";
import type {
  UseInfiniteQueryResult,
  InfiniteData,
} from "@tanstack/react-query";
import { ChevronDown, ChevronRight, ExternalLink } from "lucide-react";
import { Link as RouterLink } from "react-router-dom";

import type { ActivityEvent } from "@/types/activity";
import { ActivityRow } from "@/components/activity/ActivityRow";
import ActivityFeedSkeleton from "@/components/activity/ActivityFeedSkeleton";
import type { ActivityGroupMode } from "@/lib/activityGrouping";
import { getCampaignId, getCampaignName } from "@/lib/activityGrouping";
import { JoyChip } from "@/components/joy/JoyChip";
import { useIntersectionSentinel } from "@/hooks/useIntersectionSentinel";
import { supabase } from "@/integrations/supabase/client";
import { ActivityStatusMarker } from "@/components/activity/activityPresentation";

type FeedLike = Pick<
  UseInfiniteQueryResult<InfiniteData<ActivityEvent[], unknown>, Error>,
  | "data"
  | "isLoading"
  | "isError"
  | "error"
  | "hasNextPage"
  | "fetchNextPage"
  | "isFetchingNextPage"
  | "refetch"
>;

type ListItem =
  | {
      kind: "date";
      key: string;
      label: string;
    }
  | {
      kind: "event";
      key: string;
      event: ActivityEvent;
    }
  | {
      kind: "campaignHeader";
      key: string;
      campaignId: string;
      campaignName: string | null;
      count: number;
      timestamp: string;
    };

function buildTimelineItems(
  events: ActivityEvent[],
  groupMode: ActivityGroupMode,
  expandedCampaignIds: Set<string>,
): ListItem[] {
  const items: ListItem[] = [];
  const emittedCampaign = new Set<string>();
  let lastDate = "";

  const getDateLabel = (timestamp: string) => {
    try {
      return format(new Date(timestamp), "MMM d, yyyy");
    } catch {
      return "";
    }
  };

  const pushDateIfNeeded = (timestamp: string) => {
    const label = getDateLabel(timestamp);
    if (label && label !== lastDate) {
      lastDate = label;
      items.push({ kind: "date", key: `date:${label}`, label });
    }
  };

  if (groupMode !== "campaign") {
    for (const ev of events) {
      pushDateIfNeeded(ev.timestamp);
      items.push({ kind: "event", key: ev.id, event: ev });
    }
    return items;
  }

  const byCampaign = new Map<
    string,
    { campaignId: string; campaignName: string | null; events: ActivityEvent[] }
  >();

  for (const ev of events) {
    const campaignId = getCampaignId(ev);
    if (!campaignId) continue;
    let group = byCampaign.get(campaignId);
    if (!group) {
      group = {
        campaignId,
        campaignName: getCampaignName(ev),
        events: [],
      };
      byCampaign.set(campaignId, group);
    }
    if (!group.campaignName) group.campaignName = getCampaignName(ev);
    group.events.push(ev);
  }

  for (const ev of events) {
    const campaignId = getCampaignId(ev);

    if (!campaignId) {
      pushDateIfNeeded(ev.timestamp);
      items.push({ kind: "event", key: ev.id, event: ev });
      continue;
    }

    if (emittedCampaign.has(campaignId)) continue;
    emittedCampaign.add(campaignId);

    const group = byCampaign.get(campaignId)!;
    pushDateIfNeeded(group.events[0]?.timestamp || ev.timestamp);
    items.push({
      kind: "campaignHeader",
      key: `campaign:${campaignId}`,
      campaignId,
      campaignName: group.campaignName,
      count: group.events.length,
      timestamp: group.events[0]?.timestamp || ev.timestamp,
    });

    if (expandedCampaignIds.has(campaignId)) {
      for (const gev of group.events) {
        items.push({ kind: "event", key: gev.id, event: gev });
      }
    }
  }

  return items;
}

export function ActivityFeedList({
  feed,
  groupMode = "campaign",
  hasActiveFilters = false,
  onClearFilters,
}: {
  feed: FeedLike;
  groupMode?: ActivityGroupMode;
  hasActiveFilters?: boolean;
  onClearFilters?: () => void;
}) {
  const events = feed.data?.pages.flat() ?? [];
  const [expandedCampaignIds, setExpandedCampaignIds] = React.useState<
    Set<string>
  >(() => new Set());

  const [customerNameById, setCustomerNameById] = useState<
    Record<string, string>
  >({});

  const customerIdsToFetch = useMemo(() => {
    const ids = new Set<string>();
    for (const ev of events) {
      if (!ev.customer_id) continue;

      const metadata = (ev.metadata as any) ?? {};
      const metaName =
        metadata.customer_name ||
        `${metadata.customer_first_name ?? ""} ${metadata.customer_last_name ?? ""}`.trim();

      if (metaName) continue;
      if (customerNameById[ev.customer_id]) continue;
      ids.add(ev.customer_id);
    }
    return Array.from(ids);
  }, [customerNameById, events]);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (customerIdsToFetch.length === 0) return;

      const { data, error } = await supabase
        .from("crm_customers")
        .select("id, first_name, last_name")
        .in("id", customerIdsToFetch);

      if (cancelled) return;
      if (error) {
        return;
      }

      const next: Record<string, string> = {};
      for (const row of data ?? []) {
        const first = String((row as any).first_name ?? "").trim();
        const last = String((row as any).last_name ?? "").trim();
        const full = `${first} ${last}`.trim();
        if (row?.id && full) next[String(row.id)] = full;
      }

      if (Object.keys(next).length === 0) return;
      setCustomerNameById((prev) => ({ ...prev, ...next }));
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [customerIdsToFetch]);

  const items = useMemo(
    () => buildTimelineItems(events, groupMode, expandedCampaignIds),
    [events, groupMode, expandedCampaignIds],
  );

  const { ref: sentinelRef } = useIntersectionSentinel(
    () => {
      if (feed.hasNextPage && !feed.isFetchingNextPage) {
        feed.fetchNextPage();
      }
    },
    {
      enabled: Boolean(feed.hasNextPage),
      rootMargin: "520px",
    },
  );

  const toggleCampaign = (campaignId: string) => {
    setExpandedCampaignIds((prev) => {
      const next = new Set(prev);
      if (next.has(campaignId)) next.delete(campaignId);
      else next.add(campaignId);
      return next;
    });
  };

  if (feed.isLoading) {
    return <ActivityFeedSkeleton />;
  }

  return (
    <Stack spacing={2.25}>
      {feed.isError ? (
        <Sheet
          color="danger"
          variant="soft"
          sx={{ borderRadius: "xl", px: 3, py: 2.5 }}
        >
          <Stack spacing={1.25}>
            <Typography level="title-sm" color="danger">
              Activity feed unavailable
            </Typography>
            <Typography level="body-sm" color="danger">
              {(feed.error as Error)?.message ||
                "The activity feed could not be loaded."}
            </Typography>
            <Box>
              <Button
                size="sm"
                variant="soft"
                color="danger"
                onClick={() => feed.refetch()}
              >
                Retry
              </Button>
            </Box>
          </Stack>
        </Sheet>
      ) : null}

      {!feed.isError && items.length === 0 ? (
        <Sheet
          variant="soft"
          sx={{
            borderRadius: "2xl",
            border: "1px dashed",
            borderColor: "neutral.300",
            background:
              "linear-gradient(135deg, rgba(var(--joy-palette-neutral-mainChannel) / 0.03), rgba(var(--joy-palette-primary-mainChannel) / 0.05))",
            px: { xs: 3, md: 4 },
            py: { xs: 4, md: 5 },
          }}
        >
          <Stack spacing={1.5} alignItems="flex-start">
            <Typography level="title-md">
              No activity matches this view
            </Typography>
            <Typography level="body-sm" color="neutral">
              {hasActiveFilters
                ? "Try widening the current filters or clear them to return to the full timeline."
                : "New CRM, campaign, automation, and integration events will appear here as they happen."}
            </Typography>
            {hasActiveFilters && onClearFilters ? (
              <Button
                size="sm"
                variant="solid"
                color="primary"
                onClick={onClearFilters}
              >
                Clear filters
              </Button>
            ) : null}
          </Stack>
        </Sheet>
      ) : null}

      <Stack spacing={2.25}>
        {items.map((item, index) => {
          if (item.kind === "date") {
            return (
              <Stack
                key={item.key}
                direction="row"
                spacing={1.5}
                alignItems="center"
              >
                <Divider sx={{ flex: 1 }} />
                <JoyChip size="sm" variant="soft" color="neutral">
                  {item.label}
                </JoyChip>
                <Divider sx={{ flex: 1 }} />
              </Stack>
            );
          }

          const timestamp =
            item.kind === "campaignHeader"
              ? item.timestamp
              : item.event.timestamp;
          let timeLabel = "";
          try {
            timeLabel = format(new Date(timestamp), "p");
          } catch {
            timeLabel = "";
          }

          return (
            <Box
              key={item.key}
              sx={{
                display: "grid",
                gridTemplateColumns: {
                  xs: "24px minmax(0, 1fr)",
                  md: "72px 24px minmax(0, 1fr)",
                },
                gap: 2,
                alignItems: "stretch",
              }}
            >
              <Box sx={{ display: { xs: "none", md: "block" }, pt: 0.75 }}>
                <Typography level="body-xs" color="neutral">
                  {timeLabel}
                </Typography>
              </Box>
              <Box
                sx={{
                  position: "relative",
                  display: "flex",
                  justifyContent: "center",
                }}
              >
                <Box
                  sx={{
                    position: "absolute",
                    top: index === 0 ? 14 : -18,
                    bottom: -18,
                    width: "1px",
                    backgroundColor: "divider",
                  }}
                />
                {item.kind === "event" ? (
                  <Box
                    sx={{
                      position: "relative",
                      pt: 0.5,
                      backgroundColor: "transparent",
                    }}
                  >
                    <ActivityStatusMarker status={item.event.status} />
                  </Box>
                ) : (
                  <Box
                    sx={{
                      position: "relative",
                      mt: 1.25,
                      width: 12,
                      height: 12,
                      borderRadius: "999px",
                      border: "2px solid",
                      borderColor: "background.surface",
                      backgroundColor: "neutral.400",
                      boxShadow:
                        "0 0 0 1px rgba(var(--joy-palette-neutral-mainChannel) / 0.18)",
                    }}
                  />
                )}
              </Box>
              {item.kind === "campaignHeader" ? (
                <Sheet
                  variant="soft"
                  sx={{
                    borderRadius: "xl",
                    border: "1px solid",
                    borderColor: "neutral.200",
                    background:
                      "linear-gradient(135deg, rgba(var(--joy-palette-primary-mainChannel) / 0.05), rgba(var(--joy-palette-neutral-mainChannel) / 0.04))",
                    px: { xs: 2, md: 2.5 },
                    py: { xs: 1.75, md: 2 },
                    boxShadow: "sm",
                  }}
                >
                  <Stack
                    direction={{ xs: "column", sm: "row" }}
                    spacing={1.5}
                    justifyContent="space-between"
                    alignItems={{ xs: "stretch", sm: "center" }}
                  >
                    <Button
                      variant="plain"
                      color="neutral"
                      onClick={() => toggleCampaign(item.campaignId)}
                      sx={{
                        justifyContent: "flex-start",
                        px: 0,
                        minHeight: 0,
                        borderRadius: 0,
                        "&:hover": { backgroundColor: "transparent" },
                      }}
                    >
                      <Stack
                        direction="row"
                        spacing={1.25}
                        alignItems="center"
                        sx={{ minWidth: 0 }}
                      >
                        {expandedCampaignIds.has(item.campaignId) ? (
                          <ChevronDown size={16} />
                        ) : (
                          <ChevronRight size={16} />
                        )}
                        <Box sx={{ minWidth: 0, textAlign: "left" }}>
                          <Typography level="title-sm">
                            {item.campaignName ?? "Campaign"}
                          </Typography>
                          <Typography level="body-xs" color="neutral">
                            Campaign activity
                          </Typography>
                        </Box>
                      </Stack>
                    </Button>

                    <Stack
                      direction="row"
                      spacing={1}
                      alignItems="center"
                      useFlexGap
                    >
                      <JoyChip size="sm" variant="soft" color="primary">
                        {item.count} events
                      </JoyChip>
                      <Link
                        component={RouterLink}
                        to={`/crm/campaigns/${item.campaignId}`}
                        underline="hover"
                        level="body-xs"
                        sx={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 0.5,
                        }}
                      >
                        <ExternalLink size={14} />
                        Open campaign
                      </Link>
                    </Stack>
                  </Stack>
                </Sheet>
              ) : (
                <ActivityRow
                  event={item.event}
                  customerNameOverride={
                    item.event.customer_id
                      ? (customerNameById[item.event.customer_id] ?? undefined)
                      : undefined
                  }
                />
              )}
            </Box>
          );
        })}
      </Stack>

      <Box ref={sentinelRef} sx={{ height: 1 }} />

      {feed.isFetchingNextPage ? (
        <Stack
          direction="row"
          spacing={1}
          alignItems="center"
          justifyContent="center"
          sx={{ py: 1 }}
        >
          <CircularProgress size="sm" />
          <Typography level="body-sm" color="neutral">
            Loading more activity…
          </Typography>
        </Stack>
      ) : null}

      {!feed.hasNextPage && events.length ? (
        <Stack
          direction="row"
          spacing={1}
          alignItems="center"
          justifyContent="center"
          sx={{ py: 1 }}
        >
          <Divider sx={{ flex: 1, maxWidth: 96 }} />
          <Typography level="body-xs" color="neutral">
            You&apos;re all caught up
          </Typography>
          <Divider sx={{ flex: 1, maxWidth: 96 }} />
        </Stack>
      ) : null}
    </Stack>
  );
}
