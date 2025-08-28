
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { ContentBlock, GlobalSettings } from '@/types/emailBuilder';
import { EmailPreview } from './EmailPreview';
import { LayoutRenderer } from './LayoutRenderer';
import { supabase } from '@/integrations/supabase/client';
import { Plus, Save, Eye } from 'lucide-react';

interface CRMCampaignCreatorProps {
  campaignSlug?: string;
  contentTaskId?: string | null;
}

interface SeasonalTemplate {
  id: string;
  title: string;
  seasonal_focus: string;
  content_ideas: string[];
}

const defaultGlobalSettings: GlobalSettings = {
  fontFamily: 'Arial, sans-serif',
  fontSize: '16px',
  buttonStyle: {
    backgroundColor: '#22C55E',
    textColor: '#FFFFFF',
    cornerRadius: '8px'
  },
  headerStyle: {
    backgroundColor: '#1E40AF',
    textColor: '#FFFFFF'
  },
  footerStyle: {
    backgroundColor: '#F3F4F6',
    textColor: '#6B7280'
  }
};

const getInitialBlocks = (templateTitle?: string, contentIdeas?: string[]): ContentBlock[] => {
  const baseBlocks: ContentBlock[] = [
    {
      id: 'header-1',
      type: 'newsletter-header',
      title: templateTitle || 'Weekly Newsletter',
      subtitle: 'Your guide to seasonal gardening',
      source: 'template',
      visible: true
    },
    {
      id: 'intro-1', 
      type: 'text',
      title: 'Welcome Message',
      content: 'Welcome to this week\'s gardening newsletter! Let\'s explore what\'s happening in your garden this season.',
      source: 'template',
      visible: true
    },
    {
      id: 'main-content-1',
      type: 'image-text',
      title: 'This Week\'s Focus',
      content: 'Important gardening tasks and tips for the season ahead.',
      source: 'template',
      visible: true,
      layout: 'image-left'
    }
  ];

  // Add content blocks from template ideas
  if (contentIdeas && Array.isArray(contentIdeas)) {
    contentIdeas.slice(0, 3).forEach((idea, index) => {
      baseBlocks.push({
        id: `content-${index + 2}`,
        type: 'text',
        title: `Tip ${index + 1}`,
        content: idea,
        source: 'template',
        visible: true
      });
    });
  }

  return baseBlocks;
};

