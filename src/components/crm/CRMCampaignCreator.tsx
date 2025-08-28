import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { LayoutRenderer } from './LayoutRenderer';
import { EmailPreview } from './EmailPreview';
import { EmailBlockRenderer } from './EmailBlockRenderer';
import { useToast } from '@/hooks/use-toast';
import { useNewsletterRenderer } from '@/hooks/useNewsletterRenderer';
import { supabase } from '@/integrations/supabase/client';
import { ContentBlock, EmailBlock, GlobalSettings } from '@/types/emailBuilder';
import { NewsletterIdea } from '@/types/newsletter';
import { 
  Save, 
  Send, 
  Eye, 
  Plus, 
  Settings, 
  Calendar,
  Users,
  Mail,
  BookOpen,
  Sparkles,
  Clock,
  Target,
  Leaf,
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Trash2,
  Edit3,
  Copy,
  ExternalLink
} from 'lucide-react';

interface BlockSettingsProps {
  block: ContentBlock;
  onUpdate: (updates: Partial<ContentBlock>) => void;
}

const BlockSettings: React.FC<BlockSettingsProps> = ({ block, onUpdate }) => {
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    onUpdate({ [name]: value });
  };

  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = e.target;
    onUpdate({ [name]: checked });
  };

  const handleSelectChange = (name: string, value: string) => {
    onUpdate({ [name]: value });
  };

  return (
    <div className="space-y-4">
      {/* Visibility Setting */}
      <div>
        <Label htmlFor="visible">Visible</Label>
        <Switch
          id="visible"
          name="visible"
          checked={block.visible !== false}
          onCheckedChange={(checked) => onUpdate({ visible: checked })}
        />
      </div>

      {/* Title Input */}
      <div>
        <Label htmlFor="title">Title</Label>
        <Input
          type="text"
          id="title"
          name="title"
          value={block.title || ''}
          onChange={handleInputChange}
          placeholder="Block Title"
        />
      </div>

      {/* Content Input */}
      <div>
        <Label htmlFor="content">Content</Label>
        <Textarea
          id="content"
          name="content"
          value={block.content || ''}
          onChange={handleInputChange}
          placeholder="Block Content"
          rows={4}
        />
      </div>

      {/* Alignment Selection */}
      <div>
        <Label>Alignment</Label>
        <Select value={block.alignment || 'left'} onValueChange={(value) => handleSelectChange('alignment', value)}>
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

      {/* Padding Selection */}
      <div>
        <Label>Padding</Label>
        <Select value={block.padding || 'medium'} onValueChange={(value) => handleSelectChange('padding', value)}>
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

      {/* Margin Selection */}
      <div>
        <Label>Margin</Label>
        <Select value={block.margin || 'medium'} onValueChange={(value) => handleSelectChange('margin', value)}>
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
    </div>
  );
};

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
  description: string;
  category: string;
  theme: string;
  prompt: string;
  content_ideas: string[];
  seasonal_focus: string;
  target_audience_notes: string;
  week_number: number;
  platform_specific_notes: any;
}

interface NewsletterMeta {
  theme: string;
  category: string;
  estimatedReadTime: string;
  difficulty: string;
  keyPoints: string[];
  callToActions: string[];
}

interface CRMCampaignCreatorProps {
  campaignSlug?: string;
  contentTaskId?: string | null;
}

const defaultGlobalSettings: GlobalSettings = {
  fontFamily: 'Arial, sans-serif',
  fontSize: '16px',
  buttonStyle: {
    cornerRadius: '6px',
    backgroundColor: '#22C55E',
    textColor: '#FFFFFF'
  },
  headerStyle: {
    backgroundColor: '#F8F9FA',
    textColor: '#1F2937'
  },
  footerStyle: {
    backgroundColor: '#F8F9FA', 
    textColor: '#6B7280'
  }
};

