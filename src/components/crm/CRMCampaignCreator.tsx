
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { EmailBuilder } from './EmailBuilder';
import { EmailPreview } from './EmailPreview';
import { ContentBlock, GlobalSettings } from '@/types/emailBuilder';
import { getSeasonalTemplates, SeasonalTemplate } from '@/utils/seasonalTemplateService';
import { generateNewsletterBlocks } from '@/lib/newsletterUtils';
import { Save, Send, Eye, Calendar, Users, Settings, Loader2 } from 'lucide-react';

interface CampaignData {
  id?: string;
  name: string;
  subject_line: string;
  preheader_text: string;
  content: string;
  status: 'draft' | 'scheduled' | 'sent';
  tenant_id?: string;
  user_id?: string;
}

const defaultGlobalSettings: GlobalSettings = {
  fontFamily: 'Inter, sans-serif',
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
    backgroundColor: '#F8F9FA',
    textColor: '#6B7280'
  }
};

export const CRMCampaignCreator: React.FC<{ campaignSlug?: string; contentTaskId?: string | null }> = ({
  campaignSlug,
  contentTaskId
}) => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  // Memoize URL parameters to prevent re-renders
  const urlParams = useMemo(() => ({
    type: searchParams.get('type'),
    templateId: searchParams.get('templateId'),
    layout: searchParams.get('layout'),
    source: searchParams.get('source'),
    title: searchParams.get('title'),
    description: searchParams.get('description'),
    category: searchParams.get('category')
  }), [searchParams]);

  // Campaign state
  const [campaignData, setCampaignData] = useState<CampaignData>({
    name: '',
    subject_line: '',
    preheader_text: '',
    content: '',
    status: 'draft'
  });

  const [blocks, setBlocks] = useState<ContentBlock[]>([]);
  const [globalSettings, setGlobalSettings] = useState<GlobalSettings>(defaultGlobalSettings);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  // Preview states
  const [showPreview, setShowPreview] = useState(false);
  const [previewMode, setPreviewMode] = useState<'sidebar' | 'fullscreen'>('sidebar');

  // Memoize functions to prevent re-renders
  const handleSave = useCallback(async () => {
    if (saving) return;
    
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

      const campaignPayload = {
        ...campaignData,
        tenant_id: userData.tenant_id,
        user_id: user.user.id,
        content: JSON.stringify({ blocks, globalSettings })
      };

      let result;
      if (campaignData.id) {
        // Update existing campaign
        result = await supabase
          .from('crm_campaigns')
          .update(campaignPayload)
          .eq('id', campaignData.id)
          .select()
          .single();
      } else {
        // Create new campaign
        result = await supabase
          .from('crm_campaigns')
          .insert([campaignPayload])
          .select()
          .single();
      }

      if (result.error) throw result.error;

      setCampaignData(prev => ({ ...prev, id: result.data.id }));
      
      toast({
        title: "Campaign Saved",
        description: "Your campaign has been saved successfully."
      });
    } catch (error) {
      console.error('Error saving campaign:', error);
      toast({
        title: "Error",
        description: "Failed to save campaign. Please try again.",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  }, [campaignData, blocks, globalSettings, saving, toast]);

  // Load existing campaign or initialize from template
  useEffect(() => {
    if (isInitialized || loading) return;

    const initializeCampaign = async () => {
      setLoading(true);
      try {
        // Check if editing existing campaign (UUID format)
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        
        if (campaignSlug && uuidRegex.test(campaignSlug)) {
          // Load existing campaign
          const { data, error } = await supabase
            .from('crm_campaigns')
            .select('*')
            .eq('id', campaignSlug)
            .single();

          if (error) throw error;

          setCampaignData({
            id: data.id,
            name: data.name,
            subject_line: data.subject_line,
            preheader_text: data.preheader_text || '',
            content: data.content || '',
            status: data.status
          });

          // Parse content blocks if available
          if (data.content) {
            try {
              const parsed = JSON.parse(data.content);
              if (parsed.blocks) setBlocks(parsed.blocks);
              if (parsed.globalSettings) setGlobalSettings(parsed.globalSettings);
            } catch (parseError) {
              console.warn('Failed to parse campaign content:', parseError);
            }
          }
        } else {
          // Initialize new campaign from template or URL params
          await initializeFromTemplate();
        }
      } catch (error) {
        console.error('Error initializing campaign:', error);
        toast({
          title: "Error",
          description: "Failed to load campaign. Please try again.",
          variant: "destructive"
        });
      } finally {
        setLoading(false);
        setIsInitialized(true);
      }
    };

    initializeCampaign();
  }, [campaignSlug, isInitialized, loading, toast, urlParams]);

  const initializeFromTemplate = async () => {
    const { templateId, title, description, type } = urlParams;

    // Handle weekly theme templates
    if (templateId?.startsWith('weekly-theme-')) {
      const weekMatch = templateId.match(/^weekly-theme-(\d+)$/);
      if (weekMatch) {
        const weekNumber = parseInt(weekMatch[1]);
        
        try {
          // Try to fetch seasonal template from database
          const seasonalTemplates = await getSeasonalTemplates(weekNumber);
          if (seasonalTemplates.length > 0) {
            const template = seasonalTemplates[0];
            
            // Set campaign data from template
            setCampaignData(prev => ({
              ...prev,
              name: template.title,
              subject_line: template.title,
              preheader_text: template.seasonal_focus || ''
            }));

            // Generate blocks from template content
            const templateBlocks: ContentBlock[] = [
              {
                id: 'header-1',
                type: 'header',
                title: template.title,
                content: template.seasonal_focus || template.content_ideas,
                source: 'template',
                alignment: 'center',
                padding: 'medium'
              }
            ];

            // Add content ideas as text blocks
            if (template.content_ideas) {
              const ideas = template.content_ideas.split('\n').filter(idea => idea.trim());
              ideas.forEach((idea, index) => {
                templateBlocks.push({
                  id: `text-${index + 1}`,
                  type: 'text',
                  title: idea.trim(),
                  content: `Learn more about ${idea.toLowerCase()} and how it can benefit your garden this fall season.`,
                  source: 'template'
                });
              });
            }

            setBlocks(templateBlocks);
            return;
          }
        } catch (error) {
          console.warn('Failed to load seasonal template:', error);
        }
      }
    }

    // Fallback to URL parameters
    if (title || description) {
      const decodedTitle = decodeURIComponent(title || '');
      const decodedDescription = decodeURIComponent(description || '');
      
      setCampaignData(prev => ({
        ...prev,
        name: decodedTitle,
        subject_line: decodedTitle,
        preheader_text: decodedDescription
      }));

      // Generate basic blocks from URL params
      const initialBlocks: ContentBlock[] = [
        {
          id: 'header-1',
          type: 'header',
          title: decodedTitle,
          content: decodedDescription,
          source: 'manual',
          alignment: 'center',
          padding: 'medium'
        }
      ];

      if (decodedDescription) {
        initialBlocks.push({
          id: 'text-1',
          type: 'text',
          title: 'Introduction',
          content: decodedDescription,
          source: 'manual'
        });
      }

      setBlocks(initialBlocks);
    }
  };

  // Auto-save functionality
  useEffect(() => {
    if (!isInitialized || !campaignData.name) return;

    const autoSaveTimer = setTimeout(() => {
      if (campaignData.id) {
        handleSave();
      }
    }, 2000);

    return () => clearTimeout(autoSaveTimer);
  }, [campaignData, blocks, globalSettings, isInitialized, handleSave]);

  const handleBlocksChange = useCallback((newBlocks: ContentBlock[]) => {
    setBlocks(newBlocks);
  }, []);

  const handleGlobalSettingsChange = useCallback((newSettings: GlobalSettings) => {
    setGlobalSettings(newSettings);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="ml-2">Loading campaign...</span>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Campaign Builder</h1>
          <p className="text-muted-foreground">
            {campaignData.id ? 'Edit your campaign' : 'Create a new campaign'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => setShowPreview(!showPreview)}
          >
            <Eye className="h-4 w-4 mr-2" />
            Preview
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Save
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Campaign Settings */}
          <Card>
            <CardHeader>
              <CardTitle>Campaign Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="campaign-name">Campaign Name</Label>
                <Input
                  id="campaign-name"
                  value={campaignData.name}
                  onChange={(e) => setCampaignData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Enter campaign name"
                />
              </div>
              
              <div>
                <Label htmlFor="subject-line">Subject Line</Label>
                <Input
                  id="subject-line"
                  value={campaignData.subject_line}
                  onChange={(e) => setCampaignData(prev => ({ ...prev, subject_line: e.target.value }))}
                  placeholder="Enter email subject line"
                />
              </div>
              
              <div>
                <Label htmlFor="preheader">Preheader Text</Label>
                <Textarea
                  id="preheader"
                  value={campaignData.preheader_text}
                  onChange={(e) => setCampaignData(prev => ({ ...prev, preheader_text: e.target.value }))}
                  placeholder="Enter preheader text (optional)"
                  rows={2}
                />
              </div>
            </CardContent>
          </Card>

          {/* Email Builder */}
          <EmailBuilder
            blocks={blocks}
            onBlocksChange={handleBlocksChange}
            globalSettings={globalSettings}
            onGlobalSettingsChange={handleGlobalSettingsChange}
          />
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {showPreview && (
            <EmailPreview
              blocks={blocks}
              campaignName={campaignData.name}
              subjectLine={campaignData.subject_line}
              senderName="Your Garden Center"
              senderEmail="noreply@yourstore.com"
            />
          )}

          {/* Quick Stats */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Campaign Status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Status</span>
                <Badge variant={campaignData.status === 'draft' ? 'secondary' : 'default'}>
                  {campaignData.status}
                </Badge>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Blocks</span>
                <span className="font-medium">{blocks.length}</span>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Last Saved</span>
                <span className="text-sm">
                  {saving ? 'Saving...' : 'Auto-saved'}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Full Screen Preview Dialog */}
      {showPreview && previewMode === 'fullscreen' && (
        <EmailPreview
          blocks={blocks}
          campaignName={campaignData.name}
          subjectLine={campaignData.subject_line}
          senderName="Your Garden Center"
          senderEmail="noreply@yourstore.com"
        />
      )}
    </div>
  );
};
