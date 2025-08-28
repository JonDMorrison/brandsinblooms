
import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { LayoutRenderer } from '@/components/crm/LayoutRenderer';
import { EmailPreview } from '@/components/crm/EmailPreview';
import { MagazineNewsletterDisplay } from '@/components/content-sidebar/MagazineNewsletterDisplay';
import { getSeasonalTemplates } from '@/utils/seasonalTemplateService';
import { ContentBlock, EmailBlock, AlignmentType, SpacingType, BlockType } from '@/types/emailBuilder';
import { NewsletterMeta } from '@/types/newsletter';
import { Send, Settings, Eye, Plus, Save, Calendar, User, Mail } from 'lucide-react';
import { toast } from 'sonner';

// Database types that match Supabase schema
interface DatabaseSeasonalTemplate {
  id: string;
  title: string;
  theme: string;
  week_number: number;
  seasonal_focus: string;
  content_ideas: string;
  created_at?: string;
  updated_at?: string;
}

// Component interface with required fields
interface SeasonalTemplate {
  id: string;
  title: string;
  description: string;
  theme: string;
  week_number: number;
  seasonal_focus: string;
  content_ideas: string;
  category?: string;
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
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [campaign, setCampaign] = useState<any>(null);
  const [blocks, setBlocks] = useState<ContentBlock[]>([]);
  const [selectedBlock, setSelectedBlock] = useState<ContentBlock | null>(null);

  // Campaign form data
  const [campaignData, setCampaignData] = useState({
    name: '',
    subject_line: '',
    sender_name: '',
    sender_email: '',
    status: 'draft' as const,
    scheduled_date: null as Date | null
  });

  // Block editor states
  const [selectedAlignment, setSelectedAlignment] = useState<AlignmentType>('left');
  const [selectedPadding, setSelectedPadding] = useState<SpacingType>('medium');
  const [selectedMargin, setSelectedMargin] = useState<SpacingType>('medium');

  // Load campaign data
  useEffect(() => {
    if (campaignSlug) {
      loadCampaign();
    } else {
      initializeNewCampaign();
    }
  }, [campaignSlug]);

  const loadCampaign = async () => {
    try {
      setLoading(true);
      
      // Check if campaignSlug is a UUID (existing campaign) or a slug (new campaign)
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      const isExistingCampaign = uuidRegex.test(campaignSlug || '');

      if (isExistingCampaign) {
        // Load existing CRM campaign
        const { data: crmCampaign, error: crmError } = await supabase
          .from('crm_campaigns')
          .select('*')
          .eq('id', campaignSlug)
          .single();

        if (crmError) throw crmError;

        setCampaign(crmCampaign);
        setCampaignData({
          name: crmCampaign.name || '',
          subject_line: crmCampaign.subject_line || '',
          sender_name: crmCampaign.sender_name || '',
          sender_email: crmCampaign.sender_email || '',
          status: crmCampaign.status || 'draft',
          scheduled_date: crmCampaign.scheduled_at ? new Date(crmCampaign.scheduled_at) : null
        });

        // Load existing blocks
        const { data: existingBlocks, error: blocksError } = await supabase
          .from('campaign_blocks')
          .select('*')
          .eq('campaign_id', campaignSlug)
          .order('order_index');

        if (blocksError) throw blocksError;

        const contentBlocks: ContentBlock[] = existingBlocks?.map((block: any) => ({
          id: block.id,
          type: block.block_type as BlockType,
          title: block.content?.title,
          content: block.content?.content,
          imageUrl: block.image_url || '',
          ctaText: block.cta_text || '',
          ctaUrl: block.cta_url || '',
          source: 'manual' as const,
          layout: 'full-width',
          alignment: 'left',
          padding: 'medium',
          margin: 'medium'
        })) || [];

        setBlocks(contentBlocks);
      } else {
        // Initialize from seasonal template or content task
        await initializeFromTemplate();
      }
    } catch (error) {
      console.error('Error loading campaign:', error);
      toast.error('Failed to load campaign');
    } finally {
      setLoading(false);
    }
  };

