import { supabase } from "@/integrations/supabase/client";

interface TrackImageUsageParams {
  globalImageId: string;
  context: 'email_block' | 'header_block' | 'social_post';
  campaignId?: string;
  blockId?: string;
}

/**
 * Track usage of a global image by current tenant
 */
export async function trackImageUsage(params: TrackImageUsageParams): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      console.warn('⚠️ No user found, skipping image usage tracking');
      return;
    }

    // Get user's tenant
    const { data: userData } = await supabase
      .from('users')
      .select('tenant_id')
      .eq('id', user.id)
      .single();

    if (!userData?.tenant_id) {
      console.warn('⚠️ No tenant found, skipping image usage tracking');
      return;
    }

    // Track usage
    const { error } = await supabase.rpc('track_global_image_usage', {
      p_image_id: params.globalImageId,
      p_tenant_id: userData.tenant_id,
      p_user_id: user.id,
      p_context: params.context,
      p_campaign_id: params.campaignId || null,
      p_block_id: params.blockId || null
    });

    if (error) {
      console.error('❌ Failed to track image usage:', error);
    } else {
      console.log('✅ Image usage tracked:', params.globalImageId);
    }
  } catch (error) {
    console.error('❌ Error tracking image usage:', error);
  }
}
