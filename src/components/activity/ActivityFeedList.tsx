import React, { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import type {
  UseInfiniteQueryResult,
  InfiniteData,
} from "@tanstack/react-query";
import {
  ChevronDown,
  ChevronRight,
  ExternalLink,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  Info,
} from "lucide-react";

import type { ActivityEvent } from "@/types/activity";
import { ActivityRow } from "@/components/activity/ActivityRow";
import { cn } from "@/lib/utils";
import type { ActivityGroupMode } from "@/lib/activityGrouping";
import { getCampaignId, getCampaignName } from "@/lib/activityGrouping";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";

type FeedLike = Pick<
  UseInfiniteQueryResult<InfiniteData<ActivityEvent[], unknown>, Error>,
  | "data"
  | "isLoading"
  | "isError"
  | "error"
  | "hasNextPage"
  | "fetchNextPage"
  | "isFetchingNextPage"
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

function statusMarker(status: string) {
  switch (status) {
    case "success":
      return (
        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-green-50 text-green-600 ring-1 ring-green-200">
          <CheckCircle2 className="h-4 w-4" />
        </span>
      );
    case "failed":
      return (
        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-red-50 text-red-600 ring-1 ring-red-200">
          <XCircle className="h-4 w-4" />
        </span>
      );
    case "warning":
      return (
        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-amber-50 text-amber-600 ring-1 ring-amber-200">
          <AlertTriangle className="h-4 w-4" />
        </span>
      );
    case "pending":
      return (
        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-muted text-muted-foreground ring-1 ring-border">
          <Clock className="h-4 w-4" />
        </span>
      );
    default:
      return (
        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-muted text-muted-foreground ring-1 ring-border">
          <Info className="h-4 w-4" />
        </span>
      );
  }
}

export function ActivityFeedList({
  feed,
  groupMode = "campaign",
  className,
}: {
  feed: FeedLike;
  groupMode?: ActivityGroupMode;
  className?: string;
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

  const toggleCampaign = (campaignId: string) => {
    setExpandedCampaignIds((prev) => {
      const next = new Set(prev);
      if (next.has(campaignId)) next.delete(campaignId);
      else next.add(campaignId);
      return next;
    });
  };

  return (
    <div className={cn("space-y-4", className)}>
      {feed.isLoading ? (
        <div className="text-sm text-muted-foreground">Loading activity…</div>
      ) : null}

      {feed.isError ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Failed to load activity. {(feed.error as any)?.message ?? ""}
        </div>
      ) : null}

      {!feed.isLoading && !feed.isError && items.length === 0 ? (
        <div className="rounded-lg border bg-card p-6 text-sm text-muted-foreground">
          No activity found.
        </div>
      ) : null}

      <div className="space-y-4">
        {items.map((item, index) => {
          if (item.kind === "date") {
            return (
              <div key={item.key} className="flex items-center gap-3">
                <div className="w-[84px] text-xs text-muted-foreground">
                  &nbsp;
                </div>
                <div className="relative flex items-center">
                  <div className="absolute inset-y-0 left-1/2 w-px bg-border/70" />
                  <div className="h-2.5 w-2.5 rounded-full bg-border" />
                </div>
                <div className="rounded-full border bg-background px-3 py-1 text-xs text-muted-foreground">
                  {item.label}
                </div>
              </div>
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
            <div
              key={item.key}
              className="grid grid-cols-[84px_24px_1fr] gap-4 items-center"
            >
              <div className="text-xs text-muted-foreground pt-0.5">
                {timeLabel}
              </div>
              <div className="relative flex justify-center items-center">
                <div className="absolute inset-y-0 w-px bg-border/70" />
                {item.kind === "event" ? (
                  <div className="flex h-5 w-5 items-center justify-center rounded-full bg-background shadow-sm">
                    {statusMarker(String(item.event.status))}
                  </div>
                ) : (
                  <div className="h-3 w-3 rounded-full border border-border bg-background shadow-sm" />
                )}
              </div>
              {item.kind === "campaignHeader" ? (
                <div className="rounded-xl border bg-muted/30 p-3 flex items-center justify-between gap-3 shadow-sm">
                  <button
                    type="button"
                    onClick={() => toggleCampaign(item.campaignId)}
                    className="flex items-center gap-2 min-w-0"
                  >
                    {expandedCampaignIds.has(item.campaignId) ? (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    )}
                    <div className="min-w-0">
                      <div className="font-medium truncate">
                        {item.campaignName ?? "Campaign"}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Campaign activity
                      </div>
                    </div>
                  </button>

                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">{item.count}</Badge>
                    <a
                      href={`/crm/campaigns/${item.campaignId}`}
                      className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                    >
                      <ExternalLink className="h-3 w-3" />
                      <span className="hidden sm:inline">Open</span>
                    </a>
                  </div>
                </div>
              ) : (
                <ActivityRow
                  event={item.event}
                  className="shadow-sm"
                  customerNameOverride={
                    item.event.customer_id
                      ? (customerNameById[item.event.customer_id] ?? undefined)
                      : undefined
                  }
                />
              )}
            </div>
          );
        })}
      </div>

      {feed.hasNextPage ? (
        <div className="pt-2">
          <Button
            variant="outline"
            onClick={() => feed.fetchNextPage()}
            disabled={feed.isFetchingNextPage}
          >
            {feed.isFetchingNextPage ? "Loading…" : "Load more"}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
