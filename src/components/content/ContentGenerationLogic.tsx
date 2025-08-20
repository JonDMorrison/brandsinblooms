
import { supabase } from "@/integrations/supabase/client";
import { showToast } from "@/utils/toastUtils";

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
              showToast.error(`Failed to create ${type} task: ${createError.message}`);
            } else {
              console.log(`✅ Created new ${type} task:`, newTask.id);
              tasksNeedingContent.push(newTask);
            }
          } catch (error) {
            console.error(`❌ Error creating ${type} task:`, error);
            showToast.error(`Failed to create ${type} task`);
          }
        }
      }

      if (tasksNeedingContent.length === 0) {
        console.log('✅ All tasks already have content');
        showToast.success('All content is already generated!');
        return true;
      }

      // Show progress toast
      showToast.info(`Generating content for ${tasksNeedingContent.length} tasks...`);

      // Use multichannel generation to avoid duplicates and ensure consistency
      const { data: tenantData } = await supabase
        .from('users')
        .select('tenant_id')
        .eq('id', userId)
        .single();

      if (!tenantData?.tenant_id) {
        showToast.error('Unable to verify workspace access');
        return false;
      }

      // Generate content using multichannel function
      const { data: generatedBundle, error: generateError } = await supabase.functions.invoke('generate-multichannel-content', {
        body: {
          mode: 'custom',
          userIdea: {
            title: campaignTitle,
            notes: `Generate content for existing campaign: ${campaignTitle}`
          },
          channels: ['newsletter', 'instagram', 'facebook', 'video', 'blog'],
          workspaceId: tenantData.tenant_id
        }
      });

      if (generateError) {
        console.error('❌ Error generating multichannel content:', generateError);
        showToast.error(`Failed to generate content: ${generateError.message}`);
        return false;
      }

      // Update existing tasks with generated content
      let updatedCount = 0;
      const failedTypes = [];

      for (const task of tasksNeedingContent) {
        try {
          const matchingContent = generatedBundle.items?.find(item => 
            (item.channel === 'blog' && task.post_type === 'blog') ||
            (item.channel === task.post_type)
          );

          if (matchingContent) {
            let contentToSave = '';
            
            if (task.post_type === 'newsletter') {
              contentToSave = matchingContent.body || '';
            } else if (task.post_type === 'video') {
              contentToSave = matchingContent.script || '';
            } else if (task.post_type === 'blog') {
              contentToSave = matchingContent.markdown || matchingContent.body || '';
            } else {
              contentToSave = matchingContent.caption || matchingContent.body || '';
            }

            if (contentToSave) {
              const { error: updateError } = await supabase
                .from('content_tasks')
                .update({ 
                  ai_output: contentToSave,
                  status: 'review'
                })
                .eq('id', task.id);

              if (updateError) {
                console.error(`❌ Error updating ${task.post_type} task:`, updateError);
                failedTypes.push(task.post_type);
              } else {
                console.log(`✅ Updated ${task.post_type} task ${task.id}`);
                updatedCount++;
              }
            } else {
              console.warn(`⚠️ No content generated for ${task.post_type}`);
              failedTypes.push(task.post_type);
            }
          } else {
            console.warn(`⚠️ No matching content found for ${task.post_type}`);
            failedTypes.push(task.post_type);
          }
        } catch (error) {
          console.error(`❌ Error processing ${task.post_type} task:`, error);
          failedTypes.push(task.post_type);
        }
      }

      const result = {
        success: updatedCount > 0,
        generatedCount: updatedCount,
        failedTypes
      };
      
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
