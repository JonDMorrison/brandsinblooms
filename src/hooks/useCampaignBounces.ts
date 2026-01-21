import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface BouncedEmail {
  id: string;
  email: string;
  bounceType: string | null;
  bounceMessage: string | null;
  occurredAt: string;
  isSuppressed: boolean;
  customerId: string | null;
}

interface UseCampaignBouncesResult {
  bouncedEmails: BouncedEmail[];
  isLoading: boolean;
  error: Error | null;
  unsuppressedCount: number;
  suppressAll: () => void;
  isSuppressing: boolean;
}

export function useCampaignBounces(campaignId: string): UseCampaignBouncesResult {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch bounced emails for this campaign
  const { data: bouncedEmails = [], isLoading, error } = useQuery({
    queryKey: ['campaign-bounces', campaignId],
    queryFn: async () => {
      // Get bounced events for this campaign
      const { data: bounceEvents, error: eventsError } = await supabase
        .from('email_tracking_events')
        .select('id, customer_email, customer_id, event_data, created_at')
        .eq('campaign_id', campaignId)
        .eq('event_type', 'bounced');

      if (eventsError) throw eventsError;
      if (!bounceEvents || bounceEvents.length === 0) return [];

      // Get tenant_id from campaign
      const { data: campaign } = await supabase
        .from('crm_campaigns')
        .select('tenant_id')
        .eq('id', campaignId)
        .single();

      const tenantId = campaign?.tenant_id;
      if (!tenantId) return [];

      // Get emails that are already suppressed
      const emails = bounceEvents.map(e => e.customer_email).filter(Boolean);
      const { data: suppressions } = await supabase
        .from('suppression_list')
        .select('email')
        .eq('tenant_id', tenantId)
        .in('email', emails)
        .is('lifted_at', null);

      const suppressedSet = new Set(suppressions?.map(s => s.email) || []);

      return bounceEvents.map(event => {
        const eventData = event.event_data as Record<string, any> | null;
        return {
          id: event.id,
          email: event.customer_email,
          bounceType: eventData?.bounce_type || null,
          bounceMessage: eventData?.bounce_message || null,
          occurredAt: event.created_at,
          isSuppressed: suppressedSet.has(event.customer_email),
          customerId: event.customer_id,
        };
      });
    },
    enabled: !!campaignId,
  });

  const unsuppressedCount = bouncedEmails.filter(e => !e.isSuppressed).length;

  // Mutation to suppress all bounced emails
  const { mutate: suppressAll, isPending: isSuppressing } = useMutation({
    mutationFn: async () => {
      const unsuppressedEmails = bouncedEmails.filter(e => !e.isSuppressed);
      if (unsuppressedEmails.length === 0) {
        return { count: 0 };
      }

      // Get tenant_id from campaign
      const { data: campaign } = await supabase
        .from('crm_campaigns')
        .select('tenant_id')
        .eq('id', campaignId)
        .single();

      const tenantId = campaign?.tenant_id;
      if (!tenantId) throw new Error('Campaign not found');

      // Add to suppression list
      const suppressionRecords = unsuppressedEmails.map(email => ({
        tenant_id: tenantId,
        email: email.email,
        suppression_type: 'bounced',
        channel: 'email',
        reason: 'Manual cleanup from campaign report',
        auto_suppressed: false,
        suppressed_at: new Date().toISOString(),
      }));

      const { error: suppressError } = await supabase
        .from('suppression_list')
        .upsert(suppressionRecords, {
          onConflict: 'tenant_id,email,suppression_type',
          ignoreDuplicates: true,
        });

      if (suppressError) throw suppressError;

      // Update crm_customers.suppressed flag
      const emails = unsuppressedEmails.map(e => e.email);
      const { error: customerError } = await supabase
        .from('crm_customers')
        .update({ 
          suppressed: true,
          updated_at: new Date().toISOString()
        })
        .eq('tenant_id', tenantId)
        .in('email', emails);

      if (customerError) {
        console.warn('Failed to update customer suppressed flags:', customerError);
      }

      return { count: unsuppressedEmails.length };
    },
    onSuccess: (result) => {
      toast({
        title: 'Emails suppressed',
        description: `${result.count} bounced email${result.count !== 1 ? 's' : ''} added to suppression list. They won't receive future campaigns.`,
      });
      queryClient.invalidateQueries({ queryKey: ['campaign-bounces', campaignId] });
    },
    onError: (error) => {
      toast({
        title: 'Failed to suppress emails',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  return {
    bouncedEmails,
    isLoading,
    error: error as Error | null,
    unsuppressedCount,
    suppressAll,
    isSuppressing,
  };
}
