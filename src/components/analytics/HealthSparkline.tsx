import Box from "@mui/joy/Box";
import Skeleton from "@mui/joy/Skeleton";
import Typography from "@mui/joy/Typography";
import { useQuery } from "@tanstack/react-query";
import { Line, LineChart, ResponsiveContainer } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";

interface HealthSparklineProps {
  type: "bounce" | "complaint";
  height?: number;
}

export const HealthSparkline: React.FC<HealthSparklineProps> = ({
  type,
  height = 40,
}) => {
  const { tenant } = useTenant();
  const { data, isLoading } = useQuery({
    queryKey: ["health-sparkline", tenant?.id, type],
    enabled: Boolean(tenant?.id),
    queryFn: async () => {
      if (!tenant?.id) {
        return [];
      }

      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      // Get daily counts for the event type
      const { data: events, error } = await supabase
        .from("email_tracking_events")
        .select("created_at, event_type")
        .eq("tenant_id", tenant.id)
        .in(
          "event_type",
          type === "bounce"
            ? ["bounce", "bounced"]
            : ["complaint", "complained"],
        )
        .gte("created_at", thirtyDaysAgo.toISOString())
        .order("created_at", { ascending: true });

      if (error) throw error;

      // Group by day
      const dailyCounts: Record<string, number> = {};
      const today = new Date();

      // Initialize all 30 days with 0
      for (let i = 29; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        const key = date.toISOString().split("T")[0];
        dailyCounts[key] = 0;
      }

      // Count events per day
      (events || []).forEach((event) => {
        const key = event.created_at.split("T")[0];
        if (dailyCounts[key] !== undefined) {
          dailyCounts[key]++;
        }
      });

      // Convert to array
      return Object.entries(dailyCounts).map(([date, count]) => ({
        date,
        count,
      }));
    },
    staleTime: 60000,
  });

  if (isLoading) {
    return (
      <Skeleton
        variant="rectangular"
        sx={{ width: "100%", height, borderRadius: "sm" }}
      />
    );
  }

  if (!data || data.length === 0) {
    return (
      <Box sx={{ height, display: "grid", placeItems: "center" }}>
        <Typography level="body-xs" sx={{ color: "neutral.400" }}>
          No recent trend
        </Typography>
      </Box>
    );
  }

  const color =
    type === "bounce"
      ? "var(--joy-palette-danger-400)"
      : "var(--joy-palette-warning-400)";

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data}>
        <Line
          type="monotone"
          dataKey="count"
          stroke={color}
          strokeWidth={1.5}
          dot={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
};

export default HealthSparkline;
