
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/utils/toast';

export interface CampaignData {
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

    // Create the campaign
    const { data: campaign, error: campaignError } = await supabase
      .from('crm_campaigns')
      .insert({
        tenant_id: userProfile.tenant_id,
        user_id: user.id,
        name: campaignData.name,
        subject: campaignData.subject,
        sender_name: campaignData.sender_name,
        sender_email: campaignData.sender_email,
        preheader: campaignData.preheader,
        content: campaignData.content, // Save the actual HTML content
        status: 'draft',
        source_content_id: campaignData.source_content_id,
        source_metadata: campaignData.source_metadata || {},
        metrics: {
          sent: 0,
          delivered: 0,
          opened: 0,
          clicked: 0,
          bounced: 0,
          unsubscribed: 0,
          revenue: 0
        }
      })
      .select()
      .single();

    if (campaignError) throw campaignError;

    // Save campaign blocks if content blocks are provided
    if (campaignData.content_blocks && campaignData.content_blocks.length > 0) {
      const blocks = campaignData.content_blocks.map((block, index) => ({
        campaign_id: campaign.id,
        block_type: block.type || 'text',
        content: {
          // Preserve ALL block content properties
          title: block.title || block.headline,
          content: block.content || block.body,
          headline: block.headline,
          body: block.body,
          alignment: block.alignment,
          padding: block.padding,
          margin: block.margin,
          fontFamily: block.fontFamily,
          fontSize: block.fontSize,
          textColor: block.textColor,
          backgroundColor: block.backgroundColor,
          backgroundImageUrl: block.backgroundImageUrl,
          backgroundOpacity: block.backgroundOpacity,
          layout: block.layout,
          caption: block.caption,
          altText: block.altText,
          buttonText: block.buttonText,
          buttonUrl: block.buttonUrl,
          ctaStyle: block.ctaStyle,
          ctaSize: block.ctaSize,
          quote: block.quote,
          author: block.author,
          authorTitle: block.authorTitle,
          visible: block.visible,
          collapsed: block.collapsed
        },
        image_url: block.imageUrl,
        cta_url: block.ctaUrl || block.buttonUrl,
        cta_text: block.ctaText || block.buttonText,
        source: block.source || 'newsletter',
        persona_tag: block.personaTag,
        order_index: index
      }));

      const { error: blocksError } = await supabase
        .from('campaign_blocks')
        .insert(blocks);

      if (blocksError) {
        console.error('Error saving campaign blocks:', blocksError);
        // Don't fail the whole operation for blocks
      }
    }

    // Link segments to campaign using the new campaign_segments table
    if (campaignData.segments.length > 0) {
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

export const sendCampaign = async (campaignData: CampaignData) => {
  try {
    // First save as draft
    const campaign = await saveCampaignAsDraft(campaignData);

    // Update status based on schedule
    let status = 'sent';
    let scheduled_at = null;

    if (campaignData.schedule.type === 'scheduled' && campaignData.schedule.send_at) {
      status = 'scheduled';
      scheduled_at = campaignData.schedule.send_at;
    } else if (campaignData.schedule.type === 'optimal') {
      status = 'scheduled';
      // Set optimal time (e.g., next Tuesday at 10 AM)
      const optimalTime = new Date();
      optimalTime.setDate(optimalTime.getDate() + (2 - optimalTime.getDay() + 7) % 7);
      optimalTime.setHours(10, 0, 0, 0);
      scheduled_at = optimalTime.toISOString();
    }

    // Update campaign status
    const { error: updateError } = await supabase
      .from('crm_campaigns')
      .update({
        status,
        scheduled_at,
        sent_at: status === 'sent' ? new Date().toISOString() : null
      })
      .eq('id', campaign.id);

    if (updateError) throw updateError;

    // Track campaign creation analytics
    await trackCampaignAnalytics(campaign.id, 'created', {
      source: campaignData.source_content_id ? 'newsletter_import' : 'manual',
      segment_count: campaignData.segments.length,
      has_source_content: !!campaignData.source_content_id
    });

    const message = status === 'sent' 
      ? `Campaign "${campaignData.name}" sent successfully!`
      : `Campaign "${campaignData.name}" scheduled successfully!`;
    
    toast.success(message);
    return campaign;

  } catch (error) {
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
