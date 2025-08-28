
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { ContentBlock, AlignmentType, SpacingType } from '@/types/emailBuilder';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { ArrowLeft, Save, Send, Eye, Settings, Mail, Plus, Trash2 } from 'lucide-react';
import { EmailBlockEditor } from './EmailBlockEditor';
import { EmailPreview } from './EmailPreview';
import { LayoutRenderer } from '../crm/LayoutRenderer';
import { toast } from 'sonner';

// Database interfaces
interface DatabaseCampaign {
  id: string;
  name: string;
  subject_line: string | null;
  sender_name: string | null;
  sender_email: string | null;
  status: string;
  scheduled_at: string | null;
  created_at: string;
  updated_at: string;
  tenant_id: string | null;
  user_id: string | null;
  content: string | null;
  preheader_text: string | null;
  metadata: any;
}

interface DatabaseContentTask {
  id: string;
  title?: string;
  description?: string;
  week_number?: number;
  ai_output: string | null;
  campaign_id: string | null;
  status: string;
  created_at: string;
  scheduled_date: string | null;
  user_id: string | null;
  tenant_id: string | null;
  post_type: string | null;
  hashtags: string | null;
  image_idea: string | null;
  notes: string | null;
  assigned_user_id: string | null;
  created_by_user_id: string | null;
  holiday_id: string | null;
  attachments: any;
  image_url: string | null;
  image_source: string | null;
  image_metadata: any;
  platform_post_id: string | null;
  platform_post_url: string | null;
  posting_attempts: number | null;
  posting_disabled_at: string | null;
  last_posting_error: string | null;
  deleted_at: string | null;
  linked_crm_campaign_id: string | null;
}

interface DatabaseCampaignBlock {
  id: string;
  campaign_id: string;
  block_type: string;
  content: any;
  image_url: string | null;
  cta_url: string | null;
  cta_text: string | null;
  source: string | null;
  persona_tag: string | null;
  order_index: number;
  created_at: string;
  updated_at: string;
}

interface CRMCampaignCreatorProps {
  campaignSlug?: string;
  contentTaskId?: string | null;
}

