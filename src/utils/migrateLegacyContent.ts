
import { supabase } from '@/integrations/supabase/client';

export async function migrateLegacyReadyToPosts() {
  try {
    console.log('Starting migration of legacy ready-to-post content...');
    
    // Get approved content_tasks that should become generated_content
    const { data: legacyTasks, error: fetchError } = await supabase
      .from('content_tasks')
      .select('*')
      .eq('status', 'approved')
      .not('ai_output', 'is', null);

    if (fetchError) {
      console.error('Error fetching legacy tasks:', fetchError);
      return;
    }

    if (!legacyTasks || legacyTasks.length === 0) {
      console.log('No legacy content to migrate');
      return;
    }

    console.log(`Found ${legacyTasks.length} legacy tasks to migrate`);

    let migratedCount = 0;
    let errorCount = 0;

    for (const task of legacyTasks) {
      try {
        // Check if already migrated
        const { data: existing } = await supabase
          .from('generated_content')
          .select('id')
          .eq('caption', task.ai_output)
          .eq('user_id', task.user_id)
          .single();

        if (existing) {
          console.log(`Task ${task.id} already migrated, skipping`);
          continue;
        }

        // Create generated content from legacy task
        const { error: insertError } = await supabase
          .from('generated_content')
          .insert({
            user_id: task.user_id,
            caption: task.ai_output,
            media_url: task.image_idea,
            status: 'DRAFT',
            created_at: task.created_at
          });

        if (insertError) {
          console.error(`Error migrating task ${task.id}:`, insertError);
          errorCount++;
        } else {
          migratedCount++;
          console.log(`Successfully migrated task ${task.id}`);
        }

      } catch (error) {
        console.error(`Exception migrating task ${task.id}:`, error);
        errorCount++;
      }
    }

    console.log(`Migration complete: ${migratedCount} success, ${errorCount} errors`);
    return { migratedCount, errorCount };

  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  }
}

// Auto-run migration on first load
if (typeof window !== 'undefined') {
  // Run once per session
  const migrationKey = 'legacy_content_migrated';
  if (!sessionStorage.getItem(migrationKey)) {
    migrateLegacyReadyToPosts().finally(() => {
      sessionStorage.setItem(migrationKey, 'true');
    });
  }
}