  const initializeNewCampaign = async () => {
    const type = searchParams.get('type');
    const title = searchParams.get('title');
    const description = searchParams.get('description');

    setCampaignData({
      name: title || 'New Campaign',
      subject_line: title || '',
      sender_name: 'Your Business',
      sender_email: 'hello@yourbusiness.com',
      status: 'draft' as const,
      scheduled_date: null
    });

    if (type === 'newsletter' && contentTaskId) {
      await initializeFromContentTask();
    }
  };

  const initializeFromTemplate = async () => {
    try {
      const templateId = searchParams.get('templateId');
      if (templateId === 'weekly-theme-40') {
        const templates = await getSeasonalTemplates(40);
        if (templates.length > 0) {
          const template = templates[0] as DatabaseSeasonalTemplate;
          const seasonalTemplate: SeasonalTemplate = {
            id: template.id,
            title: template.title,
            description: template.content_ideas || 'Seasonal content',
            theme: template.theme,
            week_number: template.week_number,
            seasonal_focus: template.seasonal_focus,
            content_ideas: template.content_ideas,
            category: 'weekly'
          };
          
          await createCampaignFromTemplate(seasonalTemplate);
        }
      }
    } catch (error) {
      console.error('Error initializing from template:', error);
    }
  };

  const initializeFromContentTask = async () => {
    if (!contentTaskId) return;

    try {
      const { data: contentTask, error } = await supabase
        .from('content_tasks')
        .select('*')
        .eq('id', contentTaskId)
        .single();

      if (error) throw error;

      if (contentTask?.ai_output) {
        // Process newsletter content into blocks
        const newsletterMeta: NewsletterMeta = {
          week_focus: campaignData.name,
          industry_context: 'Gardening and landscaping business',
          target_audience: 'Garden enthusiasts and homeowners',
          content_theme: 'Fall gardening preparation',
          estimated_read_time: '5 minutes'
        };

        // Create initial blocks from content
        const initialBlocks: ContentBlock[] = [
          {
            id: 'header-1',
            type: 'header',
            title: campaignData.name,
            content: 'Welcome to this week\'s newsletter',
            source: 'newsletter',
            layout: 'full-width',
            alignment: 'center',
            padding: 'large',
            margin: 'medium'
          },
          {
            id: 'content-1',
            type: 'text',
            title: 'Main Content',
            content: contentTask.ai_output,
            source: 'newsletter',
            layout: 'full-width',
            alignment: 'left',
            padding: 'medium',
            margin: 'medium'
          }
        ];

        setBlocks(initialBlocks);
      }
    } catch (error) {
      console.error('Error loading content task:', error);
      toast.error('Failed to load content task');
    }
  };

  const createCampaignFromTemplate = async (template: SeasonalTemplate) => {
    try {
      // Create CRM campaign
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error('Not authenticated');

      const { data: userProfile } = await supabase
        .from('users')
        .select('tenant_id')
        .eq('id', user.user.id)
        .single();

      const campaignPayload = {
        name: template.title,
        subject_line: `${template.title} - Week ${template.week_number}`,
        sender_name: 'Your Business',
        sender_email: 'hello@yourbusiness.com',
        status: 'draft' as const,
        tenant_id: userProfile?.tenant_id,
        user_id: user.user.id,
        metadata: {
          template_id: template.id,
          week_number: template.week_number,
          theme: template.theme
        }
      };

      const { data: newCampaign, error: campaignError } = await supabase
        .from('crm_campaigns')
        .insert(campaignPayload)
        .select()
        .single();

      if (campaignError) throw campaignError;

      setCampaign(newCampaign);
      setCampaignData({
        name: newCampaign.name,
        subject_line: newCampaign.subject_line || '',
        sender_name: newCampaign.sender_name || '',
        sender_email: newCampaign.sender_email || '',
        status: newCampaign.status || 'draft',
        scheduled_date: null
      });

      // Create initial content blocks
      const contentIdeas = Array.isArray(template.content_ideas) 
        ? template.content_ideas 
        : template.content_ideas.split('\n').filter(idea => idea.trim());

      const initialBlocks: ContentBlock[] = [
        {
          id: 'header-1',
          type: 'header',
          title: template.title,
          content: `Week ${template.week_number}: ${template.theme}`,
          source: 'template',
          layout: 'full-width',
          alignment: 'center',
          padding: 'large',
          margin: 'medium'
        },
        {
          id: 'content-1',
          type: 'text',
          title: 'Seasonal Focus',
          content: template.seasonal_focus,
          source: 'template',
          layout: 'full-width',
          alignment: 'left',
          padding: 'medium',
          margin: 'medium'
        },
        {
          id: 'content-2',
          type: 'text',
          title: 'Content Ideas',
          content: contentIdeas.join('\n\n'),
          source: 'template',
          layout: 'full-width',
          alignment: 'left',
          padding: 'medium',
          margin: 'medium'
        }
      ];

      setBlocks(initialBlocks);
      
      // Navigate to the new campaign
      navigate(`/crm/campaigns/builder/${newCampaign.id}`);
      toast.success('Campaign created from template');
    } catch (error) {
      console.error('Error creating campaign from template:', error);
      toast.error('Failed to create campaign');
    }
  };

