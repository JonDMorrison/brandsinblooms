import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { getCurrentWeekNumber } from '@/utils/dateUtils';
import { getSeasonalTemplates } from '@/utils/seasonalTemplateService';
import { Badge } from '@/components/ui/badge';
import { LayoutRenderer } from '@/components/layout/LayoutRenderer';
import { EmailPreview } from '@/components/newsletter/EmailPreview';

interface CRMCampaignCreatorProps {}

interface SeasonalTemplate {
  id: string;
  title: string;
  theme: string;
  week_number: number;
  seasonal_focus: string;
  content_ideas: string;
  prompt?: string;
  target_audience_notes?: string;
  platform_specific_notes?: any;
  created_at: string;
  updated_at: string;
}

interface ContentBlock {
  id: string;
  type: 'header' | 'text' | 'image' | 'button' | 'divider';
  content: {
    title?: string;
    text?: string;
    imageUrl?: string;
    buttonText?: string;
    buttonUrl?: string;
  };
  imageUrl?: string;
  ctaText?: string;
  ctaUrl?: string;
  source?: string;
  personaTag?: string;
}

interface CampaignData {
  subject_line: string;
  preheader_text: string;
}

export const CRMCampaignCreator: React.FC<CRMCampaignCreatorProps> = () => {
  const [campaignName, setCampaignName] = useState('');
  const [subjectLine, setSubjectLine] = useState('');
  const [preheaderText, setPreheaderText] = useState('');
  const [blocks, setBlocks] = useState<ContentBlock[]>([]);
  const [loading, setLoading] = useState(false);
  const [seasonalTemplates, setSeasonalTemplates] = useState<SeasonalTemplate[]>([]);
  const { toast } = useToast();

  // Initialize with default blocks
  useEffect(() => {
    const defaultBlocks: ContentBlock[] = [
      {
        id: '1',
        type: 'header',
        content: {
          title: 'Welcome to Our Newsletter'
        },
        source: 'manual'
      },
      {
        id: '2', 
        type: 'text',
        content: {
          text: 'Start writing your newsletter content here...'
        },
        source: 'manual'
      },
      {
        id: '3',
        type: 'button', 
        content: {
          buttonText: 'Shop Now',
          buttonUrl: '#'
        },
        source: 'manual'
      }
    ];
    setBlocks(defaultBlocks);
  }, []);

  // Load seasonal templates
  useEffect(() => {
    const fetchSeasonalTemplates = async () => {
      try {
        const currentWeek = getCurrentWeekNumber();
        const templates = await getSeasonalTemplates(currentWeek);
        setSeasonalTemplates(templates);
      } catch (error) {
        console.error('Error fetching seasonal templates:', error);
      }
    };

    fetchSeasonalTemplates();
  }, []);

  const loadTemplateBlocks = async (templateId: string) => {
    try {
      const { data: templateBlocks, error } = await supabase
        .from('campaign_blocks')
        .select('*')
        .eq('campaign_id', templateId)
        .order('order_index');

      if (error) throw error;

      const loadedBlocks: ContentBlock[] = templateBlocks?.map((block: any) => ({
        id: block.id,
        type: block.block_type as ContentBlock['type'],
        content: {
          title: block.content?.title,
          text: block.content?.text || block.content?.content,
        },
        imageUrl: block.image_url,
        ctaText: block.cta_text,
        ctaUrl: block.cta_url,
        source: block.source,
        personaTag: block.persona_tag,
        ...block.content
      })) || [];

      setBlocks(loadedBlocks);
    } catch (error) {
      console.error('Error loading template blocks:', error);
    }
  };

  const loadSeasonalContent = async () => {
    try {
      const currentWeek = getCurrentWeekNumber();
      const { data: template, error } = await supabase
        .from('master_campaign_templates')
        .select('*')
        .eq('week_number', currentWeek)
        .single();

      if (error) throw error;

      if (template) {
        const seasonalTemplate = template as SeasonalTemplate;
        setCampaignName(seasonalTemplate.title);
        setSubjectLine(seasonalTemplate.theme);
        
        // Parse content ideas and create blocks
        const contentIdeasText = seasonalTemplate.content_ideas || '';
        const contentLines = typeof contentIdeasText === 'string' 
          ? contentIdeasText.split('\n').filter(line => line.trim())
          : [];

        const seasonalBlocks: ContentBlock[] = [
          {
            id: 'seasonal-header',
            type: 'header',
            content: {
              title: seasonalTemplate.theme
            },
            source: 'seasonal'
          }
        ];

        contentLines.forEach((line, index) => {
          seasonalBlocks.push({
            id: `seasonal-text-${index}`,
            type: 'text',
            content: {
              text: line.trim()
            },
            source: 'seasonal'
          });
        });

        seasonalBlocks.push({
          id: 'seasonal-focus',
          type: 'text',
          content: {
            text: `Focus: ${seasonalTemplate.seasonal_focus}`
          },
          source: 'seasonal'
        });

        setBlocks(seasonalBlocks);
      }
    } catch (error) {
      console.error('Error loading seasonal content:', error);
      toast({
        title: 'Error',
        description: 'Failed to load seasonal content',
        variant: 'destructive'
      });
    }
  };

  const addBlock = (type: ContentBlock['type']) => {
    const newBlock: ContentBlock = {
      id: Date.now().toString(),
      type,
      content: {
        title: type === 'header' ? 'New Header' : undefined,
        text: type === 'text' ? 'New content...' : undefined,
        buttonText: type === 'button' ? 'Click Here' : undefined,
        buttonUrl: type === 'button' ? '#' : undefined
      },
      source: 'manual'
    };
    setBlocks([...blocks, newBlock]);
  };

  const updateBlock = async (blockId: string, updates: Partial<ContentBlock>) => {
    setBlocks(blocks.map(block => 
      block.id === blockId ? { ...block, ...updates } : block
    ));

    // Save to database if this is a persisted block
    if (blockId.startsWith('db-')) {
      try {
        const { error } = await supabase
          .from('campaign_blocks')
          .update({
            content: updates.content,
            image_url: updates.imageUrl,
            cta_text: updates.ctaText,
            cta_url: updates.ctaUrl
          })
          .eq('id', blockId.replace('db-', ''));

        if (error) throw error;
      } catch (error) {
        console.error('Error updating block:', error);
      }
    }
  };

  const removeBlock = async (blockId: string) => {
    setBlocks(blocks.filter(block => block.id !== blockId));

    // Remove from database if this is a persisted block
    if (blockId.startsWith('db-')) {
      try {
        const { error } = await supabase
          .from('campaign_blocks')
          .delete()
          .eq('id', blockId.replace('db-', ''));

        if (error) throw error;
      } catch (error) {
        console.error('Error removing block:', error);
      }
    }
  };

  const saveCampaign = async () => {
    if (!campaignName.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Campaign name is required',
        variant: 'destructive'
      });
      return;
    }

    setLoading(true);
    try {
      // Create campaign
      const { data: campaign, error: campaignError } = await supabase
        .from('crm_campaigns')
        .insert({
          name: campaignName,
          subject_line: subjectLine,
          preheader_text: preheaderText,
          status: 'draft' as const
        })
        .select()
        .single();

      if (campaignError) throw campaignError;

      // Save blocks
      for (const [index, block] of blocks.entries()) {
        const { error: blockError } = await supabase
          .from('campaign_blocks')
          .insert({
            campaign_id: campaign.id,
            block_type: block.type,
            content: block.content,
            order_index: index,
            image_url: block.imageUrl,
            cta_text: block.ctaText,
            cta_url: block.ctaUrl,
            source: block.source,
            persona_tag: block.personaTag
          });

        if (blockError) throw blockError;
      }

      toast({
        title: 'Success',
        description: 'Campaign saved successfully',
      });

      // Reset form
      setCampaignName('');
      setSubjectLine('');
      setPreheaderText('');
      setBlocks([]);

    } catch (error) {
      console.error('Error saving campaign:', error);
      toast({
        title: 'Error',
        description: 'Failed to save campaign',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">Create Email Campaign</h1>
          <p className="text-muted-foreground mt-1">
            Build and customize your email campaign
          </p>
        </div>
        <Button onClick={saveCampaign} disabled={loading}>
          {loading ? 'Saving...' : 'Save Campaign'}
        </Button>
      </div>

      <Tabs defaultValue="compose" className="space-y-6">
        <TabsList>
          <TabsTrigger value="compose">Compose</TabsTrigger>
          <TabsTrigger value="preview">Preview</TabsTrigger>
          <TabsTrigger value="templates">Templates</TabsTrigger>
        </TabsList>

        <TabsContent value="compose" className="space-y-6">
          {/* Campaign Settings */}
          <Card>
            <CardHeader>
              <CardTitle>Campaign Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="campaign-name">Campaign Name</Label>
                  <Input
                    id="campaign-name"
                    value={campaignName}
                    onChange={(e) => setCampaignName(e.target.value)}
                    placeholder="Enter campaign name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="subject-line">Subject Line</Label>
                  <Input
                    id="subject-line"
                    value={subjectLine}
                    onChange={(e) => setSubjectLine(e.target.value)}
                    placeholder="Enter subject line"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="preheader">Preheader Text</Label>
                <Textarea
                  id="preheader"
                  value={preheaderText}
                  onChange={(e) => setPreheaderText(e.target.value)}
                  placeholder="Enter preheader text (optional)"
                  rows={2}
                />
              </div>
            </CardContent>
          </Card>

          {/* Content Builder */}
          <Card>
            <CardHeader>
              <CardTitle>Content Blocks</CardTitle>
            </CardHeader>
            <CardContent>
              <LayoutRenderer
                blocks={blocks}
                onUpdateBlock={updateBlock}
                onRemoveBlock={removeBlock}
                editable={true}
              />
              
              <div className="flex gap-2 mt-4">
                <Button onClick={() => addBlock('header')} variant="outline" size="sm">
                  + Header
                </Button>
                <Button onClick={() => addBlock('text')} variant="outline" size="sm">
                  + Text
                </Button>
                <Button onClick={() => addBlock('image')} variant="outline" size="sm">
                  + Image
                </Button>
                <Button onClick={() => addBlock('button')} variant="outline" size="sm">
                  + Button
                </Button>
                <Button onClick={() => addBlock('divider')} variant="outline" size="sm">
                  + Divider
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="preview">
          <Card>
            <CardHeader>
              <CardTitle>Email Preview</CardTitle>
            </CardHeader>
            <CardContent>
              <EmailPreview
                blocks={blocks}
                campaign={{
                  subject_line: subjectLine,
                  preheader_text: preheaderText
                } as CampaignData}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="templates" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Seasonal Templates</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2 mb-4">
                <Button onClick={loadSeasonalContent} variant="outline">
                  Load Current Week Template
                </Button>
              </div>
              
              <div className="grid gap-4">
                {seasonalTemplates.map((template) => (
                  <div key={template.id} className="border rounded-lg p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-semibold">{template.title}</h3>
                        <p className="text-sm text-muted-foreground mt-1">
                          {template.theme}
                        </p>
                        <Badge variant="secondary" className="mt-2">
                          Week {template.week_number}
                        </Badge>
                      </div>
                      <Button 
                        onClick={() => loadTemplateBlocks(template.id)}
                        variant="outline"
                        size="sm"
                      >
                        Use Template
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Full Preview</CardTitle>
            </CardHeader>
            <CardContent>
              <EmailPreview
                blocks={blocks}
                campaign={{
                  subject_line: subjectLine,
                  preheader_text: preheaderText
                } as CampaignData}
                isFullPreview={true}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};
