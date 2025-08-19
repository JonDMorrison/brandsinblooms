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

  return useQuery({
    queryKey: ['sms-stats', user?.id],
    queryFn: async (): Promise<SMSStats> => {
      if (!user) {
        return {
          subscribers: 0,
          credits: 2847,
          deliverability: 95,
          clicks: 0,
          queuedMessages: 0,
          recentCampaigns: [],
          recentMessages: []
        };
      }

      // Get user's tenant_id
      const { data: userData } = await supabase
        .from('users')
        .select('tenant_id')
        .eq('id', user.id)
        .maybeSingle();

      const tenantId = userData?.tenant_id;

      // Fetch campaigns for user or tenant
      let campaignQuery = supabase
        .from('crm_sms_campaigns')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);

      if (tenantId) {
        campaignQuery = campaignQuery.eq('tenant_id', tenantId);
      } else {
        campaignQuery = campaignQuery.eq('user_id', user.id);
      }

      const { data: campaigns = [] } = await campaignQuery;

      // Fetch recent messages
      const campaignIds = campaigns.map(c => c.id);
      let messagesQuery = supabase
        .from('sms_messages')
        .select(`
          id,
          phone,
          content,
          status,
          created_at,
          campaign_id
        `)
        .order('created_at', { ascending: false })
        .limit(20);

      if (campaignIds.length > 0) {
        messagesQuery = messagesQuery.in('campaign_id', campaignIds);
      } else {
        // If no campaigns, get all messages (for test sends)
        messagesQuery = messagesQuery.limit(10);
      }

      const { data: messages = [] } = await messagesQuery;

      // Fetch customers with SMS opt-in
      let customerQuery = supabase
        .from('crm_customers')
        .select('id')
        .eq('sms_opt_in', true);

      if (tenantId) {
        customerQuery = customerQuery.eq('tenant_id', tenantId);
      } else {
        customerQuery = customerQuery.eq('user_id', user.id);
      }

      const { data: customers = [] } = await customerQuery;

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
    enabled: !!user,
    refetchInterval: 30000, // Refresh every 30 seconds
    staleTime: 10000 // Consider data stale after 10 seconds
  });
};