
import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Mail, ArrowLeft } from 'lucide-react';
import { CleanEmailBlockEditor } from './CleanEmailBlockEditor';
import { EmailPreview } from './campaign-composer/EmailPreview';
import { ContentBlock } from '@/types/emailBuilder';
import { convertNewsletterToCRM } from '@/utils/newsletterToCrmConverter';
import { supabase } from '@/integrations/supabase/client';

// Generate appropriate preheader text based on content and campaign name
const generatePreheaderText = (content: string, campaignName: string): string => {
  const lowerContent = content.toLowerCase();
  const lowerCampaign = campaignName.toLowerCase();
  
  // Check for specific plant types
  if (lowerContent.includes('hydrangea') || lowerCampaign.includes('hydrangea')) {
    return 'Essential tips for planting and caring for beautiful hydrangeas in your garden';
  }
  
  if (lowerContent.includes('rose') || lowerCampaign.includes('rose')) {
    return 'Expert advice for growing stunning roses all season long';
  }
  
  if (lowerContent.includes('tomato') || lowerCampaign.includes('tomato')) {
    return 'Everything you need to know for a successful tomato harvest';
  }
  
  // Check for general gardening activities
  if (lowerContent.includes('planting') || lowerCampaign.includes('planting')) {
    return 'Professional planting techniques for your garden success';
  }
  
  if (lowerContent.includes('care') || lowerCampaign.includes('care')) {
    return 'Expert care tips for thriving plants and gardens';
  }
  
  // Seasonal defaults
  if (lowerContent.includes('summer')) {
    return 'Summer gardening tips to keep your plants thriving in the heat';
  }
  
  if (lowerContent.includes('spring')) {
    return 'Spring preparation guides for a successful growing season';
  }
  
  return 'Expert gardening tips delivered to your inbox';
};

interface CRMCampaignCreatorProps {
  campaignSlug?: string;
  contentTaskId?: string | null;
}

