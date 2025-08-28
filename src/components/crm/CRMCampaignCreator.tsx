
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Mail, ArrowLeft, Users, Sparkles, Send, Eye } from 'lucide-react';
import { useSenderConfiguration } from '@/hooks/useSenderConfiguration';
import { SharedSenderConfirmationModal } from './campaigns/SharedSenderConfirmationModal';
import { CleanEmailBlockEditor } from './CleanEmailBlockEditor';
import { EmailPreview } from './campaign-composer/EmailPreview';
import { ContentBlock } from '@/types/emailBuilder';
import { convertNewsletterToCRM } from '@/utils/newsletterToCrmSync';
import { supabase } from '@/integrations/supabase/client';
import { saveCampaignAsDraft, sendCampaign, CampaignData } from '@/utils/crmCampaignService';
import { SaveIndicator } from '@/components/crm/SaveIndicator';
import { generateFooterHTML } from '@/utils/emailFooterRenderer';
import { getDefaultTokenData } from '@/utils/emailTokenProcessor';
import { useFooterSettings } from '@/hooks/useFooterSettings';
import { useCompanyInfo } from '@/hooks/useCompanyInfo';
import { generateNewsletterBlocks, getFallbackBlocks } from '@/services/newsletterBlockGenerator';
import { fetchSmartImage } from '@/services/unsplashService';
import { useGeneratedBundle } from '@/hooks/useGeneratedBundle';
import { CampaignSetupWizard } from './campaign-setup/CampaignSetupWizard';
import { AIWriterDialog } from './ai-writer/AIWriterDialog';
import { SenderStatusIndicator } from './campaigns/SenderStatusIndicator';
import { CampaignActionBar } from './CampaignActionBar';
import { CampaignReadiness } from './CampaignReadiness';
import { usePagePersistence } from '@/hooks/usePagePersistence';
import { 
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';

// Helper function to fetch image for blocks with missing images
const getOrFetchImage = async (contentObj: any, block: any): Promise<string | null> => {
  // Check if we already have a valid image URL
  const existingImageUrl = contentObj?.imageUrl;
  if (existingImageUrl && existingImageUrl.trim() !== '') {
    return existingImageUrl;
  }

  // Generate image based on block content
  const searchQuery = contentObj?.headline || contentObj?.title || contentObj?.body || 'garden plants';
  console.log(`🖼️ Fetching image for block ${block.id} with query: "${searchQuery}"`);
  
  try {
    const imageData = await fetchSmartImage(searchQuery, '', true);
    if (imageData?.url) {
      // Save the image URL back to the database
      const { error } = await supabase
        .from('campaign_blocks')
        .update({ 
          content: {
            ...contentObj,
            imageUrl: imageData.url,
            altText: imageData.alt
          }
        })
        .eq('id', block.id);

      if (error) {
        console.warn('Failed to save image URL to database:', error);
      } else {
        console.log(`✅ Saved image URL for block ${block.id}`);
      }

      return imageData.url;
    }
  } catch (error) {
    console.warn('Failed to fetch image:', error);
  }

  return null;
};

// Post type rotation for varied content styles
const POST_TYPE_ROTATION = ['instagram', 'facebook', 'blog', 'video', 'newsletter'];

import { createBlockPrompt } from '@/utils/blockPromptBuilder';

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

  if (lowerContent.includes('summer')) {
    return 'Summer gardening tips to keep your plants thriving in the heat';
  }
  
  if (lowerContent.includes('spring')) {
    return 'Spring preparation guides for a successful growing season';
  }
  
  return 'Expert gardening tips delivered to your inbox';
};

// Auto-fill header with campaign title for new newsletters
const autoFillHeaderTitle = (blocks: ContentBlock[], campaignTitle: string): ContentBlock[] => {
  if (!campaignTitle || campaignTitle === 'Newsletter Campaign') return blocks;
  
  return blocks.map(block => {
    if (block.type === 'header' && (!block.title || block.title === 'Campaign Title' || block.title === '')) {
      return {
        ...block,
        title: campaignTitle,
        headline: campaignTitle
      };
    }
    return block;
  });
};

