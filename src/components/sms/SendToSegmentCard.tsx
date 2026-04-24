import * as React from "react";
import Avatar from "@mui/joy/Avatar";
import Box from "@mui/joy/Box";
import Chip from "@mui/joy/Chip";
import Skeleton from "@mui/joy/Skeleton";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { ArrowRight, Target } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { SegmentSMSDialog } from "./SegmentSMSDialog";

interface SegmentOption {
  id: string;
  name: string;
  description?: string;
  count: number;
  isSystem: boolean;
}

const SYSTEM_SEGMENTS: Omit<SegmentOption, "count">[] = [
  {
    id: "perks-members",
    name: "Perks Members",
    description: "Loyalty program members",
    isSystem: true,
  },
  {
    id: "high-value",
    name: "High-Value Customers",
    description: "Top spenders",
    isSystem: true,
  },
  {
    id: "new-customers",
    name: "New Customers",
    description: "Recent first purchases",
    isSystem: true,
  },
  {
    id: "frequent-buyers",
    name: "Frequent Buyers",
    description: "3+ purchases",
    isSystem: true,
  },
];

export const SendToSegmentCard: React.FC = () => {
  const [segments, setSegments] = React.useState<SegmentOption[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [selectedSegment, setSelectedSegment] =
    React.useState<SegmentOption | null>(null);
  const { tenant } = useTenant();

  const fetchSystemSegmentCount = React.useCallback(
    async (segmentId: string) => {
      if (!tenant?.id) return 0;

      try {
        let query = supabase
          .from("crm_customers")
          .select("id", { count: "exact", head: true })
          .eq("tenant_id", tenant.id)
          .eq("sms_opt_in", true)
          .eq("opt_out", false)
          .eq("suppressed", false)
          .not("phone", "is", null);

        switch (segmentId) {
          case "perks-members": {
            const { count } = await supabase
              .from("crm_customers")
              .select("id, customer_loyalty_metrics!inner(is_perks_member)", {
                count: "exact",
                head: true,
              })
              .eq("tenant_id", tenant.id)
              .eq("sms_opt_in", true)
              .eq("opt_out", false)
              .eq("suppressed", false)
              .not("phone", "is", null)
              .eq("customer_loyalty_metrics.is_perks_member", true);

            return count || 0;
          }
          case "high-value":
            query = query.gte("total_spent", 500);
            break;
          case "new-customers": {
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
            query = query.gte("created_at", thirtyDaysAgo.toISOString());
            break;
          }
          case "frequent-buyers":
            query = query.gte("order_count", 3);
            break;
          default:
            break;
        }

        const { count } = await query;
        return count || 0;
      } catch (error) {
        console.error("Error fetching system segment count:", error);
        return 0;
      }
    },
    [tenant?.id],
  );

  const fetchSegments = React.useCallback(async () => {
    if (!tenant?.id) return;

    setLoading(true);
    try {
      const { data: customSegments, error } = await supabase
        .from("crm_segments")
        .select("id, name, description, customer_count")
        .eq("tenant_id", tenant.id)
        .order("name");

      if (error) throw error;

      const customOptions: SegmentOption[] = (customSegments || []).map(
        (segment) => ({
          id: segment.id,
          name: segment.name,
          description: segment.description || undefined,
          count: segment.customer_count || 0,
          isSystem: false,
        }),
      );

      const systemOptions: SegmentOption[] = await Promise.all(
        SYSTEM_SEGMENTS.map(async (segment) => ({
          ...segment,
          count: await fetchSystemSegmentCount(segment.id),
        })),
      );

      setSegments([...systemOptions, ...customOptions]);
    } catch (error) {
      console.error("Error fetching segments:", error);
    } finally {
      setLoading(false);
    }
  }, [fetchSystemSegmentCount, tenant?.id]);

  React.useEffect(() => {
    if (tenant?.id) {
      void fetchSegments();
    }
  }, [fetchSegments, tenant?.id]);

  const visibleSegments = segments.slice(0, 6);

  return (
    <>
      <Stack spacing={2.5}>
        <Stack spacing={0.75}>
          <Typography level="title-md" fontWeight="lg">
            Segments
          </Typography>
          <Typography level="body-sm" color="neutral">
            Choose a segment to open the send flow with the right audience
            preselected.
          </Typography>
        </Stack>

        {loading ? (
          <Stack spacing={1.25}>
            {Array.from({ length: 4 }).map((_, index) => (
              <Box
                key={index}
                sx={{
                  borderRadius: "16px",
                  border: "1px solid",
                  borderColor: "neutral.200",
                  backgroundColor: "background.surface",
                  px: 1.75,
                  py: 1.5,
                }}
              >
                <Stack direction="row" spacing={1.5} alignItems="center">
                  <Skeleton variant="circular" width={40} height={40} />
                  <Stack spacing={0.75} sx={{ flex: 1, minWidth: 0 }}>
                    <Skeleton
                      variant="text"
                      sx={{ width: "42%", height: 16 }}
                    />
                    <Skeleton
                      variant="text"
                      sx={{ width: "68%", height: 14 }}
                    />
                  </Stack>
                  <Stack spacing={0.75} alignItems="flex-end">
                    <Skeleton variant="text" sx={{ width: 44, height: 16 }} />
                    <Skeleton variant="text" sx={{ width: 64, height: 12 }} />
                  </Stack>
                </Stack>
              </Box>
            ))}
          </Stack>
        ) : segments.length === 0 ? (
          <Box
            sx={{
              minHeight: 260,
              display: "grid",
              placeItems: "center",
              px: 3,
              py: 8,
              textAlign: "center",
              borderRadius: "18px",
              border: "1px dashed",
              borderColor: "neutral.300",
              backgroundColor: "background.level1",
            }}
          >
            <Stack spacing={2} alignItems="center" sx={{ maxWidth: 360 }}>
              <Avatar size="lg" variant="soft" color="neutral">
                <Target size={20} />
              </Avatar>
              <Stack spacing={0.75}>
                <Typography level="title-md">No segments available</Typography>
                <Typography level="body-sm" color="neutral">
                  Create a CRM segment first, then come back here to start a
                  targeted SMS send.
                </Typography>
              </Stack>
            </Stack>
          </Box>
        ) : (
          <Stack spacing={1.25}>
            {visibleSegments.map((segment) => (
              <Box
                key={segment.id}
                component="button"
                type="button"
                onClick={() => setSelectedSegment(segment)}
                sx={{
                  textAlign: "left",
                  borderRadius: "16px",
                  border: "1px solid",
                  borderColor: "neutral.200",
                  backgroundColor: "background.surface",
                  px: 1.75,
                  py: 1.5,
                  transition:
                    "border-color 160ms ease, background-color 160ms ease, transform 160ms ease, box-shadow 160ms ease",
                  display: "block",
                  width: "100%",
                  cursor: "pointer",
                  boxShadow: "sm",
                  "&:hover": {
                    borderColor: "primary.300",
                    backgroundColor: "background.level1",
                    transform: "translateY(-1px)",
                    boxShadow: "md",
                  },
                }}
              >
                <Stack direction="row" spacing={1.5} alignItems="center">
                  <Avatar
                    size="md"
                    variant="soft"
                    color={segment.isSystem ? "neutral" : "primary"}
                  >
                    <Target size={16} />
                  </Avatar>
                  <Stack spacing={0.75} sx={{ flex: 1, minWidth: 0 }}>
                    <Stack
                      direction="row"
                      spacing={1}
                      alignItems="center"
                      useFlexGap
                      flexWrap="wrap"
                    >
                      <Typography level="body-sm" fontWeight="md">
                        {segment.name}
                      </Typography>
                      <Chip
                        size="sm"
                        variant="soft"
                        color={segment.isSystem ? "neutral" : "primary"}
                      >
                        {segment.isSystem ? "System" : "Custom"}
                      </Chip>
                    </Stack>
                    <Typography level="body-xs" color="neutral">
                      {segment.description ||
                        (segment.isSystem
                          ? "Rule-based SMS audience"
                          : "Custom customer segment")}
                    </Typography>
                  </Stack>

                  <Stack
                    spacing={0.25}
                    alignItems="flex-end"
                    sx={{ flexShrink: 0 }}
                  >
                    <Typography level="body-sm" fontWeight="lg">
                      {segment.count.toLocaleString()}
                    </Typography>
                    <Typography level="body-xs" color="neutral">
                      Subscribers
                    </Typography>
                  </Stack>

                  <Avatar size="sm" variant="plain" color="neutral">
                    <ArrowRight size={16} />
                  </Avatar>
                </Stack>
              </Box>
            ))}

            {segments.length > visibleSegments.length ? (
              <Typography level="body-xs" color="neutral" textAlign="center">
                +{segments.length - visibleSegments.length} more segments
                available in your CRM
              </Typography>
            ) : null}
          </Stack>
        )}
      </Stack>

      {selectedSegment ? (
        <SegmentSMSDialog
          open={Boolean(selectedSegment)}
          onOpenChange={(open) => {
            if (!open) {
              setSelectedSegment(null);
            }
          }}
          segmentId={selectedSegment.id}
          segmentName={selectedSegment.name}
          customerCount={selectedSegment.count}
          isSystemSegment={selectedSegment.isSystem}
        />
      ) : null}
    </>
  );
};
