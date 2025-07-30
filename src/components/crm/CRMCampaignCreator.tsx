
import React, { useState, useEffect, useCallback, useRef } from 'react';
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
import { saveCampaignAsDraft, CampaignData } from '@/utils/crmCampaignService';
import { SaveIndicator } from '@/components/crm/SaveIndicator';

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
  const [lastSaved, setLastSaved] = useState<Date | undefined>();
  const [saveError, setSaveError] = useState(false);
  const [sourceContentInfo, setSourceContentInfo] = useState<{
    taskId: string;
    campaignTitle: string;
    contentPreview: string;
  } | null>(null);
  const [existingCampaignId, setExistingCampaignId] = useState<string | null>(null);
  const [loadingExistingCampaign, setLoadingExistingCampaign] = useState(false);

  // Auto-save functionality for CRM campaigns
  const [isAutoSaving, setIsAutoSaving] = useState(false);
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout>();

  const autoSaveCampaign = useCallback(async (campaignData: {
    blocks: ContentBlock[];
    campaign_name: string;
    subject_line: string;
    preheader: string;
  }) => {
    if (!existingCampaignId || isAutoSaving) return;
    
    try {
      setIsAutoSaving(true);
      console.log('🔄 Auto-saving CRM campaign:', existingCampaignId);
      
      // Update campaign metadata
      const { error: campaignError } = await supabase
        .from('crm_campaigns')
        .update({
          name: campaignData.campaign_name,
          subject: campaignData.subject_line,
          preheader: campaignData.preheader,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingCampaignId);

      if (campaignError) throw campaignError;

      // Delete existing blocks and recreate them
      await supabase
        .from('campaign_blocks')
        .delete()
        .eq('campaign_id', existingCampaignId);

      // Insert updated blocks
      if (campaignData.blocks.length > 0) {
        const blocksToSave = campaignData.blocks.map((block, index) => ({
          campaign_id: existingCampaignId,
          block_type: block.type, // This will now correctly save 'header' for header blocks
          content: {
            title: block.title || block.headline,
            content: block.content || block.body,
            headline: block.headline,
            body: block.body,
            alignment: block.alignment,
            padding: block.padding,
            margin: block.margin,
            fontFamily: block.fontFamily,
            fontSize: block.fontSize,
            textColor: block.textColor,
            backgroundColor: block.backgroundColor,
            backgroundImageUrl: block.backgroundImageUrl,
            backgroundOpacity: block.backgroundOpacity,
            layout: block.layout,
            caption: block.caption,
            altText: block.altText,
            buttonText: block.buttonText,
            buttonUrl: block.buttonUrl,
            ctaStyle: block.ctaStyle,
            ctaSize: block.ctaSize,
            quote: block.quote,
            author: block.author,
            authorTitle: block.authorTitle,
            visible: block.visible,
            collapsed: block.collapsed
          },
          image_url: block.imageUrl,
          cta_url: block.ctaUrl || block.buttonUrl,
          cta_text: block.ctaText || block.buttonText,
          source: block.source || 'manual',
          persona_tag: block.personaTag,
          order_index: index
        }));

        const { error: blocksError } = await supabase
          .from('campaign_blocks')
          .insert(blocksToSave);

        if (blocksError) throw blocksError;
      }

      setLastSaved(new Date());
      setSaveError(false);
      console.log('✅ Auto-save successful');
      
    } catch (error) {
      console.error('❌ Auto-save failed:', error);
      setSaveError(true);
      toast({
        title: "Auto-save failed",
        description: "Your changes may not be saved. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsAutoSaving(false);
    }
  }, [existingCampaignId, isAutoSaving, toast]);

  const debouncedAutoSave = useCallback((campaignData: {
    blocks: ContentBlock[];
    campaign_name: string;
    subject_line: string;
    preheader: string;
  }) => {
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
    }

    autoSaveTimeoutRef.current = setTimeout(() => {
      autoSaveCampaign(campaignData);
    }, 2000);
  }, [autoSaveCampaign]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, []);

  // Check for existing campaign and load session data
  useEffect(() => {
    const checkExistingCampaign = async () => {
      console.log('🔍 CRMCampaignCreator: Starting campaign check', { campaignSlug, finalContentTaskId });
      
      // Handle direct campaign slug (when editing existing campaign)
      // This takes priority over content task conversion
      if (campaignSlug) {
        // Check if campaignSlug is a valid UUID (existing campaign) or just a slug (new campaign)
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        const isValidUUID = uuidRegex.test(campaignSlug);
        
        console.log('🔍 CRMCampaignCreator: Checking campaign slug', { campaignSlug, isValidUUID });
        
        if (isValidUUID) {
          console.log('🔄 Loading existing campaign by UUID:', campaignSlug);
          setLoadingExistingCampaign(true);
          try {
            await loadExistingCampaign(campaignSlug);
            setExistingCampaignId(campaignSlug);
            console.log('✅ Successfully loaded existing campaign');
          } catch (error) {
            console.error('❌ Error loading campaign by UUID:', error);
            toast({
              title: "Error",
              description: "Failed to load campaign data",
              variant: "destructive"
            });
          } finally {
            setLoadingExistingCampaign(false);
          }
          return;
        } else {
          console.log('📝 Campaign slug is not a UUID, treating as new campaign:', campaignSlug);
          // Continue to the content task conversion logic below
        }
      }

      const contentTaskId = finalContentTaskId;
      if (!contentTaskId) return;

      setLoadingExistingCampaign(true);
      try {
        // Check if content task is already linked to a CRM campaign
        const { data: contentTask, error } = await supabase
          .from('content_tasks')
          .select('linked_crm_campaign_id')
          .eq('id', contentTaskId)
          .single();

        if (error) throw error;

        if (contentTask?.linked_crm_campaign_id) {
          // Load existing CRM campaign data
          await loadExistingCampaign(contentTask.linked_crm_campaign_id);
          setExistingCampaignId(contentTask.linked_crm_campaign_id);
        } else {
          // No existing campaign, proceed with conversion
          const title = searchParams.get('title');
          const content = searchParams.get('content');
          const type = searchParams.get('type');

          if (type === 'newsletter' && !converting && blocks.length === 0) {
            console.log('🔄 Starting newsletter conversion');
            handleNewsletterConversion(contentTaskId, title || '', content || '');
          }
        }
      } catch (error) {
        console.error('Error checking existing campaign:', error);
        // Fall back to normal conversion if check fails
        const title = searchParams.get('title');
        const content = searchParams.get('content');
        const type = searchParams.get('type');

        if (type === 'newsletter' && !converting && blocks.length === 0) {
          console.log('🔄 Starting newsletter conversion (fallback)');
          handleNewsletterConversion(contentTaskId, title || '', content || '');
        }
      } finally {
        setLoadingExistingCampaign(false);
      }
    };

    checkExistingCampaign();
  }, [searchParams, finalContentTaskId, campaignSlug, converting, blocks.length]);

  // Additional useEffect to monitor blocks changes
  useEffect(() => {
    console.log('📊 Blocks state changed:', { 
      blockCount: blocks.length, 
      blockIds: blocks.map(b => b.id),
      blockTypes: blocks.map(b => b.type)
    });
  }, [blocks]);

  const loadExistingCampaign = async (campaignId: string) => {
    try {
      console.log('🔄 Loading existing CRM campaign:', campaignId);
      
      // Load campaign details
      const { data: campaign, error: campaignError } = await supabase
        .from('crm_campaigns')
        .select('*')
        .eq('id', campaignId)
        .single();

      console.log('📊 Campaign query result:', { campaign, campaignError });

      if (campaignError) throw campaignError;

      // Load campaign blocks
      const { data: campaignBlocks, error: blocksError } = await supabase
        .from('campaign_blocks')
        .select('*')
        .eq('campaign_id', campaignId)
        .order('order_index');

      console.log('📊 Blocks query result:', { 
        campaignBlocks: campaignBlocks?.length || 0, 
        blocksError,
        firstBlock: campaignBlocks?.[0] 
      });

      if (blocksError) throw blocksError;

      // Restore campaign state
      setCampaignName(campaign.name);
      setSubjectLine(campaign.subject_line || campaign.name); // Handle missing subject field
      setPreheaderText(campaign.preheader || '');

      console.log('📋 Campaign metadata restored:', {
        name: campaign.name,
        subject: campaign.subject_line,
        preheader: campaign.preheader
      });

        // Convert campaign blocks back to ContentBlocks using enhanced transformBlock function
        const transformBlock = (block: any): ContentBlock => {
          console.log('🔍 Transforming block:', {
            blockId: block.id,
            blockType: block.block_type,
            rawContent: block.content,
            imageUrl: block.image_url,
            ctaUrl: block.cta_url,
            ctaText: block.cta_text
          });

          // Parse the content if it's a string
          let contentObj = block.content;
          if (typeof block.content === 'string') {
            try {
              contentObj = JSON.parse(block.content);
            } catch (e) {
              console.warn('Failed to parse block content as JSON:', e);
              contentObj = {};
            }
          } else if (!block.content || typeof block.content !== 'object') {
            contentObj = {};
          }

          // Detect if this should actually be a header block
          // Check for header block characteristics: backgroundColor + imageUrl + full-width layout
          let actualBlockType = block.block_type;
          if (block.block_type === 'text' && contentObj?.content) {
            const nestedContent = contentObj.content;
            const hasBackgroundColor = nestedContent?.backgroundColor;
            const hasImageUrl = nestedContent?.imageUrl;
            const isFullWidth = nestedContent?.layout === 'full-width';
            
            if (hasBackgroundColor && hasImageUrl && isFullWidth) {
              console.log('🔄 Converting misclassified text block to header block:', block.id);
              actualBlockType = 'header';
            }
          }

        // Check if we have the new fullBlock structure saved from the updated auto-save
        const fullBlock = contentObj?.fullBlock;
        if (fullBlock) {
          console.log('[HYDRATION] Found fullBlock structure, using saved block data:', {
            blockId: block.id,
            savedBlockType: fullBlock.block_type,
            savedHeadline: fullBlock.content?.headline,
            savedContent: fullBlock.content
          });
          
          // Use the saved full block structure directly
          const extractedContent = {
            ...fullBlock.content,
            // Ensure these key fields are preserved
            headline: fullBlock.content?.headline,
            title: fullBlock.content?.title,
            body: fullBlock.content?.body,
            imageUrl: fullBlock.content?.imageUrl,
            altText: fullBlock.content?.altText,
            buttonText: fullBlock.content?.buttonText,
            buttonUrl: fullBlock.content?.buttonUrl,
            backgroundColor: fullBlock.content?.backgroundColor,
            backgroundImageUrl: fullBlock.content?.backgroundImageUrl,
            backgroundOpacity: fullBlock.content?.backgroundOpacity,
            textAlign: fullBlock.content?.textAlign,
            layout: fullBlock.content?.layout
          };

          console.log('[HYDRATION] Extracted content from fullBlock:', extractedContent);
          
          // Use the extracted content for transformation
          var finalExtractedContent = extractedContent;
        } else {
          // Fallback to legacy hydration logic for older blocks
          console.log('[HYDRATION] Using legacy hydration for block:', block.id);
          
          // Handle nested content structure (content.content)
          const nestedContentObj = contentObj?.content || {};
          
          // Extract all possible fields from various levels
          var finalExtractedContent = { 
            ...contentObj, 
            ...nestedContentObj,
            // Also check for direct fields
            ...(contentObj.headline && { headline: contentObj.headline }),
            ...(contentObj.title && { title: contentObj.title }),
            ...(contentObj.body && { body: contentObj.body }),
            ...(contentObj.content && typeof contentObj.content === 'string' && { body: contentObj.content }),
            ...(contentObj.image_url && { imageUrl: contentObj.image_url }),
            ...(contentObj.alt_text && { altText: contentObj.alt_text }),
            ...(contentObj.button_text && { buttonText: contentObj.button_text }),
            ...(contentObj.button_url && { buttonUrl: contentObj.button_url }),
            // Override with nested values if they exist
            ...(nestedContentObj.headline && { headline: nestedContentObj.headline }),
            ...(nestedContentObj.title && { title: nestedContentObj.title }),
            ...(nestedContentObj.body && { body: nestedContentObj.body }),
            ...(nestedContentObj.imageUrl && { imageUrl: nestedContentObj.imageUrl }),
            ...(nestedContentObj.altText && { altText: nestedContentObj.altText }),
            ...(nestedContentObj.buttonText && { buttonText: nestedContentObj.buttonText }),
            ...(nestedContentObj.buttonUrl && { buttonUrl: nestedContentObj.buttonUrl }),
            ...(nestedContentObj.backgroundColor && { backgroundColor: nestedContentObj.backgroundColor }),
            ...(nestedContentObj.layout && { layout: nestedContentObj.layout })
          };
        }

        console.log('📋 Content extraction details:', {
          blockId: block.id,
          originalContentObj: contentObj,
          nestedContentObj: fullBlock ? 'N/A (using fullBlock)' : (contentObj?.content || {}),
          extractedContent: {
            headline: finalExtractedContent.headline,
            title: finalExtractedContent.title,
            body: finalExtractedContent.body,
            imageUrl: finalExtractedContent.imageUrl,
            altText: finalExtractedContent.altText,
            buttonText: finalExtractedContent.buttonText,
            buttonUrl: finalExtractedContent.buttonUrl,
            backgroundColor: finalExtractedContent.backgroundColor,
            layout: finalExtractedContent.layout
          }
        });

        // Build the transformed block with comprehensive field mapping
        const transformedBlock: ContentBlock = {
          id: block.id,
          // Use the detected actualBlockType which includes header block auto-detection
          type: actualBlockType === 'header'
            ? 'header' as ContentBlock['type']
            : (actualBlockType === 'text' && finalExtractedContent.imageUrl && finalExtractedContent.imageUrl !== '/images/newsletter-fallback.jpg')
              ? 'image-text' as ContentBlock['type']
              : actualBlockType as ContentBlock['type'],
          title: finalExtractedContent.title || finalExtractedContent.headline || 'Untitled Block',
          headline: finalExtractedContent.headline || finalExtractedContent.title,
          body: finalExtractedContent.body || finalExtractedContent.content,
          content: finalExtractedContent.body || finalExtractedContent.content || '',
          source: (block.source as ContentBlock['source']) || 'manual',
          // Image fields - map correctly for header vs other blocks
          imageUrl: block.block_type === 'header' ? undefined : (finalExtractedContent.imageUrl || block.image_url),
          altText: finalExtractedContent.altText || finalExtractedContent.alt_text,
          caption: finalExtractedContent.caption,
          // Button/CTA fields
          buttonText: finalExtractedContent.buttonText || finalExtractedContent.button_text || block.cta_text,
          buttonUrl: finalExtractedContent.buttonUrl || finalExtractedContent.button_url || block.cta_url,
          ctaText: finalExtractedContent.ctaText || finalExtractedContent.button_text || block.cta_text,
          ctaUrl: finalExtractedContent.ctaUrl || finalExtractedContent.button_url || block.cta_url,
          ctaStyle: finalExtractedContent.ctaStyle,
          ctaSize: finalExtractedContent.ctaSize,
          // Layout and styling
          visible: finalExtractedContent.visible !== false,
          collapsed: finalExtractedContent.collapsed || false,
          layout: finalExtractedContent.layout || 'full-width',
          alignment: finalExtractedContent.alignment || 'left',
          padding: finalExtractedContent.padding || 'medium',
          margin: finalExtractedContent.margin,
          // Typography
          fontFamily: finalExtractedContent.fontFamily,
          fontSize: finalExtractedContent.fontSize,
          textColor: finalExtractedContent.textColor,
          textAlign: finalExtractedContent.textAlign || finalExtractedContent.alignment,
          // Background
          backgroundColor: finalExtractedContent.backgroundColor || finalExtractedContent.background_color,
          backgroundImageUrl: actualBlockType === 'header' ? (finalExtractedContent.imageUrl || block.image_url) : finalExtractedContent.backgroundImageUrl,
          backgroundOpacity: finalExtractedContent.backgroundOpacity,
          // Newsletter-specific
          quote: finalExtractedContent.quote,
          author: finalExtractedContent.author,
          authorTitle: finalExtractedContent.authorTitle,
          issueNumber: finalExtractedContent.issueNumber,
          publishDate: finalExtractedContent.publishDate
        };

        // Enhanced logging to verify header block fix
        console.log('🧱 Hydrated contentObj:', {
          blockId: block.id,
          originalType: block.block_type,
          finalType: transformedBlock.type, 
          headline: transformedBlock.headline,
          body: transformedBlock.body,
          imageUrl: transformedBlock.imageUrl,
          backgroundImageUrl: transformedBlock.backgroundImageUrl,
          buttonText: transformedBlock.buttonText,
          buttonUrl: transformedBlock.buttonUrl,
          backgroundColor: transformedBlock.backgroundColor,
          layout: transformedBlock.layout,
          hasImage: !!transformedBlock.imageUrl && transformedBlock.imageUrl !== '/images/newsletter-fallback.jpg',
          isHeaderWithBackground: block.block_type === 'header' && !!transformedBlock.backgroundImageUrl
        });

        return transformedBlock;
      };

      const contentBlocks: ContentBlock[] = campaignBlocks.map(transformBlock);

      setBlocks(contentBlocks);

      toast({
        title: "Campaign Loaded",
        description: `Continuing where you left off with ${contentBlocks.length} blocks.`
      });

      console.log('✅ Existing campaign loaded successfully');
    } catch (error) {
      console.error('Error loading existing campaign:', error);
      toast({
        title: "Load Error",
        description: "Failed to load existing campaign. Starting fresh.",
        variant: "destructive"
      });
    }
  };

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
      
      // First, try to get preserved newsletter images from the content task
      let preservedImages = {};
      try {
        if (contentTaskId) {
          const { data: attachmentsData } = await supabase
            .from('content_tasks')
            .select('attachments')
            .eq('id', contentTaskId)
            .single();
            
          if (attachmentsData?.attachments && 
              typeof attachmentsData.attachments === 'object' && 
              attachmentsData.attachments !== null &&
              'newsletter_images' in attachmentsData.attachments) {
            const attachments = attachmentsData.attachments as Record<string, any>;
            preservedImages = attachments.newsletter_images;
            console.log('📸 Found preserved newsletter images:', Object.keys(preservedImages));
          }
        }
      } catch (imageError) {
        console.warn('⚠️ Could not fetch preserved images:', imageError);
      }
      
      // Use the enhanced newsletter conversion system with preserved images
      const result = await convertNewsletterToCRM(contentTaskId || 'url-content', title, fullContent, preservedImages);
      
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
      <div style="max-width: 600px; margin: 0 auto; font-family: 'Quicksand', 'system-ui', sans-serif;">
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Quicksand:wght@400;500;600;700&display=swap');
        </style>
        <div style="padding: 30px 20px; background: white;">
    `;
    
    blocks.forEach(block => {
      if (block.visible === false) return; // Only skip blocks explicitly set to false
      
      switch (block.type) {
        case 'header':
          const headerAlign = block.textAlign || 'center';
          html += `
            <div style="position: relative; text-align: ${headerAlign}; padding: 40px 20px; margin: 20px 0; border-radius: 8px; overflow: hidden;
                        ${block.backgroundImageUrl ? `background-image: url(${block.backgroundImageUrl}); background-size: cover; background-position: center;` : ''}
                        ${block.backgroundColor ? `background-color: ${block.backgroundColor};` : 'background: linear-gradient(135deg, #22c55e, #16a34a);'}">
              ${block.backgroundColor ? `<div style="position: absolute; inset: 0; background-color: ${block.backgroundColor}; opacity: ${(block.colorOverlayOpacity || 50) / 100};"></div>` : ''}
              <div style="position: relative; z-index: 10; color: white;">
                <h1 style="font-size: 28px; font-weight: 600; margin: 0 0 16px 0; font-family: 'Quicksand', sans-serif;">${block.headline || 'Your Headline Here'}</h1>
                ${block.body ? `<p style="font-size: 18px; margin: 0; opacity: 0.9; font-family: 'Quicksand', sans-serif;">${block.body}</p>` : ''}
              </div>
            </div>
          `;
          break;

        case 'text':
          const textAlign = block.textAlign || 'left';
          html += `
            <div style="margin: 20px 0; text-align: ${textAlign}; font-size: ${block.fontSize || '16px'}; font-family: 'Quicksand', sans-serif;">
              ${block.content ? `<div style="color: #475569; line-height: 1.6; white-space: pre-wrap;">${block.content}</div>` : ''}
            </div>
          `;
          break;

        case 'image':
          const imgAlign = block.textAlign || 'center';
          html += `
            <div style="text-align: ${imgAlign}; margin: 20px 0;">
              ${block.imageUrl ? `<img src="${block.imageUrl}" alt="${block.altText || ''}" style="max-width: 100%; height: auto; border-radius: 8px;" />` : 
                '<div style="background: #f1f5f9; padding: 60px 20px; text-align: center; color: #64748b; border-radius: 8px; font-family: \'Quicksand\', sans-serif;">No image selected</div>'}
            </div>
          `;
          break;

        case 'image-text':
          const isImageRight = block.layout === 'two-column-right';
          const itTextAlign = block.textAlign || 'left';
          html += `
            <div style="margin: 20px 0; padding: 20px; ${block.backgroundColor ? `background-color: ${block.backgroundColor};` : ''} border-radius: 8px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse;">
                <tr>
                  ${!isImageRight ? `
                    <td width="50%" style="padding-right: 20px; vertical-align: top;">
                      ${block.imageUrl ? `<img src="${block.imageUrl}" alt="${block.altText || ''}" style="width: 100%; height: auto; border-radius: 8px;" />` :
                        '<div style="background: #f1f5f9; padding: 40px 20px; text-align: center; color: #64748b; border-radius: 8px; font-family: \'Quicksand\', sans-serif;">No image</div>'}
                    </td>
                    <td width="50%" style="padding-left: 20px; vertical-align: top; text-align: ${itTextAlign};">
                      ${block.headline ? `<h2 style="font-size: 24px; font-weight: 600; margin: 0 0 16px 0; color: #22c55e; font-family: 'Quicksand', sans-serif;">${block.headline}</h2>` : ''}
                      ${block.body ? `<p style="color: #64748b; line-height: 1.6; margin: 0; white-space: pre-wrap; font-family: 'Quicksand', sans-serif;">${block.body}</p>` : ''}
                    </td>
                  ` : `
                    <td width="50%" style="padding-right: 20px; vertical-align: top; text-align: ${itTextAlign};">
                      ${block.headline ? `<h2 style="font-size: 24px; font-weight: 600; margin: 0 0 16px 0; color: #22c55e; font-family: 'Quicksand', sans-serif;">${block.headline}</h2>` : ''}
                      ${block.body ? `<p style="color: #64748b; line-height: 1.6; margin: 0; white-space: pre-wrap; font-family: 'Quicksand', sans-serif;">${block.body}</p>` : ''}
                    </td>
                    <td width="50%" style="padding-left: 20px; vertical-align: top;">
                      ${block.imageUrl ? `<img src="${block.imageUrl}" alt="${block.altText || ''}" style="width: 100%; height: auto; border-radius: 8px;" />` :
                        '<div style="background: #f1f5f9; padding: 40px 20px; text-align: center; color: #64748b; border-radius: 8px; font-family: \'Quicksand\', sans-serif;">No image</div>'}
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
              ${block.headline ? `<h3 style="color: #22c55e; margin: 0 0 10px 0; font-size: 20px; font-family: 'Quicksand', sans-serif; font-weight: 600;">${block.headline}</h3>` : ''}
              ${block.body ? `<p style="color: #64748b; margin: 0 0 20px 0; line-height: 1.6; font-family: 'Quicksand', sans-serif;">${block.body}</p>` : ''}
              <a href="${block.buttonUrl || '#'}" style="display: inline-block; padding: 12px 24px; background: ${block.buttonColor || '#22c55e'}; color: white; text-decoration: none; border-radius: 6px; font-weight: 600; font-family: 'Quicksand', sans-serif;">
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
    setSaveError(false);
    
    try {
      // Generate HTML content for the campaign
      const htmlContent = generateEmailHTML();
      
      // Convert blocks to the format expected by the campaign service
      const campaignBlocks = blocks.map((block, index) => ({
        block_type: block.type as 'header' | 'text' | 'image' | 'button' | 'divider',
        content: {
          headline: block.headline,
          body: block.body,
          content: block.content,
          layout: block.layout,
          imageUrl: block.imageUrl,
          altText: block.altText,
          buttonText: block.buttonText,
          buttonUrl: block.buttonUrl,
          buttonColor: block.buttonColor,
          backgroundColor: block.backgroundColor,
          textAlign: block.textAlign,
          fontSize: block.fontSize,
          fontFamily: block.fontFamily
        },
        image_url: block.imageUrl,
        cta_url: block.buttonUrl,
        cta_text: block.buttonText,
        source: block.source || 'manual',
        order_index: index
      }));

      // Prepare campaign data for saving
      const campaignData: CampaignData = {
        name: campaignName,
        subject: subjectLine,
        sender_name: 'Brands in Blooms',
        sender_email: 'hello@brandsinblooms.com',
        content: htmlContent,
        preheader: preheaderText,
        segments: [], // Default empty segments for now
        schedule: {
          type: 'immediate'
        },
        content_blocks: campaignBlocks,
        newsletter_sync: finalContentTaskId ? {
          source_task_id: finalContentTaskId,
          sync_status: 'synced',
          original_blocks_count: blocks.length
        } : undefined
      };

      console.log('💾 Saving campaign to database:', {
        name: campaignName,
        subject: subjectLine,
        preheader: preheaderText,
        blocks: blocks.length,
        hasSourceContent: !!finalContentTaskId
      });
      
      // Save campaign using the service
      const result = await saveCampaignAsDraft(campaignData);
      
      console.log('✅ Campaign saved successfully:', result);
      
      setLastSaved(new Date());
      
      toast({
        title: "Campaign Saved!",
        description: "Your email campaign has been saved as a draft."
      });
      
    } catch (error) {
      console.error('❌ Error saving campaign:', error);
      setSaveError(true);
      
      toast({
        title: "Save Error",
        description: error instanceof Error ? error.message : "Failed to save campaign. Please try again.",
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
          <div className="flex items-center gap-3">
            <p className="text-muted-foreground">Build and customize your email campaign</p>
            <SaveIndicator 
              lastSaved={lastSaved} 
              saving={loading || isAutoSaving} 
              error={saveError} 
            />
          </div>
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
                 onChange={(e) => {
                   setCampaignName(e.target.value);
                   // Auto-save campaign settings when they change
                   if (existingCampaignId) {
                     debouncedAutoSave({
                       blocks,
                       campaign_name: e.target.value,
                       subject_line: subjectLine,
                       preheader: preheaderText
                     });
                   }
                 }}
                 placeholder="Enter campaign name"
                 className="mt-1"
               />
            </div>
            
            <div>
              <Label htmlFor="subject-line">Subject Line</Label>
               <Input
                 id="subject-line"
                 value={subjectLine}
                 onChange={(e) => {
                   setSubjectLine(e.target.value);
                   // Auto-save campaign settings when they change
                   if (existingCampaignId) {
                     debouncedAutoSave({
                       blocks,
                       campaign_name: campaignName,
                       subject_line: e.target.value,
                       preheader: preheaderText
                     });
                   }
                 }}
                 placeholder="Enter subject line"
                 className="mt-1"
               />
            </div>
            
            <div>
              <Label htmlFor="preheader">Preheader Text</Label>
               <Input
                 id="preheader"
                 value={preheaderText}
                 onChange={(e) => {
                   setPreheaderText(e.target.value);
                   // Auto-save campaign settings when they change
                   if (existingCampaignId) {
                     debouncedAutoSave({
                       blocks,
                       campaign_name: campaignName,
                       subject_line: subjectLine,
                       preheader: e.target.value
                     });
                   }
                 }}
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
            onBlocksChange={(newBlocks) => {
              console.log('[CRM CAMPAIGN CREATOR] Blocks changed:', newBlocks.length);
              setBlocks(newBlocks);
              
              // Auto-save when blocks change
              if (existingCampaignId && newBlocks.length > 0) {
                console.log('[CRM CAMPAIGN CREATOR] Triggering auto-save for blocks');
                debouncedAutoSave({
                  blocks: newBlocks,
                  campaign_name: campaignName,
                  subject_line: subjectLine,
                  preheader: preheaderText
                });
              }
            }}
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
