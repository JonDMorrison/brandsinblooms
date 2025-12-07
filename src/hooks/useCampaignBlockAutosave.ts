/**
 * Campaign Block Autosave Hook
 * STEP 1: Refactored to use canonical normalizeBlockForSave
 * 
 * This hook provides debounced and immediate save functionality for campaign blocks.
 * It uses the canonical field mapping from blockFieldMapping.ts to ensure consistent
 * data structure between frontend and database.
 */

import { useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { EmailBlock, ContentBlock } from '@/types/emailBuilder';
import { normalizeBlockForSave, convertEmailBlockToContentBlock } from '@/utils/blockFieldMapping';
import { newsletterDebug } from '@/utils/newsletterDebug';

interface AutoSaveOptions {
  onSaveStart?: () => void;
  onSaveSuccess?: () => void;
  onSaveError?: (error: Error) => void;
}

export const useCampaignBlockAutosave = (options: AutoSaveOptions = {}) => {
  const saveTimeoutRef = useRef<NodeJS.Timeout>();
  const lastVersionTimeRef = useRef<{ [blockId: string]: number }>({});

  const saveBlock = useCallback(async (block: EmailBlock, campaignId: string) => {
    const endTimer = newsletterDebug.startTimer('save', `saveBlock(${block.id})`);
    
    try {
      options.onSaveStart?.();
      
      newsletterDebug.log('save', `Starting block save: ${block.id}`, {
        blockType: block.block_type,
        campaignId,
      });
      
      // STEP 1: Convert EmailBlock to ContentBlock using canonical converter
      const contentBlock = convertEmailBlockToContentBlock(block);
      
      // STEP 2: Use canonical normalizeBlockForSave for consistent field mapping
      const normalizedBlock = normalizeBlockForSave(contentBlock, block.order_index || 0);
      
      newsletterDebug.log('save', `Block normalized for save: ${block.id}`, {
        hasHeadline: !!normalizedBlock.content.headline,
        hasBody: !!normalizedBlock.content.body,
        hasImageUrl: !!normalizedBlock.image_url,
        contentKeys: Object.keys(normalizedBlock.content).filter(k => normalizedBlock.content[k] !== undefined).length,
      });

      // Use upsert to either insert or update the block
      const { error: upsertError } = await supabase
        .from('campaign_blocks')
        .upsert({
          id: block.id,
          campaign_id: campaignId,
          ...normalizedBlock,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'id'
        });

      if (upsertError) {
        newsletterDebug.error('save', `Block upsert failed: ${block.id}`, upsertError);
        throw upsertError;
      }

      // Check if we should create a version snapshot (every 5 minutes)
      const now = Date.now();
      const lastVersionTime = lastVersionTimeRef.current[block.id] || 0;
      const shouldCreateVersion = now - lastVersionTime > 5 * 60 * 1000; // 5 minutes

      if (shouldCreateVersion) {
        newsletterDebug.log('save', `Creating version snapshot for block: ${block.id}`);
        
        await supabase
          .from('campaign_block_versions')
          .insert({
            block_id: block.id,
            campaign_id: campaignId,
            snapshot_json: {
              ...normalizedBlock,
              metadata: {
                created_by: 'autosave',
                timestamp: new Date().toISOString()
              }
            }
          });

        lastVersionTimeRef.current[block.id] = now;
      }

      newsletterDebug.log('save', `Block save completed: ${block.id}`);
      options.onSaveSuccess?.();
      endTimer();
      
    } catch (error) {
      newsletterDebug.error('save', `Block save error: ${block.id}`, error);
      options.onSaveError?.(error as Error);
      endTimer();
    }
  }, [options]);

  const debouncedSave = useCallback((block: EmailBlock, campaignId: string) => {
    // Clear existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    newsletterDebug.log('save', `Scheduling debounced save for block: ${block.id}`);

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
    
    newsletterDebug.log('save', `Force saving block: ${block.id}`);
    
    // Save immediately
    saveBlock(block, campaignId);
  }, [saveBlock]);

  return {
    debouncedSave,
    forceSave
  };
};
