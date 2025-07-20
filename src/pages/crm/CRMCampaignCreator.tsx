import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/utils/toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, ArrowLeft, Send, Eye } from 'lucide-react';
import { EmailBlockEditor } from '@/components/crm/EmailBlockEditor';
import { EmailPreview } from '@/components/crm/EmailPreview';
import { GlobalSettings, EmailBlock } from '@/types/emailBuilder';
import { enhancedNewsletterToCRM } from '@/utils/enhancedNewsletterToCrmConverter';
import { processNewsletterContent } from '@/utils/newsletterContentProcessor';
import { parseNewsletterYAML } from '@/utils/newsletterUtils';

const CRMCampaignCreator: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [processingNewsletter, setProcessingNewsletter] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);

  // Campaign form state
  const [campaignName, setCampaignName] = useState('');
  const [subjectLine, setSubjectLine] = useState('');
  const [senderName, setSenderName] = useState('');
  const [senderEmail, setSenderEmail] = useState('');
  const [selectedSegments, setSelectedSegments] = useState<string[]>([]);
  const [emailBlocks, setEmailBlocks] = useState<EmailBlock[]>([]);

  // Global email settings
  const [globalSettings, setGlobalSettings] = useState<GlobalSettings>({
    fontFamily: 'Arial, sans-serif',
    fontSize: '16px',
    buttonStyle: {
      cornerRadius: '6px',
      backgroundColor: '#22c55e',
      textColor: '#ffffff'
    },
    headerStyle: {
      backgroundColor: '#1e40af',
      textColor: '#ffffff'
    },
    footerStyle: {
      backgroundColor: '#f8fafc',
      textColor: '#64748b'
    }
  });

  // Process newsletter import on component mount
  useEffect(() => {
    const processNewsletterImport = async () => {
      const contentTaskId = searchParams.get('contentTaskId');
      const source = searchParams.get('source');
      const type = searchParams.get('type');
      
      console.log('🔍 [CRMCampaignCreator] URL Parameters:', {
        contentTaskId,
        source,
        type,
        allParams: Object.fromEntries(searchParams.entries())
      });

      if (contentTaskId && source === 'newsletter_content' && type === 'newsletter') {
        console.log('📝 [CRMCampaignCreator] Processing newsletter import...');
        setProcessingNewsletter(true);
        
        try {
          // Try enhanced newsletter processing first
          const result = await enhancedNewsletterToCRM(contentTaskId, searchParams);
          
          console.log('✅ [CRMCampaignCreator] Enhanced newsletter processing result:', {
            campaignName: result.campaignName,
            subjectLine: result.subjectLine,
            contentBlocksCount: result.contentBlocks.length,
            personaTagsCount: result.personaTags.length,
            segmentSuggestionsCount: result.segmentSuggestions.length
          });

          // Set campaign details
          setCampaignName(result.campaignName);
          setSubjectLine(result.subjectLine);
          setSelectedSegments(result.segmentSuggestions);

          // Convert content blocks to email blocks
          const emailBlocks: EmailBlock[] = result.contentBlocks.map((block, index) => ({
            id: `block-${index}`,
            block_type: block.type,
            content: {
              title: block.title,
              content: block.content,
              text: block.ctaText,
              url: block.ctaUrl
            },
            image_url: block.imageUrl,
            cta_url: block.ctaUrl,
            cta_text: block.ctaText,
            order_index: index,
            campaign_id: '', // Will be set when saving
            source: block.source,
            persona_tag: block.personaTag
          }));

          console.log('📦 [CRMCampaignCreator] Generated email blocks:', emailBlocks);
          setEmailBlocks(emailBlocks);

          toast.success(`Newsletter imported successfully! Generated ${emailBlocks.length} content blocks.`, {
            duration: 4000
          });

        } catch (error) {
          console.error('❌ [CRMCampaignCreator] Enhanced processing failed:', error);
          
          // Fallback to basic URL parameter processing
          try {
            console.log('🔄 [CRMCampaignCreator] Falling back to basic parameter processing...');
            
            const title = searchParams.get('title');
            const content = searchParams.get('content');
            const personaTagsParam = searchParams.get('personaTags');
            const segmentSuggestionsParam = searchParams.get('segmentSuggestions');
            
            if (title) {
              setCampaignName(decodeURIComponent(title).replace(/\+/g, ' '));
            }
            
            if (content) {
              const decodedContent = decodeURIComponent(content);
              console.log('📄 [CRMCampaignCreator] Processing fallback content:', {
                contentLength: decodedContent.length,
                contentPreview: decodedContent.substring(0, 200)
              });
              
              // Process the newsletter content
              const processed = processNewsletterContent(decodedContent, title || '');
              
              // Generate basic email blocks from processed content
              const blocks: EmailBlock[] = [];
              
              // Add header block
              if (processed.newsletter_md) {
                const headerMatch = processed.newsletter_md.match(/^#\s+(.+)$/m);
                if (headerMatch) {
                  blocks.push({
                    id: 'header-block',
                    block_type: 'header',
                    content: {
                      title: headerMatch[1],
                      subtitle: 'Your Garden Newsletter'
                    },
                    order_index: 0,
                    campaign_id: ''
                  });
                }
              }
              
              // Add content blocks from YAML structure
              if (processed.blocks && processed.blocks.length > 0) {
                processed.blocks.forEach((block: any, index: number) => {
                  blocks.push({
                    id: `content-${index}`,
                    block_type: 'text',
                    content: {
                      title: block.title,
                      content: block.body
                    },
                    cta_text: block.cta,
                    cta_url: block.link,
                    order_index: index + 1,
                    campaign_id: ''
                  });
                });
              } else {
                // Fallback: create a single text block with all content
                blocks.push({
                  id: 'content-fallback',
                  block_type: 'text',
                  content: {
                    title: 'Newsletter Content',
                    content: decodedContent
                  },
                  order_index: 1,
                  campaign_id: ''
                });
              }
              
              setEmailBlocks(blocks);
              console.log('📦 [CRMCampaignCreator] Generated fallback blocks:', blocks);
            }
            
            // Set persona tags and segments
            if (personaTagsParam) {
              try {
                const tags = JSON.parse(decodeURIComponent(personaTagsParam));
                setSelectedSegments(prev => [...new Set([...prev, ...tags])]);
              } catch (e) {
                console.warn('Failed to parse persona tags:', e);
              }
            }
            
            if (segmentSuggestionsParam) {
              try {
                const suggestions = JSON.parse(decodeURIComponent(segmentSuggestionsParam));
                setSelectedSegments(prev => [...new Set([...prev, ...suggestions])]);
              } catch (e) {
                console.warn('Failed to parse segment suggestions:', e);
              }
            }

            toast.success('Newsletter content imported successfully!');
            
          } catch (fallbackError) {
            console.error('❌ [CRMCampaignCreator] Fallback processing also failed:', fallbackError);
            toast.error('Failed to process newsletter content. Please try again.');
          }
        }
        
        setProcessingNewsletter(false);
      }
    };

    processNewsletterImport();
  }, [searchParams]);

  const handleSaveCampaign = async () => {
    if (!campaignName.trim() || !subjectLine.trim()) {
      toast.error('Please fill in campaign name and subject line');
      return;
    }

    setLoading(true);
    try {
      // Save campaign
      const { data: campaign, error: campaignError } = await supabase
        .from('crm_campaigns')
        .insert({
          name: campaignName,
          subject_line: subjectLine,
          sender_name: senderName,
          sender_email: senderEmail,
          status: 'draft'
        })
        .select()
        .single();

      if (campaignError) throw campaignError;

      // Save email blocks
      if (emailBlocks.length > 0) {
        const blocksToSave = emailBlocks.map(block => ({
          ...block,
          campaign_id: campaign.id
        }));

        const { error: blocksError } = await supabase
          .from('campaign_blocks')
          .insert(blocksToSave);

        if (blocksError) throw blocksError;
      }

      toast.success('Campaign saved successfully!');
      navigate('/crm/campaigns');
    } catch (error) {
      console.error('Failed to save campaign:', error);
      toast.error('Failed to save campaign');
    } finally {
      setLoading(false);
    }
  };

  if (processingNewsletter) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center min-h-64">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Processing Newsletter Content</h3>
            <p className="text-muted-foreground">Converting your newsletter into email campaign blocks...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/crm/campaigns')}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Campaigns
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Create Email Campaign</h1>
            <p className="text-muted-foreground">Design and send your email campaign</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setPreviewMode(!previewMode)}
          >
            <Eye className="h-4 w-4 mr-2" />
            {previewMode ? 'Edit' : 'Preview'}
          </Button>
          <Button onClick={handleSaveCampaign} disabled={loading}>
            {loading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Send className="h-4 w-4 mr-2" />
            )}
            Save Campaign
          </Button>
        </div>
      </div>

      {previewMode ? (
        <EmailPreview
          blocks={emailBlocks}
          globalSettings={globalSettings}
          campaignName={campaignName}
          subjectLine={subjectLine}
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Campaign Settings */}
          <Card>
            <CardHeader>
              <CardTitle>Campaign Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="campaignName">Campaign Name</Label>
                <Input
                  id="campaignName"
                  value={campaignName}
                  onChange={(e) => setCampaignName(e.target.value)}
                  placeholder="Enter campaign name..."
                />
              </div>
              
              <div>
                <Label htmlFor="subjectLine">Subject Line</Label>
                <Input
                  id="subjectLine"
                  value={subjectLine}
                  onChange={(e) => setSubjectLine(e.target.value)}
                  placeholder="Enter email subject..."
                />
              </div>

              <div>
                <Label htmlFor="senderName">Sender Name</Label>
                <Input
                  id="senderName"
                  value={senderName}
                  onChange={(e) => setSenderName(e.target.value)}
                  placeholder="Your Garden Center"
                />
              </div>

              <div>
                <Label htmlFor="senderEmail">Sender Email</Label>
                <Input
                  id="senderEmail"
                  type="email"
                  value={senderEmail}
                  onChange={(e) => setSenderEmail(e.target.value)}
                  placeholder="hello@yourgarden.com"
                />
              </div>

              {selectedSegments.length > 0 && (
                <div>
                  <Label>Selected Segments</Label>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {selectedSegments.map((segment, index) => (
                      <span
                        key={index}
                        className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                      >
                        {segment}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Email Block Editor */}
          <div className="lg:col-span-2">
            <EmailBlockEditor
              blocks={emailBlocks}
              onBlocksChange={setEmailBlocks}
              globalSettings={globalSettings}
              onGlobalSettingsChange={setGlobalSettings}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default CRMCampaignCreator;
