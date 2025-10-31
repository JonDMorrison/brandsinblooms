
import { supabase } from "@/integrations/supabase/client";
import { showToast } from "@/utils/toastUtils";
import { generateContentInParallel } from "./ParallelContentGenerator";
import { filterOutExistingTypes, createTaskIfNotExists } from "@/utils/duplicateContentPrevention";

export const useContentGeneration = () => {
  const autoGenerateAllContent = async (campaignId: string, campaignTitle: string, existingTasks: any[], userId: string) => {
    console.log('🚀 Auto-generating missing content for campaign:', campaignId, 'Title:', campaignTitle);
    
    try {
      // Get all existing task types for this campaign
      const existingTypes = existingTasks.map(task => task.post_type);
      console.log('📊 Existing types:', existingTypes);
      
      // UPDATED: Standardized content types - replaced email with blog
      const requiredTypes = ['facebook', 'instagram', 'newsletter', 'blog', 'video'];
      const missingTypes = requiredTypes.filter(type => !existingTypes.includes(type));
      console.log('📝 Missing types that need new tasks:', missingTypes);
      
      // Find tasks that need content generation (have null ai_output)
      const tasksNeedingContent = existingTasks.filter(task => !task.ai_output || task.ai_output.trim() === '');
      console.log('🎯 Existing tasks needing content generation:', tasksNeedingContent.length, 'tasks');
      console.log('🔍 Tasks needing content:', tasksNeedingContent.map(t => `${t.post_type} (${t.id})`));
      
      // Filter out types that already exist (double-check for duplicates)
      const actuallyMissingTypes = await filterOutExistingTypes(campaignId, missingTypes, userId);
      
      // Create missing tasks first
      if (actuallyMissingTypes.length > 0) {
        console.log('📋 Creating missing task types:', actuallyMissingTypes);
        
        for (const type of actuallyMissingTypes) {
          try {
            const result = await createTaskIfNotExists({
              campaign_id: campaignId,
              post_type: type,
              status: 'planned',
              scheduled_date: new Date().toISOString().split('T')[0],
              user_id: userId
            });

            if (!result.success) {
              console.error(`❌ Error creating ${type} task`);
              showToast.error(`Failed to create ${type} task`);
            } else if (!result.existed) {
              console.log(`✅ Created new ${type} task:`, result.taskId);
              
              // Fetch the newly created task to add to tasksNeedingContent
              const { data: newTask } = await supabase
                .from('content_tasks')
                .select()
                .eq('id', result.taskId)
                .single();
              
              if (newTask) {
                tasksNeedingContent.push(newTask);
              }
            } else {
              console.log(`ℹ️ Task ${type} already exists, skipping creation`);
            }
          } catch (error) {
            console.error(`❌ Error creating ${type} task:`, error);
            showToast.error(`Failed to create ${type} task`);
          }
        }
      } else if (missingTypes.length > 0) {
        console.log('ℹ️ All "missing" types already exist after duplicate check');
      }

      if (tasksNeedingContent.length === 0) {
        console.log('✅ All tasks already have content');
        showToast.success('All content is already generated!');
        return true;
      }

      // Show progress toast
      showToast.info(`Generating content for ${tasksNeedingContent.length} tasks...`);

      // Use parallel generation for much faster content creation
      const result = await generateContentInParallel(
        campaignId, 
        campaignTitle, 
        tasksNeedingContent, 
        userId
      );
      
      if (result.success) {
        showToast.success(`Successfully generated ${result.generatedCount} content pieces! ${result.failedTypes.length > 0 ? `${result.failedTypes.length} failed.` : ''}`);
      } else {
        showToast.error(`Content generation failed. Please try again.`);
      }
      
      return result.success;
    } catch (error) {
      console.error('❌ Error in autoGenerateAllContent:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      showToast.error(`Failed to generate content: ${errorMessage}`);
      return false;
    }
  };

  const generateMissingContent = async (campaignId: string, campaignTitle: string, userId: string) => {
    console.log('🔄 Checking for missing content in campaign:', campaignId);
    
    try {
      // Fetch all tasks for this campaign
      const { data: tasks, error } = await supabase
        .from('content_tasks')
        .select('*')
        .eq('campaign_id', campaignId);

      if (error) {
        console.error('❌ Error fetching tasks:', error);
        showToast.error(`Failed to fetch tasks: ${error.message}`);
        throw error;
      }

      console.log('📋 Found tasks:', tasks?.map(t => `${t.post_type}: ${t.ai_output ? 'HAS CONTENT' : 'MISSING CONTENT'}`));

      return await autoGenerateAllContent(campaignId, campaignTitle, tasks || [], userId);
    } catch (error) {
      console.error('❌ Error in generateMissingContent:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      showToast.error(`Failed to generate missing content: ${errorMessage}`);
      return false;
    }
  };

  return { autoGenerateAllContent, generateMissingContent };
};
