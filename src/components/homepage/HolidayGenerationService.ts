import { supabase } from "@/integrations/supabase/client";
import { generateStructuredNewsletter } from "./StructuredNewsletterService";
import {
  buildHolidayContentPrompt,
  validateHolidayContent,
} from "./HolidayPromptBuilder";
import { attachImagesToTask } from "@/services/contentGenerationHelpers";

const contentTypes = ["instagram", "facebook", "blog", "video", "newsletter"];

export async function generateHolidayContent(
  user: any,
  holiday: any,
  tenant?: any,
  onTaskUpdate?: () => void,
) {
  const results = [];

  // Get company profile for enhanced context
  let companyProfile = null;
  if (user?.id) {
    const { data: profileData } = await supabase
      .from("company_profiles")
      .select("*")
      .eq("user_id", user.id)
      .single();
    companyProfile = profileData;
  }

  for (const type of contentTypes) {
    try {
      let output = "";
      let attempts = 0;
      const maxAttempts = type === "instagram" ? 3 : 2; // More attempts for Instagram to ensure quality

      if (type === "newsletter") {
        // Always use structured newsletter service for all users to ensure consistency
        output = await generateStructuredNewsletter(
          holiday.id, // Use holiday ID as campaign ID equivalent
          holiday.holiday_name,
          0, // No week number for holidays
          user.id,
          holiday.description ||
            `${holiday.holiday_name} gardening opportunities`,
          [], // No promo items for holidays
          `Holiday-focused content for ${holiday.holiday_name}`,
        );
      } else {
        // Use enhanced holiday-specific prompts for all other content types
        do {
          attempts++;

          // Generate content using holiday-specific prompts via edge function
          const holidayPrompt = buildHolidayContentPrompt(
            type,
            holiday,
            companyProfile,
          );

          const { data, error } = await supabase.functions.invoke(
            "generate-content",
            {
              body: {
                postType: type,
                campaignTitle: holiday.holiday_name,
                userId: user.id,
                campaignDescription: "", // Not used since we're providing a complete prompt
                customPrompt: holidayPrompt, // Pass the holiday-specific prompt
                enforceCompanyName: true,
              },
            },
          );

          if (error) {
            console.error(
              `HOLIDAY_CONTENT ERROR: Supabase function error:`,
              error,
            );
            throw new Error(
              `Holiday content generation failed: ${error.message}`,
            );
          }

          if (!data?.content) {
            console.error(`HOLIDAY_CONTENT ERROR: No content returned`);
            throw new Error("No holiday content generated");
          }

          output = data.content;

          // Validate holiday content quality (especially for Instagram)
          if (type === "instagram" && output) {
            const validation = validateHolidayContent(output, holiday);

            if (validation.quality === "weak" && attempts < maxAttempts) {
              continue; // Try again
            }
          }

          break; // Content is acceptable
        } while (attempts < maxAttempts);
      }

      // Enhanced validation that content was generated
      if (!output || output.trim() === "" || output.trim().length < 10) {
        results.push({
          type,
          success: false,
          error: "Empty or insufficient content returned",
        });
        continue;
      }

      // Get image for this task using the helper function
      const imageData = await attachImagesToTask(null, holiday.holiday_name);

      // Create task data structure with proper field validation
      const taskData: any = {
        holiday_id: holiday.id,
        post_type: type,
        ai_output: output,
        status: "review",
        scheduled_date: holiday.holiday_date,
        notes: `Generated for ${holiday.holiday_name} (${attempts} attempts)`,
        attachments: imageData?.image
          ? JSON.stringify({ image: imageData.image })
          : null,
      };

      // CRITICAL: Always set user_id for holiday tasks to satisfy RLS policies
      taskData.user_id = user.id;

      // CRITICAL: Always set tenant_id for holiday tasks to ensure they appear in Ready to Post
      if (tenant?.id) {
        taskData.tenant_id = tenant.id;
        taskData.created_by_user_id = user.id;
      } else {
        // Fallback: try to get tenant from user if not provided
        const { data: userTenant } = await supabase
          .from("tenants")
          .select("id")
          .limit(1)
          .single();

        if (userTenant) {
          taskData.tenant_id = userTenant.id;
          taskData.created_by_user_id = user.id;
        }
      }

      // Pre-insert field validation with allowed fields list
      const allowedFields = [
        "holiday_id",
        "ai_output",
        "post_type",
        "attachments",
        "status",
        "scheduled_date",
        "tenant_id",
        "created_by_user_id",
        "user_id",
        "notes",
      ];

      Object.keys(taskData).forEach((key) => {
        if (!allowedFields.includes(key)) {
          delete taskData[key as keyof typeof taskData];
        }
      });

      // Validate required fields before database insertion
      if (
        !taskData.holiday_id ||
        !taskData.post_type ||
        !taskData.ai_output ||
        (!taskData.tenant_id && !taskData.user_id)
      ) {
        console.error(
          `ERROR ${type.toUpperCase()} DEBUG: Missing required fields:`,
          {
            holiday_id: !!taskData.holiday_id,
            post_type: !!taskData.post_type,
            ai_output: !!taskData.ai_output,
            tenant_id: !!taskData.tenant_id,
            user_id: !!taskData.user_id,
          },
        );
        results.push({
          type,
          success: false,
          error: "Missing required task fields",
        });
        continue;
      }

      // Insert with enhanced error logging
      const { data: task, error } = await supabase
        .from("content_tasks")
        .insert(taskData)
        .select()
        .single();

      if (error) {
        console.error(
          `ERROR ${type.toUpperCase()} DEBUG: DB insert failed\n`,
          JSON.stringify(error, null, 2),
          "\nTask payload:",
          taskData,
        );
        console.error(`ERROR ${type.toUpperCase()} DEBUG: Error details:`, {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code,
        });
        results.push({
          type,
          success: false,
          error: `Database error: ${error.message}`,
        });
      } else {
        results.push({ type, success: true, taskId: task.id });
      }
    } catch (error) {
      console.error(
        `ERROR ${type.toUpperCase()} DEBUG: Exception during generation:`,
        error,
      );
      console.error(`ERROR ${type.toUpperCase()} DEBUG: Error details:`, {
        message: error.message,
        stack: error.stack,
        name: error.name,
      });
      results.push({ type, success: false, error: error.message });
    }
  }

  // Call onTaskUpdate if provided to refresh the UI
  if (onTaskUpdate) {
    onTaskUpdate();
  }

  return results;
}

// Export individual content generation for backwards compatibility
export { generatePersonalizedContent } from "./ContentGenerationServices";
