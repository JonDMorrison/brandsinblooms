import { useCallback, useRef, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ContentBlock } from '@/types/emailBuilder';
import { normalizeBlockForSave } from '@/utils/blockFieldMapping';
import { useAuth } from '@/hooks/useAuth';
import { logSupabaseError, logDevError } from '@/utils/devErrorLogger';

interface CampaignDraft {
  id: string;
  name: string;
  subject_line: string;
  preheader: string;
  blocks: ContentBlock[];
}

interface UseCampaignAutoSaveOptions {
  debounceMs?: number;
  onSaveStart?: () => void;
  onSaveSuccess?: (campaignId: string) => void;
  onSaveError?: (error: Error) => void;
}

export function useCampaignAutoSave(options: UseCampaignAutoSaveOptions = {}) {
  const { debounceMs = 3000, onSaveStart, onSaveSuccess, onSaveError } = options;
  const { user } = useAuth();
  
  const [isSaving, setIsSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [draftCampaignId, setDraftCampaignId] = useState<string | null>(null);
  
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastSavedDataRef = useRef<string>('');
  const isSavingRef = useRef(false);
  
  // Create a draft campaign if none exists
  const createDraftCampaign = useCallback(async (name: string): Promise<string | null> => {
    if (!user?.id) {
      console.warn('⚠️ Cannot create draft: No user');
      return null;
    }
    
    try {
      console.log('📝 Creating new draft campaign...');
      
      // Get tenant_id for the user from profiles or company_profiles
      const { data: profileData } = await supabase
        .from('company_profiles')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();
      
      const { data, error } = await supabase
        .from('crm_campaigns')
        .insert({
          name: name || 'Untitled Draft',
          subject_line: '',
          status: 'draft',
          user_id: user.id,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select('id')
        .single();
      
      if (error) {
        logSupabaseError(error, 'createDraftCampaign');
        throw error;
      }
      
      console.log('✅ Draft campaign created:', data.id);
      setDraftCampaignId(data.id);
      return data.id;
    } catch (error) {
      logDevError('runtime', error as Error, {
        functionName: 'createDraftCampaign',
        extra: { name }
      });
      return null;
    }
  }, [user?.id]);
  
  // Save campaign and blocks to database
  const saveToDB = useCallback(async (
    campaignId: string,
    data: { name: string; subject_line: string; preheader: string; blocks: ContentBlock[] }
  ) => {
    if (isSavingRef.current) {
      console.log('🚫 Save already in progress, skipping...');
      return;
    }
    
    // Check if data actually changed
    const dataHash = JSON.stringify({
      name: data.name,
      subject_line: data.subject_line,
      preheader: data.preheader,
      blockCount: data.blocks.length,
      blockIds: data.blocks.map(b => b.id)
    });
    
    if (dataHash === lastSavedDataRef.current) {
      console.log('🚫 No changes detected, skipping save');
      return;
    }
    
    isSavingRef.current = true;
    setIsSaving(true);
    onSaveStart?.();
    
    try {
      console.log('💾 Auto-saving campaign:', campaignId);
      
      // Update campaign metadata
      const { error: campaignError } = await supabase
        .from('crm_campaigns')
        .update({
          name: data.name || 'Untitled Draft',
          subject_line: data.subject_line,
          preheader: data.preheader,
          updated_at: new Date().toISOString()
        })
        .eq('id', campaignId);
      
      if (campaignError) {
        throw new Error(`Campaign update failed: ${campaignError.message}`);
      }
      
      // Save blocks atomically (delete then insert)
      if (data.blocks.length > 0) {
        // Delete existing blocks
        await supabase
          .from('campaign_blocks')
          .delete()
          .eq('campaign_id', campaignId);
        
        // Insert new blocks using normalized format
        const blocksToInsert = data.blocks.map((block, index) => ({
          campaign_id: campaignId,
          ...normalizeBlockForSave(block, index)
        }));
        
        const { error: insertError } = await supabase
          .from('campaign_blocks')
          .insert(blocksToInsert);
        
        if (insertError) {
          throw new Error(`Block insert failed: ${insertError.message}`);
        }
      } else {
        // Delete all blocks if none provided
        await supabase
          .from('campaign_blocks')
          .delete()
          .eq('campaign_id', campaignId);
      }
      
      lastSavedDataRef.current = dataHash;
      setLastSavedAt(new Date());
      setHasUnsavedChanges(false);
      onSaveSuccess?.(campaignId);
      
      console.log('✅ Auto-save completed successfully');
    } catch (error) {
      logDevError('runtime', error as Error, {
        functionName: 'saveToDB',
        extra: { campaignId, blockCount: data.blocks.length }
      });
      onSaveError?.(error as Error);
      throw error;
    } finally {
      isSavingRef.current = false;
      setIsSaving(false);
    }
  }, [onSaveStart, onSaveSuccess, onSaveError]);
  
  // Debounced auto-save function
  const debouncedSave = useCallback(async (
    campaignId: string | null,
    data: { name: string; subject_line: string; preheader: string; blocks: ContentBlock[] }
  ) => {
    // Clear any pending save
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    
    setHasUnsavedChanges(true);
    
    // Set up debounced save
    saveTimeoutRef.current = setTimeout(async () => {
      try {
        let targetCampaignId = campaignId || draftCampaignId;
        
        // Create draft if no campaign exists and we have meaningful content
        if (!targetCampaignId && (data.name || data.blocks.length > 0)) {
          targetCampaignId = await createDraftCampaign(data.name);
        }
        
        if (targetCampaignId) {
          await saveToDB(targetCampaignId, data);
        }
      } catch (error) {
        console.error('❌ Auto-save failed:', error);
      }
    }, debounceMs);
  }, [debounceMs, draftCampaignId, createDraftCampaign, saveToDB]);
  
  // Immediate save (for navigation/beforeunload)
  const immediateSave = useCallback(async (
    campaignId: string | null,
    data: { name: string; subject_line: string; preheader: string; blocks: ContentBlock[] }
  ) => {
    // Clear pending debounced save
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }
    
    try {
      let targetCampaignId = campaignId || draftCampaignId;
      
      // Create draft if no campaign exists
      if (!targetCampaignId && (data.name || data.blocks.length > 0)) {
        targetCampaignId = await createDraftCampaign(data.name);
      }
      
      if (targetCampaignId) {
        await saveToDB(targetCampaignId, data);
        return targetCampaignId;
      }
    } catch (error) {
      console.error('❌ Immediate save failed:', error);
    }
    return null;
  }, [draftCampaignId, createDraftCampaign, saveToDB]);
  
  // Cancel pending saves
  const cancelPendingSave = useCallback(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }
  }, []);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);
  
  return {
    isSaving,
    lastSavedAt,
    hasUnsavedChanges,
    draftCampaignId,
    setDraftCampaignId,
    debouncedSave,
    immediateSave,
    cancelPendingSave,
    createDraftCampaign
  };
}
