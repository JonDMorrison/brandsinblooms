
import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, RefreshCw, Eye } from 'lucide-react';
import { EmailComposer } from '@/components/crm/EmailComposer';
import { ContentImportBadge } from '@/components/crm/campaigns/ContentImportBadge';
import { enhancedNewsletterToCRM } from '@/utils/enhancedNewsletterToCrmConverter';
import { toast } from '@/utils/toast';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function CRMCampaignCreator() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(false);
  const [importedContent, setImportedContent] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [regenerating, setRegenerating] = useState(false);

  // Check for content import parameters
  const fromContentTaskId = searchParams.get('fromContentTaskId');
  const source = searchParams.get('source');
  const isContentImport = fromContentTaskId && source === 'newsletter_content';

  useEffect(() => {
    if (isContentImport) {
      loadImportedContent();
    }
  }, [isContentImport, fromContentTaskId]);

  const loadImportedContent = async () => {
    if (!fromContentTaskId) return;

    setLoading(true);
    setError(null);

    try {
      console.log('📥 Loading imported content:', { fromContentTaskId });
      
      const result = await enhancedNewsletterToCRM(fromContentTaskId, searchParams);
      
      console.log('✅ Content imported successfully:', result);
      setImportedContent(result);
      
      toast.success(`Newsletter content imported: "${result.campaignName}"`);
    } catch (error) {
      console.error('❌ Failed to import content:', error);
      setError('Failed to import newsletter content. Please try again or create a campaign manually.');
      toast.error('Failed to import newsletter content');
    } finally {
      setLoading(false);
    }
  };

  const handleRegenerateContent = async () => {
    if (!fromContentTaskId) return;

    setRegenerating(true);
    try {
      // Call regeneration API or refresh content
      await loadImportedContent();
      toast.success('Content regenerated successfully');
    } catch (error) {
      console.error('❌ Failed to regenerate content:', error);
      toast.error('Failed to regenerate content');
    } finally {
      setRegenerating(false);
    }
  };

  const handleSaveCampaign = async (emailData: any) => {
    try {
      console.log('💾 Saving CRM campaign:', emailData);
      
      // Add imported content metadata to save data
      const campaignData = {
        ...emailData,
        ...(importedContent && {
          source_content_id: fromContentTaskId,
          source_metadata: importedContent.sourceMetadata,
          content_blocks: importedContent.contentBlocks,
        })
      };

      // TODO: Implement actual save logic to crm_campaigns table
      console.log('Campaign data to save:', campaignData);
      
      toast.success('Campaign saved as draft');
    } catch (error) {
      console.error('❌ Failed to save campaign:', error);
      toast.error('Failed to save campaign');
    }
  };

  const handleSendCampaign = async (emailData: any) => {
    try {
      console.log('📤 Sending CRM campaign:', emailData);
      
      // Add imported content metadata
      const campaignData = {
        ...emailData,
        ...(importedContent && {
          source_content_id: fromContentTaskId,
          source_metadata: importedContent.sourceMetadata,
        })
      };

      // TODO: Implement actual send logic
      console.log('Campaign data to send:', campaignData);
      
      toast.success('Campaign sent successfully!');
      navigate('/crm/campaigns');
    } catch (error) {
      console.error('❌ Failed to send campaign:', error);
      toast.error('Failed to send campaign');
    }
  };

  const getInitialEmailData = () => {
    if (!importedContent) return {};

    return {
      subject: importedContent.subjectLine,
      senderName: 'Your Garden Center',
      senderEmail: 'hello@yourgardencenter.com',
      content: importedContent.contentBlocks
        .filter(block => block.type === 'text')
        .map(block => `**${block.title}**\n\n${block.content}`)
        .join('\n\n'),
      segments: [], // Will be populated by segment suggestions
      schedule: { type: 'optimal' }
    };
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6 max-w-6xl">
        <div className="space-y-6">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => navigate('/crm/campaigns')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Campaigns
            </Button>
          </div>
          
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="space-y-2">
                  <Skeleton className="h-8 w-64" />
                  <Skeleton className="h-4 w-96" />
                </div>
                <Skeleton className="h-6 w-32" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-32 w-full" />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-6 max-w-6xl">
        <div className="space-y-6">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => navigate('/crm/campaigns')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Campaigns
            </Button>
          </div>
          
          <Alert variant="destructive">
            <AlertDescription>
              {error}
            </AlertDescription>
          </Alert>

          <Card>
            <CardHeader>
              <CardTitle>Create New Campaign</CardTitle>
            </CardHeader>
            <CardContent>
              <EmailComposer
                onSave={handleSaveCampaign}
                onSend={handleSendCampaign}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => navigate('/crm/campaigns')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Campaigns
            </Button>
            
            {importedContent && (
              <ContentImportBadge themeSource={importedContent.themeSource} />
            )}
          </div>

          {importedContent && (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleRegenerateContent}
                disabled={regenerating}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${regenerating ? 'animate-spin' : ''}`} />
                {regenerating ? 'Regenerating...' : 'Regenerate Content'}
              </Button>
            </div>
          )}
        </div>

        {/* Campaign Title */}
        {importedContent && (
          <div className="space-y-2">
            <h1 className="text-3xl font-bold text-gray-900">
              {importedContent.campaignName}
            </h1>
            <p className="text-gray-600">
              This email campaign was created using your approved BloomSuite content. 
              You can still make edits and customizations below.
            </p>
          </div>
        )}

        {/* Email Composer */}
        <Card>
          <CardContent className="p-0">
            <EmailComposer
              onSave={handleSaveCampaign}
              onSend={handleSendCampaign}
              initialData={getInitialEmailData()}
            />
          </CardContent>
        </Card>

        {/* Source Information */}
        {importedContent && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Eye className="h-5 w-5" />
                Source Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium text-gray-700">Content Source:</span>
                  <p className="text-gray-600 capitalize">{importedContent.themeSource}</p>
                </div>
                <div>
                  <span className="font-medium text-gray-700">Original Content:</span>
                  <p className="text-gray-600">
                    {importedContent.sourceMetadata.weekNumber && `Week ${importedContent.sourceMetadata.weekNumber} - `}
                    {importedContent.sourceMetadata.theme || 'Custom Content'}
                  </p>
                </div>
                {importedContent.personaTags.length > 0 && (
                  <div>
                    <span className="font-medium text-gray-700">Persona Tags:</span>
                    <p className="text-gray-600">{importedContent.personaTags.join(', ')}</p>
                  </div>
                )}
                {importedContent.segmentSuggestions.length > 0 && (
                  <div>
                    <span className="font-medium text-gray-700">Suggested Segments:</span>
                    <p className="text-gray-600">{importedContent.segmentSuggestions.join(', ')}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
