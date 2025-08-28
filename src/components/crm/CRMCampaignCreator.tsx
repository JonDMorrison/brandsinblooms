
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { AlertCircle, ArrowLeft, Save, Send, Eye, Loader2, CheckCircle, Clock, Mail, Globe, Calendar, Users } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

import { EmailBlockEditor } from './EmailBlockEditor';
import { EmailPreview } from './EmailPreview';
import { CampaignSettings } from './CampaignSettings';
import { GlobalSettings, ContentBlock, EmailCampaign } from '@/types/emailBuilder';
import { generateNewsletterBlocks, enrichNewsletterContent } from '@/utils/newsletterContentGenerator';
import { getSeasonalTemplates } from '@/utils/seasonalTemplateService';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

// Default settings
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
    cornerRadius: '6px'
  }
};

const defaultBlocks: ContentBlock[] = [
  {
    id: 'header_1',
    type: 'header',
    layout: 'full-width',
    title: 'Your Newsletter Title',
    content: '',
    imageUrl: '',
    ctaText: '',
    ctaUrl: '',
    source: 'manual',
    collapsed: false,
    alignment: 'center',
    padding: 'medium',
    margin: 'medium',
    responsiveBehavior: 'stack',
    visible: true,
    animation: 'fade-in'
  }
];

interface CRMCampaignCreatorProps {
  campaignSlug?: string;
  contentTaskId?: string | null;
}

