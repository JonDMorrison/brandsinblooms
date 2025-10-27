import * as Sentry from "https://esm.sh/@sentry/deno@8.55.0";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Initialize Sentry
Sentry.init({
  dsn: Deno.env.get("SENTRY_DSN_BACKEND"),
  environment: Deno.env.get("ENV") ?? "production",
});

function softFail(code: string, context: Record<string, unknown> = {}) {
  Sentry.captureMessage(`[soft-fail] ${code}`, { level: "warning", extra: context });
}

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
)

async function handler(req: Request): Promise<Response> {
  try {
    console.log('[WATCHDOG] Starting watchdog check...');
    
    let issuesFound = 0;
    
    // 1. Find content_tasks created >5 min ago with empty ai_output
    // Note: We only check ai_output, not image_url, because some post types (SMS, newsletter) don't need images
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    
    const { data: stuckTasks, error: tasksError } = await supabaseAdmin
      .from('content_tasks')
      .select('id, created_at, ai_output, image_url, post_type, status')
      .lt('created_at', fiveMinutesAgo)
      .neq('status', 'failed')
      .neq('status', 'cancelled')
      .neq('status', 'review') // Don't fail tasks in review status (from Plan Wizard)
      .or('ai_output.is.null,ai_output.eq.');

    if (tasksError) {
      console.error('[WATCHDOG] Error fetching stuck tasks:', tasksError);
    } else if (stuckTasks && stuckTasks.length > 0) {
      console.log(`[WATCHDOG] Found ${stuckTasks.length} stuck tasks`);
      
      for (const task of stuckTasks) {
        const ageMinutes = Math.floor((Date.now() - new Date(task.created_at).getTime()) / (1000 * 60));
        
        softFail("content_stuck_no_output", { 
          taskId: task.id,
          ageMinutes,
          postType: task.post_type,
          hasOutput: !!task.ai_output,
          hasImage: !!task.image_url,
          status: task.status
        });
        
        // Mark as failed
        await supabaseAdmin
          .from('content_tasks')
          .update({ 
            status: 'failed',
            notes: `Watchdog: Stuck for ${ageMinutes} minutes without output`
          })
          .eq('id', task.id);
        
        issuesFound++;
      }
    }
    
    // 2. Find scheduled_posts where scheduled_for < now() - 3 min and status still QUEUED
    const threeMinutesAgo = new Date(Date.now() - 3 * 60 * 1000).toISOString();
    
    const { data: overduePosts, error: postsError } = await supabaseAdmin
      .from('scheduled_posts')
      .select('id, publish_at, platform, content_id, status, retry_count')
      .eq('status', 'QUEUED')
      .lt('publish_at', threeMinutesAgo);

    if (postsError) {
      console.error('[WATCHDOG] Error fetching overdue posts:', postsError);
    } else if (overduePosts && overduePosts.length > 0) {
      console.log(`[WATCHDOG] Found ${overduePosts.length} overdue posts`);
      
      for (const post of overduePosts) {
        const delayMinutes = Math.floor((Date.now() - new Date(post.publish_at).getTime()) / (1000 * 60));
        
        softFail("scheduled_post_overdue", { 
          postId: post.id,
          contentId: post.content_id,
          platform: post.platform,
          scheduledFor: post.publish_at,
          delayMinutes,
          retryCount: post.retry_count || 0
        });
        
        issuesFound++;
        
        // If it's been overdue for more than 10 minutes and has high retry count, mark as error
        if (delayMinutes > 10 && (post.retry_count || 0) >= 2) {
          await supabaseAdmin
            .from('scheduled_posts')
            .update({ 
              status: 'ERROR',
              error_message: `Watchdog: Overdue by ${delayMinutes} minutes`
            })
            .eq('id', post.id);
        }
      }
    }
    
    console.log(`[WATCHDOG] Watchdog check complete. Found ${issuesFound} issues.`);
    
    return new Response(
      JSON.stringify({ 
        success: true,
        issuesFound,
        stuckTasks: stuckTasks?.length || 0,
        overduePosts: overduePosts?.length || 0,
        timestamp: new Date().toISOString()
      }),
      { 
        status: 200, 
        headers: { 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('[WATCHDOG] Watchdog error:', error);
    Sentry.captureException(error);
    return new Response(
      JSON.stringify({ error: 'Watchdog failed', details: error.message }),
      { 
        status: 500, 
        headers: { 'Content-Type': 'application/json' } 
      }
    );
  }
}

Deno.serve(handler);