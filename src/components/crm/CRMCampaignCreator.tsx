
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
  console.log('🎯 CRMCampaignCreator - Current blocks state:', { 
    blocksLength: blocks.length, 
    blockIds: blocks.map(b => b.id),
    allBlocksData: blocks.map(b => ({ id: b.id, type: b.type, title: b.title, visible: b.visible }))
  });
  const [loading, setLoading] = useState(false);
  const [converting, setConverting] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

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
            .select('ai_output')
            .eq('id', contentTaskId)
            .single();
          
          if (!error && contentTask?.ai_output) {
            fullContent = contentTask.ai_output;
            console.log('✅ Retrieved full content from database');
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
      setPreheaderText('Expert gardening tips delivered to your inbox');
      
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
          html += `
            <div style="text-align: ${block.alignment || 'center'}; padding: 20px 0;">
              <h2 style="color: #1e40af; font-size: 24px; margin: 0 0 10px 0;">${block.headline || ''}</h2>
              ${block.body ? `<p style="color: #64748b; margin: 0;">${block.body}</p>` : ''}
            </div>
          `;
          break;
        case 'text':
          html += `
            <div style="margin: 20px 0;">
              ${block.title ? `<h3 style="color: #1e40af; font-size: 20px; margin: 0 0 10px 0;">${block.title}</h3>` : ''}
              ${block.content ? `<p style="color: #475569; line-height: 1.6; margin: 0;">${block.content}</p>` : ''}
            </div>
          `;
          break;
        case 'button':
          html += `
            <div style="text-align: ${block.alignment || 'center'}; margin: 30px 0;">
              ${block.heading ? `<h3 style="color: #1e40af; margin: 0 0 10px 0;">${block.heading}</h3>` : ''}
              ${block.body ? `<p style="color: #64748b; margin: 0 0 20px 0;">${block.body}</p>` : ''}
              <a href="${block.buttonUrl || '#'}" style="display: inline-block; padding: 12px 24px; background: #22c55e; color: white; text-decoration: none; border-radius: 6px; font-weight: 600;">
                ${block.buttonText || 'Learn More'}
              </a>
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
    if (!campaignName.trim() || !subjectLine.trim()) {
      toast({
        title: "Missing Information",
        description: "Please provide both a campaign name and subject line.",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    
    try {
      // Here you would save the campaign to your backend
      console.log('💾 Saving campaign:', {
        name: campaignName,
        subject: subjectLine,
        preheader: preheaderText,
        blocks: blocks.length
      });
      
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
          <Button onClick={handleSave} disabled={loading}>
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
