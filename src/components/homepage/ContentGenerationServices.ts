
import { supabase } from "@/integrations/supabase/client";
import { generateStructuredNewsletter } from "./StructuredNewsletterService";
import { toast } from "sonner";

export const generatePersonalizedContent = async (postType: string, campaignTitle: string, userId?: string, weekDescription?: string) => {
  console.log(`🎯 Generating validated ${postType} content for: ${campaignTitle} with description: ${weekDescription}`);
  
  // Route newsletter requests to structured generator
  if (postType === 'newsletter') {
    console.log('📰 Routing newsletter request to structured generator');
    return await generateStructuredNewsletter(
      'temp-campaign-id', // This will be replaced with actual campaign ID when available
      campaignTitle,
      1, // Week number
      userId,
      weekDescription
    );
  }
  
  try {
    console.log('📡 About to call generate-content function with:', {
      postType: postType,
      campaignTitle: campaignTitle,
      userId: userId,
      weekDescription: weekDescription
    });

    const { data, error } = await supabase.functions.invoke('generate-content', {
      body: {
        postType: postType,
        campaignTheme: campaignTitle,
        campaignTitle: campaignTitle,
        weekDescription: weekDescription,
        userId: userId,
        enforceCompanyName: true
      }
    });

    console.log(`📨 Response from generate-content function:`, { data, error });

    if (error) {
      console.error(`❌ Error from generate-content function:`, error);
      throw new Error(`Content generation failed: ${error.message || 'Unknown error'}`);
    }

    if (!data) {
      throw new Error('No data returned from content generation function');
    }

    console.log('📋 Raw response data:', data);

    if (data.generationAttempts && data.generationAttempts > 1) {
      console.log(`✅ Content generated after ${data.generationAttempts} attempts with validation`);
    }
    
    if (data.validationPassed === false) {
      console.warn('⚠️ Content generated but validation concerns remain');
    }

    const content = data.content || data.generatedText;
    if (!content) {
      throw new Error('No content in response data');
    }

    console.log(`✅ Generated ${postType} content successfully (${content.length} chars):`, content.substring(0, 100) + '...');
    return content;
  } catch (error) {
    console.error(`❌ Error in generatePersonalizedContent for ${postType}:`, error);
    
    // Provide a fallback error message
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    throw new Error(`Failed to generate ${postType} content: ${errorMessage}`);
  }
};

export const generateVideoScript = async (campaignTitle: string, userId?: string, weekDescription?: string) => {
  console.log(`🎯 Generating video script for: ${campaignTitle} with description: ${weekDescription}`);
  
  try {
    console.log('📡 About to call generate-video-script function');

    const { data, error } = await supabase.functions.invoke('generate-video-script', {
      body: {
        campaignTitle: campaignTitle,
        weekDescription: weekDescription,
        userId: userId,
        enforceCompanyName: true
      }
    });

    console.log('📨 Response from generate-video-script function:', { data, error });

    if (error) {
      console.error('❌ Error generating video script:', error);
      throw new Error(`Video script generation failed: ${error.message || 'Unknown error'}`);
    }

    const script = data?.script || data?.generatedText;
    if (!script) {
      throw new Error('No video script returned');
    }

    console.log(`✅ Generated video script successfully (${script.length} chars):`, script.substring(0, 100) + '...');
    return script;
  } catch (error) {
    console.error('❌ Error in generateVideoScript:', error);
    throw error;
  }
};

export const generateNewsletterContent = async (campaignId: string, campaignTitle: string, weekNumber: number, userId?: string, weekDescription?: string) => {
  console.log(`🎯 Generating structured newsletter content for campaign: ${campaignTitle} (Week ${weekNumber}) with description: ${weekDescription}`);
  
  try {
    // Use the new structured newsletter generator
    const content = await generateStructuredNewsletter(
      campaignId,
      campaignTitle,
      weekNumber,
      userId,
      weekDescription
    );

    console.log(`✅ Generated structured newsletter content successfully`);
    return content;
  } catch (error) {
    console.error('❌ Error in generateNewsletterContent:', error);
    throw error;
  }
};

