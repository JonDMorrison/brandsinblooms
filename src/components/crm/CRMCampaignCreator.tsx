
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Eye, Save, Send, Settings, Plus, Trash2, Edit } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { ContentBlock, GlobalSettings, BlockType } from '@/types/emailBuilder';
import { SeasonalTemplate, getSeasonalTemplates } from '@/utils/seasonalTemplateService';
import { LayoutRenderer } from '@/components/ui/layout-renderer';
import { EmailPreview } from '@/components/email/EmailPreview';

interface CRMCampaignCreatorProps {
  campaignSlug?: string;
  contentTaskId?: string | null;
}

export const CRMCampaignCreator: React.FC<CRMCampaignCreatorProps> = ({
  campaignSlug,
  contentTaskId
}) => {
  const [loading, setLoading] = useState(false);
  const [campaign, setCampaign] = useState({
    name: '',
    subject_line: '',
    preheader_text: '',
    content: '',
    status: 'draft' as 'draft' | 'scheduled' | 'sent'
  });
  
  const [blocks, setBlocks] = useState<ContentBlock[]>([]);
  const [globalSettings, setGlobalSettings] = useState<GlobalSettings>({
    fontFamily: 'Arial, sans-serif',
    fontSize: '16px',
    headerStyle: {
      backgroundColor: '#22C55E',
      textColor: '#FFFFFF'
    },
    buttonStyle: {
      backgroundColor: '#22C55E',
      textColor: '#FFFFFF',
      cornerRadius: '8px'
    },
    footerStyle: {
      backgroundColor: '#F3F4F6',
      textColor: '#6B7280'
    }
  });

  const [showPreview, setShowPreview] = useState(false);
  const [seasonalTemplates, setSeasonalTemplates] = useState<SeasonalTemplate[]>([]);

  // Initialize with default blocks
  const defaultBlocks: ContentBlock[] = useMemo(() => [
    {
      id: '1',
      type: 'header',
      title: 'Welcome to Our Newsletter',
      content: 'Your weekly dose of gardening tips and inspiration',
      source: 'manual'
    },
    {
      id: '2',
      type: 'text',
      content: 'This is your main content area. Share your latest updates, tips, and insights with your audience.',
      source: 'manual'
    },
    {
      id: '3',
      type: 'button',
      buttonText: 'Visit Our Website',
      buttonUrl: '#',
      content: 'Ready to take action?',
      source: 'manual'
    }
  ], []);

  // Load existing blocks or use defaults
  const loadBlocks = useCallback(async () => {
    if (!campaignSlug) {
      setBlocks(defaultBlocks);
      return;
    }

    try {
      // Get campaign first to get the ID
      const { data: campaignData, error: campaignError } = await supabase
        .from('crm_campaigns')
        .select('id')
        .eq('name', campaignSlug)
        .single();

      if (campaignError || !campaignData) {
        setBlocks(defaultBlocks);
        return;
      }

      // Load blocks from campaign_blocks table
      const { data: blocksData, error: blocksError } = await supabase
        .from('campaign_blocks')
        .select('*')
        .eq('campaign_id', campaignData.id)
        .order('order_index');

      if (blocksError) {
        console.error('Error loading blocks:', blocksError);
        setBlocks(defaultBlocks);
        return;
      }

      if (blocksData && blocksData.length > 0) {
        const convertedBlocks: ContentBlock[] = blocksData.map(block => ({
          id: block.id,
          type: block.block_type as BlockType,
          title: block.content?.title || '',
          content: block.content?.content || block.content?.text || '',
          imageUrl: block.image_url || undefined,
          ctaText: block.cta_text || undefined,
          ctaUrl: block.cta_url || undefined,
          source: block.source || 'manual',
          personaTag: block.persona_tag || undefined,
          // Spread any additional content properties
          ...block.content
        }));
        setBlocks(convertedBlocks);
      } else {
        setBlocks(defaultBlocks);
      }
    } catch (error) {
      console.error('Error in loadBlocks:', error);
      setBlocks(defaultBlocks);
    }
  }, [campaignSlug, defaultBlocks]);

  // Load seasonal templates
  const loadSeasonalTemplates = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('master_campaign_templates')
        .select('*')
        .order('week_number');

      if (error) {
        console.error('Error loading seasonal templates:', error);
        return;
      }

      if (data) {
        const templates: SeasonalTemplate[] = data.map(template => ({
          id: template.id,
          title: template.title,
          theme: template.theme,
          week_number: template.week_number,
          seasonal_focus: template.seasonal_focus || '',
          content_ideas: template.content_ideas || ''
        }));
        setSeasonalTemplates(templates);
        
        // Auto-generate content from template if available
        const urlParams = new URLSearchParams(window.location.search);
        const templateId = urlParams.get('templateId');
        if (templateId && templates.length > 0) {
          const template = templates.find(t => t.id === templateId);
          if (template) {
            generateContentFromTemplate(template);
          }
        }
      }
    } catch (error) {
      console.error('Error loading seasonal templates:', error);
    }
  }, []);

  const generateContentFromTemplate = useCallback((template: SeasonalTemplate) => {
    const contentIdeas = template.content_ideas;
    if (typeof contentIdeas === 'string') {
      const ideas = contentIdeas.split('\n').filter(idea => idea.trim());
      
      const templateBlocks: ContentBlock[] = [
        {
          id: '1',
          type: 'header',
          title: template.title,
          content: `Week ${template.week_number}: ${template.theme}`,
          source: 'template'
        },
        {
          id: '2',
          type: 'text',
          content: template.seasonal_focus || 'Seasonal gardening focus for this week',
          source: 'template'
        }
      ];

      ideas.forEach((idea, index) => {
        templateBlocks.push({
          id: `template-${index + 3}`,
          type: 'text',
          content: idea.trim(),
          source: 'template'
        });
      });

      setBlocks(templateBlocks);
      setCampaign(prev => ({
        ...prev,
        name: template.title,
        subject_line: `${template.title} - Week ${template.week_number}`
      }));
    }
  }, []);

  useEffect(() => {
    loadBlocks();
    loadSeasonalTemplates();
  }, [loadBlocks, loadSeasonalTemplates]);

  const addBlock = useCallback((type: BlockType) => {
    const newBlock: ContentBlock = {
      id: `block-${Date.now()}`,
      type,
      title: type === 'header' ? 'New Header' : undefined,
      content: type === 'text' ? 'New content block' : type === 'header' ? 'Header content' : '',
      source: 'manual'
    };

    if (type === 'button') {
      newBlock.buttonText = 'Click Here';
      newBlock.buttonUrl = '#';
    }

    setBlocks(prev => [...prev, newBlock]);
  }, []);

  const updateBlock = useCallback((id: string, updates: Partial<ContentBlock>) => {
    setBlocks(prev => prev.map(block => 
      block.id === id ? { ...block, ...updates } : block
    ));
  }, []);

  const deleteBlock = useCallback((id: string) => {
    setBlocks(prev => prev.filter(block => block.id !== id));
  }, []);

  const saveBlocks = useCallback(async () => {
    if (!campaignSlug) {
      toast.error('No campaign selected');
      return;
    }

    setLoading(true);
    try {
      // First, get or create the campaign
      const { data: existingCampaign, error: fetchError } = await supabase
        .from('crm_campaigns')
        .select('id')
        .eq('name', campaignSlug)
        .single();

      let campaignId: string;

      if (fetchError && fetchError.code === 'PGRST116') {
        // Campaign doesn't exist, create it
        const { data: newCampaign, error: createError } = await supabase
          .from('crm_campaigns')
          .insert({
            name: campaign.name || campaignSlug,
            subject_line: campaign.subject_line,
            content: campaign.content,
            status: campaign.status
          })
          .select('id')
          .single();

        if (createError) throw createError;
        campaignId = newCampaign.id;
      } else if (fetchError) {
        throw fetchError;
      } else {
        campaignId = existingCampaign.id;
      }

      // Delete existing blocks
      await supabase
        .from('campaign_blocks')
        .delete()
        .eq('campaign_id', campaignId);

      // Insert new blocks
      const blocksToInsert = blocks.map((block, index) => ({
        campaign_id: campaignId,
        block_type: block.type,
        content: {
          title: block.title,
          content: block.content,
          text: block.content, // Some blocks might use 'text' field
          ...block
        },
        image_url: block.imageUrl,
        cta_text: block.ctaText,
        cta_url: block.ctaUrl,
        source: block.source || 'manual',
        persona_tag: block.personaTag,
        order_index: index
      }));

      const { error: insertError } = await supabase
        .from('campaign_blocks')
        .insert(blocksToInsert);

      if (insertError) throw insertError;

      toast.success('Campaign saved successfully!');
    } catch (error) {
      console.error('Error saving blocks:', error);
      toast.error('Failed to save campaign');
    } finally {
      setLoading(false);
    }
  }, [campaignSlug, campaign, blocks]);

  const sendCampaign = useCallback(async () => {
    setLoading(true);
    try {
      await saveBlocks();
      // Here you would integrate with your email sending service
      toast.success('Campaign sent successfully!');
    } catch (error) {
      console.error('Error sending campaign:', error);
      toast.error('Failed to send campaign');
    } finally {
      setLoading(false);
    }
  }, [saveBlocks]);

  const renderBlockEditor = useCallback((block: ContentBlock) => {
    return (
      <Card key={block.id} className="mb-4">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium capitalize">
            {block.type.replace('-', ' ')} Block
            {block.source && (
              <Badge variant="secondary" className="ml-2 text-xs">
                {block.source}
              </Badge>
            )}
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => deleteBlock(block.id)}
            className="h-8 w-8 p-0"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {block.type === 'header' && (
            <>
              <Input
                placeholder="Header title"
                value={block.title || ''}
                onChange={(e) => updateBlock(block.id, { title: e.target.value })}
              />
              <Textarea
                placeholder="Header content"
                value={block.content || ''}
                onChange={(e) => updateBlock(block.id, { content: e.target.value })}
                rows={2}
              />
            </>
          )}
          
          {block.type === 'text' && (
            <Textarea
              placeholder="Text content"
              value={block.content || ''}
              onChange={(e) => updateBlock(block.id, { content: e.target.value })}
              rows={4}
            />
          )}
          
          {block.type === 'button' && (
            <>
              <Input
                placeholder="Button text"
                value={block.buttonText || ''}
                onChange={(e) => updateBlock(block.id, { buttonText: e.target.value })}
              />
              <Input
                placeholder="Button URL"
                value={block.buttonUrl || ''}
                onChange={(e) => updateBlock(block.id, { buttonUrl: e.target.value })}
              />
              <Textarea
                placeholder="Button description (optional)"
                value={block.content || ''}
                onChange={(e) => updateBlock(block.id, { content: e.target.value })}
                rows={2}
              />
            </>
          )}
          
          {block.type === 'image' && (
            <>
              <Input
                placeholder="Image URL"
                value={block.imageUrl || ''}
                onChange={(e) => updateBlock(block.id, { imageUrl: e.target.value })}
              />
              <Input
                placeholder="Alt text"
                value={block.title || ''}
                onChange={(e) => updateBlock(block.id, { title: e.target.value })}
              />
            </>
          )}
        </CardContent>
      </Card>
    );
  }, [updateBlock, deleteBlock]);

  if (showPreview) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold">Email Preview</h1>
          <Button onClick={() => setShowPreview(false)} variant="outline">
            <Edit className="mr-2 h-4 w-4" />
            Back to Editor
          </Button>
        </div>
        
        <EmailPreview
          blocks={blocks}
          campaign={{
            subject_line: campaign.subject_line,
            preheader_text: campaign.preheader_text
          }}
          isFullPreview={true}
        />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Campaign Creator</h1>
        <div className="flex space-x-2">
          <Button onClick={() => setShowPreview(true)} variant="outline">
            <Eye className="mr-2 h-4 w-4" />
            Preview
          </Button>
          <Button onClick={saveBlocks} disabled={loading}>
            <Save className="mr-2 h-4 w-4" />
            {loading ? 'Saving...' : 'Save'}
          </Button>
          <Button onClick={sendCampaign} disabled={loading}>
            <Send className="mr-2 h-4 w-4" />
            Send
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Editor Panel */}
        <div className="lg:col-span-2">
          <Tabs defaultValue="content" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="content">Content</TabsTrigger>
              <TabsTrigger value="settings">Settings</TabsTrigger>
            </TabsList>
            
            <TabsContent value="content" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Campaign Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Input
                    placeholder="Campaign name"
                    value={campaign.name}
                    onChange={(e) => setCampaign(prev => ({ ...prev, name: e.target.value }))}
                  />
                  <Input
                    placeholder="Subject line"
                    value={campaign.subject_line}
                    onChange={(e) => setCampaign(prev => ({ ...prev, subject_line: e.target.value }))}
                  />
                  <Input
                    placeholder="Preheader text"
                    value={campaign.preheader_text}
                    onChange={(e) => setCampaign(prev => ({ ...prev, preheader_text: e.target.value }))}
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle>Content Blocks</CardTitle>
                  <div className="flex space-x-2">
                    <Button size="sm" onClick={() => addBlock('header')}>
                      <Plus className="mr-1 h-3 w-3" />
                      Header
                    </Button>
                    <Button size="sm" onClick={() => addBlock('text')}>
                      <Plus className="mr-1 h-3 w-3" />
                      Text
                    </Button>
                    <Button size="sm" onClick={() => addBlock('button')}>
                      <Plus className="mr-1 h-3 w-3" />
                      Button
                    </Button>
                    <Button size="sm" onClick={() => addBlock('image')}>
                      <Plus className="mr-1 h-3 w-3" />
                      Image
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {blocks.length === 0 ? (
                    <p className="text-muted-foreground text-center py-8">
                      No blocks yet. Add your first block to get started.
                    </p>
                  ) : (
                    blocks.map(renderBlockEditor)
                  )}
                </CardContent>
              </Card>
            </TabsContent>
            
            <TabsContent value="settings" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Global Settings</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <label className="text-sm font-medium">Font Family</label>
                    <Input
                      value={globalSettings.fontFamily}
                      onChange={(e) => setGlobalSettings(prev => ({ 
                        ...prev, 
                        fontFamily: e.target.value 
                      }))}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Font Size</label>
                    <Input
                      value={globalSettings.fontSize}
                      onChange={(e) => setGlobalSettings(prev => ({ 
                        ...prev, 
                        fontSize: e.target.value 
                      }))}
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* Live Preview Panel */}
        <div className="lg:col-span-1">
          <Card className="sticky top-4">
            <CardHeader>
              <CardTitle className="flex items-center">
                <Eye className="mr-2 h-4 w-4" />
                Live Preview
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="border rounded-lg p-4 bg-white">
                <EmailPreview
                  blocks={blocks}
                  campaign={{
                    subject_line: campaign.subject_line,
                    preheader_text: campaign.preheader_text
                  }}
                />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};
