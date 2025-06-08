
interface AdminMetrics {
  totalUsers: number;
  totalCampaigns: number;
  totalTasks: number;
  activeSubscriptions: number;
  freeTrialUsers: number;
  paidUsers: number;
}

interface PlatformAnalyticsProps {
  metrics: AdminMetrics;
}

export const PlatformAnalytics = ({ metrics }: PlatformAnalyticsProps) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Subscription Breakdown</h3>
        <div className="space-y-2">
          <div className="flex justify-between">
            <span>Active Subscriptions:</span>
            <span className="font-medium text-green-600">{metrics.activeSubscriptions}</span>
          </div>
          <div className="flex justify-between">
            <span>Free Trial Users:</span>
            <span className="font-medium text-blue-600">{metrics.freeTrialUsers}</span>
          </div>
          <div className="flex justify-between">
            <span>Paid Users:</span>
            <span className="font-medium text-purple-600">{metrics.paidUsers}</span>
          </div>
          <div className="flex justify-between border-t pt-2">
            <span className="font-semibold">Total Users:</span>
            <span className="font-semibold">{metrics.totalUsers}</span>
          </div>
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>Conversion Rate:</span>
            <span>
              {metrics.totalUsers > 0 
                ? Math.round((metrics.paidUsers / metrics.totalUsers) * 100) 
                : 0}%
            </span>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Content Statistics</h3>
        <div className="space-y-2">
          <div className="flex justify-between">
            <span>Campaigns:</span>
            <span className="font-medium">{metrics.totalCampaigns}</span>
          </div>
          <div className="flex justify-between">
            <span>Content Tasks:</span>
            <span className="font-medium">{metrics.totalTasks}</span>
          </div>
          <div className="flex justify-between border-t pt-2">
            <span className="font-semibold">Avg Tasks/Campaign:</span>
            <span className="font-semibold">
              {metrics.totalCampaigns > 0 
                ? Math.round(metrics.totalTasks / metrics.totalCampaigns) 
                : 0}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