export const CRMCampaignCreator: React.FC<CRMCampaignCreatorProps> = ({ 
  campaignSlug, 
  contentTaskId 
}) => {
  const navigate = useNavigate();
  const { user } = useAuth();
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

  // State
  const [campaign, setCampaign] = useState<EmailCampaign>({
    name: '',
    subject: '',
    preheader: '',
    fromName: '',
    fromEmail: '',
    replyTo: '',
    status: 'draft',
    scheduledAt: null,
    audienceId: null,
    audienceSize: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });

  const [blocks, setBlocks] = useState<ContentBlock[]>(defaultBlocks);
  const [globalSettings, setGlobalSettings] = useState<GlobalSettings>(defaultGlobalSettings);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'error' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('content');

  // Memoize the campaign initialization logic
  const initializeCampaign = useCallback(async () => {
    if (isLoading) return; // Prevent multiple initializations
    
    setIsLoading(true);
    setError(null);

    try {
      console.log('🚀 Initializing campaign with params:', { campaignSlug, contentTaskId, urlParams });

      // Handle existing campaign editing
      if (campaignSlug && !urlParams.templateId) {
        console.log('📝 Loading existing campaign:', campaignSlug);
        // Load existing campaign logic would go here
        setCampaign(prev => ({ ...prev, name: 'Existing Campaign' }));
        setIsLoading(false);
        return;
      }

      // Handle new newsletter from template
      if (urlParams.templateId?.startsWith('weekly-theme-')) {
        const weekNumber = parseInt(urlParams.templateId.replace('weekly-theme-', ''));
        console.log('🗓️ Processing weekly theme:', weekNumber);

        try {
          // Try to get seasonal template
          const seasonalTemplates = await getSeasonalTemplates(weekNumber);
          
          if (seasonalTemplates && seasonalTemplates.length > 0) {
            const template = seasonalTemplates[0];
            console.log('✅ Found seasonal template:', template);
            
            setCampaign(prev => ({
              ...prev,
              name: template.title || urlParams.title || `Week ${weekNumber} Campaign`,
              subject: template.title || urlParams.title || `Week ${weekNumber} Newsletter`,
              preheader: `${template.seasonal_focus || urlParams.description || 'Weekly garden insights'}`
            }));

            // Generate blocks from template
            const templateBlocks = generateNewsletterBlocks(template.title, template.seasonal_focus || template.description || '');
            const enrichedBlocks = await enrichNewsletterContent(templateBlocks, `Fall season focus: ${template.seasonal_focus}`);
            setBlocks(enrichedBlocks);
            
          } else {
            // Fallback to URL params
            console.log('⚠️ No seasonal template found, using URL params');
            
            setCampaign(prev => ({
              ...prev,
              name: decodeURIComponent(urlParams.title || `Week ${weekNumber} Campaign`),
              subject: decodeURIComponent(urlParams.title || `Week ${weekNumber} Newsletter`),
              preheader: decodeURIComponent(urlParams.description || 'Weekly garden insights')
            }));

            // Generate blocks from URL params
            const templateBlocks = generateNewsletterBlocks(
              decodeURIComponent(urlParams.title || 'Fall Newsletter'), 
              decodeURIComponent(urlParams.description || 'Fall season content')
            );
            const enrichedBlocks = await enrichNewsletterContent(templateBlocks, 'Fall season newsletter content');
            setBlocks(enrichedBlocks);
          }
        } catch (seasonalError) {
          console.error('Error fetching seasonal template:', seasonalError);
          // Fallback to URL params on error
          setCampaign(prev => ({
            ...prev,
            name: decodeURIComponent(urlParams.title || 'New Newsletter'),
            subject: decodeURIComponent(urlParams.title || 'Newsletter'),
            preheader: decodeURIComponent(urlParams.description || 'Newsletter content')
          }));
        }
      } else {
        // Default new campaign
        setCampaign(prev => ({
          ...prev,
          name: 'New Campaign',
          subject: 'Your Newsletter Subject',
          preheader: 'Preview text here...'
        }));
      }

    } catch (error) {
      console.error('Error initializing campaign:', error);
      setError('Failed to initialize campaign. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [campaignSlug, contentTaskId, urlParams, isLoading]);

  // Initialize campaign only once
  useEffect(() => {
    initializeCampaign();
  }, []); // Empty dependency array to run only once

  // Auto-save functionality
  const autoSave = useCallback(async () => {
    if (!campaign.name || isSaving) return;

    setSaveStatus('saving');
    setIsSaving(true);

    try {
      // Simulate save operation
      await new Promise(resolve => setTimeout(resolve, 1000));
      setSaveStatus('saved');
      console.log('✅ Campaign auto-saved');
    } catch (error) {
      console.error('Auto-save error:', error);
      setSaveStatus('error');
    } finally {
      setIsSaving(false);
      // Clear status after 3 seconds
      setTimeout(() => setSaveStatus(null), 3000);
    }
  }, [campaign.name, isSaving]);

  // Debounced auto-save effect
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (campaign.name && campaign.name !== 'New Campaign') {
        autoSave();
      }
    }, 2000);

    return () => clearTimeout(timeoutId);
  }, [campaign, blocks, globalSettings]); // Removed autoSave from dependencies to prevent infinite loop

  // Handle campaign updates
  const updateCampaign = useCallback((updates: Partial<EmailCampaign>) => {
    setCampaign(prev => ({ ...prev, ...updates, updatedAt: new Date().toISOString() }));
  }, []);

  // Handle block updates
  const updateBlocks = useCallback((newBlocks: ContentBlock[]) => {
    setBlocks(newBlocks);
  }, []);

  // Save campaign
  const handleSave = async () => {
    setSaveStatus('saving');
    setIsSaving(true);

    try {
      if (!user) throw new Error('User not authenticated');

      const campaignData = {
        name: campaign.name,
        subject: campaign.subject,
        preheader: campaign.preheader,
        from_name: campaign.fromName,
        from_email: campaign.fromEmail,
        reply_to: campaign.replyTo,
        status: campaign.status,
        scheduled_at: campaign.scheduledAt,
        audience_id: campaign.audienceId,
        content_blocks: blocks,
        global_settings: globalSettings,
        user_id: user.id,
        updated_at: new Date().toISOString()
      };

      const { data, error } = await supabase
        .from('email_campaigns')
        .upsert(campaignData, { onConflict: 'name,user_id' })
        .select()
        .single();

      if (error) throw error;

      setSaveStatus('saved');
      console.log('✅ Campaign saved successfully:', data);

    } catch (error) {
      console.error('Save error:', error);
      setSaveStatus('error');
      setError('Failed to save campaign. Please try again.');
    } finally {
      setIsSaving(false);
      setTimeout(() => setSaveStatus(null), 3000);
    }
  };

  // Send test email
  const handleSendTest = async () => {
    console.log('📧 Sending test email...');
    // Test email logic would go here
  };

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <Alert className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
        <Button onClick={() => navigate('/crm/campaigns')} variant="outline">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Campaigns
        </Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Button onClick={() => navigate('/crm/campaigns')} variant="outline" size="sm">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold">
              {isLoading ? 'Loading Campaign...' : (campaign.name || 'New Campaign')}
            </h1>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="outline">{campaign.status}</Badge>
              {saveStatus && (
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  {saveStatus === 'saving' && <Loader2 className="w-3 h-3 animate-spin" />}
                  {saveStatus === 'saved' && <CheckCircle className="w-3 h-3 text-green-600" />}
                  {saveStatus === 'error' && <AlertCircle className="w-3 h-3 text-red-600" />}
                  <span>
                    {saveStatus === 'saving' && 'Saving...'}
                    {saveStatus === 'saved' && 'Saved'}
                    {saveStatus === 'error' && 'Save failed'}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button onClick={handleSendTest} variant="outline" disabled={isSaving || isLoading}>
            <Mail className="w-4 h-4 mr-2" />
            Send Test
          </Button>
          <Button onClick={handleSave} disabled={isSaving || isLoading}>
            {isSaving ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            Save Campaign
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin mr-3" />
          <span>Loading campaign...</span>
        </div>
      ) : (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid grid-cols-3 w-fit">
            <TabsTrigger value="content" className="flex items-center gap-2">
              <Mail className="w-4 h-4" />
              Content
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex items-center gap-2">
              <Globe className="w-4 h-4" />
              Settings
            </TabsTrigger>
            <TabsTrigger value="preview" className="flex items-center gap-2">
              <Eye className="w-4 h-4" />
              Preview
            </TabsTrigger>
          </TabsList>

          <TabsContent value="content" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Content Editor */}
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Campaign Details</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label htmlFor="campaignName">Campaign Name</Label>
                      <Input
                        id="campaignName"
                        value={campaign.name}
                        onChange={(e) => updateCampaign({ name: e.target.value })}
                        placeholder="Enter campaign name"
                      />
                    </div>
                    <div>
                      <Label htmlFor="subject">Subject Line</Label>
                      <Input
                        id="subject"
                        value={campaign.subject}
                        onChange={(e) => updateCampaign({ subject: e.target.value })}
                        placeholder="Enter email subject"
                      />
                    </div>
                    <div>
                      <Label htmlFor="preheader">Preheader Text</Label>
                      <Textarea
                        id="preheader"
                        value={campaign.preheader}
                        onChange={(e) => updateCampaign({ preheader: e.target.value })}
                        placeholder="Preview text that appears after subject line"
                        rows={2}
                      />
                    </div>
                  </CardContent>
                </Card>

                <EmailBlockEditor blocks={blocks} onBlocksChange={updateBlocks} />
              </div>

              {/* Live Preview */}
              <div className="lg:sticky lg:top-6">
                <EmailPreview 
                  blocks={blocks} 
                  globalSettings={globalSettings} 
                  campaign={campaign}
                />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="settings">
            <CampaignSettings 
              campaign={campaign}
              globalSettings={globalSettings}
              onCampaignChange={updateCampaign}
              onGlobalSettingsChange={setGlobalSettings}
            />
          </TabsContent>

          <TabsContent value="preview">
            <div className="max-w-2xl mx-auto">
              <EmailPreview 
                blocks={blocks} 
                globalSettings={globalSettings} 
                campaign={campaign}
                isFullPreview={true}
              />
            </div>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
};
