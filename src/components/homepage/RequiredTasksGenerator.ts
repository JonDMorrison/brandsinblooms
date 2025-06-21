
import { supabase } from "@/integrations/supabase/client";
import { generateCampaignContent } from "./ContentGenerationServices";
import { toast } from "sonner";

interface Campaign {
  id: string;
  title: string;
  theme?: string;
  description?: string;
  week_number?: number;
  tenant_id?: string;
}

const REQUIRED_CONTENT_TYPES = ['instagram', 'facebook', 'blog', 'video', 'newsletter'];

export const generateRequiredTasks = async (
  campaignId: string,
  campaigns: Campaign[],
  userId: string,
  onTaskUpdate: () => void,
  tenantId?: string
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
      .select('id, post_type, status, ai_output')
      .eq('campaign_id', campaignId);

    if (checkError) {
      console.error('RequiredTasksGenerator: Error checking existing tasks:', checkError);
      throw checkError;
    }

    if (existingTasks && existingTasks.length > 0) {
      console.log('RequiredTasksGenerator: Found existing tasks:', existingTasks.length);
      
      // Check if we have all 5 required content types
      const existingTypes = existingTasks.map(task => task.post_type);
      const missingTypes = REQUIRED_CONTENT_TYPES.filter(type => !existingTypes.includes(type));
      
      if (missingTypes.length === 0) {
        // Check if any tasks have content
        const tasksWithContent = existingTasks.filter(task => 
          task.ai_output && 
          task.ai_output.trim() !== '' && 
          task.status !== 'generating'
        );
        
        if (tasksWithContent.length === REQUIRED_CONTENT_TYPES.length) {
          console.log('RequiredTasksGenerator: All 5 content types exist with content, skipping generation');
          return {
            success: true,
            message: 'All content already exists for this campaign',
            tasks: existingTasks
          };
        } else {
          console.log('RequiredTasksGenerator: Some tasks exist but missing content, proceeding with generation');
        }
      } else {
        console.log('RequiredTasksGenerator: Missing content types:', missingTypes, 'proceeding with generation');
      }
    }

    // Show progress feedback
    toast.loading('Generating 5 content pieces...', { id: 'task-generation' });

    // Generate campaign content using the enhanced service
    const result = await generateCampaignContent(
      campaignId,
      campaign.theme || campaign.title,
      campaign.description || '',
      userId,
      campaign.week_number,
      finalTenantId
    );

    if (!result.success) {
      toast.error(result.message || 'Failed to generate content', { id: 'task-generation' });
      throw new Error(result.message || 'Failed to generate content');
    }

    console.log('✅ RequiredTasksGenerator: Content generation completed successfully');
    
    // Verify we got all 5 content types
    const { data: finalTasks } = await supabase
      .from('content_tasks')
      .select('post_type, status')
      .eq('campaign_id', campaignId);

    const finalTypes = finalTasks?.map(task => task.post_type) || [];
    const stillMissingTypes = REQUIRED_CONTENT_TYPES.filter(type => !finalTypes.includes(type));
    
    if (stillMissingTypes.length > 0) {
      console.warn('RequiredTasksGenerator: Still missing content types after generation:', stillMissingTypes);
      toast.warning(`Generated content, but missing: ${stillMissingTypes.join(', ')}`, { id: 'task-generation' });
    } else {
      // Success feedback
      toast.success(`Generated all 5 content pieces! Check your dashboard to review.`, { id: 'task-generation' });
    }
    
    // Trigger task update callback
    onTaskUpdate();
    
    return {
      ...result,
      tasks: finalTasks || result.tasks
    };
  } catch (error) {
    console.error('🚨 RequiredTasksGenerator: Error generating required tasks:', error);
    
    // Error feedback
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    toast.error(`Content generation failed: ${errorMessage}`, { id: 'task-generation' });
    
    throw error;
  }
};
