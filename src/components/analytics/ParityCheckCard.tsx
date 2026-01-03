import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { RefreshCw, CheckCircle, AlertTriangle, Scale } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useQuery } from '@tanstack/react-query';
import { ANALYTICS_THRESHOLDS } from '@/config/analyticsThresholds';

interface ParityCheckCardProps {
  campaignId: string;
}

interface ParityResult {
  metric: string;
  before: number;
  after: number;
  delta: number;
  deltaPercent: number;
  status: 'ok' | 'warning' | 'error';
}

export const ParityCheckCard: React.FC<ParityCheckCardProps> = ({
  campaignId,
}) => {
  const [isChecking, setIsChecking] = useState(false);
  const [parityResults, setParityResults] = useState<ParityResult[] | null>(null);
  const [overallStatus, setOverallStatus] = useState<'ok' | 'warning' | 'error' | null>(null);

  // Fetch stored parity snapshot
  const { data: campaign } = useQuery({
    queryKey: ['campaign-parity', campaignId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('crm_campaigns')
        .select('metrics, metrics_parity_snapshot')
        .eq('id', campaignId)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: !!campaignId,
  });

  const runParityCheck = async () => {
    if (!campaignId) return;

    setIsChecking(true);
    try {
      // Store current metrics as snapshot before recompute
      const currentMetrics = campaign?.metrics;
      
      if (currentMetrics) {
        await supabase
          .from('crm_campaigns')
          .update({ metrics_parity_snapshot: currentMetrics })
          .eq('id', campaignId);
      }

      // Run recompute to get fresh metrics
      const { data, error } = await supabase.rpc('recompute_campaign_metrics', {
        p_campaign_id: campaignId
      });

      if (error) throw error;

      const beforeMetrics = (currentMetrics as any)?.totals || {};
      const afterMetrics = (data as any)?.totals || {};

      // Calculate deltas using configured thresholds
      const metrics = ['sent', 'delivered', 'opens', 'clicks', 'bounces', 'unsubscribes'];
      const results: ParityResult[] = metrics.map(metric => {
        const before = beforeMetrics[metric] || 0;
        const after = afterMetrics[metric] || 0;
        const delta = after - before;
        const deltaPercent = before > 0 ? Math.abs((delta / before) * 100) : (after > 0 ? 100 : 0);
        
        let status: 'ok' | 'warning' | 'error' = 'ok';
        if (deltaPercent > ANALYTICS_THRESHOLDS.parityDelta.red) {
          status = 'error';
        } else if (deltaPercent > ANALYTICS_THRESHOLDS.parityDelta.green) {
          status = 'warning';
        }

        return {
          metric: metric.charAt(0).toUpperCase() + metric.slice(1),
          before,
          after,
          delta,
          deltaPercent,
          status,
        };
      });

      setParityResults(results);

      // Determine overall status
      const hasError = results.some(r => r.status === 'error');
      const hasWarning = results.some(r => r.status === 'warning');
      setOverallStatus(hasError ? 'error' : hasWarning ? 'warning' : 'ok');

      if (hasError) {
        toast.warning('Parity check found significant differences');
      } else if (hasWarning) {
        toast.info('Parity check found minor differences');
      } else {
        toast.success('Parity check passed');
      }

    } catch (err: any) {
      console.error('Parity check failed:', err);
      toast.error('Parity check failed');
    } finally {
      setIsChecking(false);
    }
  };

  // Check if we have a stored snapshot
  const hasSnapshot = campaign?.metrics_parity_snapshot != null;

  const getStatusColor = (status: 'ok' | 'warning' | 'error') => {
    switch (status) {
      case 'ok': return 'text-green-600';
      case 'warning': return 'text-yellow-600';
      case 'error': return 'text-red-600';
    }
  };

  const getStatusBadge = (status: 'ok' | 'warning' | 'error') => {
    switch (status) {
      case 'ok': 
        return <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">OK</Badge>;
      case 'warning': 
        return <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">Warning</Badge>;
      case 'error': 
        return <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">Drift</Badge>;
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Scale className="h-5 w-5 text-muted-foreground" />
            Parity Check
            {hasSnapshot && (
              <Badge variant="secondary" className="text-xs">Snapshot saved</Badge>
            )}
          </CardTitle>
          <div className="flex items-center gap-2">
            {overallStatus && (
              overallStatus === 'ok' 
                ? <CheckCircle className="h-5 w-5 text-green-600" />
                : <AlertTriangle className={`h-5 w-5 ${overallStatus === 'error' ? 'text-red-600' : 'text-yellow-600'}`} />
            )}
            <Button 
              variant="outline" 
              size="sm" 
              onClick={runParityCheck} 
              disabled={isChecking}
            >
              <RefreshCw className={`h-4 w-4 mr-1 ${isChecking ? 'animate-spin' : ''}`} />
              Run Check
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isChecking ? (
          <div className="space-y-2">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        ) : parityResults ? (
          <div className="space-y-4">
            {overallStatus === 'warning' && (
              <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg text-sm text-yellow-800 dark:text-yellow-200">
                Some metrics show drift &gt; {ANALYTICS_THRESHOLDS.parityDelta.green}%. Consider investigating event synchronization.
              </div>
            )}
            {overallStatus === 'error' && (
              <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg text-sm text-red-800 dark:text-red-200">
                Significant metric drift detected (&gt; {ANALYTICS_THRESHOLDS.parityDelta.red}%). Review webhook delivery and backfill from provider.
              </div>
            )}
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Metric</TableHead>
                  <TableHead className="text-right">Before</TableHead>
                  <TableHead className="text-right">After</TableHead>
                  <TableHead className="text-right">Delta</TableHead>
                  <TableHead className="text-right">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {parityResults.map((result) => (
                  <TableRow key={result.metric}>
                    <TableCell className="font-medium">{result.metric}</TableCell>
                    <TableCell className="text-right">{result.before.toLocaleString()}</TableCell>
                    <TableCell className="text-right">{result.after.toLocaleString()}</TableCell>
                    <TableCell className={`text-right ${getStatusColor(result.status)}`}>
                      {result.delta > 0 ? '+' : ''}{result.delta}
                      <span className="text-xs ml-1">
                        ({result.deltaPercent.toFixed(2)}%)
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      {getStatusBadge(result.status)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="text-center py-6 text-muted-foreground">
            <p>Run a parity check to compare cached metrics against live event data.</p>
            <p className="text-xs mt-1">Flags differences greater than {ANALYTICS_THRESHOLDS.parityDelta.green}%</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ParityCheckCard;
