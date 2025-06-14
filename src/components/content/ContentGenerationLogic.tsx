
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { generatePersonalizedContent, generateNewsletterContent, generateVideoScript } from "../homepage/ContentGenerationServices";

export const useContentGeneration = () => {
  const autoGenerateAllContent = async (campaignId: string, campaignTitle: string, existingTasks: any[], userId: string) => {
    console.log('🚀 Auto-generating missing content for campaign:', campaignId, 'Title:', campaignTitle);
    
    try {
      // Check token balance before starting
      const { data: tokenBalance, error: balanceError } = await supabase.rpc('get_token_balance', {
        p_user_id: userId
      });

      if (balanceError) {
        console.error('❌ Error checking token balance:', balanceError);
        toast.error('Failed to check token balance');
        return false;
      }

      const balance = tokenBalance && tokenBalance.length > 0 ? tokenBalance[0] : null;
      if (!balance) {
        toast.error('Unable to verify token balance');
        return false;
      }

      // Get all existing task types for this campaign
      const existingTypes = existingTasks.map(task => task.post_type);
      console.log('📊 Existing types:', existingTypes);
      
      const requiredTypes = ['facebook', 'instagram', 'email', 'newsletter', 'video'];
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

      // Calculate total tokens needed
      const totalTokensNeeded = tasksNeedingContent.reduce((total, task) => {
        if (task.post_type === 'newsletter' || task.post_type === 'video') {
          return total + 2; // Complex content types cost 2 tokens
        }
        return total + 1; // Simple content types cost 1 token
      }, 0);

      console.log(`💰 Total tokens needed: ${totalTokensNeeded}, Current balance: ${balance.tokens_balance}`);

      // Check if user has enough tokens or if they'll go into overage
      const willGoIntoOverage = balance.tokens_balance < totalTokensNeeded;
      const overageAmount = willGoIntoOverage ? totalTokensNeeded - Math.max(0, balance.tokens_balance) : 0;
      const overageCost = overageAmount * 0.25;

      if (willGoIntoOverage) {
        const proceed = window.confirm(
          `This will generate ${tasksNeedingContent.length} pieces of content requiring ${totalTokensNeeded} tokens.\n\n` +
          `Current balance: ${Math.max(0, balance.tokens_balance)} tokens\n` +
          `Overage: ${overageAmount} tokens (+$${overageCost.toFixed(2)})\n\n` +
          `Do you want to proceed?`
        );
        
        if (!proceed) {
          toast.info('Content generation cancelled');
          return false;
        }
      }

      // Generate content for existing tasks without content
      let successCount = 0;
      let failureCount = 0;
      
      for (const task of tasksNeedingContent) {
        console.log(`🤖 Generating content for ${task.post_type} task:`, task.id);
        
        try {
          // Update task status to generating
          await supabase
            .from('content_tasks')
            .update({ status: 'generating' })
            .eq('id', task.id);

          console.log(`📝 Starting ${task.post_type} content generation...`);
          
          let generatedContent = '';
          
          if (task.post_type === 'newsletter') {
            generatedContent = await generateNewsletterContent(campaignId, campaignTitle, 1, userId);
          } else if (task.post_type === 'video') {
            generatedContent = await generateVideoScript(campaignTitle, userId);
          } else {
            generatedContent = await generatePersonalizedContent(task.post_type, campaignTitle, userId);
          }
          
          console.log(`✅ Generated ${task.post_type} content (${generatedContent.length} chars):`, generatedContent.substring(0, 100) + '...');
          
          // Validate content before updating
          if (!generatedContent || generatedContent.trim() === '') {
            throw new Error(`Generated content is empty for ${task.post_type}`);
          }
          
          // Check for common validation issues but continue anyway
          const hasPlaceholders = generatedContent.includes('[') && generatedContent.includes(']');
          const hasWelcomePhrase = generatedContent.toLowerCase().includes('welcome to');
          const hasWeekNumbers = /week\s+\d+/i.test(generatedContent);
          
          if (hasPlaceholders) {
            console.warn(`⚠️ ${task.post_type} content contains placeholders:`, generatedContent.match(/\[.*?\]/g));
          }
          if (hasWelcomePhrase) {
            console.warn(`⚠️ ${task.post_type} content contains "Welcome to" phrase`);
          }
          if (hasWeekNumbers) {
            console.warn(`⚠️ ${task.post_type} content contains week numbers`);
          }
          
          // Update the task with generated content using 'review' status
          const { error: updateError } = await supabase
            .from('content_tasks')
            .update({ 
              ai_output: generatedContent,
              status: 'review'
            })
            .eq('id', task.id);
          
          if (updateError) {
            throw updateError;
          }
          
          console.log(`✅ Successfully updated ${task.post_type} task ${task.id} with generated content`);
          successCount++;
          
        } catch (error) {
          console.error(`❌ Error generating ${task.post_type} content for task ${task.id}:`, error);
          
          // Reset task status to planned on error
          await supabase
            .from('content_tasks')
            .update({ status: 'planned' })
            .eq('id', task.id);
            
          failureCount++;
          toast.error(`Failed to generate ${task.post_type} content: ${error.message}`);
        }
      }
      
      const message = `Generated ${successCount}/${tasksNeedingContent.length} content pieces successfully`;
      if (failureCount > 0) {
        toast.warning(`${message}. ${failureCount} failed.`);
      } else {
        toast.success(message);
      }
      
      if (willGoIntoOverage && overageAmount > 0) {
        toast.info(`Overage charge: $${overageCost.toFixed(2)}`);
      }
      
      return successCount > 0;
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
