import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { CampaignConsentWarning } from './CampaignConsentWarning';
import { Loader2 } from 'lucide-react';

interface SegmentConsentWarningProps {
  segmentId: string;
  onSendOptInRequest?: () => void;
}

interface ConsentStats {
  total: number;
  optedIn: number;
  excluded: number;
}

export function SegmentConsentWarning({ segmentId, onSendOptInRequest }: SegmentConsentWarningProps) {
  const [stats, setStats] = useState<ConsentStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchConsentStats() {
      if (!segmentId) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        
        // Get customers in the segment with their consent status
        const { data: segmentCustomers, error } = await supabase
          .from('customer_segments')
          .select(`
            crm_customers (
              id,
              email,
              email_opt_in
            )
          `)
          .eq('segment_id', segmentId);

        if (error) {
          console.error('Error fetching segment consent stats:', error);
          setLoading(false);
          return;
        }

        const customers = segmentCustomers
          ?.map(sc => sc.crm_customers)
          .filter(c => c && c.email && c.email.trim() !== '') || [];

        const total = customers.length;
        const optedIn = customers.filter(c => c.email_opt_in === true).length;
        const excluded = total - optedIn;

        setStats({ total, optedIn, excluded });
      } catch (err) {
        console.error('Error in fetchConsentStats:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchConsentStats();
  }, [segmentId]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
        <Loader2 className="h-4 w-4 animate-spin" />
        Checking consent status...
      </div>
    );
  }

  if (!stats || stats.total === 0) {
    return null;
  }

  return (
    <CampaignConsentWarning
      totalRecipients={stats.total}
      optedInCount={stats.optedIn}
      excludedCount={stats.excluded}
      onSendOptInRequest={onSendOptInRequest}
    />
  );
}
