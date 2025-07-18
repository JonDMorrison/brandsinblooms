import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CampaignPerformanceCard } from './CampaignPerformanceCard';
import { supabase } from '@/integrations/supabase/client';
import { useCRMAccess } from '@/hooks/useCRMAccess';
import { 
  Search, 
  Filter,
  BarChart3,
  TrendingUp,
  Mail,
  Eye,
  MousePointer,
  Download
} from 'lucide-react';
import { toast } from 'sonner';

interface Campaign {
  id: string;
  name: string;
  sent_at: string;
  status: 'draft' | 'scheduled' | 'sending' | 'sent' | 'completed';
  metrics: {
    sent: number;
    delivered: number;
    opened: number;
    clicked: number;
    bounced: number;
    unsubscribed: number;
    revenue?: number;
  } | null;
}

export const CampaignAnalyticsDashboard: React.FC = () => {
  const { hasCRMAccess, loading: crmLoading } = useCRMAccess();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'recent' | 'performance'>('recent');

  useEffect(() => {
    if (hasCRMAccess) {
      loadCampaigns();
    }
  }, [hasCRMAccess]);

  const loadCampaigns = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('crm_campaigns')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const processedCampaigns: Campaign[] = (data || []).map(campaign => ({
        id: campaign.id,
        name: campaign.name,
        sent_at: campaign.sent_at || campaign.created_at,
        status: campaign.status as Campaign['status'],
        metrics: typeof campaign.metrics === 'object' && campaign.metrics !== null ? 
          campaign.metrics as Campaign['metrics'] : null
      }));

      setCampaigns(processedCampaigns);
    } catch (error) {
      console.error('Error loading campaigns:', error);
      toast.error('Failed to load campaigns');
    } finally {
      setLoading(false);
    }
  };

  const filteredCampaigns = campaigns.filter(campaign => {
    const matchesSearch = !searchQuery || 
      campaign.name.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || campaign.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const sortedCampaigns = [...filteredCampaigns].sort((a, b) => {
    if (sortBy === 'recent') {
      return new Date(b.sent_at).getTime() - new Date(a.sent_at).getTime();
    } else {
      // Sort by performance (open rate)
      const aOpenRate = a.metrics ? 
        (a.metrics.opened / (a.metrics.delivered || a.metrics.sent || 1)) * 100 : 0;
      const bOpenRate = b.metrics ? 
        (b.metrics.opened / (b.metrics.delivered || b.metrics.sent || 1)) * 100 : 0;
      return bOpenRate - aOpenRate;
    }
  });

  const calculateOverallStats = () => {
    const sentCampaigns = campaigns.filter(c => c.metrics && c.status !== 'draft');
    if (sentCampaigns.length === 0) return null;

    const totals = sentCampaigns.reduce((acc, campaign) => {
      const metrics = campaign.metrics!;
      return {
        sent: acc.sent + metrics.sent,
        delivered: acc.delivered + metrics.delivered,
        opened: acc.opened + metrics.opened,
        clicked: acc.clicked + metrics.clicked,
        revenue: acc.revenue + (metrics.revenue || 0)
      };
    }, { sent: 0, delivered: 0, opened: 0, clicked: 0, revenue: 0 });

    return {
      totalCampaigns: sentCampaigns.length,
      avgOpenRate: Math.round((totals.opened / (totals.delivered || totals.sent || 1)) * 100),
      avgClickRate: Math.round((totals.clicked / (totals.delivered || totals.sent || 1)) * 100),
      totalRevenue: totals.revenue,
      ...totals
    };
  };

  const overallStats = calculateOverallStats();

  const exportCampaignData = () => {
    const csvData = campaigns.map(campaign => ({
      name: campaign.name,
      status: campaign.status,
      sent_date: campaign.sent_at,
      sent: campaign.metrics?.sent || 0,
      delivered: campaign.metrics?.delivered || 0,
      opened: campaign.metrics?.opened || 0,
      clicked: campaign.metrics?.clicked || 0,
      open_rate: campaign.metrics ? 
        Math.round((campaign.metrics.opened / (campaign.metrics.delivered || campaign.metrics.sent || 1)) * 100) : 0,
      click_rate: campaign.metrics ? 
        Math.round((campaign.metrics.clicked / (campaign.metrics.delivered || campaign.metrics.sent || 1)) * 100) : 0
    }));

    const csv = [
      Object.keys(csvData[0]).join(','),
      ...csvData.map(row => Object.values(row).join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `campaign-analytics-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  if (crmLoading) {
    return <div className="flex items-center justify-center h-64">Loading...</div>;
  }

  if (!hasCRMAccess) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">CRM Access Required</h2>
          <p className="text-muted-foreground">Please upgrade your plan to access campaign analytics.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Campaign Analytics</h1>
          <p className="text-muted-foreground">Track the performance of your email campaigns</p>
        </div>
        <Button variant="outline" onClick={exportCampaignData} className="gap-2">
          <Download className="h-4 w-4" />
          Export Data
        </Button>
      </div>

      {/* Overall Stats */}
      {overallStats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Total Campaigns</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{overallStats.totalCampaigns}</div>
              <p className="text-xs text-muted-foreground">
                {campaigns.filter(c => c.status === 'draft').length} drafts
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Eye className="h-4 w-4" />
                Avg Open Rate
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{overallStats.avgOpenRate}%</div>
              <p className="text-xs text-muted-foreground">
                {overallStats.opened.toLocaleString()} total opens
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <MousePointer className="h-4 w-4" />
                Avg Click Rate
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{overallStats.avgClickRate}%</div>
              <p className="text-xs text-muted-foreground">
                {overallStats.clicked.toLocaleString()} total clicks
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Total Revenue
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${overallStats.totalRevenue.toFixed(2)}</div>
              <p className="text-xs text-muted-foreground">
                Across all campaigns
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search campaigns..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-48">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="scheduled">Scheduled</SelectItem>
            <SelectItem value="sent">Sent</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
          </SelectContent>
        </Select>

        <Select value={sortBy} onValueChange={(value: 'recent' | 'performance') => setSortBy(value)}>
          <SelectTrigger className="w-48">
            <BarChart3 className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="recent">Most Recent</SelectItem>
            <SelectItem value="performance">Best Performance</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Campaign List */}
      <div className="space-y-4">
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="animate-pulse">
                <div className="h-48 bg-gray-200 rounded-lg"></div>
              </div>
            ))}
          </div>
        ) : sortedCampaigns.length === 0 ? (
          <Card>
            <CardContent className="text-center py-8">
              <Mail className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
              <h3 className="text-lg font-medium mb-2">No campaigns found</h3>
              <p className="text-muted-foreground">
                {searchQuery || statusFilter !== 'all' 
                  ? 'Try adjusting your search or filters'
                  : 'Create your first email campaign to see analytics here'
                }
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
            {sortedCampaigns.map(campaign => (
              <CampaignPerformanceCard
                key={campaign.id}
                campaignName={campaign.name}
                sentDate={campaign.sent_at}
                status={campaign.status}
                metrics={campaign.metrics || undefined}
                onViewDetails={() => {
                  // Navigate to detailed analytics view
                  console.log('View details for campaign:', campaign.id);
                }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};