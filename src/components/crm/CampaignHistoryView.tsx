import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCampaignAnalytics } from '@/hooks/useCampaignAnalytics';
import { useCampaignCloning } from '@/hooks/useCampaignCloning';
import { 
  Calendar, 
  Copy, 
  Mail, 
  MessageSquare, 
  Share2, 
  TrendingUp, 
  Eye, 
  Filter,
  Search,
  Clock,
  Users,
  BarChart3,
  Award,
  Target,
  Zap
} from 'lucide-react';
import { toast } from '@/utils/toast';
import { useNavigate } from 'react-router-dom';

interface CampaignPerformanceMetrics {
  open_rate: number;
  click_rate: number;
  total_sent: number;
  total_opens: number;
  total_clicks: number;
  engagement_score?: number;
}

interface CampaignHistoryItem {
  id: string;
  name: string;
  subject_line: string;
  status: string;
  sent_at?: string;
  created_at: string;
  metrics?: CampaignPerformanceMetrics;
  segment_name?: string;
  delivery_method?: string;
}

export const CampaignHistoryView: React.FC = () => {
  const navigate = useNavigate();
  const { campaigns, loading, loadCampaigns } = useCampaignAnalytics();
  const { cloneCampaign, cloneCampaignWithAIRefresh, isCloning } = useCampaignCloning();
  
  const [filteredCampaigns, setFilteredCampaigns] = useState<CampaignHistoryItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sortBy, setSortBy] = useState<'recent' | 'performance' | 'sent'>('recent');

  useEffect(() => {
    loadCampaigns();
  }, []);

  useEffect(() => {
    let filtered = campaigns.map(campaign => ({
      id: campaign.id,
      name: campaign.name,
      subject_line: campaign.subject_line || '',
      status: campaign.status,
      sent_at: campaign.sent_at,
      created_at: campaign.created_at,
      metrics: campaign.metrics ? {
        open_rate: campaign.open_rate || 0,
        click_rate: campaign.click_rate || 0,
        total_sent: campaign.total_sent || 0,
        total_opens: campaign.total_opens || 0,
        total_clicks: campaign.total_clicks || 0,
        engagement_score: campaign.metrics.opened && campaign.metrics.sent ? 
          ((campaign.metrics.opened + campaign.metrics.clicked) / campaign.metrics.sent) * 100 : 0
      } : undefined,
      delivery_method: campaign.delivery_method
    }));

    // Apply search filter
    if (searchQuery) {
      filtered = filtered.filter(campaign =>
        campaign.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        campaign.subject_line.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Apply status filter
    if (statusFilter) {
      filtered = filtered.filter(campaign => campaign.status === statusFilter);
    }

    // Apply sorting
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'performance':
          return (b.metrics?.engagement_score || 0) - (a.metrics?.engagement_score || 0);
        case 'sent':
          if (!a.sent_at && !b.sent_at) return 0;
          if (!a.sent_at) return 1;
          if (!b.sent_at) return -1;
          return new Date(b.sent_at).getTime() - new Date(a.sent_at).getTime();
        case 'recent':
        default:
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
    });

    setFilteredCampaigns(filtered);
  }, [campaigns, searchQuery, statusFilter, sortBy]);

  const handleCloneCampaign = async (campaignId: string, withAI: boolean = false) => {
    const clonedId = withAI ? 
      await cloneCampaignWithAIRefresh(campaignId, { clearScheduling: true, updateThemeWeek: true, aiRefresh: true }) :
      await cloneCampaign(campaignId, { clearScheduling: true });
    
    if (clonedId) {
      navigate(`/crm/campaigns/${clonedId}/edit`);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      'sent': 'default',
      'draft': 'secondary',
      'scheduled': 'outline',
      'failed': 'destructive'
    };
    return <Badge variant={variants[status] || 'secondary'}>{status}</Badge>;
  };

  const getPerformanceBadge = (metrics?: CampaignPerformanceMetrics) => {
    if (!metrics || metrics.total_sent === 0) return null;
    
    const engagementScore = metrics.engagement_score || 0;
    if (engagementScore >= 25) {
      return <Badge variant="default" className="bg-green-100 text-green-800"><Award className="h-3 w-3 mr-1" />High Performer</Badge>;
    } else if (engagementScore >= 15) {
      return <Badge variant="outline" className="border-orange-300 text-orange-600"><Target className="h-3 w-3 mr-1" />Good</Badge>;
    } else if (engagementScore >= 5) {
      return <Badge variant="outline">Average</Badge>;
    }
    return <Badge variant="secondary" className="text-gray-600">Low</Badge>;
  };

  const topPerformers = filteredCampaigns
    .filter(c => c.metrics && c.metrics.total_sent > 0)
    .slice(0, 3);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Campaign History</h2>
          <p className="text-muted-foreground">Track performance and reuse successful campaigns</p>
        </div>
        <Button onClick={() => navigate('/crm/campaigns/new')}>
          Create New Campaign
        </Button>
      </div>

      {/* Top Performers Section */}
      {topPerformers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Top Performing Campaigns
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {topPerformers.map((campaign) => (
                <div key={campaign.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between mb-2">
                    <h4 className="font-medium text-sm">{campaign.name}</h4>
                    {getPerformanceBadge(campaign.metrics)}
                  </div>
                  <p className="text-xs text-muted-foreground mb-3">{campaign.subject_line}</p>
                  
                  <div className="grid grid-cols-2 gap-2 text-xs mb-3">
                    <div>
                      <div className="text-muted-foreground">Open Rate</div>
                      <div className="font-medium">{campaign.metrics?.open_rate.toFixed(1)}%</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Click Rate</div>
                      <div className="font-medium">{campaign.metrics?.click_rate.toFixed(1)}%</div>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button 
                      size="sm" 
                      variant="outline" 
                      onClick={() => handleCloneCampaign(campaign.id)}
                      disabled={isCloning}
                    >
                      <Copy className="h-3 w-3 mr-1" />
                      Clone
                    </Button>
                    <Button 
                      size="sm" 
                      onClick={() => handleCloneCampaign(campaign.id, true)}
                      disabled={isCloning}
                    >
                      <Zap className="h-3 w-3 mr-1" />
                      AI Refresh
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters and Search */}
      <Card>
        <CardContent className="py-4">
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search campaigns..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All Status</SelectItem>
                <SelectItem value="sent">Sent</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="scheduled">Scheduled</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
              </SelectContent>
            </Select>

            <Select value={sortBy} onValueChange={(value: any) => setSortBy(value)}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="recent">Recent</SelectItem>
                <SelectItem value="performance">Performance</SelectItem>
                <SelectItem value="sent">Send Date</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Campaign List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            All Campaigns ({filteredCampaigns.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : filteredCampaigns.length === 0 ? (
            <div className="text-center py-8">
              <Mail className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
              <h3 className="font-medium mb-2">No campaigns found</h3>
              <p className="text-muted-foreground text-sm mb-4">
                {searchQuery || statusFilter ? 
                  'Try adjusting your search or filters.' :
                  'Create your first campaign to get started.'
                }
              </p>
              <Button onClick={() => navigate('/crm/campaigns/new')}>
                Create Your First Campaign
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredCampaigns.map((campaign) => (
                <div key={campaign.id} className="border rounded-lg p-4 hover:shadow-sm transition-shadow">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-medium">{campaign.name}</h3>
                        {getStatusBadge(campaign.status)}
                        {getPerformanceBadge(campaign.metrics)}
                      </div>
                      
                      <p className="text-sm text-muted-foreground mb-3">{campaign.subject_line}</p>
                      
                      <div className="flex items-center gap-6 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          <span>
                            {campaign.sent_at ? 
                              `Sent ${new Date(campaign.sent_at).toLocaleDateString()}` :
                              `Created ${new Date(campaign.created_at).toLocaleDateString()}`
                            }
                          </span>
                        </div>
                        
                        {campaign.metrics && campaign.metrics.total_sent > 0 && (
                          <>
                            <div className="flex items-center gap-1">
                              <Users className="h-3 w-3" />
                              <span>{campaign.metrics.total_sent} sent</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Eye className="h-3 w-3" />
                              <span>{campaign.metrics.open_rate.toFixed(1)}% opened</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Target className="h-3 w-3" />
                              <span>{campaign.metrics.click_rate.toFixed(1)}% clicked</span>
                            </div>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => handleCloneCampaign(campaign.id)}
                        disabled={isCloning}
                      >
                        <Copy className="h-4 w-4 mr-1" />
                        Clone
                      </Button>
                      <Button 
                        size="sm"
                        onClick={() => handleCloneCampaign(campaign.id, true)}
                        disabled={isCloning}
                      >
                        <Zap className="h-4 w-4 mr-1" />
                        AI Refresh
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};