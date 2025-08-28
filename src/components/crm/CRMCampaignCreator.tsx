
import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { LayoutRenderer } from '@/components/newsletter/LayoutRenderer';
import { EmailPreview } from '@/components/newsletter/EmailPreview';
import { useNewsletterRenderer } from '@/hooks/useNewsletterRenderer';
import { Calendar, Send, Save, ArrowLeft, Sparkles } from 'lucide-react';

interface CRMCampaignCreatorProps {
  campaignSlug?: string;
  contentTaskId?: string | null;
}

interface DatabaseSeasonalTemplate {
  content_ideas: string;
  created_at: string;
  id: string;
  platform_specific_notes: any;
  prompt: string;
  seasonal_focus: string;
  target_audience_notes: string;
  theme: string;
  title: string;
  updated_at: string;
  week_number: number;
}

interface SeasonalTemplate {
  id: string;
  title: string;
  theme: string;
  content_ideas: string;
  prompt: string;
  seasonal_focus: string;
  target_audience_notes: string;
  platform_specific_notes: any;
  week_number: number;
}

interface CampaignData {
  id?: string;
  name: string;
  subject_line: string;
  preheader_text: string;
  content: string;
  status: 'draft' | 'scheduled' | 'sent';
  segment_id?: string;
  scheduled_at?: string;
  delivery_method: string;
  sender_name: string;
  sender_email: string;
}

interface NewsletterMeta {
  theme: string;
  estimatedReadTime: string;
  wordCount: number;
  tone: string;
}

