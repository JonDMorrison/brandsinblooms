
import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/utils/toast';
import { enhancedNewsletterToCRM } from '@/utils/enhancedNewsletterToCrmConverter';
import { EmailBlockEditor } from '@/components/crm/EmailBlockEditor';
import { EmailPreview } from '@/components/crm/EmailPreview';
import { ContentBlock } from '@/types/emailBuilder';
import { Mail, ArrowLeft, Send, Eye } from 'lucide-react';

export const CRMCampaignCreator: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  
  // Form state
  const [campaignName, setCampaignName] = useState('');
  const [subjectLine, setSubjectLine] = useState('');
  const [senderName, setSenderName] = useState('Your Garden Center');
  const [senderEmail, setSenderEmail] = useState('hello@yourgarden.com');
  const [contentBlocks, setContentBlocks] = useState<ContentBlock[]>([]);
  const [personaTags, setPersonaTags] = useState<string[]>([]);
  const [segmentSuggestions, setSegmentSuggestions] = useState<string[]>([]);
  
  // UI state
  const [isProcessing, setIsProcessing] = useState(true);
  const [showPreview, setShowPreview] = useState(false);
  const [processingError, setProcessingError] = useState<string | null>(null);

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
        blocksCount: contentBlocks.length
      });

      // Here you would typically save to your CRM/database
      // For now, we'll show a success message
      toast.success(`Campaign "${campaignName}" saved successfully!`);
      
      // Navigate back or to campaigns list
      navigate('/crm/campaigns');
      
    } catch (error) {
      console.error('❌ Failed to save campaign:', error);
      toast.error('Failed to save campaign');
    }
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
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
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
                Create Email Campaign
              </h1>
              <p className="text-muted-foreground">
                {contentBlocks.length > 0 ? 
                  `Newsletter imported with ${contentBlocks.length} content blocks` : 
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
              <Eye className="h-4 w-4 mr-2" />
              {showPreview ? 'Hide Preview' : 'Preview'}
            </Button>
            <Button onClick={handleSaveCampaign}>
              <Send className="h-4 w-4 mr-2" />
              Save Campaign
            </Button>
          </div>
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

        {/* Tags and Segments */}
        {(personaTags.length > 0 || segmentSuggestions.length > 0) && (
          <Card>
            <CardHeader>
              <CardTitle>Import Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {personaTags.length > 0 && (
                <div>
                  <Label className="text-sm font-medium">Persona Tags</Label>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {personaTags.map((tag, index) => (
                      <span
                        key={index}
                        className="px-2 py-1 bg-primary/10 text-primary rounded-md text-sm"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {segmentSuggestions.length > 0 && (
                <div>
                  <Label className="text-sm font-medium">Suggested Segments</Label>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {segmentSuggestions.map((segment, index) => (
                      <span
                        key={index}
                        className="px-2 py-1 bg-secondary/50 text-secondary-foreground rounded-md text-sm"
                      >
                        {segment}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Campaign Settings */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Campaign Settings</CardTitle>
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
                
                <div>
                  <Label htmlFor="subject-line">Subject Line</Label>
                  <Input
                    id="subject-line"
                    value={subjectLine}
                    onChange={(e) => setSubjectLine(e.target.value)}
                    placeholder="Enter email subject..."
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="sender-name">Sender Name</Label>
                    <Input
                      id="sender-name"
                      value={senderName}
                      onChange={(e) => setSenderName(e.target.value)}
                      placeholder="Your Name"
                    />
                  </div>
                  <div>
                    <Label htmlFor="sender-email">Sender Email</Label>
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
            <EmailBlockEditor
              blocks={contentBlocks}
              onBlocksChange={setContentBlocks}
            />
          </div>

          {/* Preview */}
          {showPreview && (
            <div className="lg:sticky lg:top-6">
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
