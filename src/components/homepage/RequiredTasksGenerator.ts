
import { supabase } from "@/integrations/supabase/client";
import { generateCampaignContent } from "./ContentGenerationServices";

interface Campaign {
  id: string;
  title: string;
  theme?: string;
  description?: string;
  week_number?: number;
  tenant_id?: string;
}

export const generateRequiredTasks = async (
  campaignId: string,
  campaigns: Campaign[],
  userId: string,
  onTaskUpdate: () => void,
  tenantId?: string  // 🔧 NEW: Accept tenant_id parameter
) => {
  try {
    console.log('🚀 RequiredTasksGenerator: Starting content generation for campaign:', campaignId, 'with tenant_id:', tenantId);
    
    const campaign = campaigns.find(c => c.id === campaignId);
    if (!campaign) {
      throw new Error('Campaign not found');
    }

    // Get tenant_id from campaign if not provided
    const finalTenantId = tenantId || campaign.tenant_id;
    if (!finalTenantId) {
      console.warn('⚠️ No tenant_id provided - content may not be visible in dashboard');
    }

    // Check if tasks already exist for this campaign
    const { data: existingTasks, error: checkError } = await supabase
      .from('content_tasks')
      .select('id, post_type')
      .eq('campaign_id', campaignId);

    if (checkError) {
      console.error('Error checking existing tasks:', checkError);
      throw checkError;
    }

    if (existingTasks && existingTasks.length > 0) {
      console.log('Tasks already exist for campaign, skipping generation');
      return;
    }

    // Generate campaign content using the enhanced service
    const result = await generateCampaignContent(
      campaignId,
      campaign.theme || campaign.title,
      campaign.description || '',
      userId,
      campaign.week_number,
      finalTenantId  // 🔧 CRITICAL FIX: Pass tenant_id to content generation
    );

    if (!result.success) {
      throw new Error(result.message || 'Failed to generate content');
    }

    console.log('✅ RequiredTasksGenerator: Content generation completed successfully with tenant support');
    
    // Trigger task update callback
    onTaskUpdate();
    
    return result;
  } catch (error) {
    console.error('🚨 RequiredTasksGenerator: Error generating required tasks:', error);
    throw error;
  }
};
