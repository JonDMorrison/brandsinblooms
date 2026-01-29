import React, { useEffect, useMemo, useState } from "react";
import { useWindowVirtualizer } from "@tanstack/react-virtual";
import type { UseInfiniteQueryResult, InfiniteData } from "@tanstack/react-query";
import { ChevronDown, ChevronRight, ExternalLink } from "lucide-react";

import type { ActivityEvent } from "@/types/activity";
import { ActivityRow } from "@/components/activity/ActivityRow";
import { cn } from "@/lib/utils";
import type { ActivityGroupMode } from "@/lib/activityGrouping";
import { getCampaignId, getCampaignName } from "@/lib/activityGrouping";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

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
    };

function buildItems(
  events: ActivityEvent[],
  groupMode: ActivityGroupMode,
  expandedCampaignIds: Set<string>,
): ListItem[] {
  if (groupMode !== "campaign") {
    return events.map((ev) => ({ kind: "event", key: ev.id, event: ev }));
  }

  // Group by campaign id, but only where campaign_id exists
  const byCampaign = new Map<
    string,
    { campaignId: string; campaignName: string | null; events: ActivityEvent[] }
  >();
  const order: string[] = [];
  const ungrouped: ActivityEvent[] = [];

  for (const ev of events) {
    const campaignId = getCampaignId(ev);
    if (!campaignId) {
      ungrouped.push(ev);
      continue;
    }

    let group = byCampaign.get(campaignId);
    if (!group) {
      group = {
        campaignId,
        campaignName: getCampaignName(ev),
        events: [],
      };
      byCampaign.set(campaignId, group);
      order.push(campaignId);
    }

    if (!group.campaignName) group.campaignName = getCampaignName(ev);
    group.events.push(ev);
  }

  const items: ListItem[] = [];

  // Preserve global order by emitting in the order campaigns first appeared,
  // but interleave ungrouped events by position. Simpler: emit ungrouped inline.
  // We approximate by scanning original list again and emitting either campaign header (once)
  // or ungrouped events.
  const emittedCampaign = new Set<string>();
  for (const ev of events) {
    const campaignId = getCampaignId(ev);
    if (!campaignId) {
      items.push({ kind: "event", key: ev.id, event: ev });
      continue;
    }

    if (emittedCampaign.has(campaignId)) continue;
    emittedCampaign.add(campaignId);

    const group = byCampaign.get(campaignId)!;
    items.push({
      kind: "campaignHeader",
      key: `campaign:${campaignId}`,
      campaignId,
      campaignName: group.campaignName,
      count: group.events.length,
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
  className,
}: {
  feed: FeedLike;
  groupMode?: ActivityGroupMode;
  className?: string;
}) {
  const events = feed.data?.pages.flat() ?? [];

  const [expandedCampaignIds, setExpandedCampaignIds] = useState<Set<string>>(
    () => new Set(),
  );

  const items = useMemo(
    () => buildItems(events, groupMode, expandedCampaignIds),
    [events, groupMode, expandedCampaignIds],
  );

  const rowVirtualizer = useWindowVirtualizer({
    count: items.length,
    estimateSize: () => 140,
    overscan: 8,
  });

  const virtualItems = rowVirtualizer.getVirtualItems();

  // Auto-load next page when nearing the bottom (infinite scroll).
  useEffect(() => {
    const last = virtualItems[virtualItems.length - 1];
    if (!last) return;

    if (
      feed.hasNextPage &&
      !feed.isFetchingNextPage &&
      last.index >= Math.max(0, items.length - 6)
    ) {
      feed.fetchNextPage();
    }
  }, [virtualItems, feed.hasNextPage, feed.isFetchingNextPage, feed, items.length]);

  // When group expand/collapse changes height, ask the virtualizer to re-measure.
  useEffect(() => {
    rowVirtualizer.measure();
  }, [items.length, rowVirtualizer]);

  const toggleCampaign = (campaignId: string) => {
    setExpandedCampaignIds((prev) => {
      const next = new Set(prev);
      if (next.has(campaignId)) next.delete(campaignId);
      else next.add(campaignId);
      return next;
    });
  };

  return (
    <div className={cn("space-y-3", className)}>
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

      {/* Virtualized list */}
      <div
        style={{ height: `${rowVirtualizer.getTotalSize()}px` }}
        className="relative"
      >
        {virtualItems.map((virtualRow) => {
          const item = items[virtualRow.index];
          if (!item) return null;

          return (
            <div
              key={item.key}
              data-index={virtualRow.index}
              ref={rowVirtualizer.measureElement}
              className="absolute left-0 w-full"
              style={{ transform: `translateY(${virtualRow.start}px)` }}
            >
              {item.kind === "campaignHeader" ? (
                <div className="rounded-lg border bg-card p-3 flex items-center justify-between gap-3">
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
                <ActivityRow event={item.event} />
              )}
            </div>
          );
        })}
      </div>

      {/* Fallback manual loader */}
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
