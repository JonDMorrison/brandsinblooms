import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { ContentBlock, GlobalSettings } from '@/types/emailBuilder';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { LayoutRenderer } from '@/components/crm/LayoutRenderer';
import { EmailPreview } from '@/components/crm/EmailPreview';
import { CampaignCreatorLayout } from '@/components/crm/CampaignCreatorLayout';
import { Plus, Mail, Eye, Save, Send, Wand2, Calendar } from 'lucide-react';

interface CRMCampaignCreatorProps {
  campaignSlug?: string;
  contentTaskId?: string | null;
}

interface SeasonalTemplate {
  id: string;
  title: string;
  description: string;
  category: string;
  content_ideas: string[];
  seasonal_focus: string;
  created_at: string;
}

interface CampaignData {
  name: string;
  subject_line: string;
  preheader_text: string;
  content: string;
  status: 'draft' | 'scheduled' | 'sent';
  sender_name: string;
  sender_email: string;
}

const defaultHeaderBlock: ContentBlock = {
  id: crypto.randomUUID(),
  type: 'header',
  title: 'Welcome to Our Newsletter',
  content: 'Your weekly dose of inspiration and updates',
  layout: 'full-width',
  alignment: 'center',
  visible: true,
  source: 'template'
};

const defaultTextBlock: ContentBlock = {
  id: crypto.randomUUID(),
  type: 'text',
  title: 'Main Content',
  content: 'Add your main content here. This is where you can share your thoughts, updates, or any information you want to communicate to your audience.',
  layout: 'full-width',
  alignment: 'left',
  visible: true,
  source: 'template'
};

const defaultCtaBlock: ContentBlock = {
  id: crypto.randomUUID(),
  type: 'cta',
  title: 'Call to Action',
  content: 'Ready to take the next step?',
  ctaText: 'Get Started',
  ctaUrl: 'https://example.com',
  layout: 'full-width',
  alignment: 'center',
  visible: true,
  source: 'template'
};

