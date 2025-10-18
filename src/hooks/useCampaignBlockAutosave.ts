import { useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { EmailBlock } from '@/types/emailBuilder';

interface AutoSaveOptions {
  onSaveStart?: () => void;
  onSaveSuccess?: () => void;
  onSaveError?: (error: Error) => void;
}

export const useCampaignBlockAutosave = (options: AutoSaveOptions = {}) => {
  const saveTimeoutRef = useRef<NodeJS.Timeout>();
  const lastVersionTimeRef = useRef<{ [blockId: string]: number }>({});

  const saveBlock = useCallback(async (block: EmailBlock, campaignId: string) => {
    try {
      options.onSaveStart?.();
      
      // Store content directly without complex nesting to avoid corruption
      // Check both top-level block properties AND content object for each field
      const cleanContent = {
        // Essential content fields - check top level first, then content object
        headline: (block as any).headline || block.content?.headline,
        title: (block as any).title || block.content?.title,
        subtitle: (block as any).subtitle || block.content?.subtitle,
        body: (block as any).body || block.content?.body,
        content: (block as any).content || block.content?.content,
        // Image fields
        imageUrl: (block as any).imageUrl || block.content?.imageUrl,
        altText: (block as any).altText || block.content?.altText,
        caption: (block as any).caption || block.content?.caption,
        // Button/CTA fields
        buttonText: (block as any).buttonText || block.content?.buttonText,
        buttonUrl: (block as any).buttonUrl || block.content?.buttonUrl,
        ctaText: (block as any).ctaText || block.content?.ctaText,
        ctaUrl: (block as any).ctaUrl || block.content?.ctaUrl,
        ctaStyle: (block as any).ctaStyle || block.content?.ctaStyle,
        ctaSize: (block as any).ctaSize || block.content?.ctaSize,
        // Layout and styling
        layout: (block as any).layout || block.content?.layout,
        alignment: (block as any).alignment || block.content?.alignment,
        padding: (block as any).padding || block.content?.padding,
        margin: (block as any).margin || block.content?.margin,
        // Typography
        fontFamily: (block as any).fontFamily || block.content?.fontFamily,
        fontSize: (block as any).fontSize || block.content?.fontSize,
        textColor: (block as any).textColor || block.content?.textColor,
        textAlign: (block as any).textAlign || block.content?.textAlign,
        // Background
        backgroundColor: (block as any).backgroundColor || block.content?.backgroundColor,
        backgroundImageUrl: (block as any).backgroundImageUrl || block.content?.backgroundImageUrl,
        backgroundOpacity: (block as any).backgroundOpacity || block.content?.backgroundOpacity,
        // Overlays
        overlayColor: (block as any).overlayColor || block.content?.overlayColor,
        overlayOpacity: (block as any).overlayOpacity || block.content?.overlayOpacity,
        colorOverlayOpacity: (block as any).colorOverlayOpacity || block.content?.colorOverlayOpacity,
        darkOverlayOpacity: (block as any).darkOverlayOpacity || block.content?.darkOverlayOpacity,
        // Special content
        quote: (block as any).quote || block.content?.quote,
        author: (block as any).author || block.content?.author,
        authorTitle: (block as any).authorTitle || block.content?.authorTitle,
        issueNumber: (block as any).issueNumber || block.content?.issueNumber,
        publishDate: (block as any).publishDate || block.content?.publishDate,
        // Meta
        visible: block.content?.visible !== false,
        collapsed: block.content?.collapsed || false,
        // Store block type for validation
        block_type: block.block_type
      };

      console.log('[AUTO-SAVE] Saving block with clean content structure:', {
        blockId: block.id,
        blockType: block.block_type,
        hasContent: !!cleanContent.content,
        hasHeadline: !!cleanContent.headline,
        hasTitle: !!cleanContent.title,
        hasSubtitle: !!cleanContent.subtitle,
        hasIssueNumber: !!cleanContent.issueNumber,
        hasPublishDate: !!cleanContent.publishDate,
        hasBackgroundImageUrl: !!cleanContent.backgroundImageUrl,
        title: cleanContent.title,
        subtitle: cleanContent.subtitle,
        issueNumber: cleanContent.issueNumber,
        publishDate: cleanContent.publishDate,
        contentKeys: Object.keys(cleanContent).filter(key => cleanContent[key] !== undefined)
      });

      console.log('[AUTO-SAVE] Content JSON being saved:', {
        subtitle: cleanContent.subtitle || null,
        issueNumber: cleanContent.issueNumber || null,
        publishDate: cleanContent.publishDate || null,
        backgroundImageUrl: cleanContent.backgroundImageUrl || null,
        altText: cleanContent.altText || null,
        allFields: Object.keys(cleanContent).filter(key => cleanContent[key] !== undefined)
      });

      // Use upsert to either insert or update the block
      const { error: upsertError } = await supabase
        .from('campaign_blocks')
        .upsert({
          id: block.id,
          campaign_id: campaignId,
          order_index: block.order_index || 0,
          content: cleanContent,
          block_type: block.block_type,
          // Store header background images in image_url for headers
          image_url: block.block_type === 'header' ? block.content?.backgroundImageUrl : (block.image_url || block.content?.imageUrl || null),
          cta_url: block.cta_url || block.content?.ctaUrl || block.content?.buttonUrl || null,
          cta_text: block.cta_text || block.content?.ctaText || block.content?.buttonText || null,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'id'
        });

      if (upsertError) throw upsertError;

      // Check if we should create a version snapshot (every 5 minutes)
      const now = Date.now();
      const lastVersionTime = lastVersionTimeRef.current[block.id] || 0;
      const shouldCreateVersion = now - lastVersionTime > 5 * 60 * 1000; // 5 minutes

      if (shouldCreateVersion) {
        await supabase
          .from('campaign_block_versions')
          .insert({
            block_id: block.id,
            campaign_id: campaignId,
            snapshot_json: {
              content: cleanContent,
              block_type: block.block_type,
              image_url: block.block_type === 'header' ? block.content?.backgroundImageUrl : (block.image_url || block.content?.imageUrl || null),
              cta_url: block.cta_url || block.content?.ctaUrl || block.content?.buttonUrl || null,
              cta_text: block.cta_text || block.content?.ctaText || block.content?.buttonText || null,
              metadata: {
                created_by: 'autosave',
                timestamp: new Date().toISOString()
              }
            }
          });

        lastVersionTimeRef.current[block.id] = now;
      }

      options.onSaveSuccess?.();
    } catch (error) {
      console.error('Auto-save error:', error);
      options.onSaveError?.(error as Error);
    }
  }, [options]);

  const debouncedSave = useCallback((block: EmailBlock, campaignId: string) => {
    // Clear existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Set new timeout for 2 seconds
    saveTimeoutRef.current = setTimeout(() => {
      saveBlock(block, campaignId);
    }, 2000);
  }, [saveBlock]);

  const forceSave = useCallback((block: EmailBlock, campaignId: string) => {
    // Clear any pending debounced save
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    // Save immediately
    saveBlock(block, campaignId);
  }, [saveBlock]);

  return {
    debouncedSave,
    forceSave
  };
};