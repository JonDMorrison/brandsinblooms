
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
          const { data: newTask, error: createError } = await supabase
            .from('content_tasks')
            .insert({
              campaign_id: campaignId,
              post_type: type,
              status: 'planned',
              scheduled_date: new Date().toISOString().split('T')[0]
            })
            .select()
            .single();

          if (createError) {
            console.error(`❌ Error creating ${type} task:`, createError);
          } else {
            console.log(`✅ Created new ${type} task:`, newTask.id);
            tasksNeedingContent.push(newTask);
          }
        }
      }

      if (tasksNeedingContent.length === 0) {
        console.log('✅ All tasks already have content');
        return true;
      }

      // Use parallel generation for much faster content creation
      const result = await generateContentInParallel(
        campaignId, 
        campaignTitle, 
        tasksNeedingContent, 
        userId
      );
      
      return result.success;
    } catch (error) {
      console.error('❌ Error in autoGenerateAllContent:', error);
      toast.error('Failed to auto-generate content');
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
        throw error;
      }

      console.log('📋 Found tasks:', tasks?.map(t => `${t.post_type}: ${t.ai_output ? 'HAS CONTENT' : 'MISSING CONTENT'}`));

      return await autoGenerateAllContent(campaignId, campaignTitle, tasks || [], userId);
    } catch (error) {
      console.error('❌ Error in generateMissingContent:', error);
      toast.error('Failed to generate missing content');
      return false;
    }
  };

  return { autoGenerateAllContent, generateMissingContent };
};
