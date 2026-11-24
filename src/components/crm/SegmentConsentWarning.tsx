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
        
        // Count in the database: selecting member rows stops at 1,000.
        const membersWithEmail = () =>
          supabase
            .from('customer_segments')
            .select('id, crm_customers!inner(id)', { count: 'exact', head: true })
            .eq('segment_id', segmentId)
            .not('crm_customers.email', 'is', null)
            .neq('crm_customers.email', '');

        const [totalResult, optedInResult] = await Promise.all([
          membersWithEmail(),
          membersWithEmail().eq('crm_customers.email_opt_in', true),
        ]);

        const error = totalResult.error ?? optedInResult.error;
        if (error) {
          console.error('Error fetching segment consent stats:', error);
          setLoading(false);
          return;
        }

        const total = totalResult.count ?? 0;
        const optedIn = optedInResult.count ?? 0;
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
