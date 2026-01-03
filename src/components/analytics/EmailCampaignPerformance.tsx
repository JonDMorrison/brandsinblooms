import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Mail, Send, Eye, MousePointerClick, TrendingUp, ArrowRight, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { format } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';

interface CampaignPerformanceData {
  id: string;
  name: string;
  sent_at: string;
  total_sent: number;
  total_opens: number;
  total_clicks: number;
  open_rate: number;
  click_rate: number;
}

interface EmailCampaignPerformanceProps {
  dateRange: number;
}

export const EmailCampaignPerformance: React.FC<EmailCampaignPerformanceProps> = ({ dateRange }) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [campaigns, setCampaigns] = useState<CampaignPerformanceData[]>([]);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState({
    totalCampaigns: 0,
    totalDelivered: 0,
    avgOpenRate: 0,
    avgClickRate: 0,
  });

  useEffect(() => {
    const loadData = async () => {
      if (!user?.id) return;

      try {
        setLoading(true);
        
        const { data: userData } = await supabase
          .from('users')
          .select('tenant_id')
          .eq('id', user.id)
          .single();

        if (!userData?.tenant_id) return;

        const startDate = new Date();
        startDate.setDate(startDate.getDate() - dateRange);

        const { data, error } = await supabase
          .from('crm_campaigns')
          .select('id, name, sent_at, total_sent, total_opens, total_clicks, open_rate, click_rate')
          .eq('tenant_id', userData.tenant_id)
          .eq('status', 'sent')
          .gte('sent_at', startDate.toISOString())
          .order('sent_at', { ascending: false })
          .limit(5);

        if (error) throw error;

        const campaignsData = (data || []).map(c => ({
          id: c.id,
          name: c.name,
          sent_at: c.sent_at || '',
          total_sent: c.total_sent || 0,
          total_opens: c.total_opens || 0,
          total_clicks: c.total_clicks || 0,
          open_rate: c.open_rate || 0,
          click_rate: c.click_rate || 0,
        }));

        setCampaigns(campaignsData);

        // Calculate summary
        if (campaignsData.length > 0) {
          const totalDelivered = campaignsData.reduce((sum, c) => sum + c.total_sent, 0);
          const weightedOpenRate = campaignsData.reduce((sum, c) => sum + c.open_rate * c.total_sent, 0);
          const weightedClickRate = campaignsData.reduce((sum, c) => sum + c.click_rate * c.total_sent, 0);

          setSummary({
            totalCampaigns: campaignsData.length,
            totalDelivered,
            avgOpenRate: totalDelivered > 0 ? weightedOpenRate / totalDelivered : 0,
            avgClickRate: totalDelivered > 0 ? weightedClickRate / totalDelivered : 0,
          });
        }
      } catch (error) {
        console.error('Error loading email campaign performance:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [user?.id, dateRange]);

  const getRateBadge = (rate: number, type: 'open' | 'click') => {
    const threshold = type === 'open' ? 20 : 3;
    const variant = rate >= threshold ? 'default' : rate >= threshold * 0.5 ? 'secondary' : 'outline';
    return (
      <Badge variant={variant} className="font-mono">
        {rate.toFixed(1)}%
      </Badge>
    );
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-primary" />
            Email Campaign Performance
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-20" />
            ))}
          </div>
          <Skeleton className="h-48" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-primary" />
            Email Campaign Performance
          </CardTitle>
          <Button variant="outline" size="sm" onClick={() => navigate('/crm/campaigns')}>
            View All
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Summary Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center p-4 bg-muted/50 rounded-lg">
            <Send className="h-5 w-5 text-muted-foreground mx-auto mb-2" />
            <p className="text-2xl font-bold">{summary.totalCampaigns}</p>
            <p className="text-xs text-muted-foreground">Campaigns Sent</p>
          </div>
          <div className="text-center p-4 bg-muted/50 rounded-lg">
            <TrendingUp className="h-5 w-5 text-muted-foreground mx-auto mb-2" />
            <p className="text-2xl font-bold">{summary.totalDelivered.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">Emails Delivered</p>
          </div>
          <div className="text-center p-4 bg-muted/50 rounded-lg">
            <Eye className="h-5 w-5 text-muted-foreground mx-auto mb-2" />
            <p className="text-2xl font-bold">{summary.avgOpenRate.toFixed(1)}%</p>
            <p className="text-xs text-muted-foreground">Avg Open Rate</p>
          </div>
          <div className="text-center p-4 bg-muted/50 rounded-lg">
            <MousePointerClick className="h-5 w-5 text-muted-foreground mx-auto mb-2" />
            <p className="text-2xl font-bold">{summary.avgClickRate.toFixed(1)}%</p>
            <p className="text-xs text-muted-foreground">Avg Click Rate</p>
          </div>
        </div>

        {/* Recent Campaigns Table */}
        {campaigns.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Campaign</TableHead>
                <TableHead>Sent Date</TableHead>
                <TableHead className="text-right">Delivered</TableHead>
                <TableHead className="text-right">Open Rate</TableHead>
                <TableHead className="text-right">Click Rate</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {campaigns.map((campaign) => (
                <TableRow 
                  key={campaign.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => navigate(`/crm/campaigns/${campaign.id}`)}
                >
                  <TableCell className="font-medium">{campaign.name}</TableCell>
                  <TableCell>
                    {campaign.sent_at ? format(new Date(campaign.sent_at), 'MMM d, yyyy') : '-'}
                  </TableCell>
                  <TableCell className="text-right">{campaign.total_sent.toLocaleString()}</TableCell>
                  <TableCell className="text-right">{getRateBadge(campaign.open_rate, 'open')}</TableCell>
                  <TableCell className="text-right">{getRateBadge(campaign.click_rate, 'click')}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <Mail className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No email campaigns sent in this period</p>
            <Button variant="outline" className="mt-4" onClick={() => navigate('/crm/campaigns/new')}>
              Create Campaign
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
