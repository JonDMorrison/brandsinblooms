import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Eye, Users, MousePointer, Heart, Share, BarChart3 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { ContentBlockEditor, ContentBlock } from '@/components/content-hub/ContentBlockEditor';
import { ContentHubSettings } from '@/components/content-hub/ContentHubSettings';
import { HubPreview } from '@/components/content-hub/HubPreview';
import { SMSTestingPanel } from '@/components/content-hub/SMSTestingPanel';
import { useContentBlocks } from '@/hooks/useContentBlocks';
import { useHubAnalytics } from '@/hooks/useHubAnalytics';

interface Campaign {
  id: string;
  title: string;
  slug?: string;
  hub_enabled?: boolean;
  hub_expiry?: string;
  tenant_id: string;
}

export const CampaignContentHub: React.FC = () => {
  const { campaignId } = useParams<{ campaignId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [loading, setLoading] = useState(true);
  const [editableBlocks, setEditableBlocks] = useState<ContentBlock[]>([]);
  
  const { blocks, loading: blocksLoading, saveBlocks, saving } = useContentBlocks(campaignId);
  const { analytics, loading: analyticsLoading } = useHubAnalytics(campaignId);

  useEffect(() => {
    if (campaignId) {
      fetchCampaign();
    }
  }, [campaignId]);

  useEffect(() => {
    // Convert database blocks to editable format
    setEditableBlocks(blocks.map(block => ({
      id: block.id,
      type: block.type,
      payload_json: block.payload_json,
      sort_order: block.sort_order,
      is_active: block.is_active
    })));
  }, [blocks]);

  const fetchCampaign = async () => {
    if (!campaignId) return;

    try {
      const { data, error } = await supabase
        .from('campaigns')
        .select('id, title, slug, hub_enabled, hub_expiry, tenant_id')
        .eq('id', campaignId)
        .single();

      if (error) throw error;
      setCampaign(data);
    } catch (error) {
      console.error('Error fetching campaign:', error);
      toast({
        title: "Error",
        description: "Failed to load campaign details.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCampaignUpdate = async (updates: Partial<Campaign>) => {
    if (!campaignId || !campaign) return;

    try {
      const { error } = await supabase
        .from('campaigns')
        .update(updates)
        .eq('id', campaignId);

      if (error) throw error;

      setCampaign({ ...campaign, ...updates });
      
      toast({
        title: "Success",
        description: "Campaign settings updated."
      });
    } catch (error) {
      console.error('Error updating campaign:', error);
      toast({
        title: "Error",
        description: "Failed to update campaign settings.",
        variant: "destructive"
      });
    }
  };

  const handleSaveBlocks = async () => {
    const blocksToSave = editableBlocks.map(block => ({
      id: block.id?.startsWith('temp-') ? undefined : block.id,
      campaign_id: campaignId!,
      type: block.type,
      payload_json: block.payload_json,
      sort_order: block.sort_order,
      is_active: true
    })).filter(block => block.campaign_id);

    await saveBlocks(blocksToSave as any);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading campaign...</p>
        </div>
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold mb-4">Campaign not found</h2>
        <Button onClick={() => navigate('/app/crm/campaigns')}>
          Back to Campaigns
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => navigate('/app/crm/campaigns')}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Campaigns
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{campaign.title}</h1>
            <p className="text-muted-foreground">Content Hub Management</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {campaign.hub_enabled ? (
            <Badge variant="default">Hub Enabled</Badge>
          ) : (
            <Badge variant="secondary">Hub Disabled</Badge>
          )}
        </div>
      </div>

      <Tabs defaultValue="content" className="space-y-6">
        <TabsList>
          <TabsTrigger value="content">Content Blocks</TabsTrigger>
          <TabsTrigger value="preview">Preview</TabsTrigger>
          <TabsTrigger value="settings">Hub Settings</TabsTrigger>
          <TabsTrigger value="testing">SMS & QR Testing</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="content" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Content Builder</CardTitle>
              <CardDescription>
                Design your mobile-optimized content hub with drag-and-drop blocks.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ContentBlockEditor
                blocks={editableBlocks}
                onBlocksChange={setEditableBlocks}
                campaignId={campaignId}
              />
              
              <div className="flex justify-end mt-6">
                <Button 
                  onClick={handleSaveBlocks}
                  disabled={saving || editableBlocks.length === 0}
                  className="min-w-24"
                >
                  {saving ? 'Saving...' : 'Save Content'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="preview" className="space-y-6">
          <HubPreview
            campaign={campaign}
            blocks={editableBlocks}
            className="mx-auto max-w-md"
          />
        </TabsContent>

        <TabsContent value="settings" className="space-y-6">
          <ContentHubSettings
            campaign={campaign}
            onCampaignUpdate={handleCampaignUpdate}
          />
        </TabsContent>

        <TabsContent value="testing" className="space-y-6">
          <SMSTestingPanel 
            campaignId={campaignId}
            campaignSlug={campaign?.slug}
          />
        </TabsContent>

        <TabsContent value="analytics" className="space-y-6">
          {analyticsLoading ? (
            <div className="flex items-center justify-center h-48">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                <p className="text-muted-foreground">Loading analytics...</p>
              </div>
            </div>
          ) : analytics ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Views</CardTitle>
                  <Eye className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{analytics.totalViews}</div>
                  <p className="text-xs text-muted-foreground">
                    Last 7 days
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Unique Visitors</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{analytics.uniqueVisitors}</div>
                  <p className="text-xs text-muted-foreground">
                    Unique sessions
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Clicks</CardTitle>
                  <MousePointer className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{analytics.interactions.click || 0}</div>
                  <p className="text-xs text-muted-foreground">
                    All interactions
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Engagement Rate</CardTitle>
                  <BarChart3 className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {analytics.totalViews > 0 
                      ? Math.round(((analytics.interactions.click || 0) / analytics.totalViews) * 100)
                      : 0}%
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Click-through rate
                  </p>
                </CardContent>
              </Card>

              <Card className="md:col-span-2">
                <CardHeader>
                  <CardTitle className="text-sm font-medium">Interaction Types</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {Object.entries(analytics.interactions).map(([type, count]) => (
                    <div key={type} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {type === 'favorite' && <Heart className="w-4 h-4" />}
                        {type === 'share' && <Share className="w-4 h-4" />}
                        {type === 'click' && <MousePointer className="w-4 h-4" />}
                        {type === 'view' && <Eye className="w-4 h-4" />}
                        <span className="capitalize">{type}</span>
                      </div>
                      <Badge variant="secondary">{count}</Badge>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card className="md:col-span-2">
                <CardHeader>
                  <CardTitle className="text-sm font-medium">Daily Views</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {analytics.dailyViews.map((day, index) => (
                      <div key={day.date} className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">
                          {new Date(day.date).toLocaleDateString('en-US', { 
                            month: 'short', 
                            day: 'numeric' 
                          })}
                        </span>
                        <div className="flex items-center gap-2">
                          <div 
                            className="h-2 bg-primary rounded"
                            style={{ 
                              width: `${Math.max(4, (day.views / Math.max(...analytics.dailyViews.map(d => d.views))) * 60)}px` 
                            }}
                          />
                          <span className="font-medium min-w-8 text-right">{day.views}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : (
            <Card>
              <CardContent className="text-center py-12">
                <BarChart3 className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-semibold mb-2">No Analytics Data</h3>
                <p className="text-muted-foreground">
                  Enable the content hub and start sharing to see analytics data here.
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};