
import { AnalyticsDashboard } from "@/components/analytics/AnalyticsDashboard";

const AnalyticsPage = () => {
  return (
    <div className="min-h-screen bg-garden-background">
      <div className="p-6 border-b border-green-200 bg-white">
        <h1 className="text-3xl font-bold text-garden-green-dark">Analytics Dashboard</h1>
        <p className="text-garden-green font-medium">Track your marketing performance and insights</p>
      </div>
      <div className="p-6">
        <AnalyticsDashboard />
      </div>
    </div>
  );
};

export default AnalyticsPage;
