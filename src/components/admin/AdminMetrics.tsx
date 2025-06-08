
import { MetricCard } from "./MetricCard";
import { Users, Calendar, TrendingUp, Database, Crown, Activity } from "lucide-react";

interface AdminMetrics {
  totalUsers: number;
  totalCampaigns: number;
  totalTasks: number;
  activeSubscriptions: number;
  freeTrialUsers: number;
  paidUsers: number;
}

interface AdminMetricsProps {
  metrics: AdminMetrics;
}

export const AdminMetrics = ({ metrics }: AdminMetricsProps) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      <MetricCard
        title="Total Users"
        value={metrics.totalUsers}
        description="Registered users"
        icon={Users}
        color="text-blue-600"
        borderColor="border-blue-200"
      />
      
      <MetricCard
        title="Total Campaigns"
        value={metrics.totalCampaigns}
        description="Created campaigns"
        icon={Calendar}
        color="text-green-600"
        borderColor="border-green-200"
      />
      
      <MetricCard
        title="Content Tasks"
        value={metrics.totalTasks}
        description="Generated content"
        icon={Activity}
        color="text-purple-600"
        borderColor="border-purple-200"
      />
      
      <MetricCard
        title="Active Subscriptions"
        value={metrics.activeSubscriptions}
        description="Currently active"
        icon={Crown}
        color="text-yellow-600"
        borderColor="border-yellow-200"
      />
      
      <MetricCard
        title="Free Trial Users"
        value={metrics.freeTrialUsers}
        description="On free trial"
        icon={TrendingUp}
        color="text-orange-600"
        borderColor="border-orange-200"
      />
      
      <MetricCard
        title="Paid Users"
        value={metrics.paidUsers}
        description="Paying customers"
        icon={Database}
        color="text-indigo-600"
        borderColor="border-indigo-200"
      />
    </div>
  );
};
