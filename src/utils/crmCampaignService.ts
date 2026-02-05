import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/utils/toast';
import { normalizeBlockForSave, convertEmailBlockToContentBlock } from '@/utils/blockFieldMapping';
import { ContentBlock } from '@/types/emailBuilder';

export interface CampaignData {
  id?: string; // Optional - if provided, will UPDATE instead of INSERT
  name: string;
  subject: string;
  sender_name: string;
  sender_email: string;
  content: string;
  preheader?: string;
  segments: Array<{
    id: string;
    name: string;
    customer_count: number;
  }>;
  schedule: {
    type: 'immediate' | 'scheduled' | 'optimal';
    send_at?: string;
  };
  source_content_id?: string;
  source_metadata?: any;
  content_blocks?: any[];
  // Enhanced for newsletter sync
  newsletter_sync?: {
    source_task_id?: string;
    sync_status?: 'synced' | 'modified' | 'out-of-sync';
    theme?: string;
    reading_time?: string;
    persona_tags?: string[];
    original_blocks_count?: number;
  };
}

export interface CampaignBlock {
  block_type: 'header' | 'text' | 'image' | 'button' | 'divider';
  content: Record<string, any>;
  image_url?: string;
  cta_url?: string;
  cta_text?: string;
  source?: string;
  persona_tag?: string;
  order_index: number;
}

