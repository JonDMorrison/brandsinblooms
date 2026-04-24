import Grid from "@mui/joy/Grid";
import { Users, Clock, CreditCard, UserX } from "lucide-react";
import { JoyStatCard } from "@/components/joy/JoyStatCard";

interface AdminStatsProps {
  stats: {
    total_tenants: number;
    active_trials: number;
    paid_active: number;
    inactive_tenants: number;
  };
  onFilterClick: (status: string) => void;
}

export const AdminStats = ({ stats, onFilterClick }: AdminStatsProps) => {
  const statCards = [
    {
      title: "Total Tenants",
      value: stats.total_tenants,
      icon: <Users size={20} />,
      iconColor: "neutral",
      filter: null,
    },
    {
      title: "Active Trials",
      value: stats.active_trials,
      icon: <Clock size={20} />,
      iconColor: "warning",
      filter: "trialing",
    },
    {
      title: "Paid Active",
      value: stats.paid_active,
      icon: <CreditCard size={20} />,
      iconColor: "success",
      filter: "active",
    },
    {
      title: "Inactive",
      value: stats.inactive_tenants,
      icon: <UserX size={20} />,
      iconColor: "neutral",
      filter: "canceled",
    },
  ];

  return (
    <Grid container spacing={2}>
      {statCards.map((stat) => {
        return (
          <Grid key={stat.title} xs={12} sm={6} xl={3}>
            <JoyStatCard
              icon={stat.icon}
              iconColor={stat.iconColor}
              label={stat.title}
              value={stat.value}
              onClick={
                stat.filter ? () => onFilterClick(stat.filter) : undefined
              }
            />
          </Grid>
        );
      })}
    </Grid>
  );
};