// Enhanced content generation with comprehensive error handling and retry logic
export const generateCampaignContent = async (
  campaignId: string,
  theme: string,
  description: string,
  userId: string,
  weekNumber?: number,
  tenantId?: string
) => {
  console.log(`🎯 generateCampaignContent: Starting for campaign ${campaignId}`);
  console.log(`🎯 Parameters:`, { theme, description, userId, weekNumber, tenantId: tenantId || 'none' });
  
  try {
    // Log content generation attempt
    await logContentGenerationAttempt(campaignId, userId, 'started', tenantId);
    
    // Get current month for the new edge function
    const currentMonth = new Date().toLocaleString('default', { month: 'long' });
    
    console.log('📡 Calling generate_campaign_content function with theme:', theme);
    
    // Retry mechanism for edge function calls
    let retryCount = 0;
    const maxRetries = 3;
    let lastError: any;
    
    while (retryCount < maxRetries) {
      try {
        const { data, error } = await supabase.functions.invoke('generate_campaign_content', {
          body: {
            theme: theme,
            month: currentMonth,
            tone: 'professional',
            channels: ['facebook', 'instagram', 'newsletter', 'blog', 'video'],
            campaignId: campaignId,
            userId: userId
          }
        });

        if (error) {
          console.error(`❌ Error from generate_campaign_content function (attempt ${retryCount + 1}):`, error);
          lastError = error;
          retryCount++;
          
          if (retryCount < maxRetries) {
            console.log(`⏳ Retrying in 2 seconds... (attempt ${retryCount + 1}/${maxRetries})`);
            await new Promise(resolve => setTimeout(resolve, 2000));
            continue;
          }
          throw new Error(`Campaign content generation failed after ${maxRetries} attempts: ${error.message || 'Unknown error'}`);
        }

        if (!data || !data.success) {
          console.error('❌ Function returned unsuccessful result:', data);
          lastError = new Error('Failed to generate campaign content');
          retryCount++;
          
          if (retryCount < maxRetries) {
            console.log(`⏳ Retrying in 2 seconds... (attempt ${retryCount + 1}/${maxRetries})`);
            await new Promise(resolve => setTimeout(resolve, 2000));
            continue;
          }
          throw new Error('Failed to generate campaign content');
        }

        // Success - break out of retry loop
        const generatedContent = data.content;
        console.log('📋 Generated campaign content keys:', Object.keys(generatedContent || {}));
        break;
        
      } catch (error) {
        console.error(`❌ Edge function call failed (attempt ${retryCount + 1}):`, error);
        lastError = error;
        retryCount++;
        
        if (retryCount < maxRetries) {
          console.log(`⏳ Retrying in 2 seconds... (attempt ${retryCount + 1}/${maxRetries})`);
          await new Promise(resolve => setTimeout(resolve, 2000));
        } else {
          throw error;
        }
      }
    }

    // If we get here, we have successfully generated content
    const generatedContent = (await supabase.functions.invoke('generate_campaign_content', {
      body: {
        theme: theme,
        month: currentMonth,
        tone: 'professional',
        channels: ['facebook', 'instagram', 'newsletter', 'blog', 'video'],
        campaignId: campaignId,
        userId: userId
      }
    })).data.content;

    // Try to spend tokens but don't fail if it doesn't work
    await spendTokensWithFallback(userId, campaignId);

    // Create content tasks for each type WITH HYBRID TENANT/USER SUPPORT
    const contentTypes = ['instagram', 'facebook', 'blog', 'video'];
    const results = [];

    console.log('🔧 Creating content tasks with hybrid ownership model');

    // Handle regular content types
    for (const type of contentTypes) {
      try {
        const content = generatedContent[type] || '';

        if (!content) {
          console.warn(`⚠️ No content generated for type: ${type}`);
          continue;
        }

        console.log(`🔧 Creating ${type} task (${content.length} chars) with ${tenantId ? 'tenant' : 'user'} ownership`);

        const taskData: any = {
          campaign_id: campaignId,
          post_type: type,
          ai_output: content,
          status: 'review',
          scheduled_date: new Date().toISOString().split('T')[0],
          notes: `Generated from theme: ${theme}`
        };

        // Set ownership based on tenant availability
        if (tenantId) {
          taskData.tenant_id = tenantId;
          taskData.created_by_user_id = userId;
          console.log(`🔧 Using tenant model: tenant_id=${tenantId}, created_by_user_id=${userId}`);
        } else {
          taskData.user_id = userId;
          console.log(`🔧 Using user model: user_id=${userId}`);
        }

        const { data: task, error: taskError } = await supabase
          .from('content_tasks')
          .insert(taskData)
          .select()
          .single();

        if (taskError) {
          console.error(`❌ Error creating ${type} task:`, taskError);
          await logContentGenerationAttempt(campaignId, userId, 'task_creation_failed', tenantId, { 
            contentType: type, 
            error: taskError.message 
          });
        } else {
          results.push(task);
          console.log(`✅ Created ${type} content task (${task.id}) with ${tenantId ? 'tenant_id' : 'user_id'} ownership`);
          
          // Auto-generate images for the task (make this optional and non-blocking)
          generateImagesForTask(task, theme, description, type).catch(error => {
            console.error(`❌ Error generating images for ${type}:`, error);
          });
        }
      } catch (error) {
        console.error(`❌ Error generating ${type} content:`, error);
        await logContentGenerationAttempt(campaignId, userId, 'content_generation_failed', tenantId, { 
          contentType: type, 
          error: error.message 
        });
      }
    }

    // Handle newsletter separately with structured format
    try {
      console.log('📰 Generating structured newsletter content');
      const newsletterContent = await generateStructuredNewsletter(
        campaignId,
        theme,
        1,
        userId,
        description
      );

      const newsletterTaskData: any = {
        campaign_id: campaignId,
        post_type: 'newsletter',
        ai_output: newsletterContent,
        status: 'review',
        scheduled_date: new Date().toISOString().split('T')[0],
        notes: `Structured newsletter generated from theme: ${theme}`
      };

      // Set ownership based on tenant availability
      if (tenantId) {
        newsletterTaskData.tenant_id = tenantId;
        newsletterTaskData.created_by_user_id = userId;
      } else {
        newsletterTaskData.user_id = userId;
      }

      const { data: newsletterTask, error: newsletterError } = await supabase
        .from('content_tasks')
        .insert(newsletterTaskData)
        .select()
        .single();

      if (newsletterError) {
        console.error('❌ Error creating newsletter task:', newsletterError);
        await logContentGenerationAttempt(campaignId, userId, 'newsletter_creation_failed', tenantId, { 
          error: newsletterError.message 
        });
      } else {
        results.push(newsletterTask);
        console.log('✅ Created structured newsletter content task with hybrid ownership');
      }
    } catch (error) {
      console.error('❌ Error generating structured newsletter:', error);
      await logContentGenerationAttempt(campaignId, userId, 'newsletter_generation_failed', tenantId, { 
        error: error.message 
      });
    }

    // Log successful completion
    await logContentGenerationAttempt(campaignId, userId, 'completed', tenantId, { 
      tasksCreated: results.length 
    });

    console.log(`🎉 Content generation completed: ${results.length} tasks created with hybrid tenant/user support`);
    
    // Enhanced success logging
    results.forEach(task => {
      console.log(`✅ Task created: ${task.post_type} (${task.id}) - ${task.ai_output?.length || 0} chars`);
    });

    // Show success toast to user
    toast.success(`Generated ${results.length} content pieces for review!`);

    return {
      success: true,
      message: `Generated ${results.length} content pieces for review and approval`,
      tasks: results
    };
  } catch (error) {
    console.error('❌ Error in generateCampaignContent:', error);
    
    // Log the failure
    await logContentGenerationAttempt(campaignId, userId, 'failed', tenantId, { 
      error: error.message || 'Unknown error' 
    });
    
    // Enhanced error logging
    if (error instanceof Error) {
      console.error('❌ Error details:', {
        name: error.name,
        message: error.message,
        stack: error.stack
      });
    }
    
    // Show error toast to user
    toast.error(`Failed to generate content: ${error.message || 'Unknown error'}`);
    
    return {
      success: false,
      message: error.message || 'Failed to generate content',
      error: error
    };
  }
};

