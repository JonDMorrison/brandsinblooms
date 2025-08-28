
import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Save, Send, Calendar, Eye, Settings, Plus, Trash2, ChevronUp, ChevronDown } from 'lucide-react';
import { LayoutRenderer } from '@/components/newsletter/LayoutRenderer';
import { EmailPreview } from '@/components/newsletter/EmailPreview';
import { useNewsletterRenderer } from '@/hooks/useNewsletterRenderer';
import { getSeasonalTemplates } from '@/utils/seasonalTemplateService';
import { NewsletterIdea } from '@/types/newsletter';
import { ContentBlock, AlignmentType, SpacingType, BlockType } from '@/types/emailBuilder';

// Database interfaces
interface DatabaseCampaign {
  id: string;
  name: string;
  tenant_id: string;
  user_id: string;
  subject_line: string;
  preheader_text?: string;
  sender_name: string;
  sender_email: string;
  status: 'draft' | 'scheduled' | 'sent';
  scheduled_at?: string;
  delivery_method: string;
  created_at: string;
  updated_at: string;
}

interface DatabaseContentTask {
  id: string;
  title: string;
  description: string;
  ai_output: string;
  status: string;
  week_number: number;
  tenant_id: string;
  user_id: string;
  created_at: string;
}

interface DatabaseSeasonalTemplate {
  id: string;
  title: string;
  theme: string;
  week_number: number;
  seasonal_focus: string;
  content_ideas: string | string[];
}

