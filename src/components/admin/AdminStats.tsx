import { Card, CardContent } from "@/components/ui/card";
import { Users, Clock, CreditCard, UserX } from "lucide-react";

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
      icon: Users,
      color: "text-blue-600",
      bgColor: "bg-blue-50",
      filter: null,
    },
    {
      title: "Active Trials",
      value: stats.active_trials,
      icon: Clock,
      color: "text-yellow-600",
      bgColor: "bg-yellow-50",
      filter: "trialing",
    },
    {
      title: "Paid Active",
      value: stats.paid_active,
      icon: CreditCard,
      color: "text-green-600",
      bgColor: "bg-green-50",
      filter: "active",
    },
    {
      title: "Inactive",
      value: stats.inactive_tenants,
      icon: UserX,
      color: "text-gray-600",
      bgColor: "bg-gray-50",
      filter: "canceled",
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {statCards.map((stat) => {
        const IconComponent = stat.icon;
        return (
          <Card
            key={stat.title}
            className={`cursor-pointer transition-all hover:shadow-lg ${
              stat.filter ? 'hover:bg-muted/50' : ''
            }`}
            onClick={() => stat.filter && onFilterClick(stat.filter)}
          >
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    {stat.title}
                  </p>
                  <p className="text-3xl font-bold">{stat.value}</p>
                </div>
                <div className={`p-3 rounded-full ${stat.bgColor}`}>
                  <IconComponent className={`h-6 w-6 ${stat.color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};