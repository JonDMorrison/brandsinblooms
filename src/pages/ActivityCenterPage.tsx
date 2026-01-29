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

  const groupMode = (searchParams.get("group") ?? "campaign") as ActivityGroupMode;

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

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold">Activity Center</h1>
          <p className="text-sm text-muted-foreground">
            Unified timeline across CRM, campaigns, automations, and
            integrations.
          </p>
        </div>
      </div>

      <div className="mt-6">
        <ActivityFiltersBar />
      </div>

      <div className="mt-6">
        <ActivityFeedList feed={feed} groupMode={groupMode} />
      </div>
    </div>
  );
}