export const CRMCampaignCreator: React.FC<CRMCampaignCreatorProps> = ({
  campaignSlug,
  contentTaskId
}) => {
  const navigate = useNavigate();
  const [campaignName, setCampaignName] = useState('');
  const [subjectLine, setSubjectLine] = useState('');
  const [preheaderText, setPreheaderText] = useState('');
  const [senderName, setSenderName] = useState('');
  const [senderEmail, setSenderEmail] = useState('');
  const [blocks, setBlocks] = useState<ContentBlock[]>([]);
  const [globalSettings, setGlobalSettings] = useState<GlobalSettings>(defaultGlobalSettings);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [currentCampaignId, setCurrentCampaignId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('builder');

  // Memoize URL parameters to prevent re-renders
  const urlParams = useMemo(() => new URLSearchParams(window.location.search), []);
  
  const templateId = useMemo(() => urlParams.get('templateId'), [urlParams]);
  const templateTitle = useMemo(() => urlParams.get('title'), [urlParams]);
  const templateDescription = useMemo(() => urlParams.get('description'), [urlParams]);

  // Initialize campaign from template or existing campaign
  const initializeCampaign = useCallback(async () => {
    if (isLoading) return;
    
    setIsLoading(true);
    console.log('🚀 Initializing campaign...', { campaignSlug, contentTaskId, templateId });

    try {
      if (campaignSlug && !templateId) {
        // Load existing campaign
        const { data: campaign, error } = await supabase
          .from('crm_campaigns')
          .select('*')
          .eq('id', campaignSlug)
          .single();

        if (error) throw error;

        setCampaignName(campaign.name || '');
        setSubjectLine(campaign.subject_line || '');
        setPreheaderText(campaign.preheader_text || '');
        setSenderName(campaign.sender_name || '');
        setSenderEmail(campaign.sender_email || '');
        setCurrentCampaignId(campaign.id);

        // Load blocks
        const { data: campaignBlocks, error: blocksError } = await supabase
          .from('email_blocks')
          .select('*')
          .eq('campaign_id', campaignSlug)
          .order('order_index');

        if (!blocksError && campaignBlocks) {
          const convertedBlocks: ContentBlock[] = campaignBlocks.map(block => ({
            id: block.id,
            type: block.block_type,
            title: block.content?.title || '',
            content: block.content?.content || block.content?.body || '',
            imageUrl: block.image_url || '',
            ctaText: block.cta_text || '',
            ctaUrl: block.cta_url || '',
            source: block.source || 'manual',
            personaTag: block.persona_tag || '',
            visible: true,
            ...block.content
          }));
          setBlocks(convertedBlocks);
        }
      } else {
        // Initialize new campaign from template
        let initialBlocks = getInitialBlocks();
        let campaignTitle = 'New Campaign';

        if (templateId && templateTitle) {
          campaignTitle = decodeURIComponent(templateTitle);
          setCampaignName(campaignTitle);
          setSubjectLine(campaignTitle);

          // Fetch template data for content ideas
          const { data: template } = await supabase
            .from('seasonal_templates')
            .select('*')
            .eq('id', templateId)
            .single();

          if (template) {
            const contentIdeas = Array.isArray(template.content_ideas) 
              ? template.content_ideas 
              : [];
            
            initialBlocks = getInitialBlocks(template.seasonal_focus, contentIdeas);
          }
        }

        setBlocks(initialBlocks);
        setSenderName('Your Garden Center');
        setSenderEmail('newsletter@yourgardencenter.com');
      }
    } catch (error) {
      console.error('Error initializing campaign:', error);
      toast.error('Failed to load campaign data');
    } finally {
      setIsLoading(false);
    }
  }, [campaignSlug, contentTaskId, templateId, templateTitle, isLoading]);

  // Initialize on mount
  useEffect(() => {
    initializeCampaign();
  }, [initializeCampaign]);

  // Auto-save functionality
  const autoSave = useCallback(async () => {
    if (!campaignName.trim() || isSaving || isLoading) return;

    try {
      setIsSaving(true);
      
      const campaignData = {
        name: campaignName,
        subject_line: subjectLine,
        preheader_text: preheaderText,
        sender_name: senderName,
        sender_email: senderEmail,
        status: 'draft' as const,
        campaign_type: 'newsletter',
        updated_at: new Date().toISOString()
      };

      let campaignId = currentCampaignId;

      if (!campaignId) {
        const { data: newCampaign, error } = await supabase
          .from('crm_campaigns')
          .insert(campaignData)
          .select()
          .single();

        if (error) throw error;
        campaignId = newCampaign.id;
        setCurrentCampaignId(campaignId);
      } else {
        const { error } = await supabase
          .from('crm_campaigns')
          .update(campaignData)
          .eq('id', campaignId);

        if (error) throw error;
      }

      // Save blocks
      if (blocks.length > 0) {
        const { error: deleteError } = await supabase
          .from('email_blocks')
          .delete()
          .eq('campaign_id', campaignId);

        if (deleteError) throw deleteError;

        const blocksToSave = blocks.map((block, index) => ({
          campaign_id: campaignId!,
          block_type: block.type,
          content: {
            title: block.title,
            content: block.content,
            body: block.content,
            headline: block.title,
            ...block
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
          .insert(blocksToSave);

        if (blocksError) throw blocksError;
      }

      console.log('✅ Campaign auto-saved');
    } catch (error) {
      console.error('Auto-save error:', error);
    } finally {
      setIsSaving(false);
    }
  }, [campaignName, subjectLine, preheaderText, senderName, senderEmail, blocks, currentCampaignId, isSaving, isLoading]);

  // Auto-save with debounce
  useEffect(() => {
    const timeoutId = setTimeout(autoSave, 2000);
    return () => clearTimeout(timeoutId);
  }, [autoSave]);

  const addBlock = useCallback((type: ContentBlock['type']) => {
    const newBlock: ContentBlock = {
      id: `${type}-${Date.now()}`,
      type,
      title: '',
      content: '',
      source: 'manual',
      visible: true
    };

    setBlocks(prev => [...prev, newBlock]);
  }, []);

  const updateBlock = useCallback((blockId: string, updates: Partial<ContentBlock>) => {
    setBlocks(prev => 
      prev.map(block => 
        block.id === blockId ? { ...block, ...updates } : block
      )
    );
  }, []);

  const deleteBlock = useCallback((blockId: string) => {
    setBlocks(prev => prev.filter(block => block.id !== blockId));
  }, []);

  const handleSaveDraft = async () => {
    await autoSave();
    toast.success('Campaign saved as draft');
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p>Loading campaign...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="campaign-creator-container max-w-7xl mx-auto p-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold">Campaign Builder</h1>
          <p className="text-muted-foreground">Create and customize your email campaign</p>
        </div>
        <div className="campaign-header-actions flex gap-2">
          <Button variant="outline" onClick={() => navigate('/crm/campaigns')}>
            Cancel
          </Button>
          <Button 
            variant="outline" 
            onClick={handleSaveDraft}
            disabled={isSaving}
          >
            <Save className="h-4 w-4 mr-2" />
            {isSaving ? 'Saving...' : 'Save Draft'}
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="campaign-tabs-list grid w-full grid-cols-2">
          <TabsTrigger value="builder" className="campaign-tabs-trigger">Builder</TabsTrigger>
          <TabsTrigger value="preview" className="campaign-tabs-trigger">Preview</TabsTrigger>
        </TabsList>

        <TabsContent value="builder" className="mt-6">
          <div className="campaign-content-grid grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left Column - Campaign Settings & Content Builder */}
            <div className="space-y-6">
              {/* Campaign Settings */}
              <Card className="campaign-settings-card">
                <CardHeader>
                  <CardTitle>Campaign Settings</CardTitle>
                </CardHeader>
                <CardContent className="campaign-card-content space-y-4">
                  <div className="campaign-settings-grid grid grid-cols-1 gap-4">
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
                      <Label htmlFor="subject-line">Subject Line</Label>
                      <Input
                        id="subject-line"
                        value={subjectLine}
                        onChange={(e) => setSubjectLine(e.target.value)}
                        placeholder="Enter email subject"
                      />
                    </div>
                    <div>
                      <Label htmlFor="preheader">Preheader Text</Label>
                      <Input
                        id="preheader"
                        value={preheaderText}
                        onChange={(e) => setPreheaderText(e.target.value)}
                        placeholder="Enter preheader text"
                      />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="sender-name">Sender Name</Label>
                        <Input
                          id="sender-name"
                          value={senderName}
                          onChange={(e) => setSenderName(e.target.value)}
                          placeholder="Sender name"
                        />
                      </div>
                      <div>
                        <Label htmlFor="sender-email">Sender Email</Label>
                        <Input
                          id="sender-email"
                          type="email"
                          value={senderEmail}
                          onChange={(e) => setSenderEmail(e.target.value)}
                          placeholder="sender@example.com"
                        />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Content Blocks */}
              <Card>
                <CardHeader>
                  <CardTitle>Content Blocks</CardTitle>
                </CardHeader>
                <CardContent className="content-blocks-editor space-y-4">
                  {blocks.map((block, index) => (
                    <div key={block.id} className="group border rounded-lg p-4" data-testid="content-block">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium capitalize">
                          {block.type.replace('-', ' ')} Block
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteBlock(block.id)}
                        >
                          Remove
                        </Button>
                      </div>
                      <LayoutRenderer 
                        block={block}
                        onUpdate={(updates) => updateBlock(block.id, updates)}
                        editable={true}
                      />
                    </div>
                  ))}
                  
                  {/* Add Block Button */}
                  <div className="border-2 border-dashed border-muted rounded-lg p-8 text-center">
                    <div className="space-y-4">
                      <p className="text-muted-foreground">Add a new content block</p>
                      <div className="flex flex-wrap gap-2 justify-center">
                        {(['header', 'text', 'image', 'image-text', 'button', 'cta'] as const).map((type) => (
                          <Button
                            key={type}
                            variant="outline"
                            size="sm"
                            onClick={() => addBlock(type)}
                            data-testid={`layout-${type}`}
                          >
                            <Plus className="h-4 w-4 mr-2" />
                            {type.charAt(0).toUpperCase() + type.slice(1).replace('-', ' ')}
                          </Button>
                        ))}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Right Column - Preview */}
            <div className="lg:sticky lg:top-6">
              <EmailPreview
                blocks={blocks}
                campaignName={campaignName}
                subjectLine={subjectLine}
                senderName={senderName}
                senderEmail={senderEmail}
              />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="preview" className="mt-6">
          <div className="max-w-4xl mx-auto">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Eye className="h-5 w-5" />
                  Full Email Preview
                </CardTitle>
              </CardHeader>
              <CardContent>
                <EmailPreview
                  blocks={blocks}
                  campaignName={campaignName}
                  subjectLine={subjectLine}
                  senderName={senderName}
                  senderEmail={senderEmail}
                />
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};
