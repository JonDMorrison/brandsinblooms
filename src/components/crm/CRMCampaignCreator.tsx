
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { EmailPreview } from '@/components/crm/EmailPreview';
import { ContentBlockRenderer } from '@/components/crm/click-to-edit/ContentBlockRenderer';
import { AddBlockButton } from '@/components/crm/click-to-edit/AddBlockButton';
import { Save, Send, Eye, ArrowLeft } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { ContentBlock, GlobalSettings } from '@/types/emailBuilder';
import { getSeasonalTemplates } from '@/utils/seasonalTemplateService';

interface CampaignData {
  id?: string;
  name: string;
  subject_line: string;
  preheader_text?: string;
  status: 'draft' | 'scheduled' | 'sent';
  blocks: ContentBlock[];
  global_settings: GlobalSettings;
}

const defaultGlobalSettings: GlobalSettings = {
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
};

const createDefaultBlocks = (title: string, description: string): ContentBlock[] => [
  {
    id: 'header-1',
    type: 'header',
    title: title,
    content: '',
    order: 0
  },
  {
    id: 'text-1', 
    type: 'text',
    content: description,
    order: 1
  },
  {
    id: 'text-2',
    type: 'text', 
    content: 'We\'ll help you make the most of this season with expert tips and quality products.',
    order: 2
  }
];

