import { supabase } from '@/integrations/supabase/client';
import { PlanWizardState } from '@/components/plan/constants';
import { reportSoftFail } from '@/lib/softFail';

export interface PlanPersistResult {
  success: boolean;
  created: number;
  skipped: number;
  error?: string;
  details?: string[];
}

export const persistPlan = async (planState: PlanWizardState): Promise<PlanPersistResult> => {
  console.log('[PlanPersist] Starting plan persistence:', planState);

  if (!planState.themes.length || !planState.month || planState.items.length === 0) {
    return {
      success: false,
      created: 0,
      skipped: 0,
      error: 'Invalid plan state'
    };
  }

  const enabledItems = planState.items.filter(item => item.enabled);
  const results = {
    created: 0,
    skipped: 0,
    details: [] as string[]
  };

  console.log('[PlanPersist] Processing', enabledItems.length, 'enabled items');

  // Get current user once at the beginning
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  
  if (userError || !user) {
    return {
      success: false,
      created: 0,
      skipped: 0,
      error: 'User not authenticated'
    };
  }

  // Process each enabled item
  for (const item of enabledItems) {
    try {
      console.log('[PlanPersist] Processing item:', item.type, item.title);

      // Skip unsupported post types
      if (item.type === 'sms') {
        results.skipped++;
        results.details.push(`SMS "${item.title}": SMS posts not supported yet`);
        console.log('[PlanPersist] Skipping SMS item:', item.title);
        continue;
      }

      // Map post types to database values
      const postTypeMap = {
        'email': 'newsletter',
        'facebook': 'facebook',
        'instagram': 'instagram'
      } as const;

      const mappedPostType = postTypeMap[item.type as keyof typeof postTypeMap];
      if (!mappedPostType) {
        results.skipped++;
        results.details.push(`${item.type} "${item.title}": Unsupported post type`);
        console.log('[PlanPersist] Skipping unsupported type:', item.type);
        continue;
      }

      // Create content_tasks entry
      const { data: contentTask, error: taskError } = await supabase
        .from('content_tasks')
        .insert({
          post_type: mappedPostType,
          status: 'pending',
          ai_output: item.caption,
          scheduled_date: item.date.toISOString().split('T')[0], // YYYY-MM-DD format
          image_url: item.imageUrl || null,
          user_id: user.id,
          // Add metadata to track this came from plan wizard with theme info
          notes: `Generated from Plan My Marketing: ${planState.themes.map(t => t.label).join(' + ')} themes${item.themeName ? ` (${item.themeName})` : ''}${item.emailSubject ? ` | Subject: ${item.emailSubject}` : ''}${item.emailPreheader ? ` | Preheader: ${item.emailPreheader}` : ''}`
        })
        .select()
        .single();

      if (taskError) {
        console.error('[PlanPersist] Failed to create content_task:', taskError);
        reportSoftFail('[plan] content_task_creation_failed', {
          itemType: item.type,
          itemTitle: item.title,
          error: taskError.message
        });
        results.skipped++;
        results.details.push(`${item.type} "${item.title}": ${taskError.message}`);
        continue;
      }

      console.log('[PlanPersist] Created content_task:', contentTask.id);

      // For social media items, also create scheduled_posts entry
      if (item.type === 'facebook' || item.type === 'instagram') {
        // Map platform types to expected enum values
        const platformMap = {
          'facebook': 'FB',
          'instagram': 'IG_FEED'
        } as const;
        
        const { error: scheduleError } = await supabase
          .from('scheduled_posts')
          .insert({
            content_id: contentTask.id,
            platform: platformMap[item.type as keyof typeof platformMap],
            publish_at: item.date.toISOString(),
            status: 'QUEUED',
            mode: 'MANUAL', // User will need to review and publish
            user_id: user.id
          });

        if (scheduleError) {
          console.error('[PlanPersist] Failed to create scheduled_posts:', scheduleError);
          // Don't fail the whole item, just log the issue
          reportSoftFail('[plan] scheduled_post_creation_failed', {
            contentTaskId: contentTask.id,
            platform: item.type,
            error: scheduleError.message
          });
        } else {
          console.log('[PlanPersist] Created scheduled_post for:', contentTask.id);
        }
      }

      results.created++;
      
    } catch (error) {
      console.error('[PlanPersist] Unexpected error processing item:', error);
      reportSoftFail('[plan] item_processing_error', {
        itemType: item.type,
        itemTitle: item.title,
        error: error.message
      });
      results.skipped++;
      results.details.push(`${item.type} "${item.title}": Unexpected error`);
    }
  }

  console.log('[PlanPersist] Completed - Created:', results.created, 'Skipped:', results.skipped);

  // If no items were created, provide a helpful error message
  if (results.created === 0) {
    const errorMsg = results.skipped > 0 
      ? `No supported content could be created. ${results.details.join('. ')}`
      : 'No enabled items found to create';
    
    return {
      success: false,
      created: results.created,
      skipped: results.skipped,
      error: errorMsg,
      details: results.details
    };
  }

  return {
    success: results.created > 0,
    created: results.created,
    skipped: results.skipped,
    details: results.details
  };
};