// Helper functions for improved error handling
const spendTokensWithFallback = async (userId: string, campaignId: string) => {
  try {
    const { data: tokenSpent, error: tokenError } = await supabase.rpc('spend_tokens', {
      p_user_id: userId,
      p_tokens: 5,
      p_action_type: 'generation',
      p_content_type: 'content_pack',
      p_campaign_id: campaignId
    });

    if (tokenError) {
      console.error('❌ Error spending tokens:', tokenError);
      // Don't throw here - content generation succeeded, token spending is secondary
    } else {
      console.log('✅ Tokens spent successfully');
    }
  } catch (tokenError) {
    console.error('❌ Token spending failed:', tokenError);
    // Continue with content creation even if token spending fails
  }
};

const generateImagesForTask = async (task: any, theme: string, description: string, contentType: string) => {
  try {
    console.log(`🖼️ Auto-generating images for ${contentType} content`);
    const imageQuery = extractImageKeywords(theme, description, contentType);
    
    // Don't await this - let it run in background
    supabase.functions.invoke('fetch-unsplash-images', {
      body: { 
        query: imageQuery,
        contentTaskId: task.id 
      }
    }).then(() => {
      console.log(`✅ Generated images for ${contentType} content`);
    }).catch((imageError) => {
      console.error(`❌ Error generating images for ${contentType}:`, imageError);
    });
  } catch (imageError) {
    console.error(`❌ Error starting image generation for ${contentType}:`, imageError);
    // Don't fail the content generation if images fail
  }
};

