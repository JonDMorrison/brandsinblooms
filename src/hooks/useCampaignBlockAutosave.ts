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
      
      // Update the block in campaign_blocks
      const { error: updateError } = await supabase
        .from('campaign_blocks')
        .update({
          content: block.content,
          block_type: block.block_type,
          updated_at: new Date().toISOString()
        })
        .eq('id', block.id);

      if (updateError) throw updateError;

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