interface SeasonalTemplate {
  id: string;
  title: string;
  theme: string;
  week_number: number;
  seasonal_focus: string;
  content_ideas: string;
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
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [campaign, setCampaign] = useState<DatabaseCampaign | null>(null);
  const [contentTask, setContentTask] = useState<DatabaseContentTask | null>(null);
  const [blocks, setBlocks] = useState<ContentBlock[]>([]);
  const [seasonalTemplates, setSeasonalTemplates] = useState<SeasonalTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<SeasonalTemplate | null>(null);
  const [isNewCampaign, setIsNewCampaign] = useState(true);
  const [activeTab, setActiveTab] = useState('content');

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    subject_line: '',
    preheader_text: '',
    sender_name: 'Your Garden Center',
    sender_email: 'newsletter@yourgardencenter.com',
    status: 'draft' as const,
    scheduled_at: ''
  });

  // Load campaign data if editing existing campaign
  useEffect(() => {
    const loadCampaign = async () => {
      if (!campaignSlug) return;
      
      setLoading(true);
      try {
        const { data: user } = await supabase.auth.getUser();
        if (!user.user) return;

        const { data: userData } = await supabase
          .from('users')
          .select('tenant_id')
          .eq('id', user.user.id)
          .single();

        if (!userData?.tenant_id) return;

        // Check if campaignSlug is a UUID (existing campaign)
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        
        if (uuidRegex.test(campaignSlug)) {
          // Load existing campaign
          const { data: campaignData, error: campaignError } = await supabase
            .from('crm_campaigns')
            .select('*')
            .eq('id', campaignSlug)
            .eq('tenant_id', userData.tenant_id)
            .single();

          if (campaignError) throw campaignError;

          const typedCampaign = campaignData as DatabaseCampaign;
          setCampaign(typedCampaign);
          setFormData({
            name: typedCampaign.name,
            subject_line: typedCampaign.subject_line,
            preheader_text: typedCampaign.preheader_text || '',
            sender_name: typedCampaign.sender_name,
            sender_email: typedCampaign.sender_email,
            status: typedCampaign.status,
            scheduled_at: typedCampaign.scheduled_at || ''
          });
          setIsNewCampaign(false);

          // Load campaign blocks
          const { data: blocksData, error: blocksError } = await supabase
            .from('campaign_blocks')
            .select('*')
            .eq('campaign_id', campaignSlug)
            .order('order_index');

          if (blocksError) throw blocksError;

          const convertedBlocks: ContentBlock[] = (blocksData || []).map((block: any) => ({
            id: block.id,
            type: block.block_type as BlockType,
            title: block.content?.title,
            content: block.content?.content,
            imageUrl: block.image_url || '',
            ctaText: block.cta_text || '',
            ctaUrl: block.cta_url || '',
            source: 'template' as const,
            personaTag: block.persona_tag,
            alignment: 'left' as AlignmentType,
            padding: 'medium' as SpacingType,
            margin: 'medium' as SpacingType
          }));

          setBlocks(convertedBlocks);
        }
      } catch (error) {
        console.error('Error loading campaign:', error);
        toast({
          title: "Error",
          description: "Failed to load campaign data",
          variant: "destructive"
        });
      } finally {
        setLoading(false);
      }
    };

    loadCampaign();
  }, [campaignSlug, toast]);

  // Load content task if provided
  useEffect(() => {
    const loadContentTask = async () => {
      if (!contentTaskId) return;
      
      try {
        const { data: user } = await supabase.auth.getUser();
        if (!user.user) return;

        const { data: userData } = await supabase
          .from('users')
          .select('tenant_id')
          .eq('id', user.user.id)
          .single();

        if (!userData?.tenant_id) return;

        const { data: taskData, error: taskError } = await supabase
          .from('content_tasks')
          .select('*')
          .eq('id', contentTaskId)
          .eq('tenant_id', userData.tenant_id)
          .single();

        if (taskError) throw taskError;

        const typedTask = taskData as DatabaseContentTask;
        setContentTask(typedTask);

        // Set initial form data from content task
        if (isNewCampaign) {
          setFormData(prev => ({
            ...prev,
            name: typedTask.title,
            subject_line: typedTask.title
          }));
        }

        // Create initial blocks from content task
        if (typedTask.ai_output && isNewCampaign) {
          const initialBlocks: ContentBlock[] = [{
            id: 'header-1',
            type: 'newsletter-header',
            title: typedTask.title,
            content: typedTask.description,
            source: 'newsletter',
            alignment: 'center' as AlignmentType,
            padding: 'large' as SpacingType,
            margin: 'medium' as SpacingType
          }, {
            id: 'content-1',
            type: 'text',
            title: 'Main Content',
            content: typedTask.ai_output,
            source: 'newsletter',
            alignment: 'left' as AlignmentType,
            padding: 'medium' as SpacingType,
            margin: 'medium' as SpacingType
          }];
          
          setBlocks(initialBlocks);
        }
      } catch (error) {
        console.error('Error loading content task:', error);
      }
    };

    loadContentTask();
  }, [contentTaskId, isNewCampaign]);

  // Load seasonal templates
  useEffect(() => {
    const loadTemplates = async () => {
      try {
        const templates = await getSeasonalTemplates();
        const convertedTemplates: SeasonalTemplate[] = templates.map((template: DatabaseSeasonalTemplate) => ({
          ...template,
          content_ideas: Array.isArray(template.content_ideas) 
            ? template.content_ideas.join(', ') 
            : template.content_ideas || ''
        }));
        setSeasonalTemplates(convertedTemplates);
      } catch (error) {
        console.error('Error loading seasonal templates:', error);
      }
    };

    loadTemplates();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error('Not authenticated');

      const { data: userData } = await supabase
        .from('users')
        .select('tenant_id')
        .eq('id', user.user.id)
        .single();

      if (!userData?.tenant_id) throw new Error('No tenant found');

      let campaignId = campaign?.id;

      // Create or update campaign
      if (isNewCampaign) {
        const { data: newCampaign, error: campaignError } = await supabase
          .from('crm_campaigns')
          .insert([{
            ...formData,
            tenant_id: userData.tenant_id,
            user_id: user.user.id,
            delivery_method: 'shared_sender'
          }])
          .select()
          .single();

        if (campaignError) throw campaignError;
        
        campaignId = newCampaign.id;
        setCampaign(newCampaign as DatabaseCampaign);
        setIsNewCampaign(false);
      } else {
        const { error: updateError } = await supabase
          .from('crm_campaigns')
          .update(formData)
          .eq('id', campaignId);

        if (updateError) throw updateError;
      }

      // Save blocks
      if (campaignId && blocks.length > 0) {
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
            alignment: block.alignment,
            padding: block.padding
          },
          image_url: block.imageUrl,
          cta_text: block.ctaText,
          cta_url: block.ctaUrl,
          source: block.source,
          persona_tag: block.personaTag,
          order_index: index
        }));

        const { error: blocksError } = await supabase
          .from('campaign_blocks')
          .insert(blocksToInsert);

        if (blocksError) throw blocksError;
      }

      toast({
        title: "Success",
        description: "Campaign saved successfully"
      });

    } catch (error) {
      console.error('Error saving campaign:', error);
      toast({
        title: "Error",
        description: "Failed to save campaign",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  const addBlock = (type: BlockType) => {
    const newBlock: ContentBlock = {
      id: `${type}-${Date.now()}`,
      type,
      title: `New ${type} block`,
      content: '',
      source: 'manual',
      alignment: 'left',
      padding: 'medium',
      margin: 'medium'
    };
    
    setBlocks([...blocks, newBlock]);
  };

  const updateBlock = (blockId: string, updates: Partial<ContentBlock>) => {
    setBlocks(blocks.map(block => 
      block.id === blockId ? { ...block, ...updates } : block
    ));
  };

  const removeBlock = (blockId: string) => {
    setBlocks(blocks.filter(block => block.id !== blockId));
  };

  const moveBlock = (blockId: string, direction: 'up' | 'down') => {
    const currentIndex = blocks.findIndex(block => block.id === blockId);
    if (currentIndex === -1) return;
    
    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (newIndex < 0 || newIndex >= blocks.length) return;
    
    const newBlocks = [...blocks];
    [newBlocks[currentIndex], newBlocks[newIndex]] = [newBlocks[newIndex], newBlocks[currentIndex]];
    setBlocks(newBlocks);
  };

  const renderBlockEditor = (block: ContentBlock) => (
    <Card key={block.id} className="mb-4">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">
          {block.type.charAt(0).toUpperCase() + block.type.slice(1)} Block
        </CardTitle>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => moveBlock(block.id, 'up')}
            disabled={blocks.findIndex(b => b.id === block.id) === 0}
          >
            <ChevronUp className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => moveBlock(block.id, 'down')}
            disabled={blocks.findIndex(b => b.id === block.id) === blocks.length - 1}
          >
            <ChevronDown className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => removeBlock(block.id)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label htmlFor={`${block.id}-title`}>Title</Label>
          <Input
            id={`${block.id}-title`}
            value={block.title || ''}
            onChange={(e) => updateBlock(block.id, { title: e.target.value })}
            placeholder="Block title"
          />
        </div>
        
        <div>
          <Label htmlFor={`${block.id}-content`}>Content</Label>
          <Textarea
            id={`${block.id}-content`}
            value={block.content || ''}
            onChange={(e) => updateBlock(block.id, { content: e.target.value })}
            placeholder="Block content"
            rows={4}
          />
        </div>

        {block.type === 'image' && (
          <div>
            <Label htmlFor={`${block.id}-image`}>Image URL</Label>
            <Input
              id={`${block.id}-image`}
              value={block.imageUrl || ''}
              onChange={(e) => updateBlock(block.id, { imageUrl: e.target.value })}
              placeholder="Image URL"
            />
          </div>
        )}

        {(block.type === 'button' || block.type === 'cta') && (
          <>
            <div>
              <Label htmlFor={`${block.id}-cta-text`}>Button Text</Label>
              <Input
                id={`${block.id}-cta-text`}
                value={block.ctaText || ''}
                onChange={(e) => updateBlock(block.id, { ctaText: e.target.value })}
                placeholder="Button text"
              />
            </div>
            <div>
              <Label htmlFor={`${block.id}-cta-url`}>Button URL</Label>
              <Input
                id={`${block.id}-cta-url`}
                value={block.ctaUrl || ''}
                onChange={(e) => updateBlock(block.id, { ctaUrl: e.target.value })}
                placeholder="Button URL"
              />
            </div>
          </>
        )}

        <div className="grid grid-cols-3 gap-4">
          <div>
            <Label>Alignment</Label>
            <Select 
              value={block.alignment || 'left'} 
              onValueChange={(value: AlignmentType) => updateBlock(block.id, { alignment: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select alignment" />
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
              value={block.padding || 'medium'} 
              onValueChange={(value: SpacingType) => updateBlock(block.id, { padding: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select padding" />
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
              value={block.margin || 'medium'} 
              onValueChange={(value: SpacingType) => updateBlock(block.id, { margin: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select margin" />
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
      </CardContent>
    </Card>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">
            {isNewCampaign ? 'Create New Campaign' : 'Edit Campaign'}
          </h1>
          {contentTask && (
            <p className="text-muted-foreground">
              Based on: {contentTask.title}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
            Save
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="content">Content</TabsTrigger>
          <TabsTrigger value="design">Design</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
          <TabsTrigger value="preview">Preview</TabsTrigger>
        </TabsList>

        <TabsContent value="content" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Campaign Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="name">Campaign Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Enter campaign name"
                />
              </div>
              <div>
                <Label htmlFor="subject">Subject Line</Label>
                <Input
                  id="subject"
                  value={formData.subject_line}
                  onChange={(e) => setFormData(prev => ({ ...prev, subject_line: e.target.value }))}
                  placeholder="Enter subject line"
                />
              </div>
              <div>
                <Label htmlFor="preheader">Preheader Text</Label>
                <Input
                  id="preheader"
                  value={formData.preheader_text}
                  onChange={(e) => setFormData(prev => ({ ...prev, preheader_text: e.target.value }))}
                  placeholder="Enter preheader text"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Content Blocks</CardTitle>
              <div className="flex gap-2">
                <Button onClick={() => addBlock('text')} size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Text
                </Button>
                <Button onClick={() => addBlock('image')} size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Image
                </Button>
                <Button onClick={() => addBlock('cta')} size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  CTA
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {blocks.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  No content blocks yet. Add some content to get started.
                </p>
              ) : (
                <div className="space-y-4">
                  {blocks.map(renderBlockEditor)}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="design">
          <Card>
            <CardHeader>
              <CardTitle>Design Settings</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">Design customization options will be available here.</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings">
          <Card>
            <CardHeader>
              <CardTitle>Campaign Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="sender-name">Sender Name</Label>
                <Input
                  id="sender-name"
                  value={formData.sender_name}
                  onChange={(e) => setFormData(prev => ({ ...prev, sender_name: e.target.value }))}
                  placeholder="Your Garden Center"
                />
              </div>
              <div>
                <Label htmlFor="sender-email">Sender Email</Label>
                <Input
                  id="sender-email"
                  value={formData.sender_email}
                  onChange={(e) => setFormData(prev => ({ ...prev, sender_email: e.target.value }))}
                  placeholder="newsletter@yourgardencenter.com"
                />
              </div>
              <div>
                <Label htmlFor="scheduled-at">Scheduled Date</Label>
                <Input
                  id="scheduled-at"
                  type="datetime-local"
                  value={formData.scheduled_at}
                  onChange={(e) => setFormData(prev => ({ ...prev, scheduled_at: e.target.value }))}
                />
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
              {blocks.length > 0 ? (
                <div className="border rounded-lg p-4 bg-white">
                  <LayoutRenderer 
                    blocks={blocks}
                    className="max-w-2xl mx-auto"
                  />
                </div>
              ) : (
                <p className="text-muted-foreground text-center py-8">
                  Add some content blocks to see the preview.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};
