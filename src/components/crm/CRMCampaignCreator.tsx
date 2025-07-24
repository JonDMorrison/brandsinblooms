
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

    // Enhanced debugging for URL parameters
    console.log('📋 useEffect triggered with dependencies:', { 
      contentTaskId, 
      campaignSlug, 
      hasSearchParams: !!searchParams.toString(),
      type,
      allParams: Object.fromEntries(searchParams.entries()),
      currentURL: window.location.href,
      searchString: searchParams.toString(),
      currentBlocksCount: blocks.length
    });

    // Check if we have newsletter content in URL but missing type parameter
    if (content && !type && content.includes('newsletter_md')) {
      console.log('🔄 Detected newsletter content without type parameter, forcing conversion');
      handleNewsletterConversion(contentTaskId || 'url-based', title || '', content);
      return;
    }

    if (contentTaskId && type === 'newsletter') {
      console.log('🔄 Auto-populating from newsletter content', { contentTaskId, campaignSlug });
      handleNewsletterConversion(contentTaskId, title || '', content || '');
    } else if (content && content.includes('newsletter_md')) {
      console.log('🔄 Auto-populating from URL newsletter content without contentTaskId');
      handleNewsletterConversion('url-content', title || '', content);
    } else {
      console.log('❌ No newsletter conversion conditions met:', { 
        hasContentTaskId: !!contentTaskId, 
        type, 
        hasContent: !!content, 
        contentIncludesNewsletter: content?.includes('newsletter_md') 
      });
    }
  }, [searchParams, finalContentTaskId, campaignSlug]);

  // Additional useEffect to monitor blocks changes
  useEffect(() => {
    console.log('📊 Blocks state changed:', { 
      blockCount: blocks.length, 
      blockIds: blocks.map(b => b.id),
      blockTypes: blocks.map(b => b.type)
    });
  }, [blocks]);

  const handleNewsletterConversion = async (contentTaskId: string, title: string, urlContent: string) => {
    setConverting(true);
    
    try {
      console.log('📧 Converting newsletter to CRM campaign', { contentTaskId, title, hasUrlContent: !!urlContent });
      
      let fullContent = urlContent;
      
      // Only fetch from database if contentTaskId is a valid UUID
      if (contentTaskId && !['url-based', 'url-content'].includes(contentTaskId) && urlContent.length < 1000) {
        console.log('🔍 Fetching full content from database for contentTaskId:', contentTaskId);
        const { data: contentTask, error } = await supabase
          .from('content_tasks')
          .select('ai_output')
          .eq('id', contentTaskId)
          .single();
        
        if (!error && contentTask?.ai_output) {
          fullContent = contentTask.ai_output;
          console.log('✅ Retrieved full content from database');
        } else {
          console.log('⚠️ Could not fetch from database, using URL content');
        }
      } else {
        console.log('🔄 Using URL content directly (no database fetch needed)');
      }
      
      console.log('🔄 Using newsletter content:', fullContent.substring(0, 200) + '...');
      
      // Use the enhanced newsletter conversion system with layout and images
      const result = await convertNewsletterToCRM(contentTaskId || 'url-content', title, fullContent);
      
      // Pre-fill campaign settings
      setCampaignName(result.campaignName);
      setSubjectLine(result.subjectLine);
      setPreheaderText('Expert gardening tips delivered to your inbox');
      
      // Set blocks with layout and images
      const crmBlocks = result.blocks || [];
      console.log('🔍 CRM Conversion Result:', {
        campaignName: result.campaignName,
        blockCount: crmBlocks.length,
        blocks: crmBlocks.map(b => ({ 
          type: b.type, 
          id: b.id, 
          title: b.title, 
          layout: b.layout,
          hasImage: !!b.imageUrl
        }))
      });
      
      console.log('🔍 Setting blocks in state:', { 
        crmBlocksLength: crmBlocks.length, 
        currentBlocksLength: blocks.length,
        aboutToSet: crmBlocks.map(b => ({ id: b.id, type: b.type, title: b.title }))
      });
      setBlocks(crmBlocks);
      console.log('✅ Blocks should now be set in state');
      
      console.log('✅ Newsletter converted to', crmBlocks.length, 'blocks with layouts and images');
      
      toast({
        title: "Newsletter Converted!",
        description: `Converted newsletter into ${crmBlocks.length} email blocks with layouts and images.`
      });
      
    } catch (error) {
      console.error('Error converting newsletter:', error);
      toast({
        title: "Conversion Error",
        description: "Failed to convert newsletter content. Please try again.",
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
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
                value={campaignName}
                onChange={(e) => setCampaignName(e.target.value)}
                placeholder="Enter campaign name"
              />
            </div>
            
            <div>
              <Label htmlFor="subject-line">Subject Line</Label>
              <Input
                id="subject-line"
                value={subjectLine}
                onChange={(e) => setSubjectLine(e.target.value)}
                placeholder="Enter subject line"
              />
            </div>
            
            <div>
              <Label htmlFor="preheader">Preheader Text</Label>
              <Input
                id="preheader"
                value={preheaderText}
                onChange={(e) => setPreheaderText(e.target.value)}
                placeholder="Optional preheader text"
              />
            </div>
          </CardContent>
        </Card>

        {/* Email Content Builder */}
        <div className="lg:col-span-2">
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
        </div>
      </div>

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
