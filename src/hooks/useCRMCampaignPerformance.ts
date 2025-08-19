import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useTenant } from '@/hooks/useTenant';

type TimeFilter = '7d' | '30d' | 'all';
type ChannelFilter = 'all' | 'email' | 'sms' | 'social';

interface CampaignPerformance {
  id: string;
  name: string;
  channel: 'email' | 'sms' | 'social';
  status: 'active' | 'completed' | 'paused';
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  conversions: number;
  revenue: number;
  createdAt: string;
  deliveryRate: number;
  openRate: number;
  clickRate: number;
  conversionRate: number;
}

export const useCRMCampaignPerformance = (
  timeFilter: TimeFilter = '30d',
  channelFilter: ChannelFilter = 'all'
) => {
  const [campaigns, setCampaigns] = useState<CampaignPerformance[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { tenant } = useTenant();

  useEffect(() => {
    const fetchCampaignPerformance = async () => {
      if (!user || !tenant) {
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        // Calculate date range
        const now = new Date();
        let startDate: Date;
        
        switch (timeFilter) {
          case '7d':
            startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            break;
          case '30d':
            startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            break;
          default:
            startDate = new Date(2020, 0, 1); // Far past date for 'all'
        }

        // In a real app, this would fetch from campaigns table
        // For now, we'll generate mock data
        const generateMockCampaigns = (): CampaignPerformance[] => {
          const channels: Array<'email' | 'sms' | 'social'> = ['email', 'sms', 'social'];
          const statuses: Array<'active' | 'completed' | 'paused'> = ['active', 'completed', 'paused'];
          const campaignTypes = [
            'Welcome Series', 'Product Launch', 'Holiday Sale', 'Re-engagement',
            'Newsletter', 'Black Friday', 'Customer Survey', 'Win-back Campaign',
            'New Feature Announcement', 'Flash Sale'
          ];

          return Array.from({ length: 12 }, (_, i) => {
            const channel = channels[Math.floor(Math.random() * channels.length)];
            const status = statuses[Math.floor(Math.random() * statuses.length)];
            const sent = Math.floor(Math.random() * 10000) + 500;
            const delivered = Math.floor(sent * (0.85 + Math.random() * 0.1)); // 85-95% delivery
            const opened = Math.floor(delivered * (channel === 'email' ? 0.15 + Math.random() * 0.25 : 0.8 + Math.random() * 0.15)); // Email: 15-40%, SMS: 80-95%
            const clicked = Math.floor(opened * (0.05 + Math.random() * 0.15)); // 5-20% click rate
            const conversions = Math.floor(clicked * (0.02 + Math.random() * 0.08)); // 2-10% conversion
            const revenue = conversions * (25 + Math.random() * 200); // $25-225 per conversion
            
            const createdAt = new Date(
              startDate.getTime() + Math.random() * (now.getTime() - startDate.getTime())
            );

            return {
              id: `campaign-${i + 1}`,
              name: `${campaignTypes[Math.floor(Math.random() * campaignTypes.length)]} ${i + 1}`,
              channel,
              status,
              sent,
              delivered,
              opened,
              clicked,
              conversions,
              revenue: Math.floor(revenue),
              createdAt: createdAt.toISOString(),
              deliveryRate: (delivered / sent) * 100,
              openRate: (opened / delivered) * 100,
              clickRate: (clicked / opened) * 100,
              conversionRate: (conversions / clicked) * 100,
            };
          });
        };

        let mockCampaigns = generateMockCampaigns();

        // Apply channel filter
        if (channelFilter !== 'all') {
          mockCampaigns = mockCampaigns.filter(campaign => campaign.channel === channelFilter);
        }

        // Sort by creation date (newest first)
        mockCampaigns.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

        setCampaigns(mockCampaigns);

      } catch (error) {
        console.error('Error fetching campaign performance:', error);
        setCampaigns([]);
      } finally {
        setLoading(false);
      }
    };

    fetchCampaignPerformance();
  }, [user, tenant, timeFilter, channelFilter]);

  return { campaigns, loading };
};