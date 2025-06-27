
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
          }
          
          // Generate content using holiday-specific prompts via edge function
          const holidayPrompt = buildHolidayContentPrompt(type, holiday, companyProfile);
          
          const { data, error } = await supabase.functions.invoke('generate-content', {
            body: {
              postType: type,
              campaignTitle: holiday.holiday_name,
              userId: user.id,
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

          output = data.content;
          console.log(`🔧 HOLIDAY_CONTENT DEBUG: Generated successfully, length: ${output.length}`);

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

      // Get image for this task using the helper function
      console.log(`🖼️ ${type.toUpperCase()} DEBUG: Fetching smart image`);
      const imageData = await attachImagesToTask(null, holiday.holiday_name);

      // Create task data structure using attachments JSONB field for image data
      const taskData: any = {
        holiday_id: holiday.id,
        post_type: type,
        ai_output: output,
        status: 'review',
        scheduled_date: holiday.holiday_date,
        notes: `Generated for ${holiday.holiday_name} (${attempts} attempts)`,
        attachments: imageData?.image ? JSON.stringify({ image: imageData.image }) : null
      };

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

      // Validate required fields before database insertion
      if (!taskData.holiday_id || !taskData.post_type || !taskData.ai_output || !taskData.tenant_id) {
        console.error(`❌ ${type.toUpperCase()} DEBUG: Missing required fields:`, {
          holiday_id: !!taskData.holiday_id,
          post_type: !!taskData.post_type,
          ai_output: !!taskData.ai_output,
          tenant_id: !!taskData.tenant_id
        });
        results.push({ type, success: false, error: 'Missing required task fields' });
        continue;
      }

      console.log(`📊 ${type.toUpperCase()} DEBUG: Task data before insert:`, {
        ...taskData,
        ai_output_length: taskData.ai_output?.length,
        has_attachments: !!taskData.attachments
      });

      const { data: task, error } = await supabase
        .from('content_tasks')
        .insert(taskData)
        .select()
        .single();

      if (error) {
        console.error(`❌ ${type.toUpperCase()} DEBUG: Database error creating task:`, error);
        console.error(`❌ ${type.toUpperCase()} DEBUG: Error details:`, {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        });
        console.error(`❌ ${type.toUpperCase()} DEBUG: Failed task data:`, taskData);
        results.push({ type, success: false, error: `Database error: ${error.message}` });
      } else {
        console.log(`✅ ${type.toUpperCase()} DEBUG: Created task successfully:`, task.id);
        console.log(`✅ ${type.toUpperCase()} DEBUG: Task details:`, {
          id: task.id,
          post_type: task.post_type,
          status: task.status,
          tenant_id: task.tenant_id,
          ai_output_length: task.ai_output?.length,
          has_image_data: !!taskData.attachments,
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
export { generatePersonalizedContent } from "./ContentGenerationServices";
