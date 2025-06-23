
import { supabase } from "@/integrations/supabase/client";
import { generateStructuredNewsletter } from "./StructuredNewsletterService";
import { buildHolidayContentPrompt, validateHolidayContent } from "./HolidayPromptBuilder";
import { attachImagesToTask } from "@/services/contentGenerationHelpers";

const contentTypes = ['instagram', 'facebook', 'blog', 'video', 'newsletter'];

export async function generateHolidayContent(
  user: any, 
  holiday: any, 
  tenant?: any,
  onTaskUpdate?: () => void
) {
  console.log(`🎉 Generating holiday content for: ${holiday.holiday_name}`);
  
  const results = [];
  
  // Get company profile for enhanced context
  let companyProfile = null;
  if (user?.id) {
    const { data: profileData } = await supabase
      .from('company_profiles')
      .select('*')
      .eq('user_id', user.id)
      .single();
    companyProfile = profileData;
  }
  
  for (const type of contentTypes) {
    try {
      console.log(`📝 Starting ${type} content generation for holiday: ${holiday.holiday_name}`);
      
      let output = '';
      let attempts = 0;
      const maxAttempts = type === 'instagram' ? 3 : 2; // More attempts for Instagram to ensure quality

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
      } else {
        // Use enhanced holiday-specific prompts for all other content types
        do {
          attempts++;
          console.log(`🎯 ${type.toUpperCase()} DEBUG: Attempt ${attempts} for ${holiday.holiday_name}`);
          
          if (type === 'video') {
            console.log(`🎬 VIDEO DEBUG: About to generate video script for holiday: ${holiday.holiday_name}`);
            
            // Build holiday-specific context for video
            const holidayContext = buildHolidayContentPrompt('video', holiday, companyProfile);
            
            console.log(`🎬 VIDEO DEBUG: Holiday context built`);
            
            // Generate video content using existing service with enhanced holiday context
            output = await generatePersonalizedContentWithHolidayPrompt(
              type,
              holiday.holiday_name,
              user.id,
              holidayContext,
              companyProfile
            );
            
            console.log(`🎬 VIDEO DEBUG: Generated output length: ${output?.length || 0}`);
          } else {
            // Generate content using holiday-specific prompts
            output = await generatePersonalizedContentWithHolidayPrompt(
              type,
              holiday.holiday_name,
              user.id,
              buildHolidayContentPrompt(type, holiday, companyProfile),
              companyProfile
            );
          }

          // Validate holiday content quality (especially for Instagram)
          if (type === 'instagram' && output) {
            const validation = validateHolidayContent(output, holiday);
            console.log(`📸 INSTAGRAM VALIDATION: Quality: ${validation.quality}, Issues: ${validation.issues.length}`);
            
            if (validation.quality === 'weak' && attempts < maxAttempts) {
              console.log(`📸 INSTAGRAM DEBUG: Regenerating due to weak quality - attempt ${attempts + 1}`);
              continue; // Try again
            }
            
            if (validation.issues.length > 0) {
              console.warn(`📸 INSTAGRAM DEBUG: Content issues:`, validation.issues);
            }
          }
          
          break; // Content is acceptable
        } while (attempts < maxAttempts);
      }

      // Enhanced validation that content was generated
      if (!output || output.trim() === '' || output.trim().length < 10) {
        console.warn(`⚠️ ${type.toUpperCase()} DEBUG: Generated content is empty or too short`);
        console.warn(`⚠️ ${type.toUpperCase()} DEBUG: Raw output:`, output);
        results.push({ type, success: false, error: 'Empty or insufficient content returned' });
        continue;
      }

      console.log(`✅ ${type.toUpperCase()} DEBUG: Content generated successfully, length: ${output.length}, attempts: ${attempts}`);

      // Create task data structure
      const taskData: any = {
        holiday_id: holiday.id,
        post_type: type,
        ai_output: output,
        status: 'review',
        scheduled_date: holiday.holiday_date,
        notes: `Generated for ${holiday.holiday_name} (${attempts} attempts)`,
        holidays: holiday // Include holiday data for image attachment
      };

      // Attach smart images to the task
      console.log(`🖼️ ${type.toUpperCase()} DEBUG: Attaching smart images`);
      await attachImagesToTask(taskData);

      // CRITICAL: Always set tenant_id for holiday tasks to ensure they appear in Ready to Post
      if (tenant?.id) {
        taskData.tenant_id = tenant.id;
        taskData.created_by_user_id = user.id;
        console.log(`📊 ${type.toUpperCase()} DEBUG: Creating task with tenant_id: ${tenant.id}`);
      } else {
        // Fallback: try to get tenant from user if not provided
        const { data: userTenant } = await supabase
          .from('tenants')
          .select('id')
          .limit(1)
          .single();
        
        if (userTenant) {
          taskData.tenant_id = userTenant.id;
          taskData.created_by_user_id = user.id;
          console.log(`📊 ${type.toUpperCase()} DEBUG: Using fallback tenant_id: ${userTenant.id}`);
        } else {
          taskData.user_id = user.id;
          console.log(`📊 ${type.toUpperCase()} DEBUG: Creating task with user_id: ${user.id}`);
        }
      }

      console.log(`📊 ${type.toUpperCase()} DEBUG: Task data before insert:`, {
        ...taskData,
        ai_output_length: taskData.ai_output?.length,
        has_image: !!taskData.image
      });

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
          tenant_id: task.tenant_id,
          ai_output_length: task.ai_output?.length,
          has_image: !!task.image,
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

// New function for holiday-specific content generation
async function generatePersonalizedContentWithHolidayPrompt(
  postType: string,
  campaignTitle: string,
  userId: string,
  holidayPrompt: string,
  companyProfile: any
): Promise<string> {
  console.log(`🔧 HOLIDAY_CONTENT DEBUG: Generating ${postType} with holiday-specific prompt`);
  
  try {
    const { data, error } = await supabase.functions.invoke('generate-content', {
      body: {
        postType,
        campaignTitle,
        userId,
        campaignDescription: '', // Not used since we're providing a complete prompt
        customPrompt: holidayPrompt, // Pass the holiday-specific prompt
        enforceCompanyName: true
      }
    });

    if (error) {
      console.error(`🔧 HOLIDAY_CONTENT ERROR: Supabase function error:`, error);
      throw new Error(`Holiday content generation failed: ${error.message}`);
    }

    if (!data?.content) {
      console.error(`🔧 HOLIDAY_CONTENT ERROR: No content returned`);
      throw new Error('No holiday content generated');
    }

    console.log(`🔧 HOLIDAY_CONTENT DEBUG: Generated successfully, length: ${data.content.length}`);
    return data.content;
  } catch (error) {
    console.error(`🔧 HOLIDAY_CONTENT ERROR: Exception:`, error);
    throw error;
  }
}

// Export individual content generation for backwards compatibility
export { generatePersonalizedContent } from "./ContentGenerationServices";
