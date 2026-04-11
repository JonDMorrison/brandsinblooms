import { supabase } from "@/integrations/supabase/client";

export async function migrateLegacyReadyToPosts() {
  try {
    // Get approved content_tasks that should become generated_content
    const { data: legacyTasks, error: fetchError } = await supabase
      .from("content_tasks")
      .select("*")
      .eq("status", "approved")
      .not("ai_output", "is", null);

    if (fetchError) {
      console.error("Error fetching legacy tasks:", fetchError);
      return;
    }

    if (!legacyTasks || legacyTasks.length === 0) {
      return;
    }
    let migratedCount = 0;
    let errorCount = 0;

    for (const task of legacyTasks) {
      try {
        // Check if already migrated
        const { data: existing } = await supabase
          .from("generated_content" as any)
          .select("id")
          .eq("caption", task.ai_output)
          .eq("user_id", task.user_id)
          .single();

        if (existing) {
          continue;
        }

        // Create generated content from legacy task
        const { error: insertError } = await supabase
          .from("generated_content" as any)
          .insert({
            user_id: task.user_id,
            caption: task.ai_output,
            media_url: task.image_idea,
            status: "DRAFT",
            created_at: task.created_at,
          });

        if (insertError) {
          console.error(`Error migrating task ${task.id}:`, insertError);
          errorCount++;
        } else {
          migratedCount++;
        }
      } catch (error) {
        console.error(`Exception migrating task ${task.id}:`, error);
        errorCount++;
      }
    }
    return { migratedCount, errorCount };
  } catch (error) {
    console.error("Migration failed:", error);
    throw error;
  }
}

// Auto-run migration on first load
if (typeof window !== "undefined") {
  // Run once per session
  const migrationKey = "legacy_content_migrated";
  if (!sessionStorage.getItem(migrationKey)) {
    migrateLegacyReadyToPosts().finally(() => {
      sessionStorage.setItem(migrationKey, "true");
    });
  }
}
