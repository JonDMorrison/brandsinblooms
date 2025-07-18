import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';

interface Campaign {
  id: string;
  name: string;
  target_segment_ids?: string[];
  metrics: {
    sent: number;
    delivered: number;
    opened: number;
    clicked: number;
    bounced: number;
    unsubscribed: number;
    revenue: number;
  };
  crm_segments?: { name: string }[];
}

interface SegmentPerformanceBreakdownProps {
  campaigns: Campaign[];
}

export const SegmentPerformanceBreakdown = ({ campaigns }: SegmentPerformanceBreakdownProps) => {
  const segmentPerformance = React.useMemo(() => {
    const segmentMap = new Map<string, {
      name: string;
      totalSent: number;
      totalOpened: number;
      totalClicked: number;
      totalRevenue: number;
      campaignCount: number;
    }>();

    campaigns.forEach(campaign => {
      // Handle both the new multi-segment format and legacy single segment
      const segments = campaign.crm_segments || [];
      
      if (segments.length === 0) {
        // Fallback for campaigns without segment info
        const segmentName = 'Unknown Segment';
        const existing = segmentMap.get(segmentName) || {
          name: segmentName,
          totalSent: 0,
          totalOpened: 0,
          totalClicked: 0,
          totalRevenue: 0,
          campaignCount: 0,
        };

        segmentMap.set(segmentName, {
          ...existing,
          totalSent: existing.totalSent + campaign.metrics.sent,
          totalOpened: existing.totalOpened + campaign.metrics.opened,
          totalClicked: existing.totalClicked + campaign.metrics.clicked,
          totalRevenue: existing.totalRevenue + campaign.metrics.revenue,
          campaignCount: existing.campaignCount + 1,
        });
      } else {
        // Handle multiple segments
        segments.forEach(segment => {
          const existing = segmentMap.get(segment.name) || {
            name: segment.name,
            totalSent: 0,
            totalOpened: 0,
            totalClicked: 0,
            totalRevenue: 0,
            campaignCount: 0,
          };

          // Divide metrics by number of segments for this campaign to avoid double counting
          const divider = segments.length;
          
          segmentMap.set(segment.name, {
            ...existing,
            totalSent: existing.totalSent + Math.round(campaign.metrics.sent / divider),
            totalOpened: existing.totalOpened + Math.round(campaign.metrics.opened / divider),
            totalClicked: existing.totalClicked + Math.round(campaign.metrics.clicked / divider),
            totalRevenue: existing.totalRevenue + (campaign.metrics.revenue / divider),
            campaignCount: existing.campaignCount + (1 / divider),
          });
        });
      }
    });

    return Array.from(segmentMap.values())
      .map(segment => ({
        ...segment,
        openRate: segment.totalSent > 0 ? (segment.totalOpened / segment.totalSent) * 100 : 0,
        clickRate: segment.totalOpened > 0 ? (segment.totalClicked / segment.totalOpened) * 100 : 0,
        campaignCount: Math.round(segment.campaignCount),
      }))
      .sort((a, b) => b.totalRevenue - a.totalRevenue);
  }, [campaigns]);

  if (segmentPerformance.length === 0) {
    return null;
  }

  const maxOpenRate = Math.max(...segmentPerformance.map(s => s.openRate));
  const maxClickRate = Math.max(...segmentPerformance.map(s => s.clickRate));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          🎯 Segment Performance Breakdown
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {segmentPerformance.map((segment, index) => (
            <div key={segment.name} className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <h4 className="font-medium">{segment.name}</h4>
                  <Badge variant="outline" className="text-xs">
                    {segment.campaignCount} campaign{segment.campaignCount !== 1 ? 's' : ''}
                  </Badge>
                </div>
                <div className="text-right">
                  <div className="font-medium">${segment.totalRevenue.toFixed(2)}</div>
                  <div className="text-xs text-muted-foreground">
                    {segment.totalSent.toLocaleString()} sent
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Open Rate */}
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Open Rate</span>
                    <span className="font-medium">{segment.openRate.toFixed(1)}%</span>
                  </div>
                  <Progress 
                    value={maxOpenRate > 0 ? (segment.openRate / maxOpenRate) * 100 : 0} 
                    className="h-2"
                  />
                  <div className="text-xs text-muted-foreground">
                    {segment.totalOpened.toLocaleString()} opens
                  </div>
                </div>

                {/* Click Rate */}
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Click Rate</span>
                    <span className="font-medium">{segment.clickRate.toFixed(1)}%</span>
                  </div>
                  <Progress 
                    value={maxClickRate > 0 ? (segment.clickRate / maxClickRate) * 100 : 0} 
                    className="h-2"
                  />
                  <div className="text-xs text-muted-foreground">
                    {segment.totalClicked.toLocaleString()} clicks
                  </div>
                </div>
              </div>

              {index < segmentPerformance.length - 1 && (
                <hr className="border-muted" />
              )}
            </div>
          ))}
        </div>

        {segmentPerformance.length > 3 && (
          <div className="mt-6 p-4 bg-muted/30 rounded-lg">
            <p className="text-sm text-muted-foreground">
              💡 <strong>Tip:</strong> Compare segment performance to identify your highest-value customer groups. 
              Consider creating more targeted campaigns for segments with higher engagement rates.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};