export const saveCampaignAsDraft = async (campaignData: CampaignData) => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    // Get user's tenant
    const { data: userProfile } = await supabase
      .from('users')
      .select('tenant_id')
      .eq('id', user.id)
      .single();

    if (!userProfile?.tenant_id) {
      throw new Error('User tenant not found');
    }

    const campaignPayload = {
      tenant_id: userProfile.tenant_id,
      user_id: user.id,
      name: campaignData.name,
      subject_line: campaignData.subject,
      sender_name: campaignData.sender_name,
      sender_email: campaignData.sender_email,
      preheader: campaignData.preheader,
      content: campaignData.content,
      status: 'draft',
      source_content_task_id: campaignData.source_content_id,
      metrics: {
        sent: 0,
        delivered: 0,
        opened: 0,
        clicked: 0,
        bounced: 0,
        unsubscribed: 0,
        revenue: 0
      }
    };

    let campaign: any;
    let campaignError: any;

    // If campaign ID provided, UPDATE existing campaign instead of creating duplicate
    if (campaignData.id) {
      console.log('📝 Updating existing campaign:', campaignData.id);
      const { data, error } = await supabase
        .from('crm_campaigns')
        .update({
          name: campaignData.name,
          subject_line: campaignData.subject,
          sender_name: campaignData.sender_name,
          sender_email: campaignData.sender_email,
          preheader: campaignData.preheader,
          content: campaignData.content,
          status: 'draft', // Reset to draft on re-save
          updated_at: new Date().toISOString()
        })
        .eq('id', campaignData.id)
        .eq('user_id', user.id) // Security: ensure user owns campaign
        .select()
        .single();

      campaign = data;
      campaignError = error;
    } else {
      // Create NEW campaign
      console.log('📝 Creating new campaign');
      const { data, error } = await supabase
        .from('crm_campaigns')
        .insert(campaignPayload)
        .select()
        .single();

      campaign = data;
      campaignError = error;
    }

    if (campaignError) throw campaignError;

    // Create bidirectional link between content task and CRM campaign
    if (campaignData.source_content_id) {
      try {
        const { error: linkError } = await supabase
          .from('content_tasks')
          .update({ linked_crm_campaign_id: campaign.id })
          .eq('id', campaignData.source_content_id);

        if (linkError) {
          console.warn('Failed to create bidirectional link:', linkError);
          // Don't fail the whole operation for this
        }
      } catch (linkError) {
        console.warn('Error creating bidirectional link:', linkError);
      }
    }

    // Save campaign blocks if content blocks are provided
    if (campaignData.content_blocks && campaignData.content_blocks.length > 0) {
      // If updating an existing campaign, delete old blocks first
      if (campaignData.id) {
        console.log('🗑️ Deleting old blocks for campaign update:', campaign.id);
        await supabase
          .from('campaign_blocks')
          .delete()
          .eq('campaign_id', campaign.id);
      }

      // CRITICAL FIX: Use canonical normalizeBlockForSave for consistent field mapping
      // This prevents content erasure by ensuring all block fields are properly mapped
      const blocks = campaignData.content_blocks.map((block, index) => {
        // Convert to ContentBlock format if needed (handles EmailBlock or raw objects)
        const contentBlock: ContentBlock = block.type ? block : {
          id: block.id || `block-${index}`,
          type: block.block_type || block.type || 'text',
          headline: block.headline || block.title || (block.content?.headline) || (block.content?.title) || '',
          body: block.body || block.content?.body || block.content?.content || (typeof block.content === 'string' ? block.content : ''),
          title: block.title || block.headline || (block.content?.title) || (block.content?.headline) || '',
          content: block.body || block.content?.body || block.content?.content || (typeof block.content === 'string' ? block.content : ''),
          imageUrl: block.imageUrl || block.image_url || block.content?.imageUrl,
          backgroundImageUrl: block.backgroundImageUrl || block.content?.backgroundImageUrl,
          ctaText: block.ctaText || block.cta_text || block.buttonText || block.content?.ctaText || block.content?.buttonText || '',
          ctaUrl: block.ctaUrl || block.cta_url || block.buttonUrl || block.content?.ctaUrl || block.content?.buttonUrl || '',
          buttonText: block.buttonText || block.ctaText || block.content?.buttonText || '',
          buttonUrl: block.buttonUrl || block.ctaUrl || block.content?.buttonUrl || '',
          altText: block.altText || block.content?.altText || '',
          caption: block.caption || block.content?.caption || '',
          layout: block.layout || block.content?.layout,
          alignment: block.alignment || block.content?.alignment,
          textAlign: block.textAlign || block.content?.textAlign,
          padding: block.padding || block.content?.padding,
          margin: block.margin || block.content?.margin,
          fontFamily: block.fontFamily || block.content?.fontFamily,
          fontSize: block.fontSize || block.content?.fontSize,
          textColor: block.textColor || block.content?.textColor,
          backgroundColor: block.backgroundColor || block.content?.backgroundColor,
          backgroundOpacity: block.backgroundOpacity || block.content?.backgroundOpacity,
          overlayOpacity: block.overlayOpacity || block.content?.overlayOpacity,
          overlayColor: block.overlayColor || block.content?.overlayColor,
          darkOverlayOpacity: block.darkOverlayOpacity || block.content?.darkOverlayOpacity,
          ctaStyle: block.ctaStyle || block.content?.ctaStyle,
          ctaSize: block.ctaSize || block.content?.ctaSize,
          quote: block.quote || block.content?.quote,
          author: block.author || block.content?.author,
          authorTitle: block.authorTitle || block.content?.authorTitle,
          visible: block.visible ?? block.content?.visible ?? true,
          collapsed: block.collapsed ?? block.content?.collapsed ?? false,
          source: block.source || 'newsletter',
          personaTag: block.personaTag || block.persona_tag,
          // Lifecycle flags
          status: block.status || block.content?.status,
          hasGeneratedContent: block.hasGeneratedContent || block.content?.hasGeneratedContent,
          userEdited: block.userEdited || block.content?.userEdited,
          autoImageMode: block.autoImageMode || block.content?.autoImageMode,
          shouldFetchImage: block.shouldFetchImage || block.content?.shouldFetchImage,
          isGeneratingImage: block.isGeneratingImage || block.content?.isGeneratingImage,
          // Gallery fields
          galleryImages: block.galleryImages || block.content?.galleryImages || [],
        };

        // Use canonical normalizer for consistent field mapping
        const normalizedBlock = normalizeBlockForSave(contentBlock, block.order_index ?? index);

        return {
          campaign_id: campaign.id,
          ...normalizedBlock
        };
      });

      const { error: blocksError } = await supabase
        .from('campaign_blocks')
        .insert(blocks);

      if (blocksError) {
        console.error('Error saving campaign blocks:', blocksError);
        // Don't fail the whole operation for blocks
      }
    }

    // Handle segment linking
    // If updating, clear old segment links first
    if (campaignData.id) {
      await supabase
        .from('campaign_segments')
        .delete()
        .eq('campaign_id', campaign.id);

      // Also clear single segment_id
      await supabase
        .from('crm_campaigns')
        .update({ segment_id: null })
        .eq('id', campaign.id);
    }

    // Handle segment linking - single segment vs multiple segments
    if (campaignData.segments.length === 1) {
      // Single segment - store directly on campaign
      const { error: updateError } = await supabase
        .from('crm_campaigns')
        .update({ segment_id: campaignData.segments[0].id })
        .eq('id', campaign.id);

      if (updateError) {
        console.error('Error setting single segment:', updateError);
      }
    } else if (campaignData.segments.length > 1) {
      // Multiple segments - use campaign_segments table
      const segmentLinks = campaignData.segments.map(segment => ({
        campaign_id: campaign.id,
        segment_id: segment.id
      }));

      const { error: segmentError } = await supabase
        .from('campaign_segments')
        .insert(segmentLinks);

      if (segmentError) {
        console.error('Error linking segments:', segmentError);
      }
    }

    toast.success(`Campaign "${campaignData.name}" saved as draft`);
    return campaign;

  } catch (error) {
    console.error('Error saving campaign:', error);
    toast.error(`Failed to save campaign: ${error.message}`);
    throw error;
  }
};

