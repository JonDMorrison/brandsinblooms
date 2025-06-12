
import { AnalyticsDashboard } from "@/components/analytics/AnalyticsDashboard";
import { ProtectedPageWrapper } from "@/components/ProtectedPageWrapper";

const AnalyticsPage = () => {
  return (
    <ProtectedPageWrapper>
      <div className="p-6 border-b border-green-200 bg-white">
        <h1 className="text-3xl font-bold text-garden-green-dark">Analytics Dashboard</h1>
        <p className="text-garden-green font-medium">Track your marketing performance and insights</p>
      </div>
      <div className="p-6">
        <AnalyticsDashboard campaigns={[]} tasks={[]} />
      </div>
    </ProtectedPageWrapper>
  );
};

export default AnalyticsPage;
