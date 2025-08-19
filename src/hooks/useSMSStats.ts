import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useTenant } from '@/hooks/useTenant';

export interface SMSStats {
  subscribers: number;
  credits: number;
  deliverability: number;
  clicks: number;
  queuedMessages: number;
  recentCampaigns: Array<{
    id: string;
    name: string;
    status: string;
    sent: number;
    delivered: number;
    created_at: string;
  }>;
  recentMessages: Array<{
    id: string;
    phone: string;
    content: string;
    status: string;
    created_at: string;
  }>;
}

export const useSMSStats = () => {
  const { user } = useAuth();
  const { tenant } = useTenant();

  return useQuery({
    queryKey: ['sms-stats', user?.id, tenant?.id],
    queryFn: async (): Promise<SMSStats> => {
      if (!user || !tenant) {
        return {
          subscribers: 0,
          credits: 0,
          deliverability: 0,
          clicks: 0,
          queuedMessages: 0,
          recentCampaigns: [],
          recentMessages: []
        };
      }

      // Fetch campaigns
      const { data: campaigns = [] } = await supabase
        .from('crm_sms_campaigns')
        .select('*')
        .eq('tenant_id', tenant.id)
        .order('created_at', { ascending: false })
        .limit(10);

      // Fetch recent messages
      const { data: messages = [] } = await supabase
        .from('sms_messages')
        .select(`
          id,
          phone,
          content,
          status,
          created_at,
          campaign_id
        `)
        .in('campaign_id', campaigns.map(c => c.id))
        .order('created_at', { ascending: false })
        .limit(20);

      // Fetch customers with SMS opt-in
      const { data: customers = [] } = await supabase
        .from('crm_customers')
        .select('id')
        .eq('tenant_id', tenant.id)
        .eq('sms_opt_in', true);

      // Calculate stats
      const getMetrics = (campaign: any) => 
        campaign.metrics && typeof campaign.metrics === 'object' ? campaign.metrics : {};

      const totalSent = campaigns.reduce((sum, campaign) => 
        sum + (getMetrics(campaign).sent || 0), 0);
      const totalDelivered = campaigns.reduce((sum, campaign) => 
        sum + (getMetrics(campaign).delivered || 0), 0);
      const totalClicked = campaigns.reduce((sum, campaign) => 
        sum + (getMetrics(campaign).clicked || 0), 0);

      const queuedMessages = messages.filter(m => m.status === 'queued').length;
      const deliverability = totalSent > 0 ? (totalDelivered / totalSent) * 100 : 95;

      return {
        subscribers: customers.length,
        credits: 2847, // This would come from subscription/billing
        deliverability: Math.round(deliverability),
        clicks: totalClicked,
        queuedMessages,
        recentCampaigns: campaigns.slice(0, 5).map(campaign => ({
          id: campaign.id,
          name: campaign.name,
          status: campaign.status,
          sent: getMetrics(campaign).sent || 0,
          delivered: getMetrics(campaign).delivered || 0,
          created_at: campaign.created_at
        })),
        recentMessages: messages.slice(0, 10).map(message => ({
          id: message.id,
          phone: message.phone,
          content: message.content.substring(0, 50) + (message.content.length > 50 ? '...' : ''),
          status: message.status,
          created_at: message.created_at
        }))
      };
    },
    enabled: !!user && !!tenant,
    refetchInterval: 30000 // Refresh every 30 seconds
  });
};