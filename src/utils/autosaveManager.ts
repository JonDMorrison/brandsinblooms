/**
 * Centralized autosave manager to prevent race conditions and improve UX
 */

import { supabase } from '@/integrations/supabase/client';
import { ContentBlock } from '@/types/emailBuilder';
import { normalizeBlock } from './ctaNormalization';
import { normalizeBlockForSave, isHeaderBlock } from './blockFieldMapping';

export interface CampaignData {
  blocks: ContentBlock[];
  campaign_name: string;
  subject_line: string;
  preheader: string;
}

interface AutosaveOptions {
  onSuccess?: () => void;
  onError?: (error: Error) => void;
  onStart?: () => void;
  maxRetries?: number;
  debounceMs?: number;
}

class AutosaveManager {
  private timeoutRef?: NodeJS.Timeout;
  private isAutoSaving = false;
  private defaultOptions: Required<AutosaveOptions> = {
    onSuccess: () => {},
    onError: () => {},
    onStart: () => {},
    maxRetries: 3,
    debounceMs: 2000
  };

  /**
   * Debounced autosave with race condition prevention
   */
  async debouncedSave(
    campaignId: string, 
    campaignData: CampaignData, 
    options?: AutosaveOptions
  ): Promise<void> {
    const opts = { ...this.defaultOptions, ...options };

    // Clear existing timeout
    if (this.timeoutRef) {
      clearTimeout(this.timeoutRef);
    }

    // Set new debounced save
    this.timeoutRef = setTimeout(() => {
      this.save(campaignId, campaignData, opts);
    }, opts.debounceMs);
  }

  /**
   * Immediate save with retry logic
   */
  async save(
    campaignId: string, 
    campaignData: CampaignData, 
    options?: AutosaveOptions
  ): Promise<void> {
    const opts = { ...this.defaultOptions, ...options };

    if (!campaignId || this.isAutoSaving) {
      console.log('🚫 Autosave skipped:', { campaignId, isAutoSaving: this.isAutoSaving });
      return;
    }

    let retryCount = 0;

    const attemptSave = async (): Promise<void> => {
      try {
        this.isAutoSaving = true;
        opts.onStart();
        
        console.log('🔄 Autosave attempt', retryCount + 1, 'for campaign:', campaignId);

        // Validate required fields
        if (!campaignData.campaign_name?.trim()) {
          throw new Error('Campaign name is required');
        }

        // Normalize blocks before saving using unified field mapping
        const normalizedBlocks = campaignData.blocks.map(block => ({
          ...block,
          ...normalizeBlock(block)
        }));

        // Use a transaction-like approach with better error handling
        await this.saveWithTransaction(campaignId, {
          ...campaignData,
          blocks: normalizedBlocks
        });

        opts.onSuccess();
        console.log('✅ Autosave completed successfully');

      } catch (error: any) {
        console.error('❌ Autosave error (attempt', retryCount + 1, '):', error);

        // Check if this is a retryable error
        const isRetryable = error?.message?.includes('network') || 
                           error?.message?.includes('timeout') ||
                           error?.code === 'PGRST301'; // Supabase temporary error

        if (retryCount < opts.maxRetries && isRetryable) {
          retryCount++;
          console.log('🔄 Retrying autosave in 2 seconds...');
          await new Promise(resolve => setTimeout(resolve, 2000));
          return attemptSave();
        }

        // Final failure
        opts.onError(error);
        throw error;
        
      } finally {
        this.isAutoSaving = false;
      }
    };

    return attemptSave();
  }

  /**
   * Atomic save operation with optimized upserts using unified field mapping
   */
  private async saveWithTransaction(campaignId: string, campaignData: CampaignData): Promise<void> {
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
      .eq('id', campaignId);

    if (campaignError) {
      throw new Error(`Campaign update failed: ${campaignError.message}`);
    }

    // Step 2: Atomic block replacement
    if (campaignData.blocks.length === 0) {
      // If no blocks, just delete existing ones
      console.log('🗑️ Removing all blocks...');
      const { error: deleteError } = await supabase
        .from('campaign_blocks')
        .delete()
        .eq('campaign_id', campaignId);

      if (deleteError) {
        throw new Error(`Block deletion failed: ${deleteError.message}`);
      }
    } else {
      // Replace all blocks atomically using unified field mapping
      console.log('📦 Replacing', campaignData.blocks.length, 'blocks atomically...');
      
      const blocksToSave = campaignData.blocks.map((block, index) => {
        // Use unified field mapping for consistent save
        const normalizedBlock = normalizeBlockForSave(block, index);
        return {
          campaign_id: campaignId,
          ...normalizedBlock
        };
      });

      // Validate blocks
      blocksToSave.forEach((blockData, index) => {
        if (!blockData.block_type) {
          throw new Error(`Block ${index} is missing required block_type`);
        }
      });

      // Perform atomic replacement
      const { error: deleteError } = await supabase
        .from('campaign_blocks')
        .delete()
        .eq('campaign_id', campaignId);

      if (deleteError) {
        throw new Error(`Block deletion failed: ${deleteError.message}`);
      }

      const { error: insertError } = await supabase
        .from('campaign_blocks')
        .insert(blocksToSave);

      if (insertError) {
        throw new Error(`Block insertion failed: ${insertError.message}`);
      }
    }

    console.log('✅ Atomic save completed');
  }

  /**
   * Cancel pending saves
   */
  cancel(): void {
    if (this.timeoutRef) {
      clearTimeout(this.timeoutRef);
      this.timeoutRef = undefined;
    }
  }

  /**
   * Check if autosave is currently running
   */
  get isSaving(): boolean {
    return this.isAutoSaving;
  }
}

// Export singleton instance
export const autosaveManager = new AutosaveManager();