export const CRMCampaignCreator: React.FC<CRMCampaignCreatorProps> = ({ 
  campaignSlug, 
  contentTaskId 
}) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [campaign, setCampaign] = useState<CampaignData>({
    name: '',
    subject_line: '',
    preheader_text: '',
    content: '',
    status: 'draft' as const, // Properly type the status
    delivery_method: 'shared_sender',
    sender_name: '',
    sender_email: ''
  });

  const [segments, setSegments] = useState<any[]>([]);
  const [seasonalTemplate, setSeasonalTemplate] = useState<SeasonalTemplate | null>(null);
  const [contentTask, setContentTask] = useState<any>(null);

  // Newsletter renderer for preview
  const { processedNewsletter, featuredImage, loadingImages } = useNewsletterRenderer({
    content: campaign.content,
    campaignTitle: campaign.name,
    contentTaskId: contentTaskId || undefined,
    format: 'magazine'
  });

  // Load segments on mount
  useEffect(() => {
    loadSegments();
  }, []);

  // Load existing campaign or template data
  useEffect(() => {
    if (campaignSlug) {
      // Check if it's an existing campaign (UUID format)
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      if (uuidRegex.test(campaignSlug)) {
        loadExistingCampaign(campaignSlug);
      } else {
        // It's a template slug, try to load template
        loadTemplateFromSlug(campaignSlug);
      }
    }
  }, [campaignSlug]);

  // Load content task if provided
  useEffect(() => {
    if (contentTaskId) {
      loadContentTask(contentTaskId);
    }
  }, [contentTaskId]);

  const loadSegments = async () => {
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) return;

      const { data: userData } = await supabase
        .from('users')
        .select('tenant_id')
        .eq('id', user.user.id)
        .single();

      if (!userData?.tenant_id) return;

      const { data, error } = await supabase
        .from('crm_segments')
        .select('*')
        .eq('tenant_id', userData.tenant_id)
        .order('name');

      if (error) throw error;
      setSegments(data || []);
    } catch (error) {
      console.error('Error loading segments:', error);
    }
  };

  const loadTemplateFromSlug = async (slug: string) => {
    try {
      setLoading(true);
      
      // Extract week number from slug if possible
      const weekMatch = slug.match(/week-(\d+)/i) || slug.match(/(\d+)/);
      const weekNumber = weekMatch ? parseInt(weekMatch[1]) : null;

      const { data, error } = await supabase
        .from('master_campaign_templates')
        .select('*')
        .or(weekNumber ? `week_number.eq.${weekNumber}` : `title.ilike.%${slug}%`)
        .limit(1)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        const template = data as DatabaseSeasonalTemplate;
        const convertedTemplate: SeasonalTemplate = {
          id: template.id,
          title: template.title,
          theme: template.theme,
          content_ideas: template.content_ideas,
          prompt: template.prompt,
          seasonal_focus: template.seasonal_focus,
          target_audience_notes: template.target_audience_notes,
          platform_specific_notes: template.platform_specific_notes,
          week_number: template.week_number
        };

        setSeasonalTemplate(convertedTemplate);

        // Parse content_ideas - handle both string and array formats
        let contentIdeas: string[] = [];
        try {
          if (typeof template.content_ideas === 'string') {
            // Try to parse as JSON first
            try {
              const parsed = JSON.parse(template.content_ideas);
              contentIdeas = Array.isArray(parsed) ? parsed : [template.content_ideas];
            } catch {
              // If not JSON, split by common delimiters
              contentIdeas = template.content_ideas.split(/[•\n-]/).filter(item => item.trim());
            }
          }
        } catch (e) {
          console.warn('Error parsing content ideas:', e);
          contentIdeas = [template.content_ideas || ''];
        }

        // Pre-populate campaign data from template
        setCampaign(prev => ({
          ...prev,
          name: template.title,
          subject_line: template.title,
          content: contentIdeas.length > 0 ? contentIdeas.join('\n\n') : template.content_ideas || ''
        }));
      }
    } catch (error) {
      console.error('Error loading template:', error);
      toast({
        title: "Error",
        description: "Failed to load campaign template.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const loadExistingCampaign = async (campaignId: string) => {
    try {
      setLoading(true);
      
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) return;

      const { data: userData } = await supabase
        .from('users')
        .select('tenant_id')
        .eq('id', user.user.id)
        .single();

      if (!userData?.tenant_id) return;

      const { data, error } = await supabase
        .from('crm_campaigns')
        .select('*')
        .eq('id', campaignId)
        .eq('tenant_id', userData.tenant_id)
        .single();

      if (error) throw error;

      if (data) {
        setCampaign({
          id: data.id,
          name: data.name,
          subject_line: data.subject_line || '',
          preheader_text: data.preheader_text || '',
          content: data.content || '',
          status: data.status as 'draft' | 'scheduled' | 'sent', // Proper type casting
          segment_id: data.segment_id,
          scheduled_at: data.scheduled_at,
          delivery_method: data.delivery_method || 'shared_sender',
          sender_name: data.sender_name || '',
          sender_email: data.sender_email || ''
        });
      }
    } catch (error) {
      console.error('Error loading campaign:', error);
      toast({
        title: "Error",
        description: "Failed to load campaign.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const loadContentTask = async (taskId: string) => {
    try {
      const { data, error } = await supabase
        .from('content_tasks')
        .select('*')
        .eq('id', taskId)
        .single();

      if (error) throw error;

      if (data) {
        setContentTask(data);
        
        // Pre-populate campaign with content task data
        setCampaign(prev => ({
          ...prev,
          name: data.campaign_id ? `Newsletter: ${data.ai_output?.substring(0, 50)}...` : prev.name,
          content: data.ai_output || prev.content
        }));
      }
    } catch (error) {
      console.error('Error loading content task:', error);
    }
  };

  const handleSave = async () => {
    if (!campaign.name.trim()) {
      toast({
        title: "Validation Error",
        description: "Campaign name is required.",
        variant: "destructive"
      });
      return;
    }

    try {
      setSaving(true);
      
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error('Not authenticated');

      const { data: userData } = await supabase
        .from('users')
        .select('tenant_id')
        .eq('id', user.user.id)
        .single();

      if (!userData?.tenant_id) throw new Error('No tenant found');

      const campaignData = {
        tenant_id: userData.tenant_id,
        user_id: user.user.id,
        name: campaign.name,
        subject_line: campaign.subject_line,
        preheader_text: campaign.preheader_text,
        content: campaign.content,
        status: campaign.status,
        segment_id: campaign.segment_id,
        scheduled_at: campaign.scheduled_at,
        delivery_method: campaign.delivery_method,
        sender_name: campaign.sender_name,
        sender_email: campaign.sender_email,
        source_content_task_id: contentTaskId
      };

      let result;
      if (campaign.id) {
        // Update existing campaign
        const { data, error } = await supabase
          .from('crm_campaigns')
          .update(campaignData)
          .eq('id', campaign.id)
          .select()
          .single();
        
        if (error) throw error;
        result = data;
      } else {
        // Create new campaign
        const { data, error } = await supabase
          .from('crm_campaigns')
          .insert([campaignData])
          .select()
          .single();
        
        if (error) throw error;
        result = data;
        
        setCampaign(prev => ({ ...prev, id: result.id }));
      }

      toast({
        title: "Success",
        description: campaign.id ? "Campaign updated successfully." : "Campaign created successfully."
      });

      // Navigate to campaign list or detail view
      navigate('/crm/campaigns');
      
    } catch (error) {
      console.error('Error saving campaign:', error);
      toast({
        title: "Error",
        description: "Failed to save campaign. Please try again.",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSchedule = async () => {
    if (!campaign.scheduled_at) {
      toast({
        title: "Validation Error",
        description: "Please select a schedule date and time.",
        variant: "destructive"
      });
      return;
    }

    const updatedCampaign = {
      ...campaign,
      status: 'scheduled' as const
    };

    setCampaign(updatedCampaign);
    await handleSave();
  };

  // Newsletter meta information
  const newsletterMeta: NewsletterMeta = useMemo(() => {
    const wordCount = campaign.content ? campaign.content.split(/\s+/).length : 0;
    return {
      theme: seasonalTemplate?.theme || 'General',
      estimatedReadTime: `${Math.max(1, Math.ceil(wordCount / 200))} min`,
      wordCount,
      tone: 'Professional'
    };
  }, [campaign.content, seasonalTemplate]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading campaign...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/crm/campaigns')}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Campaigns
          </Button>
          <div>
            <h1 className="text-2xl font-bold">
              {campaign.id ? 'Edit Campaign' : 'Create Campaign'}
            </h1>
            {seasonalTemplate && (
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="secondary">
                  <Sparkles className="w-3 h-3 mr-1" />
                  Week {seasonalTemplate.week_number}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  {seasonalTemplate.theme}
                </span>
              </div>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            onClick={handleSave}
            disabled={saving}
          >
            <Save className="w-4 h-4 mr-2" />
            {saving ? 'Saving...' : 'Save Draft'}
          </Button>
          <Button
            onClick={handleSchedule}
            disabled={saving || !campaign.scheduled_at}
          >
            <Send className="w-4 h-4 mr-2" />
            Schedule
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column - Campaign Builder */}
        <div className="space-y-6">
          <Tabs defaultValue="content" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="content">Content</TabsTrigger>
              <TabsTrigger value="settings">Settings</TabsTrigger>
              <TabsTrigger value="schedule">Schedule</TabsTrigger>
            </TabsList>

            <TabsContent value="content" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Campaign Content</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="name">Campaign Name</Label>
                    <Input
                      id="name"
                      value={campaign.name}
                      onChange={(e) => setCampaign(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="Enter campaign name"
                    />
                  </div>

                  <div>
                    <Label htmlFor="subject">Subject Line</Label>
                    <Input
                      id="subject"
                      value={campaign.subject_line}
                      onChange={(e) => setCampaign(prev => ({ ...prev, subject_line: e.target.value }))}
                      placeholder="Enter email subject line"
                    />
                  </div>

                  <div>
                    <Label htmlFor="preheader">Preheader Text</Label>
                    <Input
                      id="preheader"
                      value={campaign.preheader_text}
                      onChange={(e) => setCampaign(prev => ({ ...prev, preheader_text: e.target.value }))}
                      placeholder="Enter preheader text (optional)"
                    />
                  </div>

                  <div>
                    <Label htmlFor="content">Email Content</Label>
                    <Textarea
                      id="content"
                      value={campaign.content}
                      onChange={(e) => setCampaign(prev => ({ ...prev, content: e.target.value }))}
                      placeholder="Enter your email content here..."
                      className="min-h-[300px]"
                    />
                  </div>
                </CardContent>
              </Card>

              {seasonalTemplate && (
                <Card>
                  <CardHeader>
                    <CardTitle>Template Information</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div>
                        <Label className="text-sm font-medium">Theme</Label>
                        <p className="text-sm text-muted-foreground">{seasonalTemplate.theme}</p>
                      </div>
                      <div>
                        <Label className="text-sm font-medium">Seasonal Focus</Label>
                        <p className="text-sm text-muted-foreground">{seasonalTemplate.seasonal_focus}</p>
                      </div>
                      <div>
                        <Label className="text-sm font-medium">Target Audience Notes</Label>
                        <p className="text-sm text-muted-foreground">{seasonalTemplate.target_audience_notes}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="settings" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Campaign Settings</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="segment">Target Segment</Label>
                    <Select 
                      value={campaign.segment_id || ""} 
                      onValueChange={(value) => setCampaign(prev => ({ ...prev, segment_id: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select a segment" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">All Customers</SelectItem>
                        {segments.map((segment) => (
                          <SelectItem key={segment.id} value={segment.id}>
                            {segment.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="delivery">Delivery Method</Label>
                    <Select 
                      value={campaign.delivery_method} 
                      onValueChange={(value) => setCampaign(prev => ({ ...prev, delivery_method: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="shared_sender">Shared Sender</SelectItem>
                        <SelectItem value="custom_sender">Custom Sender</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="sender_name">Sender Name</Label>
                      <Input
                        id="sender_name"
                        value={campaign.sender_name}
                        onChange={(e) => setCampaign(prev => ({ ...prev, sender_name: e.target.value }))}
                        placeholder="From name"
                      />
                    </div>
                    <div>
                      <Label htmlFor="sender_email">Sender Email</Label>
                      <Input
                        id="sender_email"
                        value={campaign.sender_email}
                        onChange={(e) => setCampaign(prev => ({ ...prev, sender_email: e.target.value }))}
                        placeholder="from@example.com"
                        type="email"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="schedule" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Schedule Campaign</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="scheduled_at">Send Date & Time</Label>
                    <Input
                      id="scheduled_at"
                      type="datetime-local"
                      value={campaign.scheduled_at || ''}
                      onChange={(e) => setCampaign(prev => ({ ...prev, scheduled_at: e.target.value }))}
                    />
                  </div>

                  <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-lg">
                    <Calendar className="w-5 h-5 text-blue-600" />
                    <div>
                      <p className="text-sm font-medium text-blue-900">
                        {campaign.scheduled_at 
                          ? `Campaign will be sent on ${new Date(campaign.scheduled_at).toLocaleString()}`
                          : 'Select a date and time to schedule this campaign'
                        }
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* Right Column - Preview */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Email Preview</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="border rounded-lg p-4 bg-white">
                <EmailPreview
                  content={campaign.content}
                  subject={campaign.subject_line}
                  preheader={campaign.preheader_text}
                  senderName={campaign.sender_name}
                  meta={newsletterMeta}
                />
              </div>
            </CardContent>
          </Card>

          {/* Newsletter Layout Renderer */}
          {campaign.content && (
            <Card>
              <CardHeader>
                <CardTitle>Newsletter Layout</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="border rounded-lg overflow-hidden">
                  <LayoutRenderer
                    blocks={processedNewsletter.blocks}
                    meta={processedNewsletter.meta}
                    featuredImage={featuredImage}
                    loadingImages={loadingImages}
                  />
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};
