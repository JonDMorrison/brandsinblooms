import React, { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { ActivityFiltersBar } from "@/components/activity/ActivityFiltersBar";
import { ActivityFeedList } from "@/components/activity/ActivityFeedList";
import { useActivityFeed } from "@/hooks/useActivityFeed";
import type { ActivityFeedFilters } from "@/types/activity";
import { parseCsvParam, parseDateParam } from "@/lib/activityUtils";
import type { ActivityGroupMode } from "@/lib/activityGrouping";

export default function ActivityCenterPage() {
  const [searchParams] = useSearchParams();

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
      start: null,
      end: parseDateParam(searchParams.get("end")),
    };
  }, [searchParams]);

  const feed = useActivityFeed(filters, { pageSize: 50 });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      <div className="rounded-2xl border bg-gradient-to-br from-muted/40 via-background to-background p-6 shadow-sm">
        <div className="flex items-start justify-between gap-6 flex-wrap">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border bg-background px-3 py-1 text-xs text-muted-foreground">
              Timeline
            </div>
            <h1 className="mt-3 text-2xl font-semibold">Activity Center</h1>
            <p className="mt-2 text-sm text-muted-foreground max-w-xl">
              A unified timeline across CRM, campaigns, automations, and
              integrations. Follow each event in order with clear context and
              detail.
            </p>
          </div>
        </div>
      </div>

      <ActivityFiltersBar />

      <div className="rounded-2xl border bg-card p-4 sm:p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <div className="text-sm font-medium">Timeline</div>
          <div className="text-xs text-muted-foreground">Most recent first</div>
        </div>
        <ActivityFeedList feed={feed} groupMode={groupMode} />
      </div>
    </div>
  );
}
