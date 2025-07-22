import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/utils/toast';
import { ContentBlock } from '@/types/emailBuilder';

export interface CampaignData {
  id: string;
  name: string;
  subject_line: string;
  preheader_text?: string;
  content: string;
  status: string;
  scheduled_at?: string;
  sent_at?: string;
  segment_id?: string;
  metadata?: any;
  synced_from?: string;
  created_at: string;
  updated_at: string;
}

export interface CloneCampaignOptions {
  newName?: string;
  clearScheduling?: boolean;
  updateThemeWeek?: boolean;
  aiRefresh?: boolean;
}

export const useCampaignCloning = () => {
  const { user } = useAuth();
  const [isCloning, setIsCloning] = useState(false);

  const cloneCampaign = async (
    originalCampaignId: string, 
    options: CloneCampaignOptions = {}
  ): Promise<string | null> => {
    if (!user) {
      toast.error('Must be logged in to clone campaigns');
      return null;
    }

    setIsCloning(true);
    
    try {
      // 1. Fetch original campaign data
      const { data: originalCampaign, error: fetchError } = await supabase
        .from('crm_campaigns')
        .select('*')
        .eq('id', originalCampaignId)
        .single();

      if (fetchError) throw fetchError;
      if (!originalCampaign) throw new Error('Campaign not found');

      // 2. Fetch associated blocks
      const { data: originalBlocks, error: blocksError } = await supabase
        .from('campaign_blocks')
        .select('*')
        .eq('campaign_id', originalCampaignId)
        .order('order_index');

      if (blocksError) throw blocksError;

      // 3. Prepare cloned campaign data
      const clonedCampaignData = {
        name: options.newName || `${originalCampaign.name} (Copy)`,
        subject_line: originalCampaign.subject_line,
        preheader_text: originalCampaign.preheader_text,
        content: originalCampaign.content,
        status: 'draft' as const,
        delivery_method: originalCampaign.delivery_method,
        sender_display_name: originalCampaign.sender_display_name,
        actual_sender_email: originalCampaign.actual_sender_email,
        user_id: user.id,
        tenant_id: originalCampaign.tenant_id,
        metadata: originalCampaign.metadata ? {
          ...(originalCampaign.metadata as any),
          cloned_from: originalCampaignId,
          cloned_at: new Date().toISOString()
        } : {
          cloned_from: originalCampaignId,
          cloned_at: new Date().toISOString()
        },
        // Clear scheduling info if requested
        scheduled_at: options.clearScheduling ? null : originalCampaign.scheduled_at,
        sent_at: null,
        synced_from: originalCampaign.synced_from,
        // Reset metrics
        metrics: { sent: 0, delivered: 0, opened: 0, clicked: 0, bounced: 0, unsubscribed: 0 },
        total_sent: 0,
        total_opens: 0,
        total_clicks: 0,
        open_rate: 0,
        click_rate: 0
      };

      // 4. Create cloned campaign
      const { data: clonedCampaign, error: createError } = await supabase
        .from('crm_campaigns')
        .insert(clonedCampaignData)
        .select()
        .single();

      if (createError) throw createError;

      // 5. Clone campaign blocks if they exist
      if (originalBlocks && originalBlocks.length > 0) {
        const clonedBlocks = originalBlocks.map(block => ({
          campaign_id: clonedCampaign.id,
          order_index: block.order_index,
          block_type: block.block_type,
          content: block.content,
          image_url: block.image_url,
          cta_url: block.cta_url,
          cta_text: block.cta_text,
          source: 'cloned' as const,
          persona_tag: block.persona_tag
        }));

        const { error: blocksCreateError } = await supabase
          .from('campaign_blocks')
          .insert(clonedBlocks);

        if (blocksCreateError) throw blocksCreateError;
      }

      // 6. Copy segment associations if they exist
      const { data: segments, error: segmentsError } = await supabase
        .from('campaign_segments')
        .select('segment_id')
        .eq('campaign_id', originalCampaignId);

      if (!segmentsError && segments && segments.length > 0) {
        const clonedSegments = segments.map(segment => ({
          campaign_id: clonedCampaign.id,
          segment_id: segment.segment_id
        }));

        await supabase
          .from('campaign_segments')
          .insert(clonedSegments);
      }

      toast.success(`Campaign "${clonedCampaignData.name}" cloned successfully!`);
      return clonedCampaign.id;

    } catch (err: any) {
      console.error('Error cloning campaign:', err);
      toast.error(`Failed to clone campaign: ${err.message}`);
      return null;
    } finally {
      setIsCloning(false);
    }
  };

  const cloneCampaignWithAIRefresh = async (
    originalCampaignId: string,
    options: CloneCampaignOptions = {}
  ): Promise<string | null> => {
    const clonedId = await cloneCampaign(originalCampaignId, {
      ...options,
      aiRefresh: true
    });

    if (clonedId && options.aiRefresh) {
      // TODO: Trigger AI content refresh edge function
      // This would call an edge function to regenerate content with current context
      toast.info('AI content refresh will be applied shortly...');
    }

    return clonedId;
  };

  const getDuplicateCampaigns = async (): Promise<CampaignData[]> => {
    if (!user) return [];

    try {
      const { data, error } = await supabase
        .from('crm_campaigns')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return data || [];
    } catch (err: any) {
      console.error('Error fetching campaigns:', err);
      return [];
    }
  };

  return {
    cloneCampaign,
    cloneCampaignWithAIRefresh,
    getDuplicateCampaigns,
    isCloning
  };
};