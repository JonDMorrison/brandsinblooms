import { supabase } from "@/integrations/supabase/client";
import type { Database, Json } from "@/integrations/supabase/types";
import { PlanWizardState } from "@/components/plan/constants";
import { trackImageUsage } from "@/lib/imageUsageTracking";

export interface PlanPersistResult {
  success: boolean;
  created: number;
  skipped: number;
  error?: string;
  details?: string[];
}

export const persistPlan = async (
  planState: PlanWizardState,
): Promise<PlanPersistResult> => {
  if (
    !planState.themes.length ||
    !planState.month ||
    planState.items.length === 0
  ) {
    return {
      success: false,
      created: 0,
      skipped: 0,
      error: "Invalid plan state",
    };
  }

  const enabledItems = planState.items.filter((item) => item.enabled);
  const imageRequiredTypes = ["email", "blog", "facebook", "instagram"];
  const missingImageItems = enabledItems.filter(
    (item) => imageRequiredTypes.includes(item.type) && !item.imageUrl,
  );

  if (missingImageItems.length > 0) {
    return {
      success: false,
      created: 0,
      skipped: 0,
      error: `${missingImageItems.length} scheduled items are still missing images`,
      details: missingImageItems.map(
        (item) => `${item.type} "${item.title}" needs an image before launch`,
      ),
    };
  }

  const results = {
    created: 0,
    skipped: 0,
    details: [] as string[],
  };
  const imageUsageTrackingPromises: Promise<void>[] = [];
  // Get current user once at the beginning
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return {
      success: false,
      created: 0,
      skipped: 0,
      error: "User not authenticated",
    };
  }

  // Get tenant_id
  const { data: userData } = await supabase
    .from("users")
    .select("tenant_id")
    .eq("id", user.id)
    .single();

  const tenantId = userData?.tenant_id || user.id;
  const monthName = new Date(planState.month + "-01").toLocaleString(
    "default",
    { month: "long", year: "numeric" },
  );
  const planThemes = planState.themes as unknown as Json;

  // Create plan record
  const { data: plan, error: planError } = await supabase
    .from("plans")
    .insert([
      {
        user_id: user.id,
        tenant_id: tenantId,
        name: `${monthName} - ${planState.themes.map((t) => t.label).join(" + ")}`,
        month: planState.month,
        themes: planThemes,
        status: "active",
      },
    ])
    .select()
    .single();

  if (planError) {
    console.error("[PlanPersist] Failed to create plan:", planError);
    return {
      success: false,
      created: 0,
      skipped: 0,
      error: `Failed to create plan: ${planError.message}`,
    };
  }
  // Process each enabled item
  for (const item of enabledItems) {
    try {
      // Map post types to database values
      const postTypeMap = {
        email: "newsletter",
        facebook: "facebook",
        instagram: "instagram",
        blog: "blog",
        sms: "sms",
      } as const;

      const mappedPostType = postTypeMap[item.type as keyof typeof postTypeMap];
      if (!mappedPostType) {
        results.skipped++;
        results.details.push(
          `${item.type} "${item.title}": Unsupported post type`,
        );
        continue;
      }

      const globalImageId =
        typeof item.imageMetadata?.globalImageId === "string"
          ? item.imageMetadata.globalImageId
          : undefined;

      // Create content_tasks entry - preserve AI-generated images
      const { data: contentTask, error: taskError } = await supabase
        .from("content_tasks")
        .insert({
          post_type: mappedPostType,
          status: "review", // Use valid status
          ai_output: item.caption,
          scheduled_date: item.date.toISOString().split("T")[0], // YYYY-MM-DD format
          image_url: item.imageUrl || null, // Preserve AI-generated images
          image_idea: item.imageQuery || `${item.themeName} ${item.type}`, // Preserve original query
          image_generation_status:
            item.imageGenerationStatus ||
            (item.imageUrl ? "completed" : "pending"), // Track generation status
          image_metadata: item.imageMetadata || null, // Preserve image metadata
          plan_id: plan.id,
          plan_theme: item.themeName || planState.themes[0].label,
          preview_image_url: item.imageUrl || null,
          user_id: user.id,
          tenant_id: tenantId,
          created_by_user_id: user.id,
          // Add metadata to track this came from plan wizard with theme info
          notes: `Generated from Plan My Marketing: ${planState.themes.map((t) => t.label).join(" + ")} themes${item.themeName ? ` (${item.themeName})` : ""}${item.emailSubject ? ` | Subject: ${item.emailSubject}` : ""}${item.emailPreheader ? ` | Preheader: ${item.emailPreheader}` : ""}${item.audienceTarget ? ` | Audience: ${item.audienceTarget}` : ""}${item.selectedSegmentIds?.length ? ` | Segments: ${item.selectedSegmentIds.length}` : ""}${item.selectedPersonaIds?.length ? ` | Personas: ${item.selectedPersonaIds.length}` : ""}`,
        })
        .select()
        .single();

      if (taskError) {
        console.error("[PlanPersist] Failed to create content_task:", {
          error: taskError,
          itemType: item.type,
          itemTitle: item.title,
          mappedPostType,
          userId: user.id,
          tenantId,
        });
        results.skipped++;
        results.details.push(
          `${item.type} "${item.title}": ${taskError.message}`,
        );
        continue;
      }

      if (globalImageId) {
        imageUsageTrackingPromises.push(
          trackImageUsage({
            contentId: contentTask.id,
            context:
              item.imageMetadata?.source === "gallery-reuse"
                ? "social_post_reuse"
                : "social_post",
            globalImageId,
            tenantId,
            userId: user.id,
          }),
        );
      }

      // For social media items, also create scheduled_posts entry
      if (item.type === "facebook" || item.type === "instagram") {
        // Map platform types to expected enum values
        const platformMap = {
          facebook: "FB",
          instagram: "IG_FEED",
        } as const;
        const scheduledPostInsert: Database["public"]["Tables"]["scheduled_posts"]["Insert"] =
          {
            global_image_id: globalImageId || null,
            task_id: contentTask.id,
            tenant_id: tenantId,
            platform: platformMap[item.type as keyof typeof platformMap],
            publish_at: item.date.toISOString(),
            status: "QUEUED",
            mode: "MANUAL",
            user_id: user.id,
          };

        const { error: scheduleError } = await supabase
          .from("scheduled_posts")
          .insert(scheduledPostInsert);

        if (scheduleError) {
          console.error("[PlanPersist] Failed to create scheduled_posts:", {
            error: scheduleError,
            message: scheduleError.message,
            details: scheduleError.details,
            hint: scheduleError.hint,
            code: scheduleError.code,
            contentTaskId: contentTask.id,
            platform: platformMap[item.type as keyof typeof platformMap],
            publishAt: item.date.toISOString(),
            tenantId,
            userId: user.id,
          });
          // Continue anyway - at least content_task was created
        }
      }

      results.created++;
    } catch (error) {
      console.error("[PlanPersist] Unexpected error processing item:", error);
      results.skipped++;
      results.details.push(`${item.type} "${item.title}": Unexpected error`);
    }
  }

  await Promise.allSettled(imageUsageTrackingPromises);

  // If no items were created, provide a helpful error message
  if (results.created === 0) {
    const errorMsg =
      results.skipped > 0
        ? `No supported content could be created. ${results.details.join(". ")}`
        : "No enabled items found to create";

    return {
      success: false,
      created: results.created,
      skipped: results.skipped,
      error: errorMsg,
      details: results.details,
    };
  }

  return {
    success: results.created > 0,
    created: results.created,
    skipped: results.skipped,
    details: results.details,
  };
};