export const CRMCampaignCreator: React.FC<CRMCampaignCreatorProps> = ({ 
  campaignSlug, 
  contentTaskId: propContentTaskId 
}) => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [campaignName, setCampaignName] = useState('');
  
  // Get contentTaskId from props or URL parameters
  const urlContentTaskId = searchParams.get('contentTaskId');
  const finalContentTaskId = propContentTaskId || urlContentTaskId;
  const [subjectLine, setSubjectLine] = useState('');
  const [preheaderText, setPreheaderText] = useState('');
  const [blocks, setBlocks] = useState<ContentBlock[]>([]);
  const [loading, setLoading] = useState(false);
  const [converting, setConverting] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [sourceContentInfo, setSourceContentInfo] = useState<{
    taskId: string;
    campaignTitle: string;
    contentPreview: string;
  } | null>(null);

  // Check for URL parameters and auto-populate from newsletter
  useEffect(() => {
    const contentTaskId = finalContentTaskId;
    const title = searchParams.get('title');
    const content = searchParams.get('content');
    const type = searchParams.get('type');

    console.log('📋 useEffect triggered:', { 
      contentTaskId, 
      type,
      hasContent: !!content,
      contentLength: content?.length || 0
    });

    // Simplified condition - if we have contentTaskId and type is newsletter, convert
    if (contentTaskId && type === 'newsletter' && !converting && blocks.length === 0) {
      console.log('🔄 Starting newsletter conversion');
      handleNewsletterConversion(contentTaskId, title || '', content || '');
    }
  }, [searchParams, finalContentTaskId, campaignSlug, converting, blocks.length]);

  // Additional useEffect to monitor blocks changes
  useEffect(() => {
    console.log('📊 Blocks state changed:', { 
      blockCount: blocks.length, 
      blockIds: blocks.map(b => b.id),
      blockTypes: blocks.map(b => b.type)
    });
  }, [blocks]);

  const handleNewsletterConversion = async (contentTaskId: string, title: string, urlContent: string) => {
    if (converting) return; // Prevent multiple conversions
    
    setConverting(true);
    
    try {
      console.log('📧 Converting newsletter to CRM campaign', { contentTaskId, title, hasUrlContent: !!urlContent });
      
      let fullContent = urlContent;
      
      // Always try to fetch from database for valid UUID
      if (contentTaskId && contentTaskId.length === 36 && contentTaskId.includes('-')) {
        console.log('🔍 Fetching full content from database for contentTaskId:', contentTaskId);
        try {
          const { data: contentTask, error } = await supabase
            .from('content_tasks')
            .select(`
              ai_output,
              campaigns!inner(title, theme)
            `)
            .eq('id', contentTaskId)
            .single();
          
          if (!error && contentTask?.ai_output) {
            fullContent = contentTask.ai_output;
            
            // Set source content info for verification
            setSourceContentInfo({
              taskId: contentTaskId,
              campaignTitle: contentTask.campaigns?.title || 'Unknown Campaign',
              contentPreview: fullContent.substring(0, 150) + '...'
            });
            
            console.log('✅ Retrieved full content from database:', {
              campaignTitle: contentTask.campaigns?.title,
              contentLength: fullContent.length
            });
          }
        } catch (dbError) {
          console.log('⚠️ Database fetch failed, using URL content:', dbError);
        }
      }
      
      if (!fullContent) {
        throw new Error('No content available for conversion');
      }
      
      console.log('🔄 Converting content (length:', fullContent.length, ')');
      
      // Use the enhanced newsletter conversion system with layout and images
      const result = await convertNewsletterToCRM(contentTaskId || 'url-content', title, fullContent);
      
      if (!result.blocks || result.blocks.length === 0) {
        throw new Error('Conversion resulted in no blocks');
      }
      
      // Pre-fill campaign settings
      setCampaignName(result.campaignName);
      setSubjectLine(result.subjectLine);
      // Generate content-specific preheader
      const preheaderText = generatePreheaderText(fullContent, result.campaignName);
      setPreheaderText(preheaderText);
      
      // Set blocks with layout and images
      const crmBlocks = result.blocks;
      console.log('✅ Newsletter converted to', crmBlocks.length, 'blocks');
      
      setBlocks(crmBlocks);
      
      toast({
        title: "Newsletter Converted!",
        description: `Converted newsletter into ${crmBlocks.length} email blocks.`
      });
      
    } catch (error) {
      console.error('❌ Newsletter conversion failed:', error);
      
      // Create fallback block so user isn't stuck
      const fallbackBlock: ContentBlock = {
        id: 'fallback-block',
        type: 'text',
        layout: 'full-width',
        title: 'Newsletter Content',
        content: 'Your newsletter content will appear here. You can edit this block or add new ones below.',
        source: 'manual'
      };
      
      setBlocks([fallbackBlock]);
      setCampaignName(title || 'Newsletter Campaign');
      setSubjectLine('Your Newsletter Update');
      
      toast({
        title: "Conversion Issue",
        description: "Created a basic template. Please edit the content as needed.",
        variant: "destructive"
      });
    } finally {
      setConverting(false);
    }
  };


  const generateEmailHTML = (): string => {
    let html = `
      <div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif;">
        <div style="background: linear-gradient(135deg, #22c55e, #16a34a); padding: 30px 20px; text-align: center; color: white;">
          <h1 style="margin: 0; font-size: 28px;">${campaignName}</h1>
          ${preheaderText ? `<p style="margin: 10px 0 0 0; opacity: 0.9;">${preheaderText}</p>` : ''}
        </div>
        <div style="padding: 30px 20px; background: white;">
    `;
    
    blocks.forEach(block => {
      if (!block.visible) return;
      
      switch (block.type) {
        case 'header':
          const headerAlign = block.textAlign || 'center';
          html += `
            <div style="position: relative; text-align: ${headerAlign}; padding: 40px 20px; margin: 20px 0; border-radius: 8px; overflow: hidden;
                        ${block.backgroundImageUrl ? `background-image: url(${block.backgroundImageUrl}); background-size: cover; background-position: center;` : ''}
                        ${block.backgroundColor ? `background-color: ${block.backgroundColor};` : 'background: linear-gradient(135deg, #1e40af, #3b82f6);'}">
              ${block.backgroundColor ? `<div style="position: absolute; inset: 0; background-color: ${block.backgroundColor}; opacity: ${(block.colorOverlayOpacity || 50) / 100};"></div>` : ''}
              <div style="position: relative; z-index: 10; color: white;">
                <h1 style="font-size: 28px; font-weight: bold; margin: 0 0 16px 0;">${block.headline || 'Your Headline Here'}</h1>
                ${block.body ? `<p style="font-size: 18px; margin: 0; opacity: 0.9;">${block.body}</p>` : ''}
              </div>
            </div>
          `;
          break;

        case 'text':
          const textAlign = block.textAlign || 'left';
          html += `
            <div style="margin: 20px 0; text-align: ${textAlign}; font-size: ${block.fontSize || '16px'}; font-family: ${block.fontFamily || 'Arial, sans-serif'};">
              ${block.content ? `<div style="color: #475569; line-height: 1.6; white-space: pre-wrap;">${block.content}</div>` : ''}
            </div>
          `;
          break;

        case 'image':
          const imgAlign = block.textAlign || 'center';
          html += `
            <div style="text-align: ${imgAlign}; margin: 20px 0;">
              ${block.imageUrl ? `<img src="${block.imageUrl}" alt="${block.altText || ''}" style="max-width: 100%; height: auto; border-radius: 8px;" />` : 
                '<div style="background: #f1f5f9; padding: 60px 20px; text-align: center; color: #64748b; border-radius: 8px;">No image selected</div>'}
            </div>
          `;
          break;

        case 'image-text':
          const isImageLeft = block.layout === 'image-left' || !block.layout;
          const itTextAlign = block.textAlign || 'left';
          html += `
            <div style="margin: 20px 0; padding: 20px; ${block.backgroundColor ? `background-color: ${block.backgroundColor};` : ''} border-radius: 8px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse;">
                <tr>
                  ${isImageLeft ? `
                    <td width="50%" style="padding-right: 20px; vertical-align: top;">
                      ${block.imageUrl ? `<img src="${block.imageUrl}" alt="${block.altText || ''}" style="width: 100%; height: auto; border-radius: 8px;" />` :
                        '<div style="background: #f1f5f9; padding: 40px 20px; text-align: center; color: #64748b; border-radius: 8px;">No image</div>'}
                    </td>
                    <td width="50%" style="padding-left: 20px; vertical-align: top; text-align: ${itTextAlign};">
                      ${block.headline ? `<h2 style="font-size: 24px; font-weight: bold; margin: 0 0 16px 0; color: #1e40af;">${block.headline}</h2>` : ''}
                      ${block.body ? `<p style="color: #64748b; line-height: 1.6; margin: 0; white-space: pre-wrap;">${block.body}</p>` : ''}
                    </td>
                  ` : `
                    <td width="50%" style="padding-right: 20px; vertical-align: top; text-align: ${itTextAlign};">
                      ${block.headline ? `<h2 style="font-size: 24px; font-weight: bold; margin: 0 0 16px 0; color: #1e40af;">${block.headline}</h2>` : ''}
                      ${block.body ? `<p style="color: #64748b; line-height: 1.6; margin: 0; white-space: pre-wrap;">${block.body}</p>` : ''}
                    </td>
                    <td width="50%" style="padding-left: 20px; vertical-align: top;">
                      ${block.imageUrl ? `<img src="${block.imageUrl}" alt="${block.altText || ''}" style="width: 100%; height: auto; border-radius: 8px;" />` :
                        '<div style="background: #f1f5f9; padding: 40px 20px; text-align: center; color: #64748b; border-radius: 8px;">No image</div>'}
                    </td>
                  `}
                </tr>
              </table>
            </div>
          `;
          break;

        case 'button':
          const btnAlign = block.textAlign || 'center';
          html += `
            <div style="text-align: ${btnAlign}; margin: 30px 0;">
              ${block.headline ? `<h3 style="color: #1e40af; margin: 0 0 10px 0; font-size: 20px;">${block.headline}</h3>` : ''}
              ${block.body ? `<p style="color: #64748b; margin: 0 0 20px 0; line-height: 1.6;">${block.body}</p>` : ''}
              <a href="${block.buttonUrl || '#'}" style="display: inline-block; padding: 12px 24px; background: ${block.buttonColor || '#22c55e'}; color: white; text-decoration: none; border-radius: 6px; font-weight: 600;">
                ${block.buttonText || 'Learn More'}
              </a>
            </div>
          `;
          break;

        case 'divider':
          html += `
            <div style="margin: 30px 0;">
              <hr style="border: none; height: 1px; background: #e2e8f0; margin: 0;" />
            </div>
          `;
          break;

        case 'social-follow':
          html += `
            <div style="text-align: center; margin: 30px 0; padding: 20px; background: #f8fafc; border-radius: 8px;">
              ${block.headline ? `<h3 style="color: #1e40af; margin: 0 0 10px 0; font-size: 20px;">${block.headline}</h3>` : ''}
              ${block.body ? `<p style="color: #64748b; margin: 0 0 20px 0;">${block.body}</p>` : ''}
              <div style="display: inline-block;">
                <a href="#" style="display: inline-block; margin: 0 10px; padding: 8px 16px; background: #1877f2; color: white; text-decoration: none; border-radius: 4px;">Facebook</a>
                <a href="#" style="display: inline-block; margin: 0 10px; padding: 8px 16px; background: #1da1f2; color: white; text-decoration: none; border-radius: 4px;">Twitter</a>
                <a href="#" style="display: inline-block; margin: 0 10px; padding: 8px 16px; background: #e4405f; color: white; text-decoration: none; border-radius: 4px;">Instagram</a>
              </div>
            </div>
          `;
          break;

        case 'footer':
          html += `
            <div style="text-align: center; margin: 30px 0; padding: 20px; background: #f1f5f9; border-radius: 8px; font-size: 14px; color: #64748b;">
              ${block.content || 'Thanks for reading our newsletter!'}
            </div>
          `;
          break;
      }
    });
    
    html += `
        </div>
        <div style="background: #f1f5f9; padding: 20px; text-align: center; color: #64748b; font-size: 14px;">
          <p style="margin: 0;">Thanks for reading our newsletter!</p>
        </div>
      </div>
    `;
    
    return html;
  };

  const handleSave = async () => {
    console.log('🚀 Save button clicked');
    console.log('📝 Campaign Name:', `"${campaignName}"`);
    console.log('📝 Subject Line:', `"${subjectLine}"`);
    
    if (!campaignName.trim() || !subjectLine.trim()) {
      console.log('❌ Validation failed - missing required fields');
      toast({
        title: "Missing Information",
        description: "Please provide both a campaign name and subject line.",
        variant: "destructive"
      });
      return;
    }
    
    console.log('✅ Validation passed - proceeding with save');

    setLoading(true);
    
    try {
      // Here you would save the campaign to your backend
      console.log('💾 Saving campaign:', {
        name: campaignName,
        subject: subjectLine,
        preheader: preheaderText,
        blocks: blocks.length,
        blocksData: blocks
      });
      
      console.log('📧 Generated HTML preview:', generateEmailHTML().substring(0, 500) + '...');
      
      toast({
        title: "Campaign Saved!",
        description: "Your email campaign has been saved successfully."
      });
      
    } catch (error) {
      console.error('Error saving campaign:', error);
      toast({
        title: "Save Error",
        description: "Failed to save campaign. Please try again.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  if (converting) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Converting newsletter to email campaign...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* Back Button */}
      <div>
        <Button variant="ghost" size="sm" onClick={() => navigate('/crm/campaigns')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
      </div>
      
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Create Email Campaign</h1>
          <p className="text-muted-foreground">Build and customize your email campaign</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setShowPreview(true)}>
            Preview
          </Button>
          <Button onClick={(e) => {
            console.log('🎯 BUTTON CLICKED!', e);
            handleSave();
          }} disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Mail className="h-4 w-4 mr-2" />
                Save Campaign
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Campaign Settings - Top Horizontal Section */}
      <Card>
        <CardHeader>
          <CardTitle>Campaign Settings</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="campaign-name">Campaign Name</Label>
              <Input
                id="campaign-name"
                value={campaignName}
                onChange={(e) => setCampaignName(e.target.value)}
                placeholder="Enter campaign name"
                className="mt-1"
              />
            </div>
            
            <div>
              <Label htmlFor="subject-line">Subject Line</Label>
              <Input
                id="subject-line"
                value={subjectLine}
                onChange={(e) => setSubjectLine(e.target.value)}
                placeholder="Enter subject line"
                className="mt-1"
              />
            </div>
            
            <div>
              <Label htmlFor="preheader">Preheader Text</Label>
              <Input
                id="preheader"
                value={preheaderText}
                onChange={(e) => setPreheaderText(e.target.value)}
                placeholder="Optional preheader text"
                className="mt-1"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Email Content Builder - Full Width */}
      <Card>
        <CardHeader>
          <CardTitle>Email Content</CardTitle>
        </CardHeader>
        <CardContent>
          <CleanEmailBlockEditor
            blocks={blocks}
            onBlocksChange={setBlocks}
          />
        </CardContent>
      </Card>

      {/* Email Preview Modal */}
      <EmailPreview
        isOpen={showPreview}
        onClose={() => setShowPreview(false)}
        subject={subjectLine}
        content={generateEmailHTML()}
      />
    </div>
  );
};
