
import { Users, UserCheck, Crown } from "lucide-react";
import { MetricCard } from "./MetricCard";

interface AdminMetrics {
  totalUsers: number;
  totalCampaigns: number;
  totalTasks: number;
  activeSubscriptions: number;
  freeTrialUsers: number;
  paidUsers: number;
}

interface UserMetricsSectionProps {
  metrics: AdminMetrics;
}

export const UserMetricsSection = ({ metrics }: UserMetricsSectionProps) => {
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold text-garden-green-dark">User Metrics</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <MetricCard
          title="Total Users"
          value={metrics.totalUsers}
          description="All registered users"
          icon={Users}
          color={metrics.totalUsers > 0 ? "text-blue-600" : "text-gray-400"}
          borderColor={metrics.totalUsers > 0 ? "border-blue-200" : "border-gray-200"}
          bgColor={metrics.totalUsers > 0 ? "bg-blue-50" : "bg-gray-50"}
          clickable={true}
          href="/admin/users"
        />
        
        <MetricCard
          title="Free Trial Users"
          value={metrics.freeTrialUsers}
          description="Users on free trial"
          icon={UserCheck}
          color={metrics.freeTrialUsers > 0 ? "text-orange-600" : "text-gray-400"}
          borderColor={metrics.freeTrialUsers > 0 ? "border-orange-200" : "border-gray-200"}
          bgColor={metrics.freeTrialUsers > 0 ? "bg-orange-50" : "bg-gray-50"}
          clickable={true}
          href="/admin/users?filter=free_trial"
        />
        
        <MetricCard
          title="Paid Users"
          value={metrics.paidUsers}
          description="Paying customers"
          icon={Crown}
          color={metrics.paidUsers > 0 ? "text-green-600" : "text-gray-400"}
          borderColor={metrics.paidUsers > 0 ? "border-green-200" : "border-gray-200"}
          bgColor={metrics.paidUsers > 0 ? "bg-green-50" : "bg-gray-50"}
          clickable={true}
          href="/admin/users?filter=paid"
        />
      </div>
    </div>
  );
};
