import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface ContentBlock {
  id: string;
  campaign_id: string;
  type: string;
  payload_json: any;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export const useContentBlocks = (campaignId?: string) => {
  const [blocks, setBlocks] = useState<ContentBlock[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const fetchBlocks = async () => {
    if (!campaignId) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('content_blocks')
        .select('*')
        .eq('campaign_id', campaignId)
        .eq('is_active', true)
        .order('sort_order');

      if (error) throw error;
      setBlocks(data || []);
    } catch (error) {
      console.error('Error fetching content blocks:', error);
      toast({
        title: "Error",
        description: "Failed to load content blocks.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const saveBlocks = async (newBlocks: Omit<ContentBlock, 'id' | 'created_at' | 'updated_at'>[]) => {
    if (!campaignId) return;

    setSaving(true);
    try {
      // First, mark all existing blocks as inactive
      await supabase
        .from('content_blocks')
        .update({ is_active: false })
        .eq('campaign_id', campaignId);

      // Then insert/update the new blocks
      const blocksToSave = newBlocks.map((block, index) => ({
        ...block,
        campaign_id: campaignId,
        sort_order: index,
        is_active: true
      }));

      const { error } = await supabase
        .from('content_blocks')
        .upsert(blocksToSave, {
          onConflict: 'id',
          ignoreDuplicates: false
        });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Content blocks saved successfully."
      });

      // Refresh the blocks
      await fetchBlocks();
    } catch (error) {
      console.error('Error saving content blocks:', error);
      toast({
        title: "Error",
        description: "Failed to save content blocks.",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  const deleteBlock = async (blockId: string) => {
    try {
      const { error } = await supabase
        .from('content_blocks')
        .update({ is_active: false })
        .eq('id', blockId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Content block deleted."
      });

      await fetchBlocks();
    } catch (error) {
      console.error('Error deleting content block:', error);
      toast({
        title: "Error",
        description: "Failed to delete content block.",
        variant: "destructive"
      });
    }
  };

  useEffect(() => {
    fetchBlocks();
  }, [campaignId]);

  return {
    blocks,
    loading,
    saving,
    fetchBlocks,
    saveBlocks,
    deleteBlock
  };
};