/**
 * Atomically claims a campaign for sending to prevent double-sends.
 * Uses a Postgres RPC with FOR UPDATE to ensure only one caller can claim.
 */
export const claimCampaignForSend = async (campaignId: string): Promise<{
  success: boolean;
  previousStatus?: string;
  errorMessage?: string;
}> => {
  try {
    const { data, error } = await supabase.rpc('claim_campaign_for_send', {
      campaign_id: campaignId
    });

    if (error) {
      console.error('RPC claim error:', error);
      return { success: false, errorMessage: error.message };
    }

    if (!data || data.length === 0) {
      return { success: false, errorMessage: 'No response from claim function' };
    }

    const result = data[0];
    return {
      success: result.success,
      previousStatus: result.previous_status,
      errorMessage: result.error_message
    };
  } catch (err: any) {
    console.error('Claim campaign error:', err);
    return { success: false, errorMessage: err.message };
  }
};

export const sendCampaign = async (campaignData: CampaignData) => {
  try {
    // First save as draft
    const campaign = await saveCampaignAsDraft(campaignData);

    // For immediate sends, use atomic claim then send
    if (campaignData.schedule.type === 'immediate') {
      console.log('🚀 Claiming campaign for immediate send:', campaign.id);

      // Step 1: Atomically claim the campaign (prevents double-sends)
      const claimResult = await claimCampaignForSend(campaign.id);

      if (!claimResult.success) {
        const errorMsg = claimResult.errorMessage || 'Failed to claim campaign';
        console.error('❌ Claim failed:', errorMsg);
        throw new Error(errorMsg);
      }

      console.log('✅ Campaign claimed, previous status:', claimResult.previousStatus);

      // Step 2: Send via edge function
      console.log('📧 Invoking send-email-campaign...');
      const { data: sendResult, error: sendError } = await supabase.functions.invoke('send-email-campaign', {
        body: { campaignId: campaign.id }
      });

      if (sendError) {
        console.error('Edge function send error:', sendError);
        // Mark as failed since we already claimed it
        await supabase
          .from('crm_campaigns')
          .update({
            status: 'failed',
            send_error: sendError.message
          })
          .eq('id', campaign.id);
        throw new Error(sendError.message || 'Failed to send campaign via email service');
      }

      if (sendResult?.error) {
        console.error('Send result error:', sendResult.error);
        await supabase
          .from('crm_campaigns')
          .update({
            status: 'failed',
            send_error: sendResult.error
          })
          .eq('id', campaign.id);
        throw new Error(sendResult.error);
      }

      console.log('✅ Campaign sent successfully via edge function:', sendResult);
      toast.success(`Campaign "${campaignData.name}" sent to ${sendResult?.metrics?.sent || 0} customers!`);
      return campaign;
    }

    // For scheduled campaigns, just update the status
    let status = 'scheduled';
    let scheduled_at = null;

    if (campaignData.schedule.type === 'scheduled' && campaignData.schedule.send_at) {
      scheduled_at = campaignData.schedule.send_at;
    } else if (campaignData.schedule.type === 'optimal') {
      // Set optimal time (e.g., next Tuesday at 10 AM)
      const optimalTime = new Date();
      optimalTime.setDate(optimalTime.getDate() + (2 - optimalTime.getDay() + 7) % 7);
      optimalTime.setHours(10, 0, 0, 0);
      scheduled_at = optimalTime.toISOString();
    }

    // Update campaign status for scheduled sends
    const { error: updateError } = await supabase
      .from('crm_campaigns')
      .update({
        status,
        scheduled_at
      })
      .eq('id', campaign.id);

    if (updateError) throw updateError;

    // Track campaign creation analytics
    await trackCampaignAnalytics(campaign.id, 'created', {
      source: campaignData.source_content_id ? 'newsletter_import' : 'manual',
      segment_count: campaignData.segments.length,
      has_source_content: !!campaignData.source_content_id
    });

    toast.success(`Campaign "${campaignData.name}" scheduled successfully!`);
    return campaign;

  } catch (error: any) {
    console.error('Error sending campaign:', error);
    toast.error(`Failed to send campaign: ${error.message}`);
    throw error;
  }
};