export const CRMCampaignCreator: React.FC<CRMCampaignCreatorProps> = ({
  campaignSlug,
  contentTaskId
}) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  
  // Campaign data
  const [campaignName, setCampaignName] = useState('');
  const [subjectLine, setSubjectLine] = useState('');
  const [senderName, setSenderName] = useState('Your Garden Center');
  const [senderEmail, setSenderEmail] = useState('newsletter@yourgardencenter.com');
  const [preheaderText, setPreheaderText] = useState('');
  const [campaignStatus, setCampaignStatus] = useState<'draft' | 'scheduled' | 'sent'>('draft');
  const [scheduledDate, setScheduledDate] = useState('');
  
  // Content blocks
  const [blocks, setBlocks] = useState<ContentBlock[]>([]);
  const [activeTab, setActiveTab] = useState('content');
  
  // Campaign ID for existing campaigns
  const [campaignId, setCampaignId] = useState<string | null>(null);

  // Load existing campaign or create from content task
  useEffect(() => {
    const loadCampaignData = async () => {
      if (!campaignSlug) return;

      setLoading(true);
      try {
        // Check if it's an existing campaign (UUID format)
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        const isExistingCampaign = uuidRegex.test(campaignSlug);

        if (isExistingCampaign) {
          // Load existing campaign
          const { data: campaign, error: campaignError } = await supabase
            .from('crm_campaigns')
            .select('*')
            .eq('id', campaignSlug)
            .single();

          if (campaignError) throw campaignError;

          if (campaign) {
            const dbCampaign = campaign as DatabaseCampaign;
            setCampaignId(dbCampaign.id);
            setCampaignName(dbCampaign.name || '');
            setSubjectLine(dbCampaign.subject_line || '');
            setSenderName(dbCampaign.sender_name || 'Your Garden Center');
            setSenderEmail(dbCampaign.sender_email || 'newsletter@yourgardencenter.com');
            setCampaignStatus(dbCampaign.status as 'draft' | 'scheduled' | 'sent');
            setScheduledDate(dbCampaign.scheduled_at || '');
            setPreheaderText(dbCampaign.preheader_text || '');

            // Load campaign blocks
            const { data: campaignBlocks, error: blocksError } = await supabase
              .from('campaign_blocks')
              .select('*')
              .eq('campaign_id', dbCampaign.id)
              .order('order_index');

            if (blocksError) throw blocksError;

            if (campaignBlocks) {
              const contentBlocks: ContentBlock[] = campaignBlocks.map((block: DatabaseCampaignBlock) => ({
                id: block.id,
                type: block.block_type as ContentBlock['type'],
                title: block.content?.title || '',
                content: block.content?.content || '',
                imageUrl: block.image_url || '',
                ctaText: block.cta_text || '',
                ctaUrl: block.cta_url || '',
                source: (block.source || 'manual') as ContentBlock['source'],
                personaTag: block.persona_tag || undefined,
                layout: 'full-width',
                collapsed: false,
                alignment: 'left',
                padding: 'medium',
                margin: 'medium'
              }));
              setBlocks(contentBlocks);
            }
          }
        } else if (contentTaskId) {
          // Create campaign from content task
          const { data: contentTask, error: taskError } = await supabase
            .from('content_tasks')
            .select('*')
            .eq('id', contentTaskId)
            .single();

          if (taskError) throw taskError;

          if (contentTask) {
            // Use type assertion with proper interface
            const task = contentTask as unknown as DatabaseContentTask;
            
            // Set campaign name from task data or default
            const taskTitle = task.title || campaignSlug.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
            setCampaignName(taskTitle);
            setSubjectLine(`${taskTitle} - ${new Date().toLocaleDateString()}`);

            // Parse AI output to create initial blocks
            if (task.ai_output) {
              const initialBlocks = parseContentToBlocks(task.ai_output, taskTitle);
              setBlocks(initialBlocks);
            }
          }
        }
      } catch (error) {
        console.error('Error loading campaign data:', error);
        toast.error('Failed to load campaign data');
      } finally {
        setLoading(false);
      }
    };

    loadCampaignData();
  }, [campaignSlug, contentTaskId]);

  const parseContentToBlocks = (content: string, title: string): ContentBlock[] => {
    const blocks: ContentBlock[] = [];
    
    // Add header block
    blocks.push({
      id: `block_${Date.now()}_header`,
      type: 'newsletter-header',
      title: title,
      content: '',
      source: 'newsletter',
      layout: 'full-width',
      collapsed: false,
      alignment: 'center',
      padding: 'large',
      margin: 'medium'
    });

    // Split content into sections and create text blocks
    const sections = content.split('\n\n').filter(section => section.trim());
    
    sections.forEach((section, index) => {
      if (section.trim()) {
        blocks.push({
          id: `block_${Date.now()}_${index}`,
          type: 'text',
          title: '',
          content: section.trim(),
          source: 'newsletter',
          layout: 'full-width',
          collapsed: false,
          alignment: 'left',
          padding: 'medium',
          margin: 'medium'
        });
      }
    });

    return blocks;
  };

  const saveCampaign = async (isDraft = true) => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      let finalCampaignId = campaignId;

      // Create or update campaign
      const campaignData = {
        name: campaignName,
        subject_line: subjectLine,
        sender_name: senderName,
        sender_email: senderEmail,
        status: isDraft ? 'draft' : campaignStatus,
        scheduled_at: scheduledDate || null,
        preheader_text: preheaderText,
        user_id: user.id,
        tenant_id: user.id, // Using user.id as tenant_id for now
        updated_at: new Date().toISOString()
      };

      if (campaignId) {
        // Update existing campaign
        const { error: updateError } = await supabase
          .from('crm_campaigns')
          .update(campaignData)
          .eq('id', campaignId);

        if (updateError) throw updateError;
      } else {
        // Create new campaign
        const { data: newCampaign, error: createError } = await supabase
          .from('crm_campaigns')
          .insert({
            ...campaignData,
            created_at: new Date().toISOString()
          })
          .select()
          .single();

        if (createError) throw createError;
        if (!newCampaign) throw new Error('Failed to create campaign');

        finalCampaignId = newCampaign.id;
        setCampaignId(finalCampaignId);
      }

      // Save blocks
      if (finalCampaignId) {
        // Delete existing blocks
        const { error: deleteError } = await supabase
          .from('campaign_blocks')
          .delete()
          .eq('campaign_id', finalCampaignId);

        if (deleteError) throw deleteError;

        // Insert new blocks
        if (blocks.length > 0) {
          const blockData = blocks.map((block, index) => ({
            campaign_id: finalCampaignId,
            block_type: block.type,
            content: {
              title: block.title,
              content: block.content,
              alignment: block.alignment,
              padding: block.padding,
              margin: block.margin
            },
            image_url: block.imageUrl || null,
            cta_url: block.ctaUrl || null,
            cta_text: block.ctaText || null,
            source: block.source || 'manual',
            persona_tag: block.personaTag || null,
            order_index: index,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }));

          const { error: blocksError } = await supabase
            .from('campaign_blocks')
            .insert(blockData);

          if (blocksError) throw blocksError;
        }
      }

      toast.success(isDraft ? 'Campaign saved as draft' : 'Campaign saved');
    } catch (error) {
      console.error('Error saving campaign:', error);
      toast.error('Failed to save campaign');
    } finally {
      setSaving(false);
    }
  };

  const handleBack = () => {
    navigate('/crm/campaigns');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p>Loading campaign...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={handleBack}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Campaigns
          </Button>
          <div>
            <h1 className="text-2xl font-bold">
              {campaignId ? 'Edit Campaign' : 'Create Campaign'}
            </h1>
            <p className="text-muted-foreground">
              {campaignId ? 'Update your email campaign' : 'Build your email campaign'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => saveCampaign(true)} disabled={saving}>
            <Save className="h-4 w-4 mr-2" />
            {saving ? 'Saving...' : 'Save Draft'}
          </Button>
          <Button onClick={() => saveCampaign(false)} disabled={saving}>
            <Send className="h-4 w-4 mr-2" />
            Save Campaign
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Panel - Campaign Settings & Content */}
        <div className="lg:col-span-2 space-y-6">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="content">Content</TabsTrigger>
              <TabsTrigger value="settings">Settings</TabsTrigger>
              <TabsTrigger value="schedule">Schedule</TabsTrigger>
            </TabsList>

            <TabsContent value="content" className="space-y-6">
              {/* Campaign Basic Info */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Mail className="h-5 w-5" />
                    Campaign Details
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="campaignName">Campaign Name</Label>
                    <Input
                      id="campaignName"
                      value={campaignName}
                      onChange={(e) => setCampaignName(e.target.value)}
                      placeholder="Enter campaign name"
                    />
                  </div>
                  <div>
                    <Label htmlFor="subjectLine">Subject Line</Label>
                    <Input
                      id="subjectLine"
                      value={subjectLine}
                      onChange={(e) => setSubjectLine(e.target.value)}
                      placeholder="Enter email subject line"
                    />
                  </div>
                  <div>
                    <Label htmlFor="preheader">Preheader Text</Label>
                    <Input
                      id="preheader"
                      value={preheaderText}
                      onChange={(e) => setPreheaderText(e.target.value)}
                      placeholder="Preview text that appears after subject line"
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Content Blocks */}
              <Card>
                <CardHeader>
                  <CardTitle>Email Content</CardTitle>
                </CardHeader>
                <CardContent>
                  <EmailBlockEditor 
                    blocks={blocks}
                    onBlocksChange={setBlocks}
                  />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="settings" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Settings className="h-5 w-5" />
                    Sender Settings
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="senderName">Sender Name</Label>
                    <Input
                      id="senderName"
                      value={senderName}
                      onChange={(e) => setSenderName(e.target.value)}
                      placeholder="Your Garden Center"
                    />
                  </div>
                  <div>
                    <Label htmlFor="senderEmail">Sender Email</Label>
                    <Input
                      id="senderEmail"
                      value={senderEmail}
                      onChange={(e) => setSenderEmail(e.target.value)}
                      placeholder="newsletter@yourgardencenter.com"
                    />
                  </div>
                  
                  <Separator />
                  
                  <div>
                    <Label>Campaign Status</Label>
                    <Select value={campaignStatus} onValueChange={(value: 'draft' | 'scheduled' | 'sent') => setCampaignStatus(value)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="draft">Draft</SelectItem>
                        <SelectItem value="scheduled">Scheduled</SelectItem>
                        <SelectItem value="sent">Sent</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="schedule" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Schedule Campaign</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="scheduledDate">Scheduled Date & Time</Label>
                    <Input
                      id="scheduledDate"
                      type="datetime-local"
                      value={scheduledDate}
                      onChange={(e) => setScheduledDate(e.target.value)}
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* Right Panel - Preview */}
        <div className="lg:col-span-1">
          <EmailPreview
            blocks={blocks}
            campaignName={campaignName}
            subjectLine={subjectLine}
            senderName={senderName}
            senderEmail={senderEmail}
          />
        </div>
      </div>
    </div>
  );
};