export const CRMCampaignCreator: React.FC<CRMCampaignCreatorProps> = ({ 
  campaignSlug, 
  contentTaskId 
}) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  
  // Campaign state
  const [campaignName, setCampaignName] = useState('');
  const [campaignDescription, setCampaignDescription] = useState('');
  const [subjectLine, setSubjectLine] = useState('');
  const [senderName, setSenderName] = useState('Garden Center Pro');
  const [senderEmail, setSenderEmail] = useState('hello@gardencenterpro.com');
  const [status, setStatus] = useState('draft' as const);
  const [scheduledDate, setScheduledDate] = useState('');
  
  // Content state
  const [blocks, setBlocks] = useState<ContentBlock[]>([]);
  const [selectedBlock, setSelectedBlock] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('compose');
  const [showPreview, setShowPreview] = useState(false);
  
  // Newsletter conversion state
  const [newsletterContent, setNewsletterContent] = useState('');
  const [isConverting, setIsConverting] = useState(false);
  const [conversionComplete, setConversionComplete] = useState(false);
  const [newsletterMeta, setNewsletterMeta] = useState<NewsletterMeta | null>(null);
  
  // Template state
  const [availableTemplates, setAvailableTemplates] = useState<SeasonalTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<SeasonalTemplate | null>(null);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  
  // Loading states
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(false);

  // Check if this is a newsletter campaign from URL parameters
  const isNewsletterCampaign = searchParams.get('type') === 'newsletter';
  const templateId = searchParams.get('templateId');

  // Load seasonal templates
  const loadSeasonalTemplates = useCallback(async () => {
    if (loadingTemplates) return;
    
    setLoadingTemplates(true);
    try {
      const { data, error } = await supabase
        .from('master_campaign_templates')
        .select('*')
        .order('week_number', { ascending: true });

      if (error) throw error;

      const templates: SeasonalTemplate[] = (data as DatabaseSeasonalTemplate[]).map(template => ({
        id: template.id,
        title: template.title,
        description: `${template.seasonal_focus} - Week ${template.week_number}`,
        category: 'weekly',
        theme: template.theme,
        prompt: template.prompt,
        content_ideas: typeof template.content_ideas === 'string' 
          ? template.content_ideas.split('\n').filter(Boolean)
          : [],
        seasonal_focus: template.seasonal_focus,
        target_audience_notes: template.target_audience_notes,
        week_number: template.week_number,
        platform_specific_notes: template.platform_specific_notes
      }));

      setAvailableTemplates(templates);
      
      // Auto-select template if templateId is provided
      if (templateId) {
        const template = templates.find(t => t.id === templateId);
        if (template) {
          setSelectedTemplate(template);
          setCampaignName(template.title);
          setCampaignDescription(template.description);
        }
      }
    } catch (error) {
      console.error('Error loading seasonal templates:', error);
      toast({
        title: "Error Loading Templates",
        description: "Failed to load seasonal templates. Please try again.",
        variant: "destructive"
      });
    } finally {
      setLoadingTemplates(false);
    }
  }, [templateId, loadingTemplates, toast]);

  // Load existing campaign or initialize new one
  useEffect(() => {
    const initializeCampaign = async () => {
      if (!campaignSlug) return;
      
      // Check if this is an existing campaign (UUID format)
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      const isExistingCampaign = uuidRegex.test(campaignSlug);
      
      if (isExistingCampaign) {
        await loadExistingCampaign(campaignSlug);
      } else {
        // Initialize new campaign with URL parameters
        const title = searchParams.get('title');
        const description = searchParams.get('description');
        
        if (title) setCampaignName(decodeURIComponent(title));
        if (description) setCampaignDescription(decodeURIComponent(description));
      }
    };

    initializeCampaign();
  }, [campaignSlug, searchParams]);

  // Load seasonal templates on mount
  useEffect(() => {
    loadSeasonalTemplates();
  }, [loadSeasonalTemplates]);

  // Newsletter content processing
  const {
    processedNewsletter,
    images,
    featuredImage,
    loadingImages,
    topicValidation
  } = useNewsletterRenderer({
    content: newsletterContent,
    campaignTitle: campaignName,
    contentTaskId: contentTaskId || undefined,
    format: 'magazine'
  });

  // Auto-convert newsletter content when available
  useEffect(() => {
    if (isNewsletterCampaign && contentTaskId && !conversionComplete && !isConverting) {
      handleNewsletterConversion();
    }
  }, [isNewsletterCampaign, contentTaskId, conversionComplete, isConverting]);

  const loadExistingCampaign = async (campaignId: string) => {
    setLoading(true);
    try {
      // Load campaign details
      const { data: campaign, error: campaignError } = await supabase
        .from('campaigns')
        .select('*')
        .eq('id', campaignId)
        .single();

      if (campaignError) throw campaignError;

      setCampaignName(campaign.name || '');
      setCampaignDescription(campaign.description || '');
      setSubjectLine(campaign.subject_line || '');
      setSenderName(campaign.sender_name || 'Garden Center Pro');
      setSenderEmail(campaign.sender_email || 'hello@gardencenterpro.com');
      setStatus(campaign.status || 'draft');
      setScheduledDate(campaign.scheduled_date || '');

      // Load campaign blocks
      const { data: emailBlocks, error: blocksError } = await supabase
        .from('email_blocks')
        .select('*')
        .eq('campaign_id', campaignId)
        .order('order_index');

      if (blocksError) throw blocksError;

      // Convert EmailBlocks to ContentBlocks
      const contentBlocks: ContentBlock[] = emailBlocks.map((block: EmailBlock) => ({
        id: block.id,
        type: block.block_type,
        title: block.content?.title || '',
        content: block.content?.content || block.content?.body || '',
        imageUrl: block.image_url || '',
        ctaText: block.cta_text || '',
        ctaUrl: block.cta_url || '',
        source: block.source as 'newsletter' | 'ai' | 'template' | 'manual' || 'manual',
        personaTag: block.persona_tag || '',
        visible: true,
        layout: 'full-width',
        alignment: 'left',
        padding: 'medium',
        margin: 'medium'
      }));

      setBlocks(contentBlocks);
    } catch (error) {
      console.error('Error loading campaign:', error);
      toast({
        title: "Error Loading Campaign",
        description: "Failed to load campaign data. Please try again.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleNewsletterConversion = async () => {
    if (!contentTaskId || isConverting) return;

    setIsConverting(true);
    try {
      // Load content task
      const { data: contentTask, error } = await supabase
        .from('content_tasks')
        .select('*')
        .eq('id', contentTaskId)
        .single();

      if (error) throw error;

      if (contentTask?.content) {
        setNewsletterContent(contentTask.content);
        
        // Extract meta information
        const meta: NewsletterMeta = {
          theme: contentTask.theme || 'general',
          category: 'newsletter',
          estimatedReadTime: '3-5 minutes',
          difficulty: 'beginner',
          keyPoints: [],
          callToActions: []
        };
        
        setNewsletterMeta(meta);
        setConversionComplete(true);
        
        toast({
          title: "Newsletter Content Loaded",
          description: "Successfully loaded newsletter content for conversion.",
        });
      }
    } catch (error) {
      console.error('Error loading content task:', error);
      toast({
        title: "Error Loading Content",
        description: "Failed to load newsletter content. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsConverting(false);
    }
  };

  const handleConvertToBlocks = () => {
    if (!processedNewsletter.blocks.length) return;

    const newBlocks: ContentBlock[] = processedNewsletter.blocks.map((block, index) => ({
      id: `block-${Date.now()}-${index}`,
      type: block.type as ContentBlock['type'],
      title: block.title || '',
      content: block.content || '',
      imageUrl: block.imageUrl || '',
      ctaText: block.ctaText || '',
      ctaUrl: block.ctaUrl || '',
      source: 'newsletter',
      visible: true,
      layout: 'full-width',
      alignment: 'left',
      padding: 'medium',
      margin: 'medium'
    }));

    setBlocks(newBlocks);
    setActiveTab('compose');
    
    toast({
      title: "Content Converted",
      description: `Successfully converted newsletter content into ${newBlocks.length} email blocks.`,
    });
  };

  const handleSaveDraft = async () => {
    setSaving(true);
    try {
      const campaignData = {
        name: campaignName,
        description: campaignDescription,
        subject_line: subjectLine,
        sender_name: senderName,
        sender_email: senderEmail,
        status: 'draft' as const,
        scheduled_date: scheduledDate || null,
        updated_at: new Date().toISOString()
      };

      let campaignId = campaignSlug;

      // Check if this is an existing campaign
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      const isExistingCampaign = campaignSlug && uuidRegex.test(campaignSlug);

      if (isExistingCampaign) {
        // Update existing campaign
        const { error } = await supabase
          .from('campaigns')
          .update(campaignData)
          .eq('id', campaignSlug);

        if (error) throw error;
      } else {
        // Create new campaign
        const { data, error } = await supabase
          .from('campaigns')
          .insert([campaignData])
          .select()
          .single();

        if (error) throw error;
        campaignId = data.id;
      }

      // Save email blocks
      if (blocks.length > 0 && campaignId) {
        // Delete existing blocks for this campaign
        await supabase
          .from('email_blocks')
          .delete()
          .eq('campaign_id', campaignId);

        // Insert new blocks
        const emailBlocks: Omit<EmailBlock, 'created_at' | 'updated_at'>[] = blocks.map((block, index) => ({
          id: block.id,
          campaign_id: campaignId,
          block_type: block.type,
          content: {
            title: block.title,
            content: block.content,
            body: block.content
          },
          image_url: block.imageUrl || null,
          cta_text: block.ctaText || null,
          cta_url: block.ctaUrl || null,
          source: block.source || 'manual',
          persona_tag: block.personaTag || null,
          order_index: index
        }));

        const { error: blocksError } = await supabase
          .from('email_blocks')
          .insert(emailBlocks);

        if (blocksError) throw blocksError;
      }

      toast({
        title: "Campaign Saved",
        description: "Your campaign has been saved as a draft.",
      });

      // Navigate to the saved campaign if it's new
      if (!isExistingCampaign && campaignId) {
        navigate(`/crm/campaigns/${campaignId}`);
      }
    } catch (error) {
      console.error('Error saving campaign:', error);
      toast({
        title: "Error Saving Campaign",
        description: "Failed to save campaign. Please try again.",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  const addBlock = (type: ContentBlock['type']) => {
    const newBlock: ContentBlock = {
      id: `block-${Date.now()}`,
      type,
      title: '',
      content: '',
      source: 'manual',
      visible: true,
      layout: 'full-width',
      alignment: 'left',
      padding: 'medium',
      margin: 'medium'
    };

    setBlocks([...blocks, newBlock]);
    setSelectedBlock(newBlock.id);
  };

  const updateBlock = (blockId: string, updates: Partial<ContentBlock>) => {
    setBlocks(blocks.map(block => 
      block.id === blockId ? { ...block, ...updates } : block
    ));
  };

  const deleteBlock = (blockId: string) => {
    setBlocks(blocks.filter(block => block.id !== blockId));
    if (selectedBlock === blockId) {
      setSelectedBlock(null);
    }
  };

  const renderEmailPreview = () => {
    return (
      <div className="space-y-4">
        <EmailPreview
          blocks={blocks}
          campaignName={campaignName}
          subjectLine={subjectLine}
          senderName={senderName}
          senderEmail={senderEmail}
        />
      </div>
    );
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading campaign...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/crm/campaigns')}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Campaigns
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Campaign Creator</h1>
            <p className="text-muted-foreground">
              {campaignSlug && campaignSlug.includes('-') ? 'Create new campaign' : 'Edit campaign'}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={handleSaveDraft}
            disabled={saving || !campaignName.trim()}
          >
            {saving ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2"></div>
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save as Draft
              </>
            )}
          </Button>
          
          <Button
            onClick={() => setShowPreview(true)}
            disabled={blocks.length === 0}
          >
            <Eye className="h-4 w-4 mr-2" />
            Preview
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left Panel - Campaign Settings */}
        <div className="lg:col-span-1">
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
                  value={campaignName}
                  onChange={(e) => setCampaignName(e.target.value)}
                  placeholder="Enter campaign name"
                />
              </div>
              
              <div>
                <Label htmlFor="campaign-description">Description</Label>
                <Textarea
                  id="campaign-description"
                  value={campaignDescription}
                  onChange={(e) => setCampaignDescription(e.target.value)}
                  placeholder="Campaign description"
                  rows={3}
                />
              </div>
              
              <div>
                <Label htmlFor="subject-line">Subject Line</Label>
                <Input
                  id="subject-line"
                  value={subjectLine}
                  onChange={(e) => setSubjectLine(e.target.value)}
                  placeholder="Enter email subject"
                />
              </div>
              
              <div>
                <Label htmlFor="sender-name">Sender Name</Label>
                <Input
                  id="sender-name"
                  value={senderName}
                  onChange={(e) => setSenderName(e.target.value)}
                  placeholder="Your Name"
                />
              </div>
              
              <div>
                <Label htmlFor="sender-email">Sender Email</Label>
                <Input
                  id="sender-email"
                  value={senderEmail}
                  onChange={(e) => setSenderEmail(e.target.value)}
                  placeholder="your@email.com"
                />
              </div>

              {/* Template Selection for Newsletter Campaigns */}
              {isNewsletterCampaign && availableTemplates.length > 0 && (
                <div>
                  <Label>Campaign Template</Label>
                  <Select value={selectedTemplate?.id || ''} onValueChange={(value) => {
                    const template = availableTemplates.find(t => t.id === value);
                    setSelectedTemplate(template || null);
                    if (template) {
                      setCampaignName(template.title);
                      setCampaignDescription(template.description);
                    }
                  }}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a template" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">None</SelectItem>
                      {availableTemplates.map(template => (
                        <SelectItem key={template.id} value={template.id}>
                          {template.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Status Selection */}
              <div>
                <Label>Campaign Status</Label>
                <Select value={status} onValueChange={(value: any) => setStatus(value)}>
                  <SelectTrigger>
                    <SelectValue />
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
        </div>

        {/* Main Content Area */}
        <div className="lg:col-span-3">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="compose">
                <Edit3 className="h-4 w-4 mr-2" />
                Compose
              </TabsTrigger>
              <TabsTrigger value="preview">
                <Eye className="h-4 w-4 mr-2" />
                Preview
              </TabsTrigger>
              {isNewsletterCampaign && (
                <TabsTrigger value="newsletter">
                  <BookOpen className="h-4 w-4 mr-2" />
                  Newsletter
                </TabsTrigger>
              )}
            </TabsList>

            <TabsContent value="compose" className="mt-6">
              <div className="space-y-4">
                {/* Add Block Buttons */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Plus className="h-5 w-5" />
                      Add Content Block
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => addBlock('header')}
                      >
                        Header
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => addBlock('text')}
                      >
                        Text
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => addBlock('image')}
                      >
                        Image
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => addBlock('button')}
                      >
                        Button
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {/* Content Blocks */}
                {blocks.length > 0 ? (
                  <div className="space-y-4">
                    {blocks.map((block) => (
                      <Card key={block.id} className="relative">
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between mb-3">
                            <Badge variant="secondary" className="capitalize">
                              {block.type}
                            </Badge>
                            <div className="flex items-center gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setSelectedBlock(
                                  selectedBlock === block.id ? null : block.id
                                )}
                              >
                                <Edit3 className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => deleteBlock(block.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                          
                          <LayoutRenderer
                            block={block}
                            editable={selectedBlock === block.id}
                            onUpdate={(updates) => updateBlock(block.id, updates)}
                          />
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <Card>
                    <CardContent className="p-8 text-center">
                      <Mail className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                      <h3 className="text-lg font-medium mb-2">No content blocks yet</h3>
                      <p className="text-muted-foreground mb-4">
                        Add your first content block to start building your campaign
                      </p>
                    </CardContent>
                  </Card>
                )}
              </div>
            </TabsContent>

            <TabsContent value="preview" className="mt-6">
              {renderEmailPreview()}
            </TabsContent>

            {isNewsletterCampaign && (
              <TabsContent value="newsletter" className="mt-6">
                <div className="space-y-6">
                  {conversionComplete && newsletterContent ? (
                    <div className="space-y-4">
                      <Card>
                        <CardHeader>
                          <CardTitle className="flex items-center gap-2">
                            <BookOpen className="h-5 w-5" />
                            Newsletter Content Ready
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <p className="text-muted-foreground mb-4">
                            Your newsletter content has been processed and is ready to convert into email blocks.
                          </p>
                          <Button onClick={handleConvertToBlocks}>
                            <Sparkles className="h-4 w-4 mr-2" />
                            Convert to Email Blocks
                          </Button>
                        </CardContent>
                      </Card>

                      {/* Newsletter Preview */}
                      <Card>
                        <CardHeader>
                          <CardTitle>Newsletter Preview</CardTitle>
                        </CardHeader>
                        <CardContent className="max-h-96 overflow-y-auto">
                          <div className="prose prose-sm max-w-none">
                            {processedNewsletter.blocks.map((block, index) => (
                              <div key={index} className="mb-4 p-3 border rounded">
                                <div className="text-xs text-muted-foreground mb-2 capitalize">
                                  {block.type} Block
                                </div>
                                {block.title && (
                                  <h3 className="font-medium mb-2">{block.title}</h3>
                                )}
                                {block.content && (
                                  <div className="text-sm text-muted-foreground">
                                    {block.content.substring(0, 200)}
                                    {block.content.length > 200 && '...'}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  ) : isConverting ? (
                    <Card>
                      <CardContent className="p-8 text-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto mb-4"></div>
                        <p className="text-muted-foreground">Converting newsletter content...</p>
                      </CardContent>
                    </Card>
                  ) : (
                    <Card>
                      <CardContent className="p-8 text-center">
                        <BookOpen className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                        <h3 className="text-lg font-medium mb-2">Newsletter Content Not Available</h3>
                        <p className="text-muted-foreground">
                          No newsletter content found for conversion. Please ensure you have a valid content task ID.
                        </p>
                      </CardContent>
                    </Card>
                  )}
                </div>
              </TabsContent>
            )}
          </Tabs>
        </div>
      </div>
    </div>
  );
};