const trackCampaignAnalytics = async (campaignId: string, action: string, metadata: any) => {
  try {
    await supabase.functions.invoke('track-campaign-analytics', {
      body: {
        campaign_id: campaignId,
        action,
        metadata,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Failed to track analytics:', error);
    // Don't fail the main operation for analytics
  }
};

export const regenerateCampaignContent = async (
  campaignId: string,
  originalContent: string,
  options: {
    tone?: 'professional' | 'friendly' | 'urgent' | 'casual';
    focus?: 'seasonal' | 'promotional' | 'educational' | 'community';
    personaTag?: string;
  } = {}
) => {
  try {
    const { data, error } = await supabase.functions.invoke('regenerate-crm-content', {
      body: {
        campaign_id: campaignId,
        original_content: originalContent,
        regeneration_options: options,
        timestamp: new Date().toISOString()
      }
    });

    if (error) throw error;

    toast.success('Content regenerated successfully');
    return data.regenerated_content;

  } catch (error) {
    console.error('Error regenerating content:', error);
    toast.error('Failed to regenerate content');
    throw error;
  }
};

// =====================================================
// SCHEDULED CAMPAIGN MANAGEMENT FUNCTIONS
// =====================================================

/**
 * Update a campaign's scheduled time
 */
export const updateCampaignSchedule = async (
  campaignId: string,
  scheduledAt: string,
  timezone?: string,
  options?: { silent?: boolean; onFailureMessage?: (message: string) => void }
): Promise<boolean> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const mapScheduleFailureToUserMessage = (reason?: string | null) => {
      const r = String(reason || '').toLowerCase();
      if (!r) return "We couldn't save your schedule. Please try again.";
      if (r.includes('not authenticated')) return 'Please sign in again to schedule this campaign.';
      if (r.includes('not allowed')) return "You don't have access to schedule this campaign.";
      if (r.includes('campaign not found')) return 'Campaign not found. Please refresh and try again.';
      if (r.includes('locked')) return 'This campaign is locked (already sending or sent).';
      return "We couldn't save your schedule. Please try again.";
    };

    const isTerminalRpcFailure = (reason?: string | null) => {
      const r = String(reason || '').toLowerCase();
      return r.includes('not authenticated') || r.includes('locked');
    };

    // Preferred path: server-side SECURITY DEFINER RPC.
    // This avoids client-side RLS drift causing silent 0-row updates.
    try {
      const { data, error } = await supabase.rpc(
        'set_campaign_schedule' as any,
        {
          p_campaign_id: campaignId,
          p_scheduled_at: scheduledAt,
          p_timezone: timezone ?? null,
        } as any,
      );

      if (!error) {
        const row = Array.isArray(data) ? data[0] : data;
        if (row?.success === true) {
          if (!options?.silent) toast.success('Schedule updated successfully');
          return true;
        }

        const userMessage = mapScheduleFailureToUserMessage(row?.error_message);
        console.warn('set_campaign_schedule returned failure', {
          campaignId,
          error_message: row?.error_message,
          row,
        });

        // Allow callers to present a friendly message even when we suppress service toasts.
        options?.onFailureMessage?.(userMessage);

        // If the RPC failure is terminal (auth/locked), stop here.
        // Otherwise, fall back to direct table update to preserve compatibility with older RLS policies.
        if (isTerminalRpcFailure(row?.error_message)) {
          if (!options?.silent) toast.error(userMessage);
          return false;
        }
      }

      // If RPC doesn't exist/visible yet, fall back.
      const msg = String((error as any)?.message || '');
      const looksLikeMissingRpc =
        msg.toLowerCase().includes('could not find the function') ||
        msg.toLowerCase().includes('schema cache');

      if (!looksLikeMissingRpc) {
        console.warn('set_campaign_schedule RPC error (will fall back)', {
          campaignId,
          error,
        });
      }
    } catch (e) {
      console.warn('set_campaign_schedule RPC threw (will fall back)', {
        campaignId,
        error: e,
      });
    }

    // Best-effort status check. In some environments, SELECT can be blocked by RLS
    // even when UPDATE is permitted (e.g. owner-only UPDATE fallback). We should
    // not fail early in that case.
    try {
      const { data: campaign, error: fetchError } = await supabase
        .from('crm_campaigns')
        .select('status')
        .eq('id', campaignId)
        .maybeSingle();

      if (fetchError) throw fetchError;

      if (campaign?.status === 'sending') {
        if (!options?.silent) {
          toast.error('Cannot reschedule a campaign that is currently sending');
        }
        return false;
      }

      if (campaign?.status === 'sent') {
        if (!options?.silent) {
          toast.error('Cannot reschedule a campaign that has already been sent');
        }
        return false;
      }
    } catch (e) {
      console.warn('updateCampaignSchedule: status preflight skipped (possible RLS SELECT denial)', {
        campaignId,
        error: e,
      });
    }

    const baseUpdate = {
      scheduled_at: scheduledAt,
      status: 'scheduled',
      // Reset any previous send attempt state so the scheduler can try again
      send_started_at: null,
      send_error: null,
      updated_at: new Date().toISOString(),
      metadata: timezone ? { scheduled_timezone: timezone } : undefined,
    };

    // Absolute-minimum update payload that should work even if newer columns
    // (like metadata/send_error) haven't been deployed yet.
    const minimalUpdate = {
      scheduled_at: scheduledAt,
      status: 'scheduled',
      updated_at: new Date().toISOString(),
    };

    // Some production environments may include legacy claim columns used by old scheduler logic.
    // Other environments won't have them; if we include unknown columns PostgREST will error.
    const extendedUpdate = {
      ...baseUpdate,
      claim_token: null,
      sending_started_at: null,
      send_attempts: 0,
      failure_reason: null,
    } as any;

    const attemptUpdate = async (payload: Record<string, any>) => {
      return await supabase
        .from('crm_campaigns')
        .update(payload)
        .eq('id', campaignId)
        // Also guard at the DB update level to prevent rescheduling while sending/sent
        // even if we couldn't read status due to RLS.
        .neq('status', 'sending')
        .neq('status', 'sent')
        .select('id')
        .maybeSingle();
    };

    const attempts: Array<{ label: string; payload: Record<string, any> }> = [
      { label: 'extended', payload: extendedUpdate },
      { label: 'base', payload: baseUpdate },
      { label: 'minimal', payload: minimalUpdate },
    ];

    let lastError: any = null;
    for (const attempt of attempts) {
      const { data, error } = await attemptUpdate(attempt.payload);
      if (!error) {
        if (data?.id) {
          lastError = null;
          break;
        }

        // No error but no updated row usually means RLS prevented the update.
        console.warn('Schedule update returned no row (possible RLS denial)', {
          campaignId,
          attempt: attempt.label,
        });
        return false;
      }

      lastError = error;
      const msg = String((error as any)?.message || '');
      const looksLikeMissingColumn =
        msg.toLowerCase().includes('does not exist') &&
        msg.toLowerCase().includes('column');

      if (looksLikeMissingColumn) {
        console.warn('Schedule update: missing column; retrying with fallback payload', {
          campaignId,
          attempt: attempt.label,
          message: msg,
        });
        continue;
      }

      throw error;
    }

    if (lastError) throw lastError;

    if (!options?.silent) toast.success('Schedule updated successfully');
    return true;
  } catch (error: any) {
    console.error('Error updating campaign schedule:', error);
    if (!options?.silent) {
      // Avoid surfacing internal PostgREST/schema-cache/RLS messages to end users.
      const msg = String(error?.message || '').toLowerCase();
      if (msg.includes('jwt') || msg.includes('auth') || msg.includes('permission')) {
        toast.error('Please sign in again to update the schedule.');
      } else {
        toast.error("We couldn't save your schedule. Please try again.");
      }
    }

    // Also inform silent callers with a user-friendly message.
    if (options?.onFailureMessage) {
      const msg = String(error?.message || '').toLowerCase();
      if (msg.includes('jwt') || msg.includes('auth')) {
        options.onFailureMessage('Please sign in again to schedule this campaign.');
      } else if (msg.includes('sending') || msg.includes('sent') || msg.includes('locked')) {
        options.onFailureMessage('This campaign is locked (already sending or sent).');
      } else {
        options.onFailureMessage("We couldn't save your schedule. Please try again.");
      }
    }
    return false;
  }
};

/**
 * Unschedule a campaign - revert to draft status
 */
export const unscheduleCampaign = async (
  campaignId: string,
  options?: { silent?: boolean; onFailureMessage?: (message: string) => void }
): Promise<boolean> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const mapUnscheduleFailureToUserMessage = (reason?: string | null) => {
      const r = String(reason || '').toLowerCase();
      if (!r) return "We couldn't remove the schedule. Please try again.";
      if (r.includes('not authenticated')) return 'Please sign in again to update this campaign.';
      if (r.includes('not allowed')) return "You don't have access to update this campaign.";
      if (r.includes('campaign not found')) return 'Campaign not found. Please refresh and try again.';
      if (r.includes('locked')) return 'This campaign is locked (already sending or sent).';
      return "We couldn't remove the schedule. Please try again.";
    };

    const isTerminalRpcFailure = (reason?: string | null) => {
      const r = String(reason || '').toLowerCase();
      return r.includes('not authenticated') || r.includes('locked');
    };

    // Preferred path: server-side SECURITY DEFINER RPC.
    try {
      const { data, error } = await supabase.rpc(
        'clear_campaign_schedule' as any,
        { p_campaign_id: campaignId } as any,
      );

      if (!error) {
        const row = Array.isArray(data) ? data[0] : data;
        if (row?.success === true) {
          if (!options?.silent) toast.success('Campaign unscheduled - returned to draft');
          return true;
        }

        const userMessage = mapUnscheduleFailureToUserMessage(row?.error_message);
        console.warn('clear_campaign_schedule returned failure', {
          campaignId,
          error_message: row?.error_message,
          row,
        });

        options?.onFailureMessage?.(userMessage);

        if (isTerminalRpcFailure(row?.error_message)) {
          if (!options?.silent) toast.error(userMessage);
          return false;
        }
      }

      const msg = String((error as any)?.message || '');
      const looksLikeMissingRpc =
        msg.toLowerCase().includes('could not find the function') ||
        msg.toLowerCase().includes('schema cache');
      if (!looksLikeMissingRpc) {
        console.warn('clear_campaign_schedule RPC error (will fall back)', {
          campaignId,
          error,
        });
      }
    } catch (e) {
      console.warn('clear_campaign_schedule RPC threw (will fall back)', {
        campaignId,
        error: e,
      });
    }

    // Best-effort status check. Don't fail early if SELECT is blocked by RLS.
    try {
      const { data: campaign, error: fetchError } = await supabase
        .from('crm_campaigns')
        .select('status')
        .eq('id', campaignId)
        .maybeSingle();

      if (fetchError) throw fetchError;

      if (campaign?.status === 'sending') {
        if (!options?.silent) {
          toast.error('Cannot unschedule a campaign that is currently sending');
        }
        return false;
      }

      if (campaign?.status === 'sent') {
        if (!options?.silent) {
          toast.error('Cannot unschedule a campaign that has already been sent');
        }
        return false;
      }
    } catch (e) {
      console.warn('unscheduleCampaign: status preflight skipped (possible RLS SELECT denial)', {
        campaignId,
        error: e,
      });
    }

    const baseUpdate = {
      scheduled_at: null,
      status: 'draft',
      send_started_at: null,
      send_error: null,
      updated_at: new Date().toISOString(),
    };

    const minimalUpdate = {
      scheduled_at: null,
      status: 'draft',
      updated_at: new Date().toISOString(),
    };

    const extendedUpdate = {
      ...baseUpdate,
      claim_token: null,
      sending_started_at: null,
      send_attempts: 0,
      failure_reason: null,
    } as any;

    const attemptUpdate = async (payload: Record<string, any>) => {
      return await supabase
        .from('crm_campaigns')
        .update(payload)
        .eq('id', campaignId)
        .neq('status', 'sending')
        .neq('status', 'sent')
        .select('id')
        .maybeSingle();
    };

    const attempts: Array<{ label: string; payload: Record<string, any> }> = [
      { label: 'extended', payload: extendedUpdate },
      { label: 'base', payload: baseUpdate },
      { label: 'minimal', payload: minimalUpdate },
    ];

    let lastError: any = null;
    for (const attempt of attempts) {
      const { data, error } = await attemptUpdate(attempt.payload);
      if (!error) {
        if (data?.id) {
          lastError = null;
          break;
        }

        console.warn('Unschedule returned no row (possible RLS denial)', {
          campaignId,
          attempt: attempt.label,
        });
        return false;
      }

      lastError = error;
      const msg = String((error as any)?.message || '');
      const looksLikeMissingColumn =
        msg.toLowerCase().includes('does not exist') &&
        msg.toLowerCase().includes('column');

      if (looksLikeMissingColumn) {
        console.warn('Unschedule: missing column; retrying with fallback payload', {
          campaignId,
          attempt: attempt.label,
          message: msg,
        });
        continue;
      }

      throw error;
    }

    if (lastError) throw lastError;

    if (!options?.silent) toast.success('Campaign unscheduled - returned to draft');
    return true;
  } catch (error: any) {
    console.error('Error unscheduling campaign:', error);
    if (!options?.silent) {
      const msg = String(error?.message || '').toLowerCase();
      if (msg.includes('jwt') || msg.includes('auth') || msg.includes('permission')) {
        toast.error('Please sign in again to update this campaign.');
      } else {
        toast.error("We couldn't remove the schedule. Please try again.");
      }
    }

    if (options?.onFailureMessage) {
      const msg = String(error?.message || '').toLowerCase();
      if (msg.includes('jwt') || msg.includes('auth')) {
        options.onFailureMessage('Please sign in again to update this campaign.');
      } else if (msg.includes('sending') || msg.includes('sent') || msg.includes('locked')) {
        options.onFailureMessage('This campaign is locked (already sending or sent).');
      } else {
        options.onFailureMessage("We couldn't remove the schedule. Please try again.");
      }
    }
    return false;
  }
};

