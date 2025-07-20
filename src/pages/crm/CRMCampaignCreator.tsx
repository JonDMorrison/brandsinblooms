
import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, RefreshCw, Eye, Wand2, Templates } from 'lucide-react';
import { EmailComposer } from '@/components/crm/EmailComposer';
import { ContentImportBadge } from '@/components/crm/campaigns/ContentImportBadge';
import { enhancedNewsletterToCRM } from '@/utils/enhancedNewsletterToCrmConverter';
import { saveCampaignAsDraft, sendCampaign } from '@/utils/crmCampaignService';
import { regenerateEmailContent } from '@/utils/aiContentRegenerator';
import { getSeasonalTemplateRecommendations } from '@/utils/seasonalTemplateService';
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
  const [templateRecommendations, setTemplateRecommendations] = useState<any>(null);
  const [showTemplates, setShowTemplates] = useState(false);

  // Check for content import parameters
  const fromContentTaskId = searchParams.get('fromContentTaskId');
  const source = searchParams.get('source');
  const isContentImport = fromContentTaskId && source === 'newsletter_content';

  useEffect(() => {
    if (isContentImport) {
      loadImportedContent();
    } else {
      loadTemplateRecommendations();
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
      
      // Load template recommendations based on imported content
      await loadTemplateRecommendations(result.contentBlocks.map(b => b.content).join(' '), result.personaTags);
      
      toast.success(`Newsletter content imported: "${result.campaignName}"`);
    } catch (error) {
      console.error('❌ Failed to import content:', error);
      setError('Failed to import newsletter content. Please try again or create a campaign manually.');
      toast.error('Failed to import newsletter content');
    } finally {
      setLoading(false);
    }
  };

  const loadTemplateRecommendations = async (content?: string, personaTags?: string[]) => {
    try {
      const recommendations = await getSeasonalTemplateRecommendations(content, personaTags);
      setTemplateRecommendations(recommendations);
    } catch (error) {
      console.error('Failed to load template recommendations:', error);
    }
  };

  const handleRegenerateContent = async () => {
    if (!fromContentTaskId || !importedContent) return;

    setRegenerating(true);
    try {
      const originalContent = importedContent.contentBlocks
        .map(block => `${block.title}\n${block.content}`)
        .join('\n\n');

      const regenerated = await regenerateEmailContent(
        originalContent,
        importedContent.campaignName,
        {
          tone: 'friendly',
          focus: 'seasonal',
          personaTag: importedContent.personaTags[0],
          preserveStructure: true
        }
      );

      // Update imported content with regenerated version
      const updatedContent = {
        ...importedContent,
        contentBlocks: [
          {
            type: 'text',
            title: importedContent.campaignName,
            content: regenerated.regeneratedContent
          }
        ]
      };
      
      setImportedContent(updatedContent);
      toast.success('Content regenerated successfully');

      // Show improvement suggestions if available
      if (regenerated.improvementSuggestions.length > 0) {
        toast.info(`💡 Tip: ${regenerated.improvementSuggestions[0]}`);
      }

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
      
      // Prepare campaign data with imported content metadata
      const campaignData = {
        name: emailData.subject || 'Untitled Campaign',
        subject: emailData.subject,
        sender_name: emailData.senderName,
        sender_email: emailData.senderEmail,
        content: emailData.content,
        preheader: emailData.preheader,
        segments: emailData.segments || [],
        schedule: emailData.schedule || { type: 'optimal' },
        ...(importedContent && {
          source_content_id: fromContentTaskId,
          source_metadata: importedContent.sourceMetadata,
          content_blocks: importedContent.contentBlocks,
        })
      };

      const savedCampaign = await saveCampaignAsDraft(campaignData);
      console.log('✅ Campaign saved:', savedCampaign);
      
    } catch (error) {
      console.error('❌ Failed to save campaign:', error);
      // Error handling is done in the service
    }
  };

  const handleSendCampaign = async (emailData: any) => {
    try {
      console.log('📤 Sending CRM campaign:', emailData);
      
      // Prepare campaign data
      const campaignData = {
        name: emailData.subject || 'Untitled Campaign',
        subject: emailData.subject,
        sender_name: emailData.senderName,
        sender_email: emailData.senderEmail,
        content: emailData.content,
        preheader: emailData.preheader,
        segments: emailData.segments || [],
        schedule: emailData.schedule || { type: 'immediate' },
        ...(importedContent && {
          source_content_id: fromContentTaskId,
          source_metadata: importedContent.sourceMetadata,
          content_blocks: importedContent.contentBlocks,
        })
      };

      const sentCampaign = await sendCampaign(campaignData);
      console.log('✅ Campaign sent:', sentCampaign);
      
      // Navigate to campaigns list
      navigate('/crm/campaigns');
      
    } catch (error) {
      console.error('❌ Failed to send campaign:', error);
      // Error handling is done in the service
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

          <div className="flex items-center gap-2">
            {/* Template Recommendations Button */}
            {templateRecommendations && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowTemplates(!showTemplates)}
              >
                <Templates className="h-4 w-4 mr-2" />
                Templates ({templateRecommendations.recommended.length})
              </Button>
            )}

            {importedContent && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleRegenerateContent}
                disabled={regenerating}
              >
                <Wand2 className={`h-4 w-4 mr-2 ${regenerating ? 'animate-spin' : ''}`} />
                {regenerating ? 'Regenerating...' : 'AI Enhance'}
              </Button>
            )}
          </div>
        </div>

        {/* Template Recommendations */}
        {showTemplates && templateRecommendations && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Templates className="h-5 w-5" />
                Recommended Templates
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {templateRecommendations.recommended.map((template: any) => (
                  <div key={template.id} className="p-4 border rounded-lg hover:bg-gray-50 cursor-pointer">
                    <h4 className="font-medium text-sm">{template.name}</h4>
                    <p className="text-xs text-gray-600 mt-1">{template.theme}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                        {template.season}
                      </span>
                      <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">
                        {template.category}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
              
              {templateRecommendations.content_analysis?.detected_themes.length > 0 && (
                <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                  <p className="text-sm text-blue-700">
                    <strong>Content Analysis:</strong> Detected themes include{' '}
                    {templateRecommendations.content_analysis.detected_themes.join(', ')}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Campaign Title */}
        {importedContent && (
          <div className="space-y-2">
            <h1 className="text-3xl font-bold text-gray-900">
              {importedContent.campaignName}
            </h1>
            <p className="text-gray-600">
              This email campaign was created using your approved BloomSuite content. 
              You can enhance it with AI or use our seasonal templates.
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
                Source Information & AI Insights
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
                    <span className="font-medium text-gray-700">AI Persona Tags:</span>
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
              
              {templateRecommendations && (
                <div className="mt-4 p-3 bg-green-50 rounded-lg">
                  <p className="text-sm text-green-700">
                    <strong>🎯 Smart Insights:</strong> Based on your content, we found {templateRecommendations.recommended.length} highly relevant templates and identified this as {templateRecommendations.content_analysis.season_match} content.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
