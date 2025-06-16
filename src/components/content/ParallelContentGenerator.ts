
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { generatePersonalizedContent, generateNewsletterContent, generateVideoScript } from "../homepage/ContentGenerationServices";

interface ContentGenerationTask {
  taskId: string;
  postType: string;
  tokens: number;
}

interface ParallelGenerationResult {
  success: boolean;
  generatedCount: number;
  failedTypes: string[];
  totalTime: number;
}

export const generateContentInParallel = async (
  campaignId: string,
  campaignTitle: string,
  tasksNeedingContent: any[],
  userId: string,
  weekDescription?: string
): Promise<ParallelGenerationResult> => {
  console.log('🚀 Starting parallel content generation for', tasksNeedingContent.length, 'tasks');
  const startTime = Date.now();
  
  // Check token balance first
  const { data: tokenBalance, error: balanceError } = await supabase.rpc('get_token_balance', {
    p_user_id: userId
  });

  if (balanceError) {
    console.error('❌ Error checking token balance:', balanceError);
    toast.error('Failed to check token balance');
    return { success: false, generatedCount: 0, failedTypes: [], totalTime: 0 };
  }

  const balance = tokenBalance && tokenBalance.length > 0 ? tokenBalance[0] : null;
  if (!balance) {
    toast.error('Unable to verify token balance');
    return { success: false, generatedCount: 0, failedTypes: [], totalTime: 0 };
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
      return { success: false, generatedCount: 0, failedTypes: [], totalTime: 0 };
    }
  }

  // Create parallel generation promises
  const generationPromises = tasksNeedingContent.map(async (task) => {
    try {
      console.log(`🤖 Starting ${task.post_type} generation for task:`, task.id);
      
      // Update task status to generating
      await supabase
        .from('content_tasks')
        .update({ status: 'generating' })
        .eq('id', task.id);

      let generatedContent = '';
      
      // Spend tokens for this specific generation
      const tokensToSpend = (task.post_type === 'newsletter' || task.post_type === 'video') ? 2 : 1;
      
      const { error: tokenError } = await supabase.rpc('spend_tokens', {
        p_user_id: userId,
        p_tokens: tokensToSpend,
        p_action_type: 'generation',
        p_content_type: task.post_type
      });

      if (tokenError) {
        throw new Error(`Token spending failed: ${tokenError.message}`);
      }
      
      if (task.post_type === 'newsletter') {
        generatedContent = await generateNewsletterContent(campaignId, campaignTitle, 1, userId, weekDescription);
      } else if (task.post_type === 'video') {
        generatedContent = await generateVideoScript(campaignTitle, userId, weekDescription);
      } else {
        generatedContent = await generatePersonalizedContent(task.post_type, campaignTitle, userId, weekDescription);
      }
      
      console.log(`✅ Generated ${task.post_type} content (${generatedContent.length} chars)`);
      
      // Validate content before updating
      if (!generatedContent || generatedContent.trim() === '') {
        throw new Error(`Generated content is empty for ${task.post_type}`);
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
      
      return { 
        taskId: task.id, 
        postType: task.post_type, 
        success: true, 
        content: generatedContent 
      };
      
    } catch (error) {
      console.error(`❌ Error generating ${task.post_type} content for task ${task.id}:`, error);
      
      // Reset task status to planned on error
      await supabase
        .from('content_tasks')
        .update({ status: 'planned' })
        .eq('id', task.id);
        
      return { 
        taskId: task.id, 
        postType: task.post_type, 
        success: false, 
        error: error.message 
      };
    }
  });

  // Wait for all generations to complete in parallel
  const results = await Promise.allSettled(generationPromises);
  
  // Process results with proper type checking
  const successfulResults = results
    .filter((result): result is PromiseFulfilledResult<any> => 
      result.status === 'fulfilled' && result.value.success
    )
    .map(result => result.value);
    
  const failedResults = results
    .map(result => {
      if (result.status === 'fulfilled' && !result.value.success) {
        return result.value.postType;
      } else if (result.status === 'rejected') {
        return 'unknown';
      }
      return null;
    })
    .filter(Boolean);

  const totalTime = Date.now() - startTime;
  const generatedCount = successfulResults.length;
  
  console.log(`🎯 Parallel generation completed in ${totalTime}ms: ${generatedCount}/${tasksNeedingContent.length} successful`);
  
  if (generatedCount > 0) {
    const message = generatedCount === tasksNeedingContent.length 
      ? `🎉 Generated ${generatedCount} pieces of content in ${Math.round(totalTime/1000)}s!`
      : `⚠️ Generated ${generatedCount}/${tasksNeedingContent.length} pieces of content. ${failedResults.length} failed.`;
    
    toast.success(message);
  } else {
    toast.error('Failed to generate any content. Please try again.');
  }

  if (willGoIntoOverage && overageAmount > 0) {
    toast.info(`Overage charge: $${overageCost.toFixed(2)}`);
  }
  
  return {
    success: generatedCount > 0,
    generatedCount,
    failedTypes: failedResults,
    totalTime
  };
};
