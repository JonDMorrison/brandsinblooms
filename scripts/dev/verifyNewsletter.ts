
import { supabase } from "@/integrations/supabase/client";

interface NewsletterVerificationResult {
  success: boolean;
  message: string;
  taskCounts: Record<string, number>;
  error?: string;
}

export const verifyNewsletterGeneration = async (
  campaignId: string,
  userId: string
): Promise<NewsletterVerificationResult> => {
  try {
    console.log(`🔍 Newsletter Verification: Starting for campaign ${campaignId}`);
    
    // Step 1: Delete existing newsletter tasks for this campaign
    const { error: deleteError } = await supabase
      .from('content_tasks')
      .delete()
      .eq('campaign_id', campaignId)
      .eq('post_type', 'newsletter');

    if (deleteError) {
      console.error('❌ Error deleting existing newsletter tasks:', deleteError);
    } else {
      console.log('✅ Cleaned up existing newsletter tasks');
    }

    // Step 2: Query current task distribution
    const { data: beforeTasks, error: beforeError } = await supabase
      .from('content_tasks')
      .select('post_type')
      .eq('campaign_id', campaignId);

    if (beforeError) {
      throw new Error(`Failed to query tasks before generation: ${beforeError.message}`);
    }

    const beforeCounts = beforeTasks?.reduce((acc, task) => {
      acc[task.post_type] = (acc[task.post_type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>) || {};

    console.log('📊 Task counts before refresh:', beforeCounts);

    // Step 3: Trigger content refresh (this will be called externally)
    console.log('⚠️ Content refresh must be triggered externally via UI or API');

    // Step 4: Wait and verify results
    await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds

    const { data: afterTasks, error: afterError } = await supabase
      .from('content_tasks')
      .select('post_type')
      .eq('campaign_id', campaignId);

    if (afterError) {
      throw new Error(`Failed to query tasks after generation: ${afterError.message}`);
    }

    const afterCounts = afterTasks?.reduce((acc, task) => {
      acc[task.post_type] = (acc[task.post_type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>) || {};

    console.log('📊 Task counts after refresh:', afterCounts);

    // Step 5: Verify newsletter exists
    const expectedTypes = ['instagram', 'facebook', 'blog', 'video', 'newsletter'];
    const missingTypes = expectedTypes.filter(type => !afterCounts[type] || afterCounts[type] === 0);

    if (missingTypes.length === 0) {
      return {
        success: true,
        message: `✅ All content types generated successfully`,
        taskCounts: afterCounts
      };
    } else {
      return {
        success: false,
        message: `❌ Missing content types: ${missingTypes.join(', ')}`,
        taskCounts: afterCounts,
        error: `Newsletter generation failed - missing: ${missingTypes.join(', ')}`
      };
    }

  } catch (error) {
    console.error('❌ Newsletter verification failed:', error);
    return {
      success: false,
      message: `Verification failed: ${error.message}`,
      taskCounts: {},
      error: error.message
    };
  }
};

// Development-only utility - DO NOT expose to production
export const runNewsletterDiagnostics = async (campaignId: string) => {
  if (process.env.NODE_ENV === 'production') {
    console.warn('🚫 Newsletter diagnostics disabled in production');
    return;
  }

  console.log('🔍 Running newsletter diagnostics...');
  
  // Check for existing newsletter tasks
  const { data: newsletterTasks } = await supabase
    .from('content_tasks')
    .select('*')
    .eq('campaign_id', campaignId)
    .eq('post_type', 'newsletter');

  console.log('📰 Existing newsletter tasks:', newsletterTasks?.length || 0);
  
  if (newsletterTasks && newsletterTasks.length > 0) {
    newsletterTasks.forEach((task, index) => {
      console.log(`📰 Newsletter ${index + 1}:`, {
        id: task.id,
        status: task.status,
        content_length: task.ai_output?.length || 0,
        created_at: task.created_at
      });
    });
  }

  // Check all tasks for this campaign
  const { data: allTasks } = await supabase
    .from('content_tasks')
    .select('post_type, status, created_at')
    .eq('campaign_id', campaignId)
    .order('created_at', { ascending: false });

  const taskSummary = allTasks?.reduce((acc, task) => {
    acc[task.post_type] = (acc[task.post_type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>) || {};

  console.log('📊 All task types for campaign:', taskSummary);
  
  return { newsletterTasks, taskSummary };
};
