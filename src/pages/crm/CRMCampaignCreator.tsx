import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from '@/utils/toast';
import { enhancedNewsletterToCRM } from '@/utils/enhancedNewsletterToCrmConverter';
import { CleanEmailBlockEditor } from '@/components/crm/CleanEmailBlockEditor';
import { EmailPreview } from '@/components/crm/EmailPreview';
import { SmartCampaignEnhancements } from '@/components/crm/SmartCampaignEnhancements';
import { SmartSendOptimization } from '@/components/crm/SmartSendOptimization';
import { ContentBlock } from '@/types/emailBuilder';
import { useSenderConfiguration } from '@/hooks/useSenderConfiguration';
import { Mail, ArrowLeft, Send, Eye, EyeOff, Settings, Zap, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

export const CRMCampaignCreator: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { senderConfig, loading: senderConfigLoading } = useSenderConfiguration();
  
  // Form state
  const [campaignName, setCampaignName] = useState('');
  const [subjectLine, setSubjectLine] = useState('');
  const [preheaderText, setPreheaderText] = useState('');
  const [senderName, setSenderName] = useState('');
  const [senderEmail, setSenderEmail] = useState('');
  const [contentBlocks, setContentBlocks] = useState<ContentBlock[]>([]);
  const [personaTags, setPersonaTags] = useState<string[]>([]);
  const [segmentSuggestions, setSegmentSuggestions] = useState<string[]>([]);
  const [syncedFrom, setSyncedFrom] = useState<string | null>(null);
  const [themeCampaignId, setThemeCampaignId] = useState<string | null>(null);
  const [scheduledAt, setScheduledAt] = useState<string | null>(null);
  const [sendReasoning, setSendReasoning] = useState<string>('');
  const [selectedSegmentIds, setSelectedSegmentIds] = useState<string[]>([]);

  // UI state
  const [isProcessing, setIsProcessing] = useState(true);
  const [showPreview, setShowPreview] = useState(false);
  const [activeTab, setActiveTab] = useState<'content' | 'enhance' | 'schedule'>('content');
  const [processingError, setProcessingError] = useState<string | null>(null);

  // Initialize sender information when sender config loads
  useEffect(() => {
    if (senderConfig && !senderConfigLoading) {
      setSenderName(senderConfig.displayName);
      setSenderEmail(senderConfig.senderEmail);
    }
  }, [senderConfig, senderConfigLoading]);

  useEffect(() => {
    const processNewsletterImport = async () => {
      const contentTaskId = searchParams.get('contentTaskId');
      const type = searchParams.get('type');
      const title = searchParams.get('title');
      
      console.log('🔍 [CRMCampaignCreator] Processing URL parameters:', {
        contentTaskId,
        type,
        title,
        hasContentTaskId: !!contentTaskId,
        isNewsletterType: type === 'newsletter'
      });

      // Check if this is a newsletter import (relaxed conditions)
      const isNewsletterImport = type === 'newsletter' || contentTaskId;
      
      if (isNewsletterImport && contentTaskId) {
        console.log('📧 [CRMCampaignCreator] Processing newsletter import');
        setIsProcessing(true);
        
        try {
          // Use enhanced newsletter to CRM converter
          const result = await enhancedNewsletterToCRM(contentTaskId, searchParams);
          
          console.log('✅ [CRMCampaignCreator] Newsletter processed successfully:', {
            campaignName: result.campaignName,
            subjectLine: result.subjectLine,
            blocksCount: result.contentBlocks.length,
            personaTagsCount: result.personaTags.length,
            segmentSuggestionsCount: result.segmentSuggestions.length
          });

          // Set form data from processed newsletter
          setCampaignName(result.campaignName);
          setSubjectLine(result.subjectLine);
          setContentBlocks(result.contentBlocks);
          setPersonaTags(result.personaTags);
          setSegmentSuggestions(result.segmentSuggestions);
          setSyncedFrom(contentTaskId);
          setThemeCampaignId(contentTaskId);
          
          toast.success(`Newsletter "${result.campaignName}" loaded with ${result.contentBlocks.length} content blocks`);
          
        } catch (error) {
          console.error('❌ [CRMCampaignCreator] Failed to process newsletter:', error);
          setProcessingError(error instanceof Error ? error.message : 'Failed to process newsletter content');
          
          // Set basic fallback data
          const fallbackTitle = title ? decodeURIComponent(title).replace(/\+/g, ' ') : 'Newsletter Campaign';
          setCampaignName(`📧 ${fallbackTitle}`);
          setSubjectLine('🌱 Your Garden Newsletter Update');
          
          toast.error('Failed to process newsletter content. Using basic template.');
        }
      } else {
        // Manual campaign creation
        console.log('✏️ [CRMCampaignCreator] Manual campaign creation mode');
        setCampaignName('New Campaign');
        setSubjectLine('');
      }
      
      setIsProcessing(false);
    };

    processNewsletterImport();
  }, [searchParams]);

  const handleSaveCampaign = async () => {
    if (!campaignName.trim()) {
      toast.error('Please enter a campaign name');
      return;
    }

    try {
      console.log('💾 [CRMCampaignCreator] Saving campaign:', {
        name: campaignName,
        subject: subjectLine,
        blocksCount: contentBlocks.length,
        scheduledAt,
        segmentIds: selectedSegmentIds
      });

      // Here you would implement the actual save logic
      // For now, we'll just show success
      toast.success(`Campaign "${campaignName}" saved successfully!`);
      navigate('/crm/campaigns');
      
    } catch (error) {
      console.error('❌ Failed to save campaign:', error);
      toast.error('Failed to save campaign');
    }
  };

  const handleTimingChange = (sendAt: string, reasoning: string) => {
    setScheduledAt(sendAt);
    setSendReasoning(reasoning);
  };

  const handleAudienceChange = (segmentIds: string[]) => {
    setSelectedSegmentIds(segmentIds);
  };

  if (isProcessing) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-muted-foreground">Processing newsletter content...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto p-6 space-y-6">
        {/* Simplified Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/crm/campaigns')}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <Mail className="h-6 w-6 text-primary" />
                {campaignName || 'New Email Campaign'}
              </h1>
              <p className="text-muted-foreground">
                {contentBlocks.length > 0 ? 
                  `${contentBlocks.length} content blocks` : 
                  'Design and send your email campaign'
                }
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setShowPreview(!showPreview)}
            >
              {showPreview ? (
                <>
                  <EyeOff className="h-4 w-4 mr-2" />
                  Hide Preview
                </>
              ) : (
                <>
                  <Eye className="h-4 w-4 mr-2" />
                  Preview
                </>
              )}
            </Button>
            <Button onClick={handleSaveCampaign}>
              <Send className="h-4 w-4 mr-2" />
              Save Campaign
            </Button>
          </div>
        </div>

        {/* Campaign Progress Tabs */}
        <div className="flex gap-1 p-1 bg-muted rounded-lg w-fit">
          <Button
            variant={activeTab === 'content' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setActiveTab('content')}
          >
            <Settings className="h-4 w-4 mr-2" />
            Content
          </Button>
          <Button
            variant={activeTab === 'enhance' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setActiveTab('enhance')}
          >
            <Sparkles className="h-4 w-4 mr-2" />
            Enhance
          </Button>
          <Button
            variant={activeTab === 'schedule' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setActiveTab('schedule')}
          >
            <Zap className="h-4 w-4 mr-2" />
            Schedule
          </Button>
        </div>

        {/* Error Alert */}
        {processingError && (
          <Card className="border-destructive">
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-destructive">
                <span className="text-sm font-medium">Processing Error:</span>
                <span className="text-sm">{processingError}</span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Dynamic Grid Layout */}
        <div className={cn(
          "grid gap-6 w-full transition-all duration-300",
          showPreview ? "grid-cols-1 lg:grid-cols-3" : "grid-cols-1 lg:grid-cols-2"
        )}>
          {/* Main Content Column */}
          <div className="space-y-6">
            {activeTab === 'content' && (
              <>
                {/* Campaign Settings */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Settings className="h-5 w-5" />
                      Campaign Settings
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label htmlFor="campaign-name">Campaign Name</Label>
                      <Input
                        id="campaign-name"
                        value={campaignName}
                        onChange={(e) => setCampaignName(e.target.value)}
                        placeholder="Enter campaign name..."
                      />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="sender-name">From Name</Label>
                        <Input
                          id="sender-name"
                          value={senderName}
                          onChange={(e) => setSenderName(e.target.value)}
                          placeholder="Your Name"
                        />
                      </div>
                      <div>
                        <Label htmlFor="sender-email">From Email</Label>
                        <Input
                          id="sender-email"
                          type="email"
                          value={senderEmail}
                          onChange={(e) => setSenderEmail(e.target.value)}
                          placeholder="your@email.com"
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Content Blocks Editor */}
                <CleanEmailBlockEditor
                  blocks={contentBlocks}
                  onBlocksChange={setContentBlocks}
                />
              </>
            )}
          </div>

          {/* Enhancement/Schedule Column */}
          <div className="space-y-6">
            {activeTab === 'enhance' && (
              <SmartCampaignEnhancements
                subjectLine={subjectLine}
                onSubjectLineChange={setSubjectLine}
                preheaderText={preheaderText}
                onPreheaderTextChange={setPreheaderText}
                contentBlocks={contentBlocks}
                personaTags={personaTags}
                onPersonaTagsChange={setPersonaTags}
                syncedFrom={syncedFrom || undefined}
                themeCampaignId={themeCampaignId || undefined}
                campaignName={campaignName}
              />
            )}

            {activeTab === 'schedule' && (
              <SmartSendOptimization
                campaignId={themeCampaignId || 'new'}
                personaTags={personaTags}
                onTimingChange={handleTimingChange}
                onAudienceChange={handleAudienceChange}
                initialScheduledAt={scheduledAt || undefined}
              />
            )}
          </div>

          {/* Preview Column - Only shown when showPreview is true */}
          {showPreview && (
            <div className="lg:sticky lg:top-6 h-fit">
              <EmailPreview
                blocks={contentBlocks}
                campaignName={campaignName}
                subjectLine={subjectLine}
                senderName={senderName}
                senderEmail={senderEmail}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CRMCampaignCreator;
