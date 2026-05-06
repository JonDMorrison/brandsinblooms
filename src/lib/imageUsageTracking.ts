import { supabase } from "@/integrations/supabase/client";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function asUuidOrNull(value?: string): string | null {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  return UUID_PATTERN.test(trimmed) ? trimmed : null;
}

interface TrackImageUsageParams {
  globalImageId: string;
  context: "email_block" | "header_block" | "social_post";
  campaignId?: string;
  blockId?: string;
}

/**
 * Track usage of a global image by current tenant
 */
export async function trackImageUsage(
  params: TrackImageUsageParams,
): Promise<void> {
  try {
    const globalImageId = asUuidOrNull(params.globalImageId);
    if (!globalImageId) {
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return;
    }

    // Get user's tenant
    const { data: userData } = await supabase
      .from("users")
      .select("tenant_id")
      .eq("id", user.id)
      .single();

    if (!userData?.tenant_id) {
      return;
    }

    // Track usage
    const { error } = await supabase.rpc("track_global_image_usage", {
      p_image_id: globalImageId,
      p_tenant_id: userData.tenant_id,
      p_user_id: user.id,
      p_context: params.context,
      p_campaign_id: asUuidOrNull(params.campaignId),
      p_block_id: asUuidOrNull(params.blockId),
    });

    if (error) {
      console.error("❌ Failed to track image usage:", error);
    }
  } catch (error) {
    console.error("❌ Error tracking image usage:", error);
  }
}