  const saveCampaign = async () => {
    try {
      setLoading(true);

      if (!campaign?.id) {
        toast.error('No campaign to save');
        return;
      }

      // Update campaign metadata
      const { error: campaignError } = await supabase
        .from('crm_campaigns')
        .update({
          name: campaignData.name,
          subject_line: campaignData.subject_line,
          sender_name: campaignData.sender_name,
          sender_email: campaignData.sender_email,
          status: campaignData.status,
          scheduled_at: campaignData.scheduled_date?.toISOString()
        })
        .eq('id', campaign.id);

      if (campaignError) throw campaignError;

      // Save blocks to database
      for (const block of blocks) {
        const blockPayload = {
          campaign_id: campaign.id,
          block_type: block.type,
          content: {
            title: block.title,
            content: block.content,
            alignment: block.alignment,
            padding: block.padding,
            margin: block.margin
          },
          image_url: block.imageUrl,
          cta_text: block.ctaText,
          cta_url: block.ctaUrl,
          order_index: blocks.indexOf(block),
          source: block.source
        };

        const { error: blockError } = await supabase
          .from('campaign_blocks')
          .upsert(blockPayload);

        if (blockError) throw blockError;
      }

      toast.success('Campaign saved successfully');
    } catch (error) {
      console.error('Error saving campaign:', error);
      toast.error('Failed to save campaign');
    } finally {
      setLoading(false);
    }
  };

  const addBlock = (type: BlockType) => {
    const newBlock: ContentBlock = {
      id: `block-${Date.now()}`,
      type,
      title: `New ${type} block`,
      content: `Content for ${type} block`,
      source: 'manual',
      layout: 'full-width',
      alignment: 'left',
      padding: 'medium',
      margin: 'medium'
    };

    setBlocks([...blocks, newBlock]);
    setSelectedBlock(newBlock);
  };

  const updateBlock = (blockId: string, updates: Partial<ContentBlock>) => {
    setBlocks(blocks.map(block => 
      block.id === blockId ? { ...block, ...updates } : block
    ));
    
    if (selectedBlock?.id === blockId) {
      setSelectedBlock({ ...selectedBlock, ...updates });
    }
  };

