import { supabase } from '@/integrations/supabase/client';
import { PlanWizardState } from '@/components/plan/constants';

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

  // Get tenant_id
  const { data: userData } = await supabase
    .from('users')
    .select('tenant_id')
    .eq('id', user.id)
    .single();

  const tenantId = userData?.tenant_id || user.id;
  const monthName = new Date(planState.month + '-01').toLocaleString('default', { month: 'long', year: 'numeric' });

  // Create plan record
  const { data: plan, error: planError } = await supabase
    .from('plans')
    .insert([{
      user_id: user.id,
      tenant_id: tenantId,
      name: `${monthName} - ${planState.themes.map(t => t.label).join(' + ')}`,
      month: planState.month,
      themes: planState.themes as any,
      status: 'active'
    }])
    .select()
    .single();

  if (planError) {
    console.error('[PlanPersist] Failed to create plan:', planError);
    return {
      success: false,
      created: 0,
      skipped: 0,
      error: `Failed to create plan: ${planError.message}`
    };
  }

  console.log('[PlanPersist] Created plan:', plan.id);

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
        'instagram': 'instagram',
        'blog': 'blog'
      } as const;

      const mappedPostType = postTypeMap[item.type as keyof typeof postTypeMap];
      if (!mappedPostType) {
        results.skipped++;
        results.details.push(`${item.type} "${item.title}": Unsupported post type`);
        console.log('[PlanPersist] Skipping unsupported type:', item.type);
        continue;
      }

      // Create content_tasks entry - preserve AI-generated images
      const { data: contentTask, error: taskError } = await supabase
        .from('content_tasks')
        .insert({
          post_type: mappedPostType,
          status: 'review', // Use valid status
          ai_output: item.caption,
          scheduled_date: item.date.toISOString().split('T')[0], // YYYY-MM-DD format
          image_url: item.imageUrl || null, // Preserve AI-generated images
          image_idea: item.imageQuery || `${item.themeName} ${item.type}`, // Preserve original query
          image_generation_status: item.imageUrl ? 'completed' : 'pending', // Track generation status
          image_metadata: item.imageMetadata || null, // Preserve image metadata
          plan_id: plan.id,
          plan_theme: item.themeName || planState.themes[0].label,
          preview_image_url: item.imageUrl || null,
          user_id: user.id,
          tenant_id: tenantId,
          created_by_user_id: user.id,
          // Add metadata to track this came from plan wizard with theme info
          notes: `Generated from Plan My Marketing: ${planState.themes.map(t => t.label).join(' + ')} themes${item.themeName ? ` (${item.themeName})` : ''}${item.emailSubject ? ` | Subject: ${item.emailSubject}` : ''}${item.emailPreheader ? ` | Preheader: ${item.emailPreheader}` : ''}${item.audienceTarget ? ` | Audience: ${item.audienceTarget}` : ''}${item.selectedSegmentIds?.length ? ` | Segments: ${item.selectedSegmentIds.length}` : ''}${item.selectedPersonaIds?.length ? ` | Personas: ${item.selectedPersonaIds.length}` : ''}`
        })
        .select()
        .single();

      if (taskError) {
        console.error('[PlanPersist] Failed to create content_task:', taskError);
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
            task_id: contentTask.id,
            tenant_id: tenantId,
            platform: platformMap[item.type as keyof typeof platformMap],
            publish_at: item.date.toISOString(),
            status: 'QUEUED',
            mode: 'MANUAL', // User will need to review and publish
            user_id: user.id
          } as any);

        if (scheduleError) {
          console.error('[PlanPersist] Failed to create scheduled_posts:', scheduleError);
          // Don't fail the whole item, just log the issue
        } else {
          console.log('[PlanPersist] Created scheduled_post for:', contentTask.id);
        }
      }

      results.created++;
      
    } catch (error) {
      console.error('[PlanPersist] Unexpected error processing item:', error);
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