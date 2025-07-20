import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Layout, Send, Save, RefreshCw, Mail, Users, Calendar, Sparkles } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { toast } from '@/utils/toast';
import { supabase } from '@/integrations/supabase/client';
import { useCRMAccess } from '@/hooks/useCRMAccess';
import { CRMUpgradePrompt } from '@/components/crm/CRMUpgradePrompt';
import { SegmentSelector } from '@/components/crm/campaigns/SegmentSelector';
import { useSegmentSelector } from '@/hooks/useSegmentSelector';
import { ContentImportBadge } from '@/components/crm/campaigns/ContentImportBadge';
import { saveCampaignAsDraft, sendCampaign } from '@/utils/crmCampaignService';
import { regenerateEmailContent, regenerateContentBlock } from '@/utils/aiContentRegenerator';
import { getSeasonalTemplates, recommendTemplatesForContent } from '@/utils/seasonalTemplateService';

interface CampaignData {
  name: string;
  subject: string;
  sender_name: string;
  sender_email: string;
  content: string;
  preheader?: string;
}

interface ScheduleSettings {
  type: 'immediate' | 'scheduled' | 'optimal';
  send_at?: string;
}

interface ContentBlock {
  type: 'header' | 'text' | 'image' | 'button' | 'divider';
  title?: string;
  content?: string;
  imageUrl?: string;
  ctaUrl?: string;
  ctaText?: string;
}

export const CRMCampaignCreator = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { hasCRMAccess } = useCRMAccess();

  const [campaignData, setCampaignData] = useState<CampaignData>({
    name: '',
    subject: '',
    sender_name: '',
    sender_email: '',
    content: '',
    preheader: ''
  });
  const [scheduleSettings, setScheduleSettings] = useState<ScheduleSettings>({
    type: 'immediate'
  });
  const [contentBlocks, setContentBlocks] = useState<ContentBlock[]>([
    { type: 'text', content: '' }
  ]);
  const [loading, setLoading] = useState(false);
  const [regeneratingContent, setRegeneratingContent] = useState(false);
  const [regeneratingBlock, setRegeneratingBlock] = useState<number | null>(null);

  const {
    isOpen,
    selectedSegments,
    openModal,
    closeModal,
    handleSegmentsSelected,
    clearSegments,
    hasSegments
  } = useSegmentSelector();

  useEffect(() => {
    // Populate fromContentTaskId if available
    const importedTitle = searchParams.get('title');
    const importedThemeSource = searchParams.get('themeSource');

    if (importedTitle) {
      setCampaignData(prev => ({
        ...prev,
        name: `${importedTitle} Campaign`,
        subject: `Check out our ${importedTitle} Newsletter!`,
        content: `We're excited to share our latest insights on ${importedTitle}.`
      }));
    }
  }, [searchParams]);

  const handleSaveCampaign = async () => {
    if (!campaignData.name.trim()) {
      toast.error('Please enter a campaign name');
      return;
    }

    if (selectedSegments.length === 0) {
      toast.error('Please select at least one segment');
      return;
    }

    setLoading(true);
    try {
      const campaignPayload = {
        ...campaignData,
        segments: selectedSegments,
        schedule: scheduleSettings,
        source_content_id: searchParams.get('fromContentTaskId'),
        source_metadata: {
          original_title: searchParams.get('title'),
          theme_source: searchParams.get('themeSource'),
          import_timestamp: new Date().toISOString()
        },
        content_blocks: contentBlocks
      };

      const savedCampaign = await saveCampaignAsDraft(campaignPayload);
      
      toast.success(`Campaign "${campaignData.name}" saved as draft!`);
      navigate('/crm/campaigns');
    } catch (error) {
      console.error('Error saving campaign:', error);
      toast.error('Failed to save campaign');
    } finally {
      setLoading(false);
    }
  };

  const handleSendCampaign = async () => {
    if (!campaignData.name.trim()) {
      toast.error('Please enter a campaign name');
      return;
    }

    if (selectedSegments.length === 0) {
      toast.error('Please select at least one segment');
      return;
    }

    setLoading(true);
    try {
      const campaignPayload = {
        ...campaignData,
        segments: selectedSegments,
        schedule: scheduleSettings,
        source_content_id: searchParams.get('fromContentTaskId'),
        source_metadata: {
          original_title: searchParams.get('title'),
          theme_source: searchParams.get('themeSource'),
          import_timestamp: new Date().toISOString()
        },
        content_blocks: contentBlocks
      };

      const sentCampaign = await sendCampaign(campaignPayload);
      
      const message = scheduleSettings.type === 'immediate' 
        ? `Campaign "${campaignData.name}" sent successfully!`
        : `Campaign "${campaignData.name}" scheduled successfully!`;
      
      toast.success(message);
      navigate('/crm/campaigns');
    } catch (error) {
      console.error('Error sending campaign:', error);
      toast.error('Failed to send campaign');
    } finally {
      setLoading(false);
    }
  };

  const handleRegenerateContent = async () => {
    if (!campaignData.content) {
      toast.error('No content to regenerate');
      return;
    }

    setRegeneratingContent(true);
    try {
      const regeneratedContent = await regenerateEmailContent(
        campaignData.content,
        {
          tone: 'professional',
          focus: 'promotional',
          businessContext: campaignData.name
        }
      );

      setCampaignData(prev => ({
        ...prev,
        content: regeneratedContent
      }));

      toast.success('Content regenerated successfully!');
    } catch (error) {
      console.error('Error regenerating content:', error);
      toast.error('Failed to regenerate content');
    } finally {
      setRegeneratingContent(false);
    }
  };

  const handleRegenerateBlock = async (blockIndex: number) => {
    const block = contentBlocks[blockIndex];
    if (!block) return;

    setRegeneratingBlock(blockIndex);
    try {
      const regeneratedBlock = await regenerateContentBlock(
        block,
        {
          tone: 'professional',
          focus: 'promotional'
        }
      );

      const updatedBlocks = [...contentBlocks];
      updatedBlocks[blockIndex] = regeneratedBlock;
      setContentBlocks(updatedBlocks);

      toast.success('Block regenerated successfully!');
    } catch (error) {
      console.error('Error regenerating block:', error);
      toast.error('Failed to regenerate block');
    } finally {
      setRegeneratingBlock(null);
    }
  };

  return (
    <div className="container mx-auto py-10">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            Create Campaign
            {searchParams.get('fromContentTaskId') && (
              <ContentImportBadge themeSource={searchParams.get('themeSource') as any} />
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Campaign Details */}
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="name">Campaign Name</Label>
              <Input
                id="name"
                value={campaignData.name}
                onChange={e => setCampaignData({ ...campaignData, name: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="subject">Subject</Label>
              <Input
                id="subject"
                value={campaignData.subject}
                onChange={e => setCampaignData({ ...campaignData, subject: e.target.value })}
              />
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="sender_name">Sender Name</Label>
              <Input
                id="sender_name"
                value={campaignData.sender_name}
                onChange={e => setCampaignData({ ...campaignData, sender_name: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="sender_email">Sender Email</Label>
              <Input
                id="sender_email"
                type="email"
                value={campaignData.sender_email}
                onChange={e => setCampaignData({ ...campaignData, sender_email: e.target.value })}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="preheader">Preheader</Label>
            <Input
              id="preheader"
              value={campaignData.preheader}
              onChange={e => setCampaignData({ ...campaignData, preheader: e.target.value })}
            />
          </div>

          <div>
            <Label htmlFor="content">Content</Label>
            <div className="relative">
              <Textarea
                id="content"
                value={campaignData.content}
                onChange={e => setCampaignData({ ...campaignData, content: e.target.value })}
                className="resize-none"
              />
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-2 right-2"
                onClick={handleRegenerateContent}
                disabled={regeneratingContent}
              >
                <RefreshCw className={`h-4 w-4 ${regeneratingContent ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>

          {/* Segment Selection */}
          <Separator />
          <div className="flex items-center justify-between">
            <Label>Segments</Label>
            {hasCRMAccess ? (
              <Button variant="outline" size="sm" onClick={openModal}>
                <Users className="h-4 w-4 mr-2" />
                Select Segments
              </Button>
            ) : (
              <CRMUpgradePrompt variant="button" size="sm" />
            )}
          </div>

          {selectedSegments.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {selectedSegments.map(segment => (
                <Badge key={segment.id} variant="secondary">
                  {segment.name}
                </Badge>
              ))}
            </div>
          )}

          {/* Schedule Settings */}
          <Separator />
          <div>
            <Label>Schedule</Label>
            <div className="mt-2 space-y-2">
              <div className="flex items-center space-x-2">
                <input
                  type="radio"
                  id="immediate"
                  value="immediate"
                  checked={scheduleSettings.type === 'immediate'}
                  onChange={() => setScheduleSettings({ type: 'immediate' })}
                />
                <Label htmlFor="immediate">Immediate</Label>
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="radio"
                  id="scheduled"
                  value="scheduled"
                  checked={scheduleSettings.type === 'scheduled'}
                  onChange={() => setScheduleSettings({ type: 'scheduled' })}
                />
                <Label htmlFor="scheduled">Scheduled</Label>
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="radio"
                  id="optimal"
                  value="optimal"
                  checked={scheduleSettings.type === 'optimal'}
                  onChange={() => setScheduleSettings({ type: 'optimal' })}
                />
                <Label htmlFor="optimal">Optimal Time</Label>
              </div>
            </div>
          </div>

          <SegmentSelector
            isOpen={isOpen}
            onClose={closeModal}
            onSegmentsSelected={handleSegmentsSelected}
            selectedSegments={selectedSegments}
          />

          {/* Action Buttons */}
          <Separator />
          <div className="flex justify-end space-x-2">
            <Button variant="secondary" onClick={handleSaveCampaign} disabled={loading}>
              <Save className="h-4 w-4 mr-2" />
              {loading ? 'Saving...' : 'Save Draft'}
            </Button>
            {hasCRMAccess ? (
              <Button onClick={handleSendCampaign} disabled={loading}>
                <Send className="h-4 w-4 mr-2" />
                {loading ? 'Send Campaign' : 'Send'}
              </Button>
            ) : (
              <CRMUpgradePrompt variant="button" />
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