  const deleteBlock = (blockId: string) => {
    setBlocks(blocks.filter(block => block.id !== blockId));
    if (selectedBlock?.id === blockId) {
      setSelectedBlock(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-muted-foreground">Loading campaign...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Campaign Creator</h1>
          <p className="text-muted-foreground">Create and manage your email campaigns</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate('/crm/campaigns')}>
            Cancel
          </Button>
          <Button onClick={saveCampaign} disabled={loading}>
            <Save className="h-4 w-4 mr-2" />
            Save Campaign
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Panel - Campaign Settings */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Campaign Settings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="campaign-name">Campaign Name</Label>
                <Input
                  id="campaign-name"
                  value={campaignData.name}
                  onChange={(e) => setCampaignData({ ...campaignData, name: e.target.value })}
                  placeholder="Enter campaign name"
                />
              </div>
              
              <div>
                <Label htmlFor="subject-line">Subject Line</Label>
                <Input
                  id="subject-line"
                  value={campaignData.subject_line}
                  onChange={(e) => setCampaignData({ ...campaignData, subject_line: e.target.value })}
                  placeholder="Enter email subject"
                />
              </div>

              <div>
                <Label htmlFor="sender-name">Sender Name</Label>
                <Input
                  id="sender-name"
                  value={campaignData.sender_name}
                  onChange={(e) => setCampaignData({ ...campaignData, sender_name: e.target.value })}
                  placeholder="Your Business Name"
                />
              </div>

              <div>
                <Label htmlFor="sender-email">Sender Email</Label>
                <Input
                  id="sender-email"
                  type="email"
                  value={campaignData.sender_email}
                  onChange={(e) => setCampaignData({ ...campaignData, sender_email: e.target.value })}
                  placeholder="hello@yourbusiness.com"
                />
              </div>

              <Separator />

              <div>
                <Label>Add Content Block</Label>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  <Button variant="outline" size="sm" onClick={() => addBlock('header')}>
                    Header
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => addBlock('text')}>
                    Text
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => addBlock('image')}>
                    Image
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => addBlock('button')}>
                    Button
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Block Editor */}
          {selectedBlock && (
            <Card>
              <CardHeader>
                <CardTitle>Edit Block</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Title</Label>
                  <Input
                    value={selectedBlock.title || ''}
                    onChange={(e) => updateBlock(selectedBlock.id, { title: e.target.value })}
                    placeholder="Block title"
                  />
                </div>

                <div>
                  <Label>Content</Label>
                  <Textarea
                    value={selectedBlock.content || ''}
                    onChange={(e) => updateBlock(selectedBlock.id, { content: e.target.value })}
                    placeholder="Block content"
                    rows={4}
                  />
                </div>

                <div>
                  <Label>Alignment</Label>
                  <Select
                    value={selectedBlock.alignment || 'left'}
                    onValueChange={(value: AlignmentType) => {
                      setSelectedAlignment(value);
                      updateBlock(selectedBlock.id, { alignment: value });
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="left">Left</SelectItem>
                      <SelectItem value="center">Center</SelectItem>
                      <SelectItem value="right">Right</SelectItem>
                      <SelectItem value="justify">Justify</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Padding</Label>
                  <Select
                    value={selectedBlock.padding || 'medium'}
                    onValueChange={(value: SpacingType) => {
                      setSelectedPadding(value);
                      updateBlock(selectedBlock.id, { padding: value });
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      <SelectItem value="small">Small</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="large">Large</SelectItem>
                      <SelectItem value="extra-large">Extra Large</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Margin</Label>
                  <Select
                    value={selectedBlock.margin || 'medium'}
                    onValueChange={(value: SpacingType) => {
                      setSelectedMargin(value);
                      updateBlock(selectedBlock.id, { margin: value });
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      <SelectItem value="small">Small</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="large">Large</SelectItem>
                      <SelectItem value="extra-large">Extra Large</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => deleteBlock(selectedBlock.id)}
                >
                  Delete Block
                </Button>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Center Panel - Email Builder */}
        <div className="lg:col-span-2">
          <Tabs defaultValue="builder" className="space-y-4">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="builder">Email Builder</TabsTrigger>
              <TabsTrigger value="preview">Preview</TabsTrigger>
            </TabsList>

            <TabsContent value="builder" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Email Content</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {blocks.length === 0 ? (
                      <div className="text-center py-12 border-2 border-dashed border-muted-foreground/25 rounded-lg">
                        <Mail className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                        <h3 className="text-lg font-medium mb-2">No content blocks yet</h3>
                        <p className="text-muted-foreground mb-4">
                          Add content blocks to start building your email
                        </p>
                        <Button onClick={() => addBlock('header')}>
                          <Plus className="h-4 w-4 mr-2" />
                          Add Your First Block
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {blocks.map((block) => (
                          <div
                            key={block.id}
                            className={`border rounded-lg p-4 cursor-pointer transition-colors ${
                              selectedBlock?.id === block.id
                                ? 'border-primary bg-primary/5'
                                : 'border-muted hover:border-muted-foreground/25'
                            }`}
                            onClick={() => setSelectedBlock(block)}
                          >
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <Badge variant="outline">{block.type}</Badge>
                                <span className="font-medium">{block.title}</span>
                              </div>
                            </div>
                            <LayoutRenderer
                              block={block}
                              editable={false}
                              className="pointer-events-none"
                            />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="preview">
              <EmailPreview
                blocks={blocks}
                campaignName={campaignData.name}
                subjectLine={campaignData.subject_line}
                senderName={campaignData.sender_name}
                senderEmail={campaignData.sender_email}
              />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
};
