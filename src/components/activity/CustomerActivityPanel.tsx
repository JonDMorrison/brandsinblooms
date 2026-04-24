import React from "react";
import Box from "@mui/joy/Box";
import Button from "@mui/joy/Button";
import CircularProgress from "@mui/joy/CircularProgress";
import Sheet from "@mui/joy/Sheet";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { Link as RouterLink } from "react-router-dom";
import { useActivityFeed } from "@/hooks/useActivityFeed";
import { ActivityRow } from "@/components/activity/ActivityRow";
import { useIntersectionSentinel } from "@/hooks/useIntersectionSentinel";
import { supabase } from "@/integrations/supabase/client";
import {
  JoyCard,
  JoyCardContent,
  JoyCardHeader,
} from "@/components/joy/JoyCard";
import type { ActivityFeedFilters } from "@/types/activity";

interface CustomerActivityPanelProps {
  customerId: string;
  customerName?: string;
  pageSize?: number;
  title?: string;
  description?: string;
  filters?: Omit<ActivityFeedFilters, "customerId">;
}

export function CustomerActivityPanel({
  customerId,
  customerName: customerNameProp,
  pageSize = 10,
  title = "Activity",
  description = "Recent customer events across CRM, campaigns, and automations.",
  filters,
}: CustomerActivityPanelProps) {
  const feed = useActivityFeed(
    {
      customerId,
      ...filters,
    },
    { pageSize, enabled: !!customerId },
  );

  const [customerName, setCustomerName] = React.useState<string>(
    customerNameProp ?? "",
  );

  React.useEffect(() => {
    setCustomerName(customerNameProp ?? "");
  }, [customerNameProp]);

  React.useEffect(() => {
    let cancelled = false;

    async function run() {
      if (!customerId || customerNameProp) return;

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
  }, [customerId, customerNameProp]);

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
    <JoyCard>
      <JoyCardHeader
        title={title}
        description={description}
        actions={
          <Button
            component={RouterLink}
            to={`/activity?customer=${customerId}`}
            variant="soft"
            color="primary"
            size="sm"
          >
            View all
          </Button>
        }
      />
      <JoyCardContent sx={{ pt: 3 }}>
        <Stack spacing={1.5}>
          {feed.isLoading ? (
            <Stack direction="row" spacing={1} alignItems="center">
              <CircularProgress size="sm" />
              <Typography level="body-sm" color="neutral">
                Loading activity…
              </Typography>
            </Stack>
          ) : null}

          {feed.isError ? (
            <Sheet
              color="danger"
              variant="soft"
              sx={{ borderRadius: "lg", px: 2, py: 1.5 }}
            >
              <Typography level="body-sm" color="danger">
                Failed to load activity.
              </Typography>
            </Sheet>
          ) : null}

          {!feed.isLoading && !feed.isError && events.length === 0 ? (
            <Typography level="body-sm" color="neutral">
              No recent activity.
            </Typography>
          ) : null}

          {events.map((ev) => (
            <ActivityRow
              key={ev.id}
              event={ev}
              customerNameOverride={customerName || undefined}
              compact
            />
          ))}

          <Box ref={sentinelRef} sx={{ height: 1 }} />

          {feed.isFetchingNextPage ? (
            <Stack
              direction="row"
              spacing={1}
              alignItems="center"
              justifyContent="center"
              sx={{ py: 0.5 }}
            >
              <CircularProgress size="sm" />
              <Typography level="body-xs" color="neutral">
                Loading more activity…
              </Typography>
            </Stack>
          ) : null}
        </Stack>
      </JoyCardContent>
    </JoyCard>
  );
}