const logContentGenerationAttempt = async (
  campaignId: string, 
  userId: string, 
  status: string, 
  tenantId?: string, 
  metadata?: any
) => {
  try {
    await supabase.from('token_usage').insert({
      user_id: userId,
      action_type: 'content_generation_log',
      tokens_consumed: 0,
      tokens_remaining: 0,
      campaign_id: campaignId,
      metadata: {
        status,
        tenant_id: tenantId,
        timestamp: new Date().toISOString(),
        ...metadata
      }
    });
  } catch (error) {
    console.error('❌ Error logging content generation attempt:', error);
    // Don't throw - logging is secondary
  }
};

export const generateContentForCampaign = generateCampaignContent;

// Helper function to extract keywords for image search with enhanced platform specificity
const extractImageKeywords = (theme: string, description: string, contentType: string): string => {
  // Combine theme and description for better keyword extraction
  const combinedText = `${theme} ${description || ''}`.toLowerCase();
  
  // Remove common words and extract meaningful keywords
  const cleanText = combinedText
    .replace(/week \d+/g, '')
    .replace(/\b(the|and|or|of|in|on|at|to|for|with|by|campaign|content|post)\b/g, '')
    .trim();
  
  // Enhanced platform-specific keywords with style modifiers
  const typeKeywords = {
    instagram: 'lifestyle aesthetic beautiful vibrant colorful trendy square portrait garden',
    facebook: 'community educational informative people landscape wide garden',
    newsletter: 'professional seasonal informative clean organized landscape header garden',
    blog: 'featured image professional educational informative landscape header garden',
    video: 'action process tutorial hands-on behind scenes landscape cinematic garden'
  };
  
  const finalQuery = cleanText || theme || 'garden';
  return `${finalQuery} ${typeKeywords[contentType] || typeKeywords.instagram}`.trim();
};
