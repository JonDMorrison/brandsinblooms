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
      
      // Store block properties directly in content to ensure they persist
      const fullContent = {
        // Include existing content
        ...block.content,
        // Store critical block properties from EmailBlock schema
        type: block.block_type,
        // Store the entire block structure to avoid losing properties
        fullBlock: {
          ...block,
          // Remove circular references and database-specific fields
          content: block.content,
          created_at: undefined,
          updated_at: undefined,
          campaign_id: undefined
        }
      };

      console.log('[AUTO-SAVE] Saving block with full content structure:', {
        blockId: block.id,
        blockType: block.block_type,
        hasFullBlock: !!fullContent.fullBlock,
        contentKeys: Object.keys(fullContent)
      });

      // Use upsert to either insert or update the block
      const { error: upsertError } = await supabase
        .from('campaign_blocks')
        .upsert({
          id: block.id,
          campaign_id: campaignId,
          order_index: block.order_index || 0,
          content: fullContent,
          block_type: block.block_type,
          image_url: block.image_url || null,
          cta_url: block.cta_url || null,
          cta_text: block.cta_text || null,
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
              content: block.content,
              block_type: block.block_type,
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