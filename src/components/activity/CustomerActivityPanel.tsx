import React from "react";
import { useActivityFeed } from "@/hooks/useActivityFeed";
import { ActivityRow } from "@/components/activity/ActivityRow";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { useIntersectionSentinel } from "@/hooks/useIntersectionSentinel";
import { supabase } from "@/integrations/supabase/client";

export function CustomerActivityPanel({ customerId }: { customerId: string }) {
  const feed = useActivityFeed(
    {
      customerId,
    },
    { pageSize: 10, enabled: !!customerId },
  );

  const [customerName, setCustomerName] = React.useState<string>("");

  React.useEffect(() => {
    let cancelled = false;

    async function run() {
      if (!customerId) return;

      const { data, error } = await supabase
        .from("crm_customers")
        .select("first_name, last_name")
        .eq("id", customerId)
        .maybeSingle();

      if (cancelled) return;
      if (error) return;

      const first = String((data as any)?.first_name ?? "").trim();
      const last = String((data as any)?.last_name ?? "").trim();
      const full = `${first} ${last}`.trim();
      if (full) setCustomerName(full);
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [customerId]);

  const events = feed.data?.pages.flat() ?? [];

  const { ref: sentinelRef } = useIntersectionSentinel(
    () => {
      if (feed.hasNextPage && !feed.isFetchingNextPage) {
        feed.fetchNextPage();
      }
    },
    { enabled: !!customerId, rootMargin: "300px" },
  );

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <CardTitle className="text-base">Activity</CardTitle>
        <a href={`/activity?customer=${customerId}`}>
          <Button variant="outline" size="sm">
            View all
          </Button>
        </a>
      </CardHeader>
      <CardContent className="space-y-3">
        {feed.isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading activity…
          </div>
        ) : null}

        {feed.isError ? (
          <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            Failed to load activity.
          </div>
        ) : null}

        {!feed.isLoading && !feed.isError && events.length === 0 ? (
          <div className="text-sm text-muted-foreground">
            No recent activity.
          </div>
        ) : null}

        {events.map((ev) => (
          <ActivityRow
            key={ev.id}
            event={ev}
            customerNameOverride={customerName || undefined}
          />
        ))}

        <div ref={sentinelRef} />

        {feed.hasNextPage ? (
          <Button
            variant="ghost"
            onClick={() => feed.fetchNextPage()}
            disabled={feed.isFetchingNextPage}
            className="w-full"
          >
            {feed.isFetchingNextPage ? "Loading…" : "Load more"}
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}
