
import { Calendar, Activity } from "lucide-react";
import { MetricCard } from "./MetricCard";

interface AdminMetrics {
  totalUsers: number;
  totalCampaigns: number;
  totalTasks: number;
  activeSubscriptions: number;
  freeTrialUsers: number;
  paidUsers: number;
}

interface ContentActivitySectionProps {
  metrics: AdminMetrics;
}

export const ContentActivitySection = ({ metrics }: ContentActivitySectionProps) => {
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold text-garden-green-dark">Content Activity</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <MetricCard
          title="Total Campaigns"
          value={metrics.totalCampaigns}
          description="Created campaigns"
          icon={Calendar}
          color={metrics.totalCampaigns > 0 ? "text-purple-600" : "text-gray-400"}
          borderColor={metrics.totalCampaigns > 0 ? "border-purple-200" : "border-gray-200"}
          bgColor={metrics.totalCampaigns > 0 ? "bg-purple-50" : "bg-gray-50"}
          clickable={true}
          href="/admin/campaigns"
        />
        
        <MetricCard
          title="Content Tasks"
          value={metrics.totalTasks}
          description="Generated content pieces"
          icon={Activity}
          color={metrics.totalTasks > 0 ? "text-indigo-600" : "text-gray-400"}
          borderColor={metrics.totalTasks > 0 ? "border-indigo-200" : "border-gray-200"}
          bgColor={metrics.totalTasks > 0 ? "bg-indigo-50" : "bg-gray-50"}
          clickable={true}
          href="/admin/content-tasks"
        />
      </div>
    </div>
  );
};