export const CRMCampaignCreator: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  
  // Memoize URL parameters to prevent unnecessary re-renders
  const urlParams = useMemo(() => ({
    type: searchParams.get('type'),
    templateId: searchParams.get('templateId'),
    title: searchParams.get('title'),
    description: searchParams.get('description'),
    category: searchParams.get('category')
  }), [searchParams]);

  const [campaignData, setCampaignData] = useState<CampaignData>({
    name: '',
    subject_line: '',
    preheader_text: '',
    status: 'draft',
    blocks: [],
    global_settings: defaultGlobalSettings
  });

  const [activeTab, setActiveTab] = useState('content');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  // Memoized functions to prevent unnecessary re-renders
  const updateCampaignData = useCallback((updates: Partial<CampaignData>) => {
    setCampaignData(prev => ({ ...prev, ...updates }));
  }, []);

  const updateBlock = useCallback((blockId: string, updates: Partial<ContentBlock>) => {
    setCampaignData(prev => ({
      ...prev,
      blocks: prev.blocks.map(block => 
        block.id === blockId ? { ...block, ...updates } : block
      )
    }));
  }, []);

  const addBlock = useCallback((type: ContentBlock['type'], insertAfter?: string) => {
    const newBlock: ContentBlock = {
      id: `${type}-${Date.now()}`,
      type,
      title: type === 'header' ? 'New Header' : undefined,
      content: type === 'text' ? 'New content block...' : '',
      order: campaignData.blocks.length
    };

    setCampaignData(prev => {
      if (!insertAfter) {
        return {
          ...prev,
          blocks: [...prev.blocks, newBlock]
        };
      }

      const insertIndex = prev.blocks.findIndex(b => b.id === insertAfter);
      const newBlocks = [...prev.blocks];
      newBlocks.splice(insertIndex + 1, 0, newBlock);
      
      // Reorder blocks
      return {
        ...prev,
        blocks: newBlocks.map((block, index) => ({ ...block, order: index }))
      };
    });
  }, [campaignData.blocks.length]);

  const removeBlock = useCallback((blockId: string) => {
    setCampaignData(prev => ({
      ...prev,
      blocks: prev.blocks.filter(block => block.id !== blockId)
        .map((block, index) => ({ ...block, order: index }))
    }));
  }, []);

  // Initialize campaign from URL parameters or template
  const initializeCampaign = useCallback(async () => {
    if (isInitialized || !urlParams.templateId) return;

    setIsLoading(true);
    console.log('Initializing campaign with params:', urlParams);

    try {
      let campaignName = '';
      let subjectLine = '';
      let preheaderText = '';
      let initialBlocks: ContentBlock[] = [];

      // Handle weekly theme templates
      if (urlParams.templateId?.startsWith('weekly-theme-')) {
        const weekMatch = urlParams.templateId.match(/^weekly-theme-(\d+)$/);
        if (weekMatch) {
          const weekNumber = parseInt(weekMatch[1]);
          
          try {
            // Try to get seasonal template from database
            const seasonalTemplates = await getSeasonalTemplates(weekNumber);
            
            if (seasonalTemplates.length > 0) {
              const template = seasonalTemplates[0];
              campaignName = template.title;
              subjectLine = template.title;
              preheaderText = template.seasonal_focus || '';
              
              // Create blocks from template
              initialBlocks = [
                {
                  id: 'header-1',
                  type: 'header',
                  title: template.title,
                  content: '',
                  order: 0
                },
                {
                  id: 'text-1',
                  type: 'text',
                  content: template.seasonal_focus || '',
                  order: 1
                }
              ];

              // Add content ideas as blocks if available
              if (template.content_ideas && template.content_ideas.length > 0) {
                template.content_ideas.slice(0, 3).forEach((idea, index) => {
                  initialBlocks.push({
                    id: `image-text-${index + 1}`,
                    type: 'image-text',
                    title: idea,
                    content: `Learn more about ${idea.toLowerCase()} this fall season.`,
                    order: initialBlocks.length
                  });
                });
              }
            }
          } catch (error) {
            console.warn('Failed to fetch seasonal template, using URL fallback:', error);
          }
        }
      }

      // Fallback to URL parameters if template lookup failed
      if (!campaignName && urlParams.title) {
        campaignName = decodeURIComponent(urlParams.title);
        subjectLine = campaignName;
        preheaderText = urlParams.description ? decodeURIComponent(urlParams.description) : '';
        initialBlocks = createDefaultBlocks(campaignName, preheaderText);
      }

      // Final fallback
      if (!campaignName) {
        campaignName = 'New Newsletter Campaign';
        subjectLine = 'New Newsletter Campaign';
        initialBlocks = createDefaultBlocks(campaignName, 'Your newsletter content here...');
      }

      setCampaignData({
        name: campaignName,
        subject_line: subjectLine,
        preheader_text: preheaderText,
        status: 'draft',
        blocks: initialBlocks,
        global_settings: defaultGlobalSettings
      });

      setIsInitialized(true);
      console.log('Campaign initialized successfully:', { campaignName, blocksCount: initialBlocks.length });

    } catch (error) {
      console.error('Failed to initialize campaign:', error);
      toast({
        title: "Error",
        description: "Failed to initialize campaign. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  }, [isInitialized, urlParams, toast]);

  // Auto-save functionality
  const autoSave = useCallback(async () => {
    if (!campaignData.id || isSaving) return;

    try {
      setIsSaving(true);
      const { error } = await supabase
        .from('crm_campaigns')
        .update({
          name: campaignData.name,
          subject_line: campaignData.subject_line,
          preheader_text: campaignData.preheader_text,
          status: campaignData.status,
          blocks: campaignData.blocks,
          global_settings: campaignData.global_settings,
          updated_at: new Date().toISOString()
        })
        .eq('id', campaignData.id);

      if (error) throw error;
    } catch (error) {
      console.error('Auto-save failed:', error);
    } finally {
      setIsSaving(false);
    }
  }, [campaignData, isSaving]);

  const saveCampaign = async () => {
    if (!user) return;

    setIsSaving(true);
    try {
      const campaignPayload = {
        user_id: user.id,
        name: campaignData.name,
        subject_line: campaignData.subject_line,
        preheader_text: campaignData.preheader_text,
        status: campaignData.status,
        type: 'newsletter',
        blocks: campaignData.blocks,
        global_settings: campaignData.global_settings
      };

      if (campaignData.id) {
        // Update existing campaign
        const { error } = await supabase
          .from('crm_campaigns')
          .update(campaignPayload)
          .eq('id', campaignData.id);

        if (error) throw error;
      } else {
        // Create new campaign
        const { data, error } = await supabase
          .from('crm_campaigns')
          .insert([campaignPayload])
          .select()
          .single();

        if (error) throw error;
        if (data) {
          setCampaignData(prev => ({ ...prev, id: data.id }));
        }
      }

      toast({
        title: "Success",
        description: "Campaign saved successfully",
      });
    } catch (error) {
      console.error('Error saving campaign:', error);
      toast({
        title: "Error",
        description: "Failed to save campaign. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Initialize campaign on component mount
  useEffect(() => {
    if (!isLoading && !isInitialized) {
      initializeCampaign();
    }
  }, [isLoading, isInitialized, initializeCampaign]);

  // Auto-save when campaign data changes
  useEffect(() => {
    if (isInitialized && campaignData.id) {
      const timeoutId = setTimeout(autoSave, 2000);
      return () => clearTimeout(timeoutId);
    }
  }, [campaignData, isInitialized, autoSave]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading campaign...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
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
                <h1 className="text-2xl font-bold">Newsletter Campaign</h1>
                <p className="text-sm text-muted-foreground">
                  {campaignData.name || 'New Campaign'}
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              {isSaving && (
                <span className="text-sm text-muted-foreground">Saving...</span>
              )}
              <Button onClick={saveCampaign} disabled={isSaving}>
                <Save className="w-4 h-4 mr-2" />
                Save
              </Button>
              <Button variant="outline">
                <Send className="w-4 h-4 mr-2" />
                Send Test
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-4">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="content">Content</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
            <TabsTrigger value="preview">Preview</TabsTrigger>
          </TabsList>

          <TabsContent value="content" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Content Editor */}
              <div className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Campaign Details</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label htmlFor="name">Campaign Name</Label>
                      <Input
                        id="name"
                        value={campaignData.name}
                        onChange={(e) => updateCampaignData({ name: e.target.value })}
                        placeholder="Enter campaign name"
                      />
                    </div>
                    <div>
                      <Label htmlFor="subject">Subject Line</Label>
                      <Input
                        id="subject"
                        value={campaignData.subject_line}
                        onChange={(e) => updateCampaignData({ subject_line: e.target.value })}
                        placeholder="Enter subject line"
                      />
                    </div>
                    <div>
                      <Label htmlFor="preheader">Preheader Text</Label>
                      <Textarea
                        id="preheader"
                        value={campaignData.preheader_text || ''}
                        onChange={(e) => updateCampaignData({ preheader_text: e.target.value })}
                        placeholder="Enter preheader text"
                        rows={2}
                      />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Content Blocks</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {campaignData.blocks.map((block, index) => (
                      <div key={block.id} className="space-y-2">
                        <ContentBlockRenderer
                          block={block}
                          onUpdate={(updates) => updateBlock(block.id, updates)}
                          onRemove={() => removeBlock(block.id)}
                          isPreview={false}
                        />
                        <AddBlockButton 
                          onAddBlock={(type) => addBlock(type, block.id)}
                          position="after"
                        />
                      </div>
                    ))}
                    
                    {campaignData.blocks.length === 0 && (
                      <AddBlockButton 
                        onAddBlock={(type) => addBlock(type)}
                        position="start"
                      />
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Live Preview */}
              <div className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Eye className="w-4 h-4" />
                      Live Preview
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <EmailPreview
                      blocks={campaignData.blocks}
                      campaign={{
                        subject_line: campaignData.subject_line,
                        preheader_text: campaignData.preheader_text
                      }}
                    />
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="settings" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Global Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="fontFamily">Font Family</Label>
                  <Input
                    id="fontFamily"
                    value={campaignData.global_settings.fontFamily}
                    onChange={(e) => updateCampaignData({
                      global_settings: {
                        ...campaignData.global_settings,
                        fontFamily: e.target.value
                      }
                    })}
                  />
                </div>
                <div>
                  <Label htmlFor="fontSize">Font Size</Label>
                  <Input
                    id="fontSize"
                    value={campaignData.global_settings.fontSize}
                    onChange={(e) => updateCampaignData({
                      global_settings: {
                        ...campaignData.global_settings,
                        fontSize: e.target.value
                      }
                    })}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="preview" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Full Preview</CardTitle>
              </CardHeader>
              <CardContent>
                <EmailPreview
                  blocks={campaignData.blocks}
                  campaign={{
                    subject_line: campaignData.subject_line,
                    preheader_text: campaignData.preheader_text
                  }}
                  isFullPreview={true}
                />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};
