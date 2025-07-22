import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface CampaignMetrics {
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  bounced: number;
  unsubscribed: number;
  revenue?: number;
}

interface CampaignAnalytics {
  id: string;
  name: string;
  subject_line: string;
  status: string;
  sent_at: string;
  metrics: CampaignMetrics | null;
  created_at: string;
  open_rate: number;
  click_rate: number;
  total_sent: number;
  total_opens: number;
  total_clicks: number;
  delivery_method?: string;
}

interface EmailTrackingEvent {
  id: string;
  campaign_id: string;
  customer_email: string;
  event_type: 'sent' | 'delivered' | 'opened' | 'clicked' | 'bounced' | 'unsubscribed';
  event_data: Record<string, any>;
  created_at: string;
}

export const useCampaignAnalytics = () => {
  const [campaigns, setCampaigns] = useState<CampaignAnalytics[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadCampaigns = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const { data, error: queryError } = await supabase
        .from('crm_campaigns')
        .select('*')
        .order('created_at', { ascending: false });

      if (queryError) throw queryError;

      const processedCampaigns: CampaignAnalytics[] = (data || []).map(campaign => ({
        id: campaign.id,
        name: campaign.name,
        subject_line: campaign.subject_line || '',
        status: campaign.status,
        sent_at: campaign.sent_at || campaign.created_at,
        metrics: typeof campaign.metrics === 'object' && campaign.metrics !== null && !Array.isArray(campaign.metrics) ? 
          campaign.metrics as unknown as CampaignMetrics : null,
        created_at: campaign.created_at,
        open_rate: campaign.open_rate || 0,
        click_rate: campaign.click_rate || 0,
        total_sent: campaign.total_sent || 0,
        total_opens: campaign.total_opens || 0,
        total_clicks: campaign.total_clicks || 0,
        delivery_method: campaign.delivery_method
      }));

      setCampaigns(processedCampaigns);
    } catch (err: any) {
      console.error('Error loading campaigns:', err);
      setError(err.message);
      toast.error('Failed to load campaign analytics');
    } finally {
      setLoading(false);
    }
  };

  const loadCampaignEvents = async (campaignId: string): Promise<EmailTrackingEvent[]> => {
    try {
      const { data, error } = await supabase
        .from('email_tracking_events')
        .select('*')
        .eq('campaign_id', campaignId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      return (data || []).map(event => ({
        ...event,
        event_type: event.event_type as EmailTrackingEvent['event_type'],
        event_data: event.event_data as Record<string, any>
      }));
    } catch (err: any) {
      console.error('Error loading campaign events:', err);
      toast.error('Failed to load campaign events');
      return [];
    }
  };

  const calculateMetrics = (events: EmailTrackingEvent[]): CampaignMetrics => {
    const metrics: CampaignMetrics = {
      sent: 0,
      delivered: 0,
      opened: 0,
      clicked: 0,
      bounced: 0,
      unsubscribed: 0,
      revenue: 0
    };

    // Count unique emails for each event type
    const uniqueEmails = {
      sent: new Set<string>(),
      delivered: new Set<string>(),
      opened: new Set<string>(),
      clicked: new Set<string>(),
      bounced: new Set<string>(),
      unsubscribed: new Set<string>()
    };

    events.forEach(event => {
      switch (event.event_type) {
        case 'sent':
          uniqueEmails.sent.add(event.customer_email);
          break;
        case 'delivered':
          uniqueEmails.delivered.add(event.customer_email);
          break;
        case 'opened':
          uniqueEmails.opened.add(event.customer_email);
          break;
        case 'clicked':
          uniqueEmails.clicked.add(event.customer_email);
          break;
        case 'bounced':
          uniqueEmails.bounced.add(event.customer_email);
          break;
        case 'unsubscribed':
          uniqueEmails.unsubscribed.add(event.customer_email);
          break;
      }
    });

    metrics.sent = uniqueEmails.sent.size;
    metrics.delivered = uniqueEmails.delivered.size;
    metrics.opened = uniqueEmails.opened.size;
    metrics.clicked = uniqueEmails.clicked.size;
    metrics.bounced = uniqueEmails.bounced.size;
    metrics.unsubscribed = uniqueEmails.unsubscribed.size;

    return metrics;
  };

  const refreshCampaignMetrics = async (campaignId: string) => {
    try {
      const events = await loadCampaignEvents(campaignId);
      const calculatedMetrics = calculateMetrics(events);

      const { error } = await supabase
        .from('crm_campaigns')
        .update({ 
          metrics: calculatedMetrics as any,
          total_sent: calculatedMetrics.sent,
          total_opens: calculatedMetrics.opened,
          total_clicks: calculatedMetrics.clicked,
          open_rate: calculatedMetrics.sent > 0 ? 
            ((calculatedMetrics.opened / calculatedMetrics.sent) * 100) : 0,
          click_rate: calculatedMetrics.sent > 0 ? 
            ((calculatedMetrics.clicked / calculatedMetrics.sent) * 100) : 0
        })
        .eq('id', campaignId);

      if (error) throw error;

      // Reload campaigns to reflect updated metrics
      await loadCampaigns();
      
      toast.success('Campaign metrics updated');
    } catch (err: any) {
      console.error('Error refreshing metrics:', err);
      toast.error('Failed to refresh campaign metrics');
    }
  };

  // Set up real-time subscription for tracking events
  useEffect(() => {
    const channel = supabase
      .channel('email-tracking-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'email_tracking_events'
        },
        (payload) => {
          console.log('New tracking event:', payload);
          // Reload campaigns to get updated metrics
          loadCampaigns();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    loadCampaigns();
  }, []);

  return {
    campaigns,
    loading,
    error,
    loadCampaigns,
    loadCampaignEvents,
    refreshCampaignMetrics,
    calculateMetrics
  };
};