
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { generatePersonalizedContent, generateNewsletterContent, generateVideoScript } from "@/components/homepage/ContentGenerationServices";
import { getHashtagsForType, getImageIdeaForType } from "./ContentViewerUtils";
import { ContentValidator } from "./ContentValidator";

export const useContentGeneration = () => {
  const autoGenerateAllContent = async (campaignId: string, campaignTitle: string, existingTasks: any[], userId: string) => {
    if (!userId) {
      console.log('No user found, skipping auto-generation');
      return;
    }

    console.log('🚀 Auto-generating missing content for campaign:', campaignId, 'Title:', campaignTitle);

    try {
      // Check what content types already exist
      const existingTypes = existingTasks?.map(t => t.post_type) || [];
      const allTypes = ['facebook', 'instagram', 'email', 'newsletter', 'video'];
      const missingTypes = allTypes.filter(type => !existingTypes.includes(type));

      console.log('📊 Existing types:', existingTypes);
      console.log('📝 Missing types:', missingTypes);

      // Create tasks for missing types
      if (missingTypes.length > 0) {
        const today = new Date();
        const tasksToCreate = [];

        for (let i = 0; i < missingTypes.length; i++) {
          const postType = missingTypes[i];
          const scheduledDate = new Date(today);
          scheduledDate.setDate(today.getDate() + i + 1);

          tasksToCreate.push({
            campaign_id: campaignId,
            post_type: postType,
            status: 'planned',
            scheduled_date: scheduledDate.toISOString().split('T')[0],
          });
        }

        console.log('✅ Creating missing tasks:', tasksToCreate);

        // Insert the missing tasks
        const { data: createdTasks, error: insertError } = await supabase
          .from('content_tasks')
          .insert(tasksToCreate)
          .select();

        if (insertError) {
          console.error('❌ Error creating tasks:', insertError);
          throw new Error('Failed to create content tasks');
        }

        console.log('✅ Created tasks:', createdTasks);
      }

      // Now generate content for all tasks without content
      const { data: allTasks, error: allTasksError } = await supabase
        .from('content_tasks')
        .select('*')
        .eq('campaign_id', campaignId)
        .is('ai_output', null);

      if (allTasksError) {
        console.error('❌ Error fetching tasks for generation:', allTasksError);
        throw new Error('Failed to fetch tasks for content generation');
      }

      console.log('🎯 Tasks needing content generation:', allTasks?.length || 0, 'tasks');

      // Generate content for each task with validation
      for (const task of allTasks || []) {
        console.log(`🤖 Generating content for ${task.post_type} task:`, task.id);

        try {
          // Update status to generating
          await supabase
            .from('content_tasks')
            .update({ status: 'generating' })
            .eq('id', task.id);

          let aiOutput = '';
          let validationAttempts = 1;

          console.log(`📝 Starting ${task.post_type} content generation...`);

          // Generate content based on type with validation
          if (task.post_type === 'newsletter') {
            aiOutput = await generateNewsletterContent(
              campaignId, 
              campaignTitle, 
              Math.ceil(Date.now() / (7 * 24 * 60 * 60 * 1000)), // rough week number
              userId
            );
          } else if (task.post_type === 'video') {
            aiOutput = await generateVideoScript(campaignTitle, userId);
          } else {
            aiOutput = await generatePersonalizedContent(
              task.post_type, 
              campaignTitle, 
              userId
            );
          }

          console.log(`✅ Generated ${task.post_type} content:`, aiOutput?.substring(0, 100) + '...');

          // Validate the generated content
          const validation = ContentValidator.validate(aiOutput);
          
          if (!validation.isValid) {
            console.warn(`⚠️ Generated ${task.post_type} content failed validation:`, validation.issues);
            
            // Try to regenerate with validation feedback
            const regenerateFunction = async () => {
              console.log(`🔄 Regenerating ${task.post_type} content due to validation issues...`);
              if (task.post_type === 'newsletter') {
                return await generateNewsletterContent(campaignId, campaignTitle, Math.ceil(Date.now() / (7 * 24 * 60 * 60 * 1000)), userId);
              } else if (task.post_type === 'video') {
                return await generateVideoScript(campaignTitle, userId);
              } else {
                return await generatePersonalizedContent(task.post_type, campaignTitle, userId);
              }
            };
            
            const validatedResult = await ContentValidator.validateAndRegenerate(
              aiOutput,
              regenerateFunction,
              3
            );
            
            aiOutput = validatedResult.content;
            validationAttempts = validatedResult.attempts;
            
            if (validatedResult.issues.length > 0) {
              console.warn(`⚠️ Content still has validation issues after ${validationAttempts} attempts:`, validatedResult.issues);
              toast.warning(`${task.post_type} content generated with minor validation issues`);
            }
          } else {
            console.log(`✅ ${task.post_type} content passed validation on first attempt`);
          }

          // Update task with generated content
          const { error: updateError } = await supabase
            .from('content_tasks')
            .update({ 
              ai_output: aiOutput,
              status: 'ready_to_post',
              hashtags: getHashtagsForType(task.post_type),
              image_idea: getImageIdeaForType(task.post_type)
            })
            .eq('id', task.id);

          if (updateError) {
            console.error(`❌ Error updating ${task.post_type} task:`, updateError);
          } else {
            console.log(`✅ Successfully generated ${task.post_type} content (${validationAttempts} attempts)`);
          }

        } catch (contentError) {
          console.error(`❌ Error generating ${task.post_type} content:`, contentError);
          
          // Reset status back to planned if generation fails
          await supabase
            .from('content_tasks')
            .update({ status: 'planned' })
            .eq('id', task.id);
        }
      }

      if (missingTypes.length > 0 || (allTasks && allTasks.length > 0)) {
        toast.success(`Auto-generated content for ${campaignTitle}!`);
        return true;
      }

    } catch (error) {
      console.error('❌ Error in auto-generation:', error);
      toast.error('Failed to auto-generate content');
      return false;
    }
  };

  return { autoGenerateAllContent };
};
