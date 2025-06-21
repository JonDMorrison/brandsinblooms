
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
      console.log(`📝 Starting ${type} content generation for holiday: ${holiday.holiday_name}`);
      
      let output = '';

      if (type === 'newsletter') {
        // Always use structured newsletter service for all users to ensure consistency
        output = await generateStructuredNewsletter(
          holiday.id, // Use holiday ID as campaign ID equivalent
          holiday.holiday_name,
          0, // No week number for holidays
          user.id,
          holiday.description || `${holiday.holiday_name} gardening opportunities`,
          [], // No promo items for holidays
          `Holiday-focused content for ${holiday.holiday_name}`
        );
      } else if (type === 'video') {
        console.log(`🎬 VIDEO DEBUG: About to generate video script for holiday: ${holiday.holiday_name}`);
        console.log(`🎬 VIDEO DEBUG: User ID: ${user.id}`);
        
        // Enhanced holiday context for video generation
        const holidayContext = `${holiday.holiday_name} - ${holiday.garden_relevance || holiday.description || 'Holiday gardening opportunity'}. Focus specifically on ${holiday.holiday_name} gardening activities, seasonal care, and holiday-specific plant care or garden preparation.`;
        
        console.log(`🎬 VIDEO DEBUG: Holiday context: ${holidayContext}`);
        
        // Generate video content using existing service with enhanced holiday-specific logging
        output = await generatePersonalizedContent(
          type,
          holiday.holiday_name, // Use holiday name as campaign title
          user.id,
          holidayContext // Pass enhanced holiday context
        );
        
        console.log(`🎬 VIDEO DEBUG: Generated output length: ${output?.length || 0}`);
        console.log(`🎬 VIDEO DEBUG: Generated output preview: ${output?.substring(0, 200)}...`);
        
        // Validate that the video script mentions the holiday
        if (output && !output.toLowerCase().includes(holiday.holiday_name.toLowerCase())) {
          console.warn(`🎬 VIDEO WARNING: Generated script may not be about ${holiday.holiday_name}`);
        }
      } else {
        // Generate other content types using existing service with holiday context
        const holidayContext = `${holiday.holiday_name} - ${holiday.garden_relevance || holiday.description || `Special ${holiday.holiday_name} content for garden centers`}`;
        
        output = await generatePersonalizedContent(
          type,
          holiday.holiday_name,
          user.id,
          holidayContext
        );
      }

      // Enhanced validation that content was generated
      if (!output || output.trim() === '' || output.trim().length < 10) {
        console.warn(`⚠️ ${type.toUpperCase()} DEBUG: Generated content is empty or too short`);
        console.warn(`⚠️ ${type.toUpperCase()} DEBUG: Raw output:`, output);
        results.push({ type, success: false, error: 'Empty or insufficient content returned' });
        continue;
      }

      console.log(`✅ ${type.toUpperCase()} DEBUG: Content generated successfully, length: ${output.length}`);

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
        console.log(`📊 ${type.toUpperCase()} DEBUG: Creating task with tenant_id: ${tenant.id}`);
      } else {
        taskData.user_id = user.id;
        console.log(`📊 ${type.toUpperCase()} DEBUG: Creating task with user_id: ${user.id}`);
      }

      console.log(`📊 ${type.toUpperCase()} DEBUG: Task data before insert:`, taskData);

      const { data: task, error } = await supabase
        .from('content_tasks')
        .insert(taskData)
        .select()
        .single();

      if (error) {
        console.error(`❌ ${type.toUpperCase()} DEBUG: Database error creating task:`, error);
        console.error(`❌ ${type.toUpperCase()} DEBUG: Failed task data:`, taskData);
        results.push({ type, success: false, error: error.message });
      } else {
        console.log(`✅ ${type.toUpperCase()} DEBUG: Created task successfully:`, task.id);
        console.log(`✅ ${type.toUpperCase()} DEBUG: Task details:`, {
          id: task.id,
          post_type: task.post_type,
          status: task.status,
          ai_output_length: task.ai_output?.length,
          ai_output_preview: task.ai_output?.substring(0, 100)
        });
        results.push({ type, success: true, taskId: task.id });
      }

    } catch (error) {
      console.error(`❌ ${type.toUpperCase()} DEBUG: Exception during generation:`, error);
      console.error(`❌ ${type.toUpperCase()} DEBUG: Error details:`, {
        message: error.message,
        stack: error.stack,
        name: error.name
      });
      results.push({ type, success: false, error: error.message });
    }
  }

  // Call onTaskUpdate if provided to refresh the UI
  if (onTaskUpdate) {
    console.log('🔄 DEBUG: Calling onTaskUpdate to refresh UI');
    onTaskUpdate();
  }

  console.log(`🎉 Holiday content generation complete for ${holiday.holiday_name}:`, results);
  
  // Enhanced result logging
  const successCount = results.filter(r => r.success).length;
  const failureCount = results.filter(r => !r.success).length;
  console.log(`📊 SUMMARY: ${successCount} successful, ${failureCount} failed generations`);
  
  return results;
}

// Export individual content generation for backwards compatibility
export { generatePersonalizedContent };
