
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { generateContentInParallel } from "./ParallelContentGenerator";

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
      
      // Create missing tasks first
      if (missingTypes.length > 0) {
        console.log('📋 Creating missing task types:', missingTypes);
        for (const type of missingTypes) {
          try {
            const { data: newTask, error: createError } = await supabase
              .from('content_tasks')
              .insert({
                campaign_id: campaignId,
                post_type: type,
                status: 'planned',
                scheduled_date: new Date().toISOString().split('T')[0],
                user_id: userId
              })
              .select()
              .single();

            if (createError) {
              console.error(`❌ Error creating ${type} task:`, createError);
              toast.error(`Failed to create ${type} task: ${createError.message}`);
            } else {
              console.log(`✅ Created new ${type} task:`, newTask.id);
              tasksNeedingContent.push(newTask);
            }
          } catch (error) {
            console.error(`❌ Error creating ${type} task:`, error);
            toast.error(`Failed to create ${type} task`);
          }
        }
      }

      if (tasksNeedingContent.length === 0) {
        console.log('✅ All tasks already have content');
        toast.success('All content is already generated!');
        return true;
      }

      // Show progress toast
      toast.info(`Generating content for ${tasksNeedingContent.length} tasks...`);

      // Use parallel generation for much faster content creation
      const result = await generateContentInParallel(
        campaignId, 
        campaignTitle, 
        tasksNeedingContent, 
        userId
      );
      
      if (result.success) {
        toast.success(`Successfully generated ${result.successCount} content pieces! ${result.failureCount > 0 ? `${result.failureCount} failed.` : ''}`);
      } else {
        toast.error(`Content generation failed: ${result.error || 'Unknown error'}`);
      }
      
      return result.success;
    } catch (error) {
      console.error('❌ Error in autoGenerateAllContent:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      toast.error(`Failed to generate content: ${errorMessage}`);
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
        toast.error(`Failed to fetch tasks: ${error.message}`);
        throw error;
      }

      console.log('📋 Found tasks:', tasks?.map(t => `${t.post_type}: ${t.ai_output ? 'HAS CONTENT' : 'MISSING CONTENT'}`));

      return await autoGenerateAllContent(campaignId, campaignTitle, tasks || [], userId);
    } catch (error) {
      console.error('❌ Error in generateMissingContent:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      toast.error(`Failed to generate missing content: ${errorMessage}`);
      return false;
    }
  };

  return { autoGenerateAllContent, generateMissingContent };
};
