
import { CreditCard, TrendingUp } from "lucide-react";
import { MetricCard } from "./MetricCard";

interface AdminMetrics {
  totalUsers: number;
  totalCampaigns: number;
  totalTasks: number;
  activeSubscriptions: number;
  freeTrialUsers: number;
  paidUsers: number;
}

interface BillingOverviewSectionProps {
  metrics: AdminMetrics;
}

export const BillingOverviewSection = ({ metrics }: BillingOverviewSectionProps) => {
  const conversionRate = metrics.totalUsers > 0 
    ? Math.round((metrics.paidUsers / metrics.totalUsers) * 100) 
    : 0;

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold text-garden-green-dark">Billing Overview</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <MetricCard
          title="Active Subscriptions"
          value={metrics.activeSubscriptions}
          description="Currently active plans"
          icon={CreditCard}
          color={metrics.activeSubscriptions > 0 ? "text-green-600" : "text-gray-400"}
          borderColor={metrics.activeSubscriptions > 0 ? "border-green-200" : "border-gray-200"}
          bgColor={metrics.activeSubscriptions > 0 ? "bg-green-50" : "bg-gray-50"}
          clickable={true}
          href="/admin/subscriptions"
        />
        
        <MetricCard
          title="Conversion Rate"
          value={conversionRate}
          description="Free trial to paid conversion"
          icon={TrendingUp}
          color={conversionRate > 0 ? "text-blue-600" : "text-gray-400"}
          borderColor={conversionRate > 0 ? "border-blue-200" : "border-gray-200"}
          bgColor={conversionRate > 0 ? "bg-blue-50" : "bg-gray-50"}
          suffix="%"
          clickable={false}
        />
      </div>
    </div>
  );
};