// Normalize blocks to ensure consistency - convert text blocks to image-text blocks with proper structure
const normalizeBlocks = (blocks: ContentBlock[]): ContentBlock[] => {
  return blocks.map(block => {
    // Convert ALL text blocks to image-text blocks for uniformity, not just template/newsletter ones
    if (block.type === 'text') {
      // Extract headline from content if not already present
      let headline = block.headline || block.title || '';
      if (!headline && (block.content || block.body)) {
        const textContent = block.content || block.body || '';
        // Try to extract first line as headline if it looks like a heading
        const lines = textContent.split('\n').filter(line => line.trim());
        if (lines.length > 0) {
          const firstLine = lines[0].trim();
          // If first line is short and looks like a heading, use it as headline
          if (firstLine.length < 100 && firstLine.length > 5) {
            headline = firstLine.replace(/^#+\s*/, '').replace(/^\*\*(.*?)\*\*$/, '$1'); // Remove markdown
          }
        }
      }
      
      // Set default headline if still empty
      if (!headline) {
        headline = 'Content Headline';
      }
      
      console.log(`🔄 Normalizing text block ${block.id} to image-text with headline: "${headline}"`);
      
      return {
        ...block,
        type: 'image-text' as const,
        layout: block.layout || 'image-right',
        headline: headline,
        body: block.body || block.content || 'Add your content here'
      };
    }
    
    return block;
  });
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
  
  // Page persistence hook
  const { persistState, restoreState } = usePagePersistence<{
    campaignName: string;
    subjectLine: string;
    preheaderText: string;
    blocks: ContentBlock[];
    showPreview: boolean;
  }>({
    key: `campaign_creator_${campaignSlug || 'new'}`,
    ttl: 2 * 60 * 60 * 1000, // 2 hours for campaign data
    onHidden: () => {
      // Persist critical state when tab is hidden
      persistState({
        campaignName,
        subjectLine,
        preheaderText,
        blocks,
        showPreview
      });
    }
  });
  
  // Prefill from Generated Bundle if provided
  const bundleIdParam = searchParams.get('bundleId');
  const { query: bundleQuery } = useGeneratedBundle(bundleIdParam || undefined);
  
  // Get contentTaskId from props or URL parameters
  const urlContentTaskId = searchParams.get('contentTaskId');
  const finalContentTaskId = propContentTaskId || urlContentTaskId;
  const [subjectLine, setSubjectLine] = useState('');
  const [preheaderText, setPreheaderText] = useState('');
  const [blocks, setBlocks] = useState<ContentBlock[]>([]);
  const [selectedPersonas, setSelectedPersonas] = useState<any[]>([]);
  const [selectedSegments, setSelectedSegments] = useState<any[]>([]);
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
  const [generatingBlocks, setGeneratingBlocks] = useState<Set<string>>(new Set());
  const [showSetupWizard, setShowSetupWizard] = useState(false);
  const [showAIWriter, setShowAIWriter] = useState(false);
  const [sending, setSending] = useState(false);
  const [showSenderConfirmation, setShowSenderConfirmation] = useState(false);
  

  // Sender configuration for domain verification
  const { senderConfig, loading: loadingSenderConfig } = useSenderConfiguration();

  // Footer and company data
  const { footerSettings } = useFooterSettings();
  const { companyInfo } = useCompanyInfo();

  // Auto-save functionality for CRM campaigns
  const [isAutoSaving, setIsAutoSaving] = useState(false);
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout>();

  const autoSaveCampaign = useCallback(async (campaignData: {
    blocks: ContentBlock[];
    campaign_name: string;
    subject_line: string;
    preheader: string;
  }) => {
    if (!existingCampaignId || isAutoSaving) {
      console.log('🚫 Auto-save skipped:', { existingCampaignId, isAutoSaving });
      return;
    }
    
    let retryCount = 0;
    const maxRetries = 3;
    
    const attemptSave = async (): Promise<void> => {
      try {
        setIsAutoSaving(true);
        console.log('🔄 Auto-save attempt', retryCount + 1, 'for campaign:', existingCampaignId);
        
        // Validate required fields
        if (!campaignData.campaign_name?.trim()) {
          throw new Error('Campaign name is required');
        }

        // Step 1: Update campaign metadata
        console.log('📝 Updating campaign metadata...');
        const { error: campaignError } = await supabase
          .from('crm_campaigns')
          .update({
            name: campaignData.campaign_name,
            subject_line: campaignData.subject_line,
            preheader: campaignData.preheader,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingCampaignId);

        if (campaignError) {
          console.error('❌ Campaign update failed:', campaignError);
          throw new Error(`Campaign update failed: ${campaignError.message}`);
        }
        console.log('✅ Campaign metadata updated successfully');

        // Step 2: Upsert blocks to avoid race conditions
        console.log('📦 Upserting', campaignData.blocks.length, 'blocks...');
        
        if (campaignData.blocks.length > 0) {
          // Validate blocks before upsert
          const blocksToSave = campaignData.blocks.map((block, index) => {
            const blockData = {
              campaign_id: existingCampaignId,
              block_type: block.type,
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
            };

            // Validate required fields
            if (!blockData.block_type) {
              throw new Error(`Block ${index} is missing required block_type`);
            }

            return blockData;
          });

          // First, delete existing blocks for this campaign
          const { error: deleteError } = await supabase
            .from('campaign_blocks')
            .delete()
            .eq('campaign_id', existingCampaignId);

          if (deleteError) {
            console.error('❌ Block deletion failed:', deleteError);
            throw new Error(`Block deletion failed: ${deleteError.message}`);
          }

          // Then insert new blocks in a single transaction
          const { error: blocksError } = await supabase
            .from('campaign_blocks')
            .insert(blocksToSave);

          if (blocksError) {
            console.error('❌ Block insertion failed:', blocksError);
            throw new Error(`Block insertion failed: ${blocksError.message}`);
          }
          console.log('✅ Blocks upserted successfully');
        } else {
          console.log('📦 No blocks to insert');
        }

        setLastSaved(new Date());
        setSaveError(false);
        console.log('✅ Auto-save completed successfully');
        
      } catch (error: any) {
        console.error('❌ Auto-save error (attempt', retryCount + 1, '):', error);
        
        // Check if this is a retryable error
        const isRetryable = error?.message?.includes('network') || 
                           error?.message?.includes('timeout') ||
                           error?.message?.includes('temporary');
        
        if (retryCount < maxRetries && isRetryable) {
          retryCount++;
          console.log('🔄 Retrying auto-save in 2 seconds...');
          await new Promise(resolve => setTimeout(resolve, 2000));
          return attemptSave();
        }
        
        // Final failure
        setSaveError(true);
        
        // Show user-friendly error message
        let errorMessage = "Your changes may not be saved. Please try again.";
        if (error?.message?.includes('Campaign name is required')) {
          errorMessage = "Campaign name is required to save.";
        } else if (error?.message?.includes('network')) {
          errorMessage = "Network error. Check your connection and try again.";
        } else if (error?.message?.includes('Block') && error?.message?.includes('missing')) {
          errorMessage = "Some blocks have invalid data. Please check your content.";
        }
        
        toast({
          title: "Auto-save failed",
          description: errorMessage,
          variant: "destructive"
        });
        
        throw error;
      } finally {
        setIsAutoSaving(false);
      }
    };

    return attemptSave();
  }, [existingCampaignId, isAutoSaving, toast]);

  // Handler for AI-generated content
  const handleAIContentGenerated = async (aiData: {
    campaignName: string;
    subjectLine: string;
    preheaderText: string;
    blocks: ContentBlock[];
  }) => {
    console.log('🤖 AI content generated:', aiData);
    
    // Update campaign fields
    setCampaignName(aiData.campaignName);
    setSubjectLine(aiData.subjectLine);
    setPreheaderText(aiData.preheaderText);
    setBlocks(aiData.blocks);
    
    // If we have an existing campaign, trigger auto-save
    if (existingCampaignId) {
      debouncedAutoSave({
        blocks: aiData.blocks,
        campaign_name: aiData.campaignName,
        subject_line: aiData.subjectLine,
        preheader: aiData.preheaderText
      });
    }
  };

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

  // Auto-enhance new newsletters without templates
  const [enhancing, setEnhancing] = useState(false);
  
  useEffect(() => {
    const route = searchParams;
    const isNewNewsletter = 
      route.get('type') === 'newsletter' &&
      !route.get('templateId') &&
      !route.get('contentTaskId') &&
      !existingCampaignId &&
      blocks.length > 0 &&
      !enhancing;
    
    if (!isNewNewsletter) return;
    
    let cancelled = false;
    
    async function enhanceAll() {
      console.log('[AI] Auto-enhance: starting for new newsletter');
      setEnhancing(true);
      
      const topic = campaignName || 
        blocks.find((b) => b.title || b.headline)?.title || 
        'Weekly Gardening Tips';
      
      try {
        const enhanced = await Promise.allSettled(
          blocks.map(async (block) => {
            if (block.type === 'header' || block.type === 'divider') {
              return block;
            }
            
            const currentIndex = blocks.indexOf(block);
            const previousBlocks = blocks.slice(0, currentIndex).filter(b => b.type !== 'header' && b.type !== 'divider');
            
            const payload = {
              prompt: `Create newsletter content for: ${topic.trim()}`,
              type: 'email_block',
              postType: 'newsletter',
              campaignTitle: topic.trim(),
              campaignContext: '',
              blockIndex: currentIndex,
              previousBlocks,
              totalBlocks: blocks.length
            };
            
            console.log('[AI] auto-enhance invoke for block:', { blockId: block.id, payload });
            const { data, error } = await supabase.functions.invoke('generate-email-content', { 
              body: payload 
            });
            
            console.log('[AI] auto-enhance response:', { blockId: block.id, error, data });
            
            if (error) return block;
            
            const { normalizeAIResponse, applyAIToBlock } = await import('@/lib/newsletter/aiMapping');
            const normalizedAI = normalizeAIResponse(data);
            let updatedBlock = applyAIToBlock(block, normalizedAI);
            
            // Defensive handling for placeholder titles
            if (updatedBlock.title === 'AI Generated Content' || !updatedBlock.title) {
              updatedBlock.title = normalizedAI.title || topic.trim() || 'Newsletter Content';
            }
            if (updatedBlock.headline === 'AI Generated Content' || !updatedBlock.headline) {
              updatedBlock.headline = normalizedAI.title || topic.trim() || 'Newsletter Content';
            }
            
            return updatedBlock;
          })
        );
        
        const enhancedBlocks = enhanced.map((result, i) => 
          result.status === 'fulfilled' ? result.value : blocks[i]
        );
        
        if (!cancelled) {
          // Apply image fallback for blocks that need images
          const blocksWithImages = await Promise.all(
            enhancedBlocks.map(async (block) => {
              if ((block.type === 'image-text' || block.type === 'hero') && !block.imageUrl) {
                const imageQuery = block.title || block.headline || campaignName || 'garden';
                try {
                  const imageData = await fetchSmartImage(imageQuery, '', true);
                  if (imageData?.url) {
                    return { ...block, imageUrl: imageData.url, altText: imageData.alt };
                  }
                } catch (error) {
                  console.warn('Failed to fetch fallback image for block:', block.id, error);
                }
              }
              return block;
            })
          );
          
          setBlocks(blocksWithImages);
          const contentCount = blocksWithImages.filter(b => (b.body || b.content)?.length).length;
          
          console.log('[AI] Auto-enhance: completed');
          toast({
            title: "AI Enhancement Complete",
            description: `Generated ${contentCount} blocks with AI content and images`,
          });
        }
      } catch (error) {
        console.error('[AI] Auto-enhance failed:', error);
        if (!cancelled) {
          toast({
            title: "Auto-enhancement failed",
            description: "Manual content editing is still available",
            variant: "destructive"
          });
        }
      } finally {
        if (!cancelled) {
          setEnhancing(false);
        }
      }
    }
    
    // Delay to ensure blocks have fully loaded
    const timer = setTimeout(enhanceAll, 1000);
    
    return () => { 
      cancelled = true;
      clearTimeout(timer);
    };
  }, [searchParams, existingCampaignId, blocks.length, campaignName, enhancing, supabase, toast]);

  // Prefill from Generated Bundle (newsletter)
  useEffect(() => {
    const type = searchParams.get('type');
    if (type !== 'newsletter') return;
    if (!bundleIdParam) return;
    if (bundleQuery.isLoading || !bundleQuery.data) return;

    const prefillKey = `crm-prefill:${bundleIdParam}`;
    const cleanUrl = () => {
      const url = new URL(window.location.href);
      url.searchParams.delete('bundleId');
      const qs = url.searchParams.toString();
      window.history.replaceState({}, '', url.pathname + (qs ? `?${qs}` : ''));
    };

    if (localStorage.getItem(prefillKey) === 'done') {
      cleanUrl();
      return;
    }

    if (blocks.length > 0) return;

    try {
      const items = (bundleQuery.data.content?.items || []) as any[];
      const newsletterItem = items.find((i: any) => i.channel === 'newsletter') || items.find((i: any) => i.channel === 'blog') || items[0];
      if (!newsletterItem) return;
      const title = newsletterItem.title || 'Newsletter';
      const body = newsletterItem.body || '';
      setCampaignName(title);
      setSubjectLine(title);
setPreheaderText(generatePreheaderText(body, title));

// Use robust converter to build 4–5 blocks preview from YAML/Markdown
const result = convertNewsletterToCRM(body, title);
setBlocks(normalizeBlocks(result.blocks));

localStorage.setItem(prefillKey, 'done');
toast({ title: 'Newsletter prefilled', description: 'We added content from your bundle.' });
cleanUrl();
    } catch (e) {
      console.warn('CRM prefill from bundle failed', e);
    }
  }, [bundleIdParam, bundleQuery.data, bundleQuery.isLoading, blocks.length, searchParams, toast]);

  // Guard flags to prevent multiple processing runs
  const processedTemplateRef = useRef<string | null>(null);
  const processedExistingCampaignRef = useRef<string | null>(null);
  const processedContentTaskRef = useRef<string | null>(null);

  // Check for existing campaign and load session data
  useEffect(() => {
    const checkExistingCampaign = async () => {
      console.log('🔍 CRMCampaignCreator: Starting campaign check', { campaignSlug, finalContentTaskId });
      
      // First try to restore from persisted state
      const persistedState = restoreState();
      if (persistedState && !existingCampaignId) {
        console.log('📋 Restoring persisted state');
        setCampaignName(persistedState.campaignName);
        setSubjectLine(persistedState.subjectLine);
        setPreheaderText(persistedState.preheaderText);
        setBlocks(persistedState.blocks);
        setShowPreview(persistedState.showPreview);
      }
      
      // Handle newsletter template processing (from picker)
      const templateId = searchParams.get('templateId');
      const layout = searchParams.get('layout');
      const source = searchParams.get('source');
      
      if (templateId && source === 'picker') {
        // Guard: Only process template once
        const templateKey = `${templateId}-${layout}-${source}`;
        if (processedTemplateRef.current === templateKey) {
          console.log('🚫 Template already processed, skipping:', templateKey);
          return;
        }
        
        console.log('🎨 Processing newsletter template:', { templateId, layout });
        processedTemplateRef.current = templateKey;
        
        try {
          setLoading(true);
          
          // Fetch the newsletter ideas to get the template
          const { data, error } = await supabase.rpc('fn_get_newsletter_ideas');
          
          if (error) throw error;
          
          const ideas = Array.isArray(data) ? data as any[] : [];
          const selectedIdea = ideas.find(idea => idea.id === templateId);
          
          if (selectedIdea) {
            console.log('✅ Found template idea:', selectedIdea.title);
            
            // Set campaign details from template
            setCampaignName(selectedIdea.title || 'Newsletter Campaign');
            setSubjectLine(selectedIdea.title || 'Newsletter');
            setPreheaderText(generatePreheaderText(selectedIdea.description || '', selectedIdea.title || ''));
            
            // Generate blocks using the new newsletter block generator
            const templateBlocks = selectedIdea.templateBlocks || [];
            const layoutType = layout as 'block-builder' | 'simple-email' || 'block-builder';
            
            console.log(`🎨 Generating blocks for ${layoutType} layout with ${templateBlocks.length} template blocks`);
            
            let crmBlocks: ContentBlock[];
            try {
              // First, generate basic template blocks
              crmBlocks = generateNewsletterBlocks({
                topic: selectedIdea.title || 'Newsletter Campaign',
                layout: layoutType,
                templateBlocks: templateBlocks
              });
              
              if (crmBlocks.length === 0) {
                console.warn('⚠️ Block generator returned empty array, using fallback');
                crmBlocks = getFallbackBlocks(selectedIdea.title || 'Newsletter Campaign');
              }
              
              // Enhance each block with AI content using direct block generation
              console.log('🤖 Enhancing template blocks with AI content...');
              
              try {
                const enhancedBlocks = await Promise.all(
                  crmBlocks.map(async (block, index) => {
                    // Skip header blocks from AI enhancement to keep clean titles
                    if (block.type === 'header') {
                      return block;
                    }

                    try {
                      console.log(`🔄 Generating AI content for block ${index + 1}: ${block.type}`);
                      
                      const postType = POST_TYPE_ROTATION[index % POST_TYPE_ROTATION.length];
                      const previousBlocks = crmBlocks.slice(0, index).filter(b => b.type !== 'header' && b.type !== 'divider');
                      
                      const response = await supabase.functions.invoke('generate-email-content', {
                        body: { 
                          prompt: `Create newsletter content for: ${selectedIdea.title}`,
                          type: 'email_block',
                          postType: postType,
                          campaignTitle: selectedIdea.title || 'Newsletter Campaign',
                          campaignContext: selectedIdea.description || '',
                          blockIndex: index,
                          previousBlocks,
                          totalBlocks: crmBlocks.length
                        }
                      });

                      if (response.error) {
                        console.warn(`⚠️ AI generation failed for block ${index + 1}:`, response.error);
                        return block; // Return original block if AI fails
                      }

                      const aiResult = response.data;
                      if (aiResult && aiResult.title && aiResult.content) {
                        console.log(`✅ AI content generated for block ${index + 1}`);
                        
                        // Apply AI content to block with proper field mapping
                        return {
                          ...block,
                          title: aiResult.title,
                          headline: aiResult.title,
                          content: aiResult.content,
                          body: aiResult.content,
                          ctaText: aiResult.cta_text || block.ctaText,
                          ctaUrl: aiResult.cta_url || block.ctaUrl
                        };
                      } else {
                        console.warn(`⚠️ AI returned incomplete content for block ${index + 1}`);
                        return block;
                      }
                    } catch (blockError) {
                      console.warn(`⚠️ Failed to enhance block ${index + 1}:`, blockError);
                      return block; // Return original block if enhancement fails
                    }
                  })
                );

                console.log(`✅ Enhanced ${enhancedBlocks.length} blocks with AI content`);
                crmBlocks = normalizeBlocks(autoFillHeaderTitle(enhancedBlocks, selectedIdea.title || 'Newsletter Campaign'));
                
              } catch (enhancementError) {
                console.error('❌ Block enhancement failed, using template blocks:', enhancementError);
                // Keep the template blocks as fallback
              }
              
            } catch (error) {
              console.error('❌ Error generating blocks:', error);
              crmBlocks = getFallbackBlocks(selectedIdea.title || 'Newsletter Campaign');
            }
            
            setBlocks(normalizeBlocks(crmBlocks));
            
            // Always generate and auto-fill images for template-picked newsletters
            setTimeout(async () => {
              try {
                console.log('🖼️ Fetching images for newsletter blocks...');
                
                // Generate primary search query (prefer heroQuery, fallback to title/description)
                const primaryQuery = selectedIdea.heroQuery || selectedIdea.title || selectedIdea.description || 'garden';
                console.log(`🔍 Using primary query: "${primaryQuery}"`);
                
                // Find all blocks that need images (limit to first 3)
                const imageBlocks = crmBlocks
                  .map((block, index) => ({ block, index }))
                  .filter(({ block }) => {
                    // Original logic for image and image-text blocks
                    const hasImageType = (block.type === 'image' || block.type === 'image-text' || block.type === 'header');
                    
                    // New logic for image-centric layouts
                    const hasImageCentricLayout = block.layout && (
                      block.layout === 'image-left' || 
                      block.layout === 'image-right' || 
                      block.layout === 'two-column-left' || 
                      block.layout === 'two-column-right'
                    );
                    
                    // Check if block has text content but no image
                    const hasTextContent = (block.title || block.headline || block.content || block.body);
                    const needsImage = !block.imageUrl && 
                                     !(typeof block.content === 'object' && block.content && (block.content as any).imageUrl);
                    
                    return (hasImageType || (hasImageCentricLayout && hasTextContent)) && needsImage;
                  })
                  .slice(0, 8); // Increased limit to handle more blocks
                
                console.log(`📸 [Images] Found ${imageBlocks.length} blocks needing images`);
                
                for (let i = 0; i < imageBlocks.length; i++) {
                  try {
                    const blockInfo = imageBlocks[i];
                    
                    // Use primary query for first block, variations for others
                    let searchQuery = primaryQuery;
                    if (i === 1) searchQuery = `${primaryQuery} gardening plants`;
                    if (i === 2) searchQuery = `${primaryQuery} garden tools tips`;
                    
                    console.log(`🔍 Fetching image ${i + 1} for block ${blockInfo.index} with query: "${searchQuery}"`);
                    
                    const imageData = await fetchSmartImage(searchQuery, '', true);
                    
                    if (imageData?.url) {
                      setBlocks(prev => prev.map((block, index) => 
                        index === blockInfo.index
                          ? { 
                              ...block, 
                              imageUrl: imageData.url, 
                              altText: imageData.alt || `${selectedIdea.title} content` 
                            }
                          : block
                      ));
                      console.log(`✅ Applied image to block ${blockInfo.index}`);
                    } else {
                      console.warn(`⚠️ No image data returned for block ${blockInfo.index}`);
                    }
                    
                    // Add delay between requests to avoid rate limiting
                    if (i < imageBlocks.length - 1) {
                      await new Promise(resolve => setTimeout(resolve, 500));
                    }
                  } catch (error) {
                    console.error(`Failed to fetch image for block ${i}:`, error);
                  }
                }
                
                console.log(`📸 [Images] Applied fallback images: ${imageBlocks.length} of ${crmBlocks.filter(b => b.type === 'image-text' || b.type === 'header').length} image blocks`);
                
              } catch (error) {
                console.error('Failed to fetch newsletter images:', error);
              }
            }, 1500); // Increased delay to let AI content load first
            
            toast({
              title: "Template Applied",
              description: `Newsletter template "${selectedIdea.title}" has been applied successfully with ${crmBlocks.length} blocks for ${layoutType} layout.`,
            });
            
            console.log(`✅ [NewsletterInit] Generated ${crmBlocks.length} blocks for "${selectedIdea.title}" (layout: ${layoutType})`);
          } else {
            console.warn('⚠️ Template not found, using URL parameters as fallback:', templateId);
            
            // Extract title and description from URL parameters as fallback
            const urlTitle = decodeURIComponent(searchParams.get('title') || '');
            const urlDescription = decodeURIComponent(searchParams.get('description') || '');
            
            const topic = urlTitle || 'Newsletter Campaign';
            const description = urlDescription || topic;
            
            // Generate blocks based on layout and topic
            const layoutType = layout as 'block-builder' | 'simple-email' || 'block-builder';
            setCampaignName(topic);
            setSubjectLine(topic.replace(' Newsletter', ''));
            setPreheaderText(generatePreheaderText(topic, description));
            
            console.log(`🎨 Generating ${layoutType} layout blocks for topic: "${topic}"`);
            
            let crmBlocks = generateNewsletterBlocks({
              topic: topic,
              layout: layoutType,
              templateBlocks: []
            });
            
            if (crmBlocks.length === 0) {
              console.warn('⚠️ Block generator returned empty array, using fallback');
              crmBlocks = getFallbackBlocks(topic);
            }
            
            setBlocks(normalizeBlocks(crmBlocks));
            console.log(`✅ [FallbackInit] Generated ${crmBlocks.length} blocks for "${topic}" (layout: ${layoutType})`);
          }
        } catch (error) {
          console.error('❌ Error processing template:', error);
          toast({
            title: "Template Error",
            description: "Failed to load the selected template. Starting with a blank campaign.",
            variant: "destructive"
          });
        } finally {
          setLoading(false);
        }
        return;
      }
      
      // Handle direct campaign slug (when editing existing campaign)
      // This takes priority over content task conversion
      if (campaignSlug) {
        // Check if campaignSlug is a valid UUID (existing campaign) or just a slug (new campaign)
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        const isValidUUID = uuidRegex.test(campaignSlug);
        
        console.log('🔍 CRMCampaignCreator: Checking campaign slug', { campaignSlug, isValidUUID });
        
        if (isValidUUID) {
          // Guard: Only process existing campaign once
          if (processedExistingCampaignRef.current === campaignSlug) {
            console.log('🚫 Existing campaign already processed, skipping:', campaignSlug);
            return;
          }
          
          console.log('🔄 Loading existing campaign by UUID:', campaignSlug);
          processedExistingCampaignRef.current = campaignSlug;
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

      // Guard: Only process content task once
      if (processedContentTaskRef.current === contentTaskId) {
        console.log('🚫 Content task already processed, skipping:', contentTaskId);
        return;
      }
      processedContentTaskRef.current = contentTaskId;

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
  }, [searchParams.get('templateId'), searchParams.get('layout'), searchParams.get('source'), finalContentTaskId, campaignSlug]);

  // Additional useEffect to monitor blocks changes
  useEffect(() => {
    console.log('📊 Blocks state changed:', { 
      blockCount: blocks.length, 
      blockIds: blocks.map(b => b.id),
      blockTypes: blocks.map(b => b.type)
    });
  }, [blocks]);

  // Initialize blank newsletter with default blocks
  const blankNewsletterInitialized = useRef(false);
  useEffect(() => {
    const isBlankNewsletter = 
      searchParams.get('type') === 'newsletter' &&
      !searchParams.get('templateId') &&
      !searchParams.get('contentTaskId') &&
      !existingCampaignId &&
      !campaignSlug &&
      blocks.length === 0 &&
      !blankNewsletterInitialized.current;

    if (isBlankNewsletter) {
      console.log('🆕 Initializing blank newsletter with default blocks');
      blankNewsletterInitialized.current = true;
      
      setCampaignName('Newsletter Campaign');
      setSubjectLine('Weekly Garden Update');
      setPreheaderText('Essential gardening tips delivered to your inbox');
      
      // Generate default newsletter blocks
      const defaultBlocks = getFallbackBlocks('Newsletter Campaign');
      setBlocks(defaultBlocks);
      
      console.log('✅ Blank newsletter initialized with', defaultBlocks.length, 'blocks');
    }
  }, [
    searchParams.get('type'), 
    searchParams.get('templateId'), 
    searchParams.get('contentTaskId'),
    existingCampaignId,
    campaignSlug,
    blocks.length
  ]);

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
        const transformBlock = async (block: any): Promise<ContentBlock> => {
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

          // CRITICAL FIX: Unwrap nested content structure
          // Database stores content like: { content: { body: "text", content: "text", headline: "..." } }
          // We need to unwrap to get to the actual content fields
          while (contentObj && typeof contentObj === 'object' && contentObj.content && typeof contentObj.content === 'object') {
            console.log('🔧 Unwrapping nested content layer:', Object.keys(contentObj.content));
            contentObj = contentObj.content;
          }
          
          console.log('✅ Content after unwrapping:', {
            blockId: block.id,
            hasBody: !!contentObj?.body,
            hasContent: !!contentObj?.content,
            hasHeadline: !!contentObj?.headline,
            bodyType: typeof contentObj?.body,
            contentType: typeof contentObj?.content
          });

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

        // Use simplified content structure with validation
        console.log('[HYDRATION] Processing block with clean content structure:', {
          blockId: block.id,
          blockType: block.block_type,
          contentObj: contentObj,
          hasContent: !!contentObj?.content,
          hasBody: !!contentObj?.body,
          hasHeadline: !!contentObj?.headline,
          hasTitle: !!contentObj?.title
        });
        
        // Extract content directly from the simplified structure
        const finalExtractedContent = {
          // Essential content fields - prioritize direct fields
          headline: contentObj?.headline,
          title: contentObj?.title,
          body: contentObj?.body || contentObj?.content,
          content: contentObj?.content || contentObj?.body,
          // Image fields - CRITICAL FIX: Treat empty strings as null and fetch if missing
          imageUrl: await getOrFetchImage(contentObj, block),
          altText: contentObj?.altText,
          caption: contentObj?.caption,
          // Button/CTA fields
          buttonText: contentObj?.buttonText,
          buttonUrl: contentObj?.buttonUrl,
          ctaText: contentObj?.ctaText,
          ctaUrl: contentObj?.ctaUrl,
          ctaStyle: contentObj?.ctaStyle,
          ctaSize: contentObj?.ctaSize,
          // Layout and styling
          layout: contentObj?.layout || 'full-width',
          alignment: contentObj?.alignment,
          padding: contentObj?.padding || 'medium',
          margin: contentObj?.margin,
          // Typography
          fontFamily: contentObj?.fontFamily,
          fontSize: contentObj?.fontSize,
          textColor: contentObj?.textColor,
          textAlign: contentObj?.textAlign || contentObj?.alignment,
          // Background
          backgroundColor: contentObj?.backgroundColor,
          backgroundImageUrl: contentObj?.backgroundImageUrl,
          backgroundOpacity: contentObj?.backgroundOpacity,
          // Special content
          quote: contentObj?.quote,
          author: contentObj?.author,
          authorTitle: contentObj?.authorTitle,
          issueNumber: contentObj?.issueNumber,
          publishDate: contentObj?.publishDate,
          // Meta
          visible: contentObj?.visible !== false,
          collapsed: contentObj?.collapsed || false
        };

        console.log('📋 Content extraction details:', {
          blockId: block.id,
          originalContentObj: contentObj,
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
          altText: finalExtractedContent.altText,
          caption: finalExtractedContent.caption,
          // Button/CTA fields
          buttonText: finalExtractedContent.buttonText || block.cta_text,
          buttonUrl: finalExtractedContent.buttonUrl || block.cta_url,
          ctaText: finalExtractedContent.ctaText || block.cta_text,
          ctaUrl: finalExtractedContent.ctaUrl || block.cta_url,
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
          backgroundColor: finalExtractedContent.backgroundColor,
          backgroundImageUrl: actualBlockType === 'header' ? (finalExtractedContent.backgroundImageUrl || block.image_url) : finalExtractedContent.backgroundImageUrl,
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

      const contentBlocks: ContentBlock[] = await Promise.all(campaignBlocks.map(transformBlock));

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
      const result = convertNewsletterToCRM(fullContent, title, contentTaskId);
      
      if (!result.blocks || result.blocks.length === 0) {
        throw new Error('Conversion resulted in no blocks');
      }
      
      // Pre-fill campaign settings
      setCampaignName(result.campaignTitle);
      setSubjectLine(result.campaignTitle);
      // Generate content-specific preheader
      const preheaderText = generatePreheaderText(fullContent, result.campaignTitle);
      setPreheaderText(preheaderText);
      
      // Set blocks with layout and images
      const crmBlocks = result.blocks;
      console.log('✅ Newsletter converted to', crmBlocks.length, 'blocks');
      
      setBlocks(normalizeBlocks(crmBlocks));
      
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
    const emailContent = generateEmailContentWithStyles();
    
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>${subjectLine || 'Email Campaign'}</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
  <link href="https://fonts.googleapis.com/css2?family=Quicksand:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Quicksand:wght@400;500;600;700&display=swap');
    
    /* Reset and base styles */
    body, table, td, p, a, li, blockquote {
      -webkit-text-size-adjust: 100%;
      -ms-text-size-adjust: 100%;
    }
    table, td {
      mso-table-lspace: 0pt;
      mso-table-rspace: 0pt;
    }
    img {
      -ms-interpolation-mode: bicubic;
      border: 0;
      height: auto;
      line-height: 100%;
      outline: none;
      text-decoration: none;
    }
    
    /* Mobile responsive styles */
    @media only screen and (max-width: 600px) {
      .email-container {
        width: 100% !important;
        max-width: 100% !important;
      }
      .content-block {
        padding: 20px 15px !important;
      }
      .mobile-center {
        text-align: center !important;
      }
      .mobile-full-width {
        width: 100% !important;
        display: block !important;
        padding-left: 0 !important;
        padding-right: 0 !important;
        padding-bottom: 20px !important;
      }
      .mobile-stack table,
      .mobile-stack tbody,
      .mobile-stack tr,
      .mobile-stack td {
        display: block !important;
        width: 100% !important;
      }
      .mobile-stack td {
        padding-left: 0 !important;
        padding-right: 0 !important;
        padding-bottom: 20px !important;
      }
      .cta-button {
        width: auto !important;
        padding: 12px 24px !important;
        font-size: 16px !important;
      }
      img {
        max-width: 100% !important;
        height: auto !important;
      }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #f8f9fa; font-family: 'Quicksand', 'Arial', sans-serif;">
  ${emailContent}
</body>
</html>`;
  };

  const generateEmailContentWithStyles = (): string => {
    let html = `
      <div class="email-container" style="max-width: 600px; margin: 0 auto; background: white; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
        <div class="content-block" style="padding: 30px 20px;">
    `;
    
    blocks.forEach(block => {
      if (block.visible === false) return; // Only skip blocks explicitly set to false
      
      switch (block.type) {
        case 'header':
          const headerAlign = block.textAlign || 'center';
          const headerOpacity = block.backgroundOpacity || 0.4;
          html += `
            <div style="position: relative; text-align: ${headerAlign}; padding: 40px 20px; margin: 20px 0; border-radius: 8px; overflow: hidden;
                        ${block.backgroundImageUrl ? `background-image: url(${block.backgroundImageUrl}); background-size: cover; background-position: center;` : ''}
                        ${!block.backgroundImageUrl ? `background-color: ${block.backgroundColor || '#1f2937'};` : ''}">
              ${block.backgroundImageUrl ? `<div style="position: absolute; inset: 0; background-color: ${block.backgroundColor || '#000000'}; opacity: ${headerOpacity};"></div>` : ''}
              <div style="position: relative; z-index: 10;">
                <h1 style="font-size: 28px; font-weight: 600; margin: 0 0 16px 0; font-family: 'Quicksand', sans-serif; color: ${block.textColor || '#ffffff'};">${block.headline || block.title || 'Your Headline Here'}</h1>
                ${block.body || block.content ? `<div style="font-size: 18px; margin: 0; opacity: 0.9; font-family: 'Quicksand', sans-serif; color: ${block.textColor || '#ffffff'};">${block.body || block.content || ''}</div>` : ''}
              </div>
            </div>
          `;
          break;

        case 'text':
          const textAlign = block.textAlign || 'left';
          const textColor = block.textColor || '#475569';
          html += `
            <div style="margin: 20px 0; text-align: ${textAlign}; font-size: ${block.fontSize || '16px'}; font-family: 'Quicksand', sans-serif; ${block.backgroundColor ? `background-color: ${block.backgroundColor}; padding: 20px; border-radius: 8px;` : ''}">
              ${block.headline || block.title ? `<h2 style="font-size: 24px; font-weight: 600; margin: 0 0 16px 0; color: ${textColor}; font-family: 'Quicksand', sans-serif;">${block.headline || block.title}</h2>` : ''}
              ${block.content || block.body ? `<div style="color: ${textColor}; line-height: 1.6;">${block.content || block.body}</div>` : ''}
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
          const isImageLeft = block.layout === 'image-left' || !block.layout;
          const itTextAlign = block.textAlign || 'left';
          const itTextColor = block.textColor || '#475569';
          const itHeadlineColor = block.textColor || '#1f2937'; // Use dark gray instead of green
          html += `
            <div style="margin: 20px 0; padding: 20px; ${block.backgroundColor ? `background-color: ${block.backgroundColor};` : ''} border-radius: 8px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse;" class="mobile-stack">
                <tr>
                  ${isImageLeft ? `
                    <td width="50%" style="padding-right: 20px; vertical-align: top;" class="mobile-full-width mobile-stack">
                      ${block.imageUrl ? `<img src="${block.imageUrl}" alt="${block.altText || ''}" style="width: 100%; height: auto; border-radius: 8px; display: block;" />` :
                        '<div style="background: #f1f5f9; padding: 40px 20px; text-align: center; color: #64748b; border-radius: 8px; font-family: \'Quicksand\', sans-serif;">No image</div>'}
                    </td>
                    <td width="50%" style="padding-left: 20px; vertical-align: top; text-align: ${itTextAlign};" class="mobile-full-width mobile-stack">
                      ${block.headline ? `<h2 style="font-size: 24px; font-weight: 600; margin: 0 0 16px 0; color: ${itHeadlineColor}; font-family: 'Quicksand', sans-serif;">${block.headline}</h2>` : ''}
                       ${block.body ? `<div style="color: ${itTextColor}; line-height: 1.6; margin: 0; font-family: 'Quicksand', sans-serif;">${block.body}</div>` : ''}
                    </td>
                  ` : `
                    <td width="50%" style="padding-right: 20px; vertical-align: top; text-align: ${itTextAlign};" class="mobile-full-width mobile-stack">
                      ${block.headline ? `<h2 style="font-size: 24px; font-weight: 600; margin: 0 0 16px 0; color: ${itHeadlineColor}; font-family: 'Quicksand', sans-serif;">${block.headline}</h2>` : ''}
                      ${block.body ? `<div style="color: ${itTextColor}; line-height: 1.6; margin: 0; font-family: 'Quicksand', sans-serif;">${block.body}</div>` : ''}
                    </td>
                    <td width="50%" style="padding-left: 20px; vertical-align: top;" class="mobile-full-width mobile-stack">
                      ${block.imageUrl ? `<img src="${block.imageUrl}" alt="${block.altText || ''}" style="width: 100%; height: auto; border-radius: 8px; display: block;" />` :
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
               ${block.headline ? `<h3 style="color: ${block.textColor || '#1f2937'}; margin: 0 0 10px 0; font-size: 20px; font-family: 'Quicksand', sans-serif; font-weight: 600;">${block.headline}</h3>` : ''}
               ${block.body ? `<div style="color: #64748b; margin: 0 0 20px 0; line-height: 1.6; font-family: 'Quicksand', sans-serif;">${block.body}</div>` : ''}
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
              ${block.body ? `<div style="color: #64748b; margin: 0 0 20px 0;">${block.body}</div>` : ''}
              <div style="display: inline-block;">
                <a href="#" style="display: inline-block; margin: 0 10px; padding: 8px 16px; background: #1877f2; color: white; text-decoration: none; border-radius: 4px;">Facebook</a>
                <a href="#" style="display: inline-block; margin: 0 10px; padding: 8px 16px; background: #1da1f2; color: white; text-decoration: none; border-radius: 4px;">Twitter</a>
                <a href="#" style="display: inline-block; margin: 0 10px; padding: 8px 16px; background: #e4405f; color: white; text-decoration: none; border-radius: 4px;">Instagram</a>
              </div>
            </div>
          `;
          break;

        case 'footer':
          // Footer rendering is handled separately at the end of the function
          // This case is just for the switch statement - actual footer HTML is added below
          break;
      }
    });
    
    // Generate footer with proper token data and settings
    const footerSettings = {
      showPhone: true,
      showLogo: true,
      showManagePreferences: true,
      padding: 'normal' as const,
      alignment: 'center' as const,
      showDivider: true,
      backgroundColor: 'light' as const,
      fontSize: 'sm' as const,
      complianceText: 'You received this email because you subscribed to our newsletter. {{unsubscribe_url}}'
    };
    
    const companyInfo = {
      name: 'Homestead Nurseryland',
      address: '123 Garden Center Dr, Green Valley, CA 90210',
      phone: '(555) 123-GROW',
      logoUrl: ''
    };
    
    console.log('🔍 Generating footer in email preview');
    const tokenData = getDefaultTokenData(companyInfo);
    const footerHTML = generateFooterHTML(footerSettings, companyInfo, tokenData);
    console.log('✅ Footer HTML generated:', footerHTML.substring(0, 100) + '...');
    
    html += `
          ${footerHTML}
        </div>
      </div>
    `;
    
    return html;
  };

  const handleSave = async () => {
    console.log('🚀 Save button clicked');
    console.log('📝 Campaign Name:', `"${campaignName}"`);
    console.log('📝 Subject Line:', `"${subjectLine}"`);
    console.log('📝 Existing Campaign ID:', existingCampaignId);
    
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
      if (existingCampaignId) {
        // Update existing campaign
        console.log('🔄 Updating existing campaign:', existingCampaignId);
        
        await autoSaveCampaign({
          blocks,
          campaign_name: campaignName,
          subject_line: subjectLine,
          preheader: preheaderText
        });
        
        console.log('✅ Campaign updated successfully');
        
        toast({
          title: "Campaign Updated!",
          description: "Your email campaign has been updated successfully."
        });
        
      } else {
        // Create new campaign
        console.log('➕ Creating new campaign');
        
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

        console.log('💾 Saving new campaign to database:', {
          name: campaignName,
          subject: subjectLine,
          preheader: preheaderText,
          blocks: blocks.length,
          hasSourceContent: !!finalContentTaskId
        });
        
        // Save campaign using the service
        const result = await saveCampaignAsDraft(campaignData);
        
        console.log('✅ Campaign created successfully:', result);
        
        toast({
          title: "Campaign Created!",
          description: "Your email campaign has been saved as a draft."
        });
      }
      
      setLastSaved(new Date());
      
      // Navigate back to campaigns list
      navigate('/crm/campaigns');
      
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

  const handleSendCampaign = async () => {
    // Validate required fields
    if (!campaignName.trim()) {
      toast({
        title: "Campaign name required",
        description: "Please enter a campaign name before sending.",
        variant: "destructive"
      });
      return;
    }
    
    if (!subjectLine.trim()) {
      toast({
        title: "Subject line required", 
        description: "Please enter a subject line before sending.",
        variant: "destructive"
      });
      return;
    }

    // Check if audience is selected
    if (selectedSegments.length === 0) {
      toast({
        title: "Audience required",
        description: "Please select customer segments in the Audience section before sending.",
        variant: "destructive"
      });
      return;
    }

    // Check sender configuration
    if (!senderConfig?.isVerified) {
      setShowSenderConfirmation(true);
      return;
    }

    // Proceed with sending
    await proceedWithSending();
  };

  const proceedWithSending = async () => {
    try {
      setSending(true);
      
      const campaignData: CampaignData = {
        name: campaignName,
        subject: subjectLine,
        sender_name: senderConfig?.displayName || 'Garden Center',
        sender_email: senderConfig?.senderEmail || 'noreply@bloomsuite.email',
        content: generateEmailHTML(),
        preheader: preheaderText,
        segments: selectedSegments,
        schedule: { type: 'immediate' },
        content_blocks: blocks
      };

      // First save as draft, then send immediately
      const campaign = await saveCampaignAsDraft(campaignData);
      
      // Now invoke the edge function to actually send the emails
      console.log('🚀 Invoking send-email-campaign for campaign:', campaign.id);
      const { data: sendResult, error: sendError } = await supabase.functions.invoke('send-email-campaign', {
        body: { campaignId: campaign.id }
      });

      if (sendError) {
        console.error('Send error:', sendError);
        throw new Error(sendError.message || 'Failed to send campaign');
      }

      console.log('✅ Campaign sent successfully:', sendResult);
      
      toast({
        title: "Campaign sent!",
        description: `Your campaign "${campaignName}" has been sent to ${sendResult?.metrics?.sent || 0} customers. View analytics to see delivery progress.`
      });

      // Navigate to campaign analytics instead of campaigns list
      navigate(`/crm/campaigns/${campaign.id}/analytics`);

    } catch (error: any) {
      console.error('Error sending campaign:', error);
      
      let errorMessage = "There was an error sending your campaign. Please try again.";
      if (error.message?.includes('Email service not configured')) {
        errorMessage = "Email service not configured. Please set up your domain or add RESEND_API_KEY.";
      } else if (error.message?.includes('no segment selected')) {
        errorMessage = "Please select an audience segment before sending.";
      } else if (error.message?.includes('No customers found')) {
        errorMessage = "No customers found in the selected segment with valid email addresses.";
      }
      
      toast({
        title: "Send failed",
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      setSending(false);
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
    <>
      {/* Sticky Action Bar */}
      <CampaignActionBar
        campaignName={campaignName}
        subjectLine={subjectLine}
        blocks={blocks}
        selectedSegments={selectedSegments}
        senderConfig={senderConfig}
        loadingSenderConfig={loadingSenderConfig}
        lastSaved={lastSaved}
        isAutoSaving={isAutoSaving}
        saveError={saveError}
        sending={sending}
        loading={loading}
        onSend={handleSendCampaign}
        onSave={handleSave}
        onPreview={() => setShowPreview(true)}
        onAudience={() => setShowSetupWizard(true)}
        onAIWriter={() => setShowAIWriter(true)}
      />

      <div className="max-w-7xl mx-auto p-6 space-y-6">
        {/* Breadcrumb Navigation */}
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="/crm">CRM</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink href="/crm/campaigns">Campaigns</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>
                {existingCampaignId ? 'Edit Campaign' : 'New Campaign'}
              </BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
        
        {/* Back Button & Simple Header */}
        <div className="space-y-2">
          <Button variant="ghost" size="sm" onClick={() => navigate('/crm/campaigns')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {existingCampaignId ? 'Edit Email Campaign' : 'Create Email Campaign'}
            </h1>
            <p className="text-muted-foreground">Build and customize your email campaign</p>
          </div>
        </div>

        {/* Campaign Settings - Top Horizontal Section */}
        <Card>
          <CardHeader>
            <CardTitle>Campaign Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
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
            
            {/* Campaign Readiness Checklist */}
            <CampaignReadiness
              campaignName={campaignName}
              subjectLine={subjectLine}
              blocks={blocks}
              selectedSegments={selectedSegments}
              senderConfig={senderConfig}
              onEditAudience={() => setShowSetupWizard(true)}
            />
          </CardContent>
         </Card>

       {/* Campaign Setup Wizard */}
       <CampaignSetupWizard
         open={showSetupWizard}
         onClose={() => setShowSetupWizard(false)}
         selectedPersonas={selectedPersonas}
         selectedSegments={selectedSegments}
         onPersonasChange={setSelectedPersonas}
         onSegmentsChange={setSelectedSegments}
       />

         {/* Email Content Builder - Full Width */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Email Content</CardTitle>
              {!existingCampaignId && (
                <Button variant="outline" size="sm" onClick={() => setShowAIWriter(true)}>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Write with AI
                </Button>
              )}
            </div>
          </CardHeader>
        <CardContent>
          <CleanEmailBlockEditor
            blocks={blocks}
            onBlocksChange={(newBlocks) => {
              console.log('[CRM CAMPAIGN CREATOR] Blocks changed:', newBlocks.length);
              
              // Prevent accidental clearing of blocks unless it's intentional
              if (newBlocks.length === 0 && blocks.length > 0) {
                console.log('🚫 [CRM CAMPAIGN CREATOR] Preventing accidental block clearing');
                return;
              }
              
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
            generatingBlocks={generatingBlocks}
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

      {/* AI Writer Dialog */}
      <AIWriterDialog
        open={showAIWriter}
        onOpenChange={setShowAIWriter}
        onContentGenerated={handleAIContentGenerated}
      />

      {/* Sender Confirmation Modal */}
      <SharedSenderConfirmationModal
        isOpen={showSenderConfirmation}
        onClose={() => setShowSenderConfirmation(false)}
        onConfirm={() => {
          setShowSenderConfirmation(false);
          proceedWithSending();
        }}
        senderConfig={senderConfig}
        campaignName={campaignName}
        recipientCount={selectedPersonas.reduce((total, persona) => total + (persona.customerCount || 0), 0) + selectedSegments.reduce((total, segment) => total + (segment.customerCount || 0), 0)}
      />
      </div>
    </>
  );
};
