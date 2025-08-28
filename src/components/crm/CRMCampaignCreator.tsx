
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Plus, Trash2, Mail, Edit3 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { PageHeader } from '@/components/common/PageHeader';
import { MagazineNewsletterRenderer } from '@/components/newsletter/MagazineNewsletterRenderer';

interface CRMCampaignCreatorProps {
  campaignSlug?: string;
  contentTaskId?: string | null;
}

interface CampaignData {
  name: string;
  subject_line: string;
  preheader: string;
  content: string;
  status: 'draft' | 'scheduled' | 'sent';
  scheduled_at?: string;
  tenant_id: string;
  user_id: string;
  source_content_task_id?: string;
}

interface DatabaseSeasonalTemplate {
  id: string;
  title: string;
  theme: string;
  week_number: number;
  seasonal_focus: string;
  content_ideas: string;
  created_at: string;
  updated_at: string;
  platform_specific_notes: any;
  prompt: string;
  target_audience_notes: string;
}

interface CampaignBlock {
  id: string;
  block_type: string;
  content: any;
  image_url?: string;
  cta_text?: string;
  cta_url?: string;
  source?: string;
  persona_tag?: string;
  order_index: number;
}

export const CRMCampaignCreator: React.FC<CRMCampaignCreatorProps> = ({ 
  campaignSlug, 
  contentTaskId 
}) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [savingCampaign, setSavingCampaign] = useState(false);
  const [campaignData, setCampaignData] = useState<CampaignData>({
    name: '',
    subject_line: '',
    preheader: '',
    content: '',
    status: 'draft',
    tenant_id: user?.user_metadata?.tenant_id || '',
    user_id: user?.id || ''
  });
  const [blocks, setBlocks] = useState<CampaignBlock[]>([]);
  const [seasonalTemplates, setSeasonalTemplates] = useState<DatabaseSeasonalTemplate[]>([]);
  const [contentTask, setContentTask] = useState<any>(null);
  const [existingCampaign, setExistingCampaign] = useState<any>(null);

  // Load seasonal templates
  useEffect(() => {
    const loadSeasonalTemplates = async () => {
      try {
        const { data, error } = await supabase
          .from('master_campaign_templates')
          .select('*')
          .order('week_number');

        if (error) throw error;
        if (data) {
          setSeasonalTemplates(data);
        }
      } catch (error) {
        console.error('Error loading seasonal templates:', error);
      }
    };

    loadSeasonalTemplates();
  }, []);

  // Load existing campaign or content task
  useEffect(() => {
    const loadInitialData = async () => {
      if (!user) return;
      
      setLoading(true);
      
      try {
        // Check if editing existing campaign
        if (campaignSlug && campaignSlug.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)) {
          const { data: campaign, error } = await supabase
            .from('crm_campaigns')
            .select('*, campaign_blocks(*)')
            .eq('id', campaignSlug)
            .eq('tenant_id', user.user_metadata?.tenant_id)
            .single();

          if (error) throw error;
          
          if (campaign) {
            setExistingCampaign(campaign);
            setCampaignData({
              name: campaign.name || '',
              subject_line: campaign.subject_line || '',
              preheader: campaign.preheader || '',
              content: campaign.content || '',
              status: campaign.status || 'draft',
              tenant_id: campaign.tenant_id,
              user_id: campaign.user_id
            });
            
            if (campaign.campaign_blocks) {
              setBlocks(campaign.campaign_blocks.map((block: any) => ({
                id: block.id,
                block_type: block.block_type as string,
                content: typeof block.content === 'object' ? block.content : { text: block.content || '' },
                image_url: block.image_url,
                cta_text: block.cta_text,
                cta_url: block.cta_url,
                source: block.source,
                persona_tag: block.persona_tag,
                order_index: block.order_index || 0
              })));
            }
          }
        }
        
        // Load content task if provided
        if (contentTaskId) {
          const { data: task, error } = await supabase
            .from('content_tasks')
            .select('*, campaigns(*)')
            .eq('id', contentTaskId)
            .single();

          if (error) throw error;
          
          if (task) {
            setContentTask(task);
            
            // Pre-fill campaign data from content task
            if (!existingCampaign) {
              setCampaignData(prev => ({
                ...prev,
                name: task.campaigns?.title || `Newsletter Campaign - ${new Date().toLocaleDateString()}`,
                content: task.ai_output || '',
                source_content_task_id: task.id
              }));
            }

            // Try to find matching seasonal template
            const matchingTemplate = seasonalTemplates.find(template => 
              task.campaigns?.theme && template.theme.toLowerCase().includes(task.campaigns.theme.toLowerCase())
            );

            if (matchingTemplate) {
              const contentIdeas = typeof matchingTemplate.content_ideas === 'string' 
                ? matchingTemplate.content_ideas 
                : Array.isArray(matchingTemplate.content_ideas) 
                  ? matchingTemplate.content_ideas.join('\n')
                  : '';

              const seasonalFocus = matchingTemplate.seasonal_focus || '';
              
              // Generate blocks from template
              const templateBlocks = [
                {
                  id: `block-${Date.now()}`,
                  block_type: 'text',
                  content: { text: contentIdeas },
                  order_index: 0
                },
                {
                  id: `block-${Date.now() + 1}`,
                  block_type: 'seasonal_focus',
                  content: { text: seasonalFocus },
                  order_index: 1
                }
              ];
              
              setBlocks(templateBlocks);
            }
          }
        }
      } catch (error) {
        console.error('Error loading campaign data:', error);
        toast({
          title: "Error",
          description: "Failed to load campaign data",
          variant: "destructive"
        });
      } finally {
        setLoading(false);
      }
    };

    loadInitialData();
  }, [user, campaignSlug, contentTaskId, seasonalTemplates]);

  const addBlock = (type: string) => {
    const newBlock: CampaignBlock = {
      id: `block-${Date.now()}`,
      block_type: type,
      content: { text: '', title: '' },
      order_index: blocks.length
    };
    setBlocks([...blocks, newBlock]);
  };

  const updateBlock = (blockId: string, updates: Partial<CampaignBlock>) => {
    setBlocks(blocks.map(block => 
      block.id === blockId ? { ...block, ...updates } : block
    ));
  };

  const removeBlock = (blockId: string) => {
    setBlocks(blocks.filter(block => block.id !== blockId));
  };

  const saveCampaign = async () => {
    if (!user) return;
    
    setSavingCampaign(true);
    
    try {
      let campaignId = existingCampaign?.id;
      
      // Create or update campaign
      if (existingCampaign) {
        const { error } = await supabase
          .from('crm_campaigns')
          .update({
            name: campaignData.name,
            subject_line: campaignData.subject_line,
            preheader: campaignData.preheader,
            content: campaignData.content,
            status: campaignData.status,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingCampaign.id);
          
        if (error) throw error;
      } else {
        const { data: newCampaign, error } = await supabase
          .from('crm_campaigns')
          .insert([{
            ...campaignData,
            tenant_id: user.user_metadata?.tenant_id,
            user_id: user.id
          }])
          .select()
          .single();
          
        if (error) throw error;
        campaignId = newCampaign.id;
        setExistingCampaign(newCampaign);
      }

      // Save blocks
      if (campaignId && blocks.length > 0) {
        // Delete existing blocks
        await supabase
          .from('campaign_blocks')
          .delete()
          .eq('campaign_id', campaignId);

        // Insert new blocks
        const { error: blocksError } = await supabase
          .from('campaign_blocks')
          .insert(
            blocks.map((block, index) => ({
              campaign_id: campaignId,
              block_type: block.block_type,
              content: block.content,
              image_url: block.image_url,
              cta_text: block.cta_text,
              cta_url: block.cta_url,
              source: block.source || 'manual',
              persona_tag: block.persona_tag,
              order_index: index
            }))
          );

        if (blocksError) throw blocksError;
      }

      toast({
        title: "Success!",
        description: "Campaign saved successfully"
      });

      // Navigate to campaigns list or stay on edit page
      if (!existingCampaign) {
        navigate(`/crm/campaigns/${campaignId}`);
      }
      
    } catch (error) {
      console.error('Error saving campaign:', error);
      toast({
        title: "Error",
        description: "Failed to save campaign",
        variant: "destructive"
      });
    } finally {
      setSavingCampaign(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <PageHeader
        title={existingCampaign ? "Edit Campaign" : "Create Campaign"}
        description="Design and customize your email campaign"
        primaryAction={{
          label: savingCampaign ? "Saving..." : "Save Campaign",
          icon: savingCampaign ? Loader2 : Mail,
          onClick: saveCampaign
        }}
      />

      <div className="max-w-7xl mx-auto px-6 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Campaign Settings */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Campaign Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Campaign Name</label>
                  <Input
                    value={campaignData.name}
                    onChange={(e) => setCampaignData({...campaignData, name: e.target.value})}
                    placeholder="Enter campaign name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Subject Line</label>
                  <Input
                    value={campaignData.subject_line}
                    onChange={(e) => setCampaignData({...campaignData, subject_line: e.target.value})}
                    placeholder="Enter email subject line"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Preheader Text</label>
                  <Input
                    value={campaignData.preheader}
                    onChange={(e) => setCampaignData({...campaignData, preheader: e.target.value})}
                    placeholder="Preview text that appears after subject line"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Content Blocks */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  Content Blocks
                  <Button
                    onClick={() => addBlock('text')}
                    size="sm"
                    variant="outline"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Block
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {blocks.map((block, index) => (
                  <div key={block.id} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <Badge variant="secondary">{block.block_type}</Badge>
                      <Button
                        onClick={() => removeBlock(block.id)}
                        size="sm"
                        variant="ghost"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                    
                    <Textarea
                      value={block.content?.text || ''}
                      onChange={(e) => updateBlock(block.id, {
                        content: { ...block.content, text: e.target.value }
                      })}
                      placeholder="Enter block content..."
                      rows={3}
                    />

                    {block.block_type === 'cta' && (
                      <div className="mt-3 grid grid-cols-2 gap-3">
                        <Input
                          value={block.cta_text || ''}
                          onChange={(e) => updateBlock(block.id, { cta_text: e.target.value })}
                          placeholder="Button text"
                        />
                        <Input
                          value={block.cta_url || ''}
                          onChange={(e) => updateBlock(block.id, { cta_url: e.target.value })}
                          placeholder="Button URL"
                        />
                      </div>
                    )}
                  </div>
                ))}

                {blocks.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    <Edit3 className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>No content blocks yet. Add your first block to get started.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Preview */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Email Preview</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="border rounded-lg p-6 bg-white min-h-[400px]">
                  {campaignData.subject_line && (
                    <div className="mb-4 p-3 bg-gray-50 rounded border-l-4 border-blue-500">
                      <p className="font-semibold text-sm text-gray-600">Subject:</p>
                      <p className="font-medium">{campaignData.subject_line}</p>
                      {campaignData.preheader && (
                        <p className="text-sm text-gray-500 mt-1">{campaignData.preheader}</p>
                      )}
                    </div>
                  )}

                  <MagazineNewsletterRenderer
                    title={campaignData.name}
                    blocks={blocks.map(block => ({
                      title: block.content?.title || '',
                      body: block.content?.text || '',
                      cta: block.cta_text || 'Learn More',
                      link: block.cta_url || '#',
                      image_prompt: '',
                      alt_text: ''
                    }))}
                    meta={{
                      week_focus: contentTask?.campaigns?.theme || '',
                      seasonal_notes: '',
                      target_audience: ''
                    }}
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};
