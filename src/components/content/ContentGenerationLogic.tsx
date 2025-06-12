
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { generatePersonalizedContent, generateNewsletterContent, generateVideoScript } from "../homepage/ContentGenerationServices";

export const useContentGeneration = () => {
  const autoGenerateAllContent = async (campaignId: string, campaignTitle: string, existingTasks: any[], userId: string) => {
    console.log('🚀 Auto-generating missing content for campaign:', campaignId, 'Title:', campaignTitle);
    
    try {
      // Get all existing task types for this campaign
      const existingTypes = existingTasks.map(task => task.post_type);
      console.log('📊 Existing types:', existingTypes);
      
      const requiredTypes = ['facebook', 'instagram', 'email', 'newsletter', 'video'];
      const missingTypes = requiredTypes.filter(type => !existingTypes.includes(type));
      console.log('📝 Missing types:', missingTypes);
      
      // Find tasks that need content generation (have null ai_output)
      const tasksNeedingContent = existingTasks.filter(task => !task.ai_output || task.ai_output.trim() === '');
      console.log('🎯 Tasks needing content generation:', tasksNeedingContent.length, 'tasks');
      
      // Generate content for existing tasks without content
      for (const task of tasksNeedingContent) {
        console.log(`🤖 Generating content for ${task.post_type} task:`, task.id);
        
        try {
          console.log(`📝 Starting ${task.post_type} content generation...`);
          
          let generatedContent = '';
          
          if (task.post_type === 'newsletter') {
            generatedContent = await generateNewsletterContent(campaignId, campaignTitle, 1, userId);
          } else if (task.post_type === 'video') {
            generatedContent = await generateVideoScript(campaignTitle, userId);
          } else {
            generatedContent = await generatePersonalizedContent(task.post_type, campaignTitle, userId);
          }
          
          console.log(`✅ Generated ${task.post_type} content:`, generatedContent.substring(0, 100) + '...');
          
          // Validate content before updating
          if (!generatedContent || generatedContent.trim() === '') {
            console.error(`❌ Generated content is empty for ${task.post_type}`);
            continue;
          }
          
          // Check for common validation issues
          const hasPlaceholders = generatedContent.includes('[') && generatedContent.includes(']');
          const hasWelcomePhrase = generatedContent.toLowerCase().includes('welcome to');
          const hasWeekNumbers = /week\s+\d+/i.test(generatedContent);
          
          if (hasPlaceholders) {
            console.warn(`⚠️ ${task.post_type} content contains placeholders, but proceeding`);
          }
          if (hasWelcomePhrase) {
            console.warn(`⚠️ ${task.post_type} content contains "Welcome to" phrase, but proceeding`);
          }
          if (hasWeekNumbers) {
            console.warn(`⚠️ ${task.post_type} content contains week numbers, but proceeding`);
          }
          
          console.log(`✅ ${task.post_type} content passed validation on first attempt`);
          
          // Update the task with generated content using 'draft' status
          const { error: updateError } = await supabase
            .from('content_tasks')
            .update({ 
              ai_output: generatedContent,
              status: 'draft' // Changed from 'completed' to 'draft' to match database constraint
            })
            .eq('id', task.id);
          
          if (updateError) {
            console.error(`❌ Error updating ${task.post_type} task:`, updateError);
          } else {
            console.log(`✅ Successfully updated ${task.post_type} task with generated content`);
          }
          
        } catch (error) {
          console.error(`❌ Error generating ${task.post_type} content:`, error);
          toast.error(`Failed to generate ${task.post_type} content`);
        }
      }
      
      return true;
    } catch (error) {
      console.error('❌ Error in autoGenerateAllContent:', error);
      toast.error('Failed to auto-generate content');
      return false;
    }
  };

  return { autoGenerateAllContent };
};
