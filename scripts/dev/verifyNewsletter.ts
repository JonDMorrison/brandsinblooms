
import { supabase } from "@/integrations/supabase/client";

interface NewsletterVerificationResult {
  success: boolean;
  message: string;
  taskCounts: Record<string, number>;
  error?: string;
  details?: any;
}

export const verifyNewsletterGeneration = async (
  campaignId: string,
  userId: string
): Promise<NewsletterVerificationResult> => {
  try {
    console.log(`🔍 Newsletter Verification: Starting for campaign ${campaignId}`);
    
    // Step 1: Query current task distribution BEFORE any changes
    const { data: beforeTasks, error: beforeError } = await supabase
      .from('content_tasks')
      .select('post_type, id, status, created_at')
      .eq('campaign_id', campaignId);

    if (beforeError) {
      throw new Error(`Failed to query tasks before generation: ${beforeError.message}`);
    }

    const beforeCounts = beforeTasks?.reduce((acc, task) => {
      acc[task.post_type] = (acc[task.post_type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>) || {};

    console.log('📊 Task counts before verification:', beforeCounts);

    // Step 2: Check for existing newsletter specifically
    const existingNewsletters = beforeTasks?.filter(task => task.post_type === 'newsletter') || [];
    console.log('📰 Existing newsletter tasks:', existingNewsletters.length);
    
    if (existingNewsletters.length > 0) {
      existingNewsletters.forEach((task, index) => {
        console.log(`📰 Newsletter ${index + 1}:`, {
          id: task.id,
          status: task.status,
          created_at: task.created_at
        });
      });
    }

    // Step 3: Manual verification - query the database directly
    const { data: manualCheck, error: manualError } = await supabase
      .from('content_tasks')
      .select('*')
      .eq('campaign_id', campaignId)
      .eq('post_type', 'newsletter');

    console.log('🔍 Manual newsletter check:', { 
      count: manualCheck?.length || 0, 
      error: manualError,
      tasks: manualCheck 
    });

    // Step 4: Verify all expected types
    const expectedTypes = ['instagram', 'facebook', 'blog', 'video', 'newsletter'];
    const missingTypes = expectedTypes.filter(type => !beforeCounts[type] || beforeCounts[type] === 0);
    const hasNewsletter = beforeCounts['newsletter'] > 0;

    const result = {
      success: missingTypes.length === 0 && hasNewsletter,
      message: hasNewsletter 
        ? `✅ Newsletter found! All content types present: ${expectedTypes.join(', ')}`
        : `❌ Newsletter MISSING! Present types: ${Object.keys(beforeCounts).join(', ')}`,
      taskCounts: beforeCounts,
      details: {
        expectedTypes,
        missingTypes,
        hasNewsletter,
        manualNewsletterCount: manualCheck?.length || 0,
        allTasks: beforeTasks?.map(t => ({ id: t.id, type: t.post_type, status: t.status }))
      }
    };

    if (!hasNewsletter) {
      result.error = `Newsletter generation failed - missing newsletter task in database`;
    }

    return result;

  } catch (error) {
    console.error('❌ Newsletter verification failed:', error);
    return {
      success: false,
      message: `Verification failed: ${error.message}`,
      taskCounts: {},
      error: error.message,
      details: { error: error.message }
    };
  }
};

// Enhanced diagnostics that shows database state
export const runNewsletterDiagnostics = async (campaignId: string) => {
  if (process.env.NODE_ENV === 'production') {
    console.warn('🚫 Newsletter diagnostics disabled in production');
    return;
  }

  console.log('🔍 Running comprehensive newsletter diagnostics...');
  
  // Check for existing newsletter tasks
  const { data: newsletterTasks, error: newsletterError } = await supabase
    .from('content_tasks')
    .select('*')
    .eq('campaign_id', campaignId)
    .eq('post_type', 'newsletter');

  console.log('📰 Newsletter-specific query result:', { 
    count: newsletterTasks?.length || 0, 
    error: newsletterError,
    tasks: newsletterTasks 
  });
  
  if (newsletterTasks && newsletterTasks.length > 0) {
    newsletterTasks.forEach((task, index) => {
      console.log(`📰 Newsletter ${index + 1}:`, {
        id: task.id,
        status: task.status,
        content_length: task.ai_output?.length || 0,
        created_at: task.created_at,
        tenant_id: task.tenant_id,
        user_id: task.user_id
      });
    });
  } else {
    console.warn('⚠️ NO NEWSLETTER TASKS FOUND for campaign:', campaignId);
  }

  // Check all tasks for this campaign
  const { data: allTasks, error: allError } = await supabase
    .from('content_tasks')
    .select('post_type, status, created_at, id, tenant_id, user_id')
    .eq('campaign_id', campaignId)
    .order('created_at', { ascending: false });

  console.log('📊 All tasks query result:', { 
    count: allTasks?.length || 0, 
    error: allError 
  });

  const taskSummary = allTasks?.reduce((acc, task) => {
    acc[task.post_type] = (acc[task.post_type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>) || {};

  console.log('📊 All task types for campaign:', taskSummary);
  
  // Check for any database constraints or issues
  const { data: campaignInfo } = await supabase
    .from('campaigns')
    .select('*')
    .eq('id', campaignId)
    .single();

  console.log('🎯 Campaign info:', campaignInfo);
  
  return { 
    newsletterTasks, 
    taskSummary, 
    allTasks,
    campaignInfo,
    diagnosticsComplete: true
  };
};

// Force newsletter creation (dev only)
export const forceCreateNewsletterTask = async (campaignId: string, userId: string, tenantId?: string) => {
  if (process.env.NODE_ENV === 'production') {
    console.warn('🚫 Force newsletter creation disabled in production');
    return { success: false, error: 'Not available in production' };
  }

  try {
    console.log('🔧 Force creating newsletter task...');
    
    const fallbackContent = `# Weekly Garden Newsletter

**This Week's Focus**

Welcome to our weekly newsletter! This week we're bringing you the latest gardening insights and tips.

## What's Growing
Discover what's thriving in gardens this week and how you can make the most of the season.

## Expert Tips
Our gardening experts share their top recommendations for this time of year.

## Looking Ahead
Plan your garden activities for the coming week with our forward-looking advice.

---
*Thank you for reading our newsletter!*`;

    const taskData: any = {
      campaign_id: campaignId,
      post_type: 'newsletter',
      ai_output: fallbackContent,
      status: 'review',
      scheduled_date: new Date().toISOString().split('T')[0],
      notes: 'Force-created newsletter task for debugging'
    };

    if (tenantId) {
      taskData.tenant_id = tenantId;
      taskData.created_by_user_id = userId;
    } else {
      taskData.user_id = userId;
    }

    const { data: task, error } = await supabase
      .from('content_tasks')
      .insert(taskData)
      .select()
      .single();

    if (error) {
      console.error('❌ Error force-creating newsletter:', error);
      return { success: false, error: error.message };
    }

    console.log('✅ Force-created newsletter task:', task.id);
    return { success: true, task };

  } catch (error) {
    console.error('❌ Force creation failed:', error);
    return { success: false, error: error.message };
  }
};
