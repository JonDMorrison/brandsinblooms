
import { DollarSign, TrendingUp, Users, Target } from "lucide-react";
import { MetricCard } from "./MetricCard";

interface AdminMetrics {
  totalUsers: number;
  totalProfiles: number;
  trialUsers: number;
  paidUsers: number;
  currentMRR: number;
  potentialMRR: number;
  conversionRate: number;
}

interface RevenueSectionProps {
  metrics: AdminMetrics;
}

export const RevenueSection = ({ metrics }: RevenueSectionProps) => {
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold text-garden-green-dark">Revenue & Business Metrics</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          title="Monthly Recurring Revenue"
          value={metrics.currentMRR}
          description="Current MRR from paid users"
          icon={DollarSign}
          color={metrics.currentMRR > 0 ? "text-green-600" : "text-gray-400"}
          borderColor={metrics.currentMRR > 0 ? "border-green-200" : "border-gray-200"}
          bgColor={metrics.currentMRR > 0 ? "bg-green-50" : "bg-gray-50"}
          prefix="$"
          clickable={false}
        />
        
        <MetricCard
          title="Potential MRR"
          value={metrics.potentialMRR}
          description="If all trial users convert"
          icon={Target}
          color="text-blue-600"
          borderColor="border-blue-200"
          bgColor="bg-blue-50"
          prefix="$"
          clickable={false}
        />
        
        <MetricCard
          title="Total Users"
          value={metrics.totalProfiles}
          description="Company profiles created"
          icon={Users}
          color="text-purple-600"
          borderColor="border-purple-200"
          bgColor="bg-purple-50"
          clickable={false}
        />
        
        <MetricCard
          title="Conversion Rate"
          value={metrics.conversionRate}
          description="Trial to paid conversion"
          icon={TrendingUp}
          color={metrics.conversionRate > 0 ? "text-orange-600" : "text-gray-400"}
          borderColor={metrics.conversionRate > 0 ? "border-orange-200" : "border-gray-200"}
          bgColor={metrics.conversionRate > 0 ? "bg-orange-50" : "bg-gray-50"}
          suffix="%"
          clickable={false}
        />
      </div>
    </div>
  );
};
