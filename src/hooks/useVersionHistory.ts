import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface BlockVersion {
  id: string;
  block_id: string;
  campaign_id: string;
  snapshot_json: any;
  created_at: string;
}

export const useVersionHistory = (blockId: string, campaignId: string) => {
  const [versions, setVersions] = useState<BlockVersion[]>([]);
  const [loading, setLoading] = useState(false);

  const loadVersions = async () => {
    if (!blockId) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('campaign_block_versions')
        .select('*')
        .eq('block_id', blockId)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      setVersions(data || []);
    } catch (error) {
      console.error('Error loading versions:', error);
      toast.error('Failed to load version history');
    } finally {
      setLoading(false);
    }
  };

  const restoreVersion = async (versionId: string) => {
    try {
      // Get the version data
      const version = versions.find(v => v.id === versionId);
      if (!version) throw new Error('Version not found');

      // Update the current block with the version data
      const { error } = await supabase
        .from('campaign_blocks')
        .update({
          content: version.snapshot_json.content,
          block_type: version.snapshot_json.block_type,
          updated_at: new Date().toISOString()
        })
        .eq('id', blockId);

      if (error) throw error;

      toast.success('Version restored successfully');
      return version.snapshot_json;
    } catch (error) {
      console.error('Error restoring version:', error);
      toast.error('Failed to restore version');
      throw error;
    }
  };

  const createManualVersion = async (content: any, blockType: string) => {
    try {
      const { error } = await supabase
        .from('campaign_block_versions')
        .insert({
          block_id: blockId,
          campaign_id: campaignId,
          snapshot_json: {
            content,
            block_type: blockType,
            metadata: {
              created_by: 'manual',
              timestamp: new Date().toISOString()
            }
          }
        });

      if (error) throw error;
      
      // Reload versions to include the new one
      await loadVersions();
      toast.success('Manual version saved');
    } catch (error) {
      console.error('Error creating manual version:', error);
      toast.error('Failed to save manual version');
    }
  };

  useEffect(() => {
    if (blockId && campaignId) {
      loadVersions();
    }
  }, [blockId, campaignId]);

  return {
    versions,
    loading,
    loadVersions,
    restoreVersion,
    createManualVersion
  };
};