export const CRMCampaignCreator: React.FC<CRMCampaignCreatorProps> = ({ 
  campaignSlug, 
  contentTaskId 
}) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();

  const [blocks, setBlocks] = useState<ContentBlock[]>([
    defaultHeaderBlock,
    defaultTextBlock,
    defaultCtaBlock
  ]);
  const [campaign, setCampaign] = useState<CampaignData>({
    name: '',
    subject_line: '',
    preheader_text: '',
    content: '',
    status: 'draft',
    sender_name: '',
    sender_email: ''
  });
  const [globalSettings, setGlobalSettings] = useState<GlobalSettings>({
    fontFamily: 'Arial, sans-serif',
    fontSize: '16px',
    buttonStyle: {
      cornerRadius: '4px',
      backgroundColor: '#007bff',
      textColor: '#ffffff'
    },
    headerStyle: {
      backgroundColor: '#f8f9fa',
      textColor: '#333333'
    },
    footerStyle: {
      backgroundColor: '#f8f9fa',
      textColor: '#666666'
    }
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [seasonalTemplate, setSeasonalTemplate] = useState<SeasonalTemplate | null>(null);

  const loadSeasonalTemplate = async () => {
    const templateId = searchParams.get('templateId');
    if (!templateId) return;

    try {
      const { data, error } = await supabase
        .from('master_campaign_templates')
        .select('*')
        .eq('id', templateId)
        .single();

      if (error) throw error;

      if (data) {
        const template = data as SeasonalTemplate;
        setSeasonalTemplate(template);
        
        // Parse content_ideas as JSON if it's a string
        let contentIdeas: string[] = [];
        if (typeof template.content_ideas === 'string') {
          try {
            contentIdeas = JSON.parse(template.content_ideas);
          } catch {
            contentIdeas = [template.content_ideas];
          }
        } else if (Array.isArray(template.content_ideas)) {
          contentIdeas = template.content_ideas;
        }

        // Create blocks from template
        const templateBlocks: ContentBlock[] = [];
        
        // Add header block with template title
        templateBlocks.push({
          id: crypto.randomUUID(),
          type: 'header',
          title: template.title,
          content: template.description,
          layout: 'full-width',
          alignment: 'center',
          visible: true,
          source: 'template'
        });

        // Add content blocks from ideas
        if (contentIdeas && contentIdeas.length > 0) {
          contentIdeas.forEach((idea, index) => {
            templateBlocks.push({
              id: crypto.randomUUID(),
              type: 'text',
              title: `Section ${index + 1}`,
              content: idea,
              layout: 'full-width',
              alignment: 'left',
              visible: true,
              source: 'template'
            });
          });
        }

        // Add CTA block
        templateBlocks.push({
          id: crypto.randomUUID(),
          type: 'cta',
          title: 'Get Started',
          content: `Learn more about ${template.seasonal_focus || 'our services'}`,
          ctaText: 'Learn More',
          ctaUrl: 'https://example.com',
          layout: 'full-width',
          alignment: 'center',
          visible: true,
          source: 'template'
        });

        setBlocks(templateBlocks);
        
        // Update campaign with template info
        setCampaign(prev => ({
          ...prev,
          name: template.title,
          subject_line: template.title
        }));
      }
    } catch (error) {
      console.error('Error loading seasonal template:', error);
      toast({
        title: "Error",
        description: "Failed to load campaign template.",
        variant: "destructive"
      });
    }
  };

  useEffect(() => {
    loadSeasonalTemplate();
  }, [searchParams]);

  const saveCampaign = async () => {
    if (!campaign.name.trim()) {
      toast({
        title: "Campaign name required",
        description: "Please enter a campaign name before saving.",
        variant: "destructive"
      });
      return;
    }

    setSaving(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error('Not authenticated');

      const { data: userProfile } = await supabase
        .from('users')
        .select('tenant_id')
        .eq('id', userData.user.id)
        .single();

      if (!userProfile?.tenant_id) throw new Error('No tenant found');

      const campaignData = {
        name: campaign.name,
        subject_line: campaign.subject_line,
        preheader_text: campaign.preheader_text,
        content: JSON.stringify(blocks),
        status: campaign.status,
        sender_name: campaign.sender_name,
        sender_email: campaign.sender_email,
        tenant_id: userProfile.tenant_id,
        user_id: userData.user.id
      };

      const { data, error } = await supabase
        .from('crm_campaigns')
        .insert(campaignData)
        .select()
        .single();

      if (error) throw error;

      toast({
        title: "Campaign saved",
        description: "Your campaign has been saved successfully."
      });

      navigate(`/crm/campaigns/${data.id}`);
    } catch (error) {
      console.error('Error saving campaign:', error);
      toast({
        title: "Error saving campaign",
        description: "There was a problem saving your campaign. Please try again.",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  const addBlock = (type: ContentBlock['type']) => {
    const newBlock: ContentBlock = {
      id: crypto.randomUUID(),
      type,
      title: '',
      content: '',
      layout: 'full-width',
      alignment: 'left',
      visible: true,
      source: 'manual'
    };

    setBlocks(prev => [...prev, newBlock]);
  };

  const updateBlock = (blockId: string, updates: Partial<ContentBlock>) => {
    setBlocks(prev => prev.map(block => 
      block.id === blockId ? { ...block, ...updates } : block
    ));
  };

  const deleteBlock = (blockId: string) => {
    setBlocks(prev => prev.filter(block => block.id !== blockId));
  };

  const moveBlock = (blockId: string, direction: 'up' | 'down') => {
    setBlocks(prev => {
      const currentIndex = prev.findIndex(block => block.id === blockId);
      if (currentIndex === -1) return prev;

      const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
      if (newIndex < 0 || newIndex >= prev.length) return prev;

      const newBlocks = [...prev];
      [newBlocks[currentIndex], newBlocks[newIndex]] = [newBlocks[newIndex], newBlocks[currentIndex]];
      return newBlocks;
    });
  };

  return (
    <CampaignCreatorLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Create Campaign</h1>
            <p className="text-muted-foreground">
              {seasonalTemplate ? `Based on: ${seasonalTemplate.title}` : 'Build your email campaign'}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate('/crm/campaigns')}>
              Cancel
            </Button>
            <Button onClick={saveCampaign} disabled={saving}>
              {saving ? <Save className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
              Save Campaign
            </Button>
          </div>
        </div>

        <Tabs defaultValue="compose" className="w-full">
          <TabsList>
            <TabsTrigger value="compose">Compose</TabsTrigger>
            <TabsTrigger value="preview">Preview</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="compose" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Campaign Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="campaign-name">Campaign Name</Label>
                    <Input
                      id="campaign-name"
                      value={campaign.name}
                      onChange={(e) => setCampaign(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="Enter campaign name"
                    />
                  </div>
                  <div>
                    <Label htmlFor="subject-line">Subject Line</Label>
                    <Input
                      id="subject-line"
                      value={campaign.subject_line}
                      onChange={(e) => setCampaign(prev => ({ ...prev, subject_line: e.target.value }))}
                      placeholder="Enter subject line"
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="preheader">Preheader Text</Label>
                  <Input
                    id="preheader"
                    value={campaign.preheader_text}
                    onChange={(e) => setCampaign(prev => ({ ...prev, preheader_text: e.target.value }))}
                    placeholder="Preview text that appears after subject line"
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="sender-name">Sender Name</Label>
                    <Input
                      id="sender-name"
                      value={campaign.sender_name}
                      onChange={(e) => setCampaign(prev => ({ ...prev, sender_name: e.target.value }))}
                      placeholder="Your Name"
                    />
                  </div>
                  <div>
                    <Label htmlFor="sender-email">Sender Email</Label>
                    <Input
                      id="sender-email"
                      type="email"
                      value={campaign.sender_email}
                      onChange={(e) => setCampaign(prev => ({ ...prev, sender_email: e.target.value }))}
                      placeholder="your@email.com"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  Email Content
                  <Button onClick={() => addBlock('text')} size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Block
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {blocks.map((block, index) => (
                  <div key={block.id} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <Badge variant="secondary">{block.type}</Badge>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => moveBlock(block.id, 'up')}
                          disabled={index === 0}
                        >
                          ↑
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => moveBlock(block.id, 'down')}
                          disabled={index === blocks.length - 1}
                        >
                          ↓
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteBlock(block.id)}
                        >
                          ×
                        </Button>
                      </div>
                    </div>
                    <LayoutRenderer
                      block={block}
                      editable={true}
                      onUpdate={(updates) => updateBlock(block.id, updates)}
                    />
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="preview">
            <EmailPreview
              blocks={blocks}
              campaignName={campaign.name}
              subjectLine={campaign.subject_line}
              senderName={campaign.sender_name}
              senderEmail={campaign.sender_email}
            />
          </TabsContent>

          <TabsContent value="settings">
            <Card>
              <CardHeader>
                <CardTitle>Global Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Font Family</Label>
                  <Input
                    value={globalSettings.fontFamily}
                    onChange={(e) => setGlobalSettings(prev => ({ 
                      ...prev, 
                      fontFamily: e.target.value 
                    }))}
                  />
                </div>
                <div>
                  <Label>Font Size</Label>
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
    </CampaignCreatorLayout>
  );
};