/**
 * Send a scheduled campaign immediately
 * Uses atomic claim to prevent double-sends
 */
export const sendScheduledCampaignNow = async (campaignId: string): Promise<{
  success: boolean;
  error?: string;
}> => {
  try {
    console.log('🚀 Attempting to send scheduled campaign now:', campaignId);

    // Step 1: Atomically claim the campaign
    const claimResult = await claimCampaignForSend(campaignId);

    if (!claimResult.success) {
      const errorMsg = claimResult.errorMessage || 'Failed to claim campaign';
      console.error('❌ Claim failed:', errorMsg);
      toast.error(errorMsg);
      return { success: false, error: errorMsg };
    }

    console.log('✅ Campaign claimed, previous status:', claimResult.previousStatus);

    // Step 2: Clear scheduled_at since we're sending now
    await supabase
      .from('crm_campaigns')
      .update({ scheduled_at: null })
      .eq('id', campaignId);

    // Step 3: Send via edge function
    console.log('📧 Invoking send-email-campaign...');
    const { data: sendResult, error: sendError } = await supabase.functions.invoke('send-email-campaign', {
      body: { campaignId }
    });

    if (sendError) {
      console.error('Edge function send error:', sendError);
      await supabase
        .from('crm_campaigns')
        .update({
          status: 'failed',
          send_error: sendError.message
        })
        .eq('id', campaignId);
      toast.error(`Send failed: ${sendError.message}`);
      return { success: false, error: sendError.message };
    }

    if (sendResult?.error) {
      console.error('Send result error:', sendResult.error);
      await supabase
        .from('crm_campaigns')
        .update({
          status: 'failed',
          send_error: sendResult.error
        })
        .eq('id', campaignId);
      toast.error(`Send failed: ${sendResult.error}`);
      return { success: false, error: sendResult.error };
    }

    const sentCount = sendResult?.metrics?.sent || 0;
    console.log('✅ Campaign sent successfully:', sendResult);
    toast.success(`Campaign sent to ${sentCount} customers!`);

    return { success: true };
  } catch (error: any) {
    console.error('Error sending campaign now:', error);
    toast.error(`Failed to send: ${error.message}`);
    return { success: false, error: error.message };
  }
};

/**
 * Get campaign status info for display
 */
export const getCampaignStatusInfo = (
  status: string,
  scheduledAt?: string | null,
  sendError?: string | null
): {
  label: string;
  variant: 'default' | 'secondary' | 'destructive' | 'outline';
  isPastDue: boolean;
  isLocked: boolean;
} => {
  const isPastDue = status === 'scheduled' && scheduledAt && new Date(scheduledAt) < new Date();
  const isLocked = ['scheduled', 'sending', 'sent'].includes(status);

  switch (status) {
    case 'draft':
      return { label: 'Draft', variant: 'secondary', isPastDue: false, isLocked: false };
    case 'scheduled':
      return { label: 'Scheduled', variant: 'default', isPastDue, isLocked: true };
    case 'sending':
      return { label: 'Sending', variant: 'default', isPastDue: false, isLocked: true };
    case 'sent':
      return { label: 'Sent', variant: 'outline', isPastDue: false, isLocked: true };
    case 'failed':
      return { label: 'Failed', variant: 'destructive', isPastDue: false, isLocked: false };
    default:
      return { label: status, variant: 'secondary', isPastDue: false, isLocked: false };
  }
};
