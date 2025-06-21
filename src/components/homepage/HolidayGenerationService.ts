
import { supabase } from "@/integrations/supabase/client";
import { generateStructuredNewsletter } from "./StructuredNewsletterService";
import { generatePersonalizedContent } from "./ContentGenerationServices";

const contentTypes = ['instagram', 'facebook', 'blog', 'video', 'newsletter'];

export async function generateHolidayContent(
  user: any, 
  holiday: any, 
  tenant?: any,
  onTaskUpdate?: () => void
) {
  console.log(`🎉 Generating holiday content for: ${holiday.holiday_name}`);
  
  const results = [];
  
  for (const type of contentTypes) {
    try {
      console.log(`📝 Generating ${type} content for holiday: ${holiday.holiday_name}`);
      
      let output = '';

      if (type === 'newsletter') {
        // DEV-preview seeding for designers
        if (['jon@getclear.ca'].includes(user.email)) {
          output = `# 🌟 DEV PREVIEW HOLIDAY NEWSLETTER

**${holiday.holiday_name} Special Edition**

## Beat the Season: Your Garden's Holiday Survival Guide
Make the most of ${holiday.holiday_name} with expert gardening tips that transform your outdoor space into a seasonal showcase.

## This Holiday's Garden Game-Changer  
Discover the secret techniques that professional gardeners use during ${holiday.holiday_name} to create stunning results.

## SOS: Save Your Plants Before the Season Changes
Don't let seasonal transitions damage your garden - learn the critical steps to protect your plants during ${holiday.holiday_name}.

## Get Ready: Your Garden's Next Power Move
Plan ahead for post-${holiday.holiday_name} success with strategic preparation that sets your garden up for the coming season.

---
Transform your holiday garden with expert guidance 🌿`;
        } else {
          // Generate real newsletter content using the structured newsletter service
          output = await generateStructuredNewsletter(
            holiday.id, // Use holiday ID as campaign ID equivalent
            holiday.holiday_name,
            0, // No week number for holidays
            user.id,
            holiday.description || `${holiday.holiday_name} gardening opportunities`,
            [], // No promo items for holidays
            `Holiday-focused content for ${holiday.holiday_name}`
          );
        }
      } else {
        // Generate other content types using existing service
        // Map holiday data to the expected parameters for generatePersonalizedContent
        const campaignTitle = holiday.holiday_name;
        const weekDescription = holiday.garden_relevance || holiday.description || `Special ${holiday.holiday_name} content for garden centers`;
        
        output = await generatePersonalizedContent(
          type,
          campaignTitle,
          user.id,
          weekDescription
        );
      }

      // Validate that content was generated
      if (!output || output.trim() === '') {
        console.warn(`⚠️ No content generated for ${type}`);
        results.push({ type, success: false, error: 'Empty content returned' });
        continue;
      }

      // Insert content task with proper tenant handling
      const taskData: any = {
        holiday_id: holiday.id,
        post_type: type,
        ai_output: output,
        status: 'review',
        scheduled_date: holiday.holiday_date,
        notes: `Generated for ${holiday.holiday_name}`
      };

      // Handle tenant vs user-based task creation
      if (tenant?.id) {
        taskData.tenant_id = tenant.id;
        taskData.created_by_user_id = user.id;
      } else {
        taskData.user_id = user.id;
      }

      const { data: task, error } = await supabase
        .from('content_tasks')
        .insert(taskData)
        .select()
        .single();

      if (error) {
        console.error(`❌ Error creating ${type} task for holiday:`, error);
        results.push({ type, success: false, error: error.message });
      } else {
        console.log(`✅ Created ${type} task for holiday:`, task.id);
        results.push({ type, success: true, taskId: task.id });
      }

    } catch (error) {
      console.error(`❌ Error generating ${type} content for holiday:`, error);
      results.push({ type, success: false, error: error.message });
    }
  }

  // Call onTaskUpdate if provided to refresh the UI
  if (onTaskUpdate) {
    onTaskUpdate();
  }

  console.log(`🎉 Holiday content generation complete for ${holiday.holiday_name}:`, results);
  return results;
}

// Export individual content generation for backwards compatibility
export { generatePersonalizedContent };
