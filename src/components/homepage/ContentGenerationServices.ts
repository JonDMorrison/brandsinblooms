import { supabase } from "@/integrations/supabase/client";
import { generateStructuredNewsletter } from "./StructuredNewsletterService";
import { toast } from "sonner";

export const generatePersonalizedContent = async (postType: string, campaignTitle: string, userId?: string, weekDescription?: string) => {
  console.log(`🎯 Generating validated ${postType} content for: ${campaignTitle} with description: ${weekDescription}`);
  
  // ALWAYS route newsletter requests to structured generator for consistent 4-section format
  if (postType === 'newsletter') {
    console.log('📰 Routing newsletter request to structured generator for 4-section format');
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
    
    console.log('🔧 Using individual content generation with enhanced error handling');
    
    // Try to spend tokens but don't fail if it doesn't work
    await spendTokensWithFallback(userId, campaignId);

    // Use individual content generation for each type for better reliability
    const contentTypes = ['instagram', 'facebook', 'blog', 'video', 'newsletter'];
    const results = [];
    const failedTypes = [];

    console.log('🔧 Creating content tasks with enhanced error handling');

    for (const type of contentTypes) {
      try {
        console.log(`🔧 Starting ${type} content generation`);

        // 🔍 CRITICAL SAFEGUARD: Validate content type
        if (!['instagram', 'facebook', 'blog', 'video', 'newsletter'].includes(type)) {
          console.warn('❌ Unknown post_type skipped:', type);
          failedTypes.push({ type, error: 'Unknown post type' });
          continue;
        }

        let content = '';
        
        // 📰 NEWSLETTER SPECIFIC: Enhanced error handling and fallback
        if (type === 'newsletter') {
          console.log('📰 NEWSLETTER: Starting generation with enhanced error handling');
          try {
            content = await generateNewsletterContent(
              campaignId,
              theme,
              weekNumber || 1,
              userId,
              description
            );
            console.log(`📰 NEWSLETTER: Generated successfully (${content?.length || 0} chars)`);
          } catch (newsletterError) {
            console.error('📰 NEWSLETTER: Primary generation failed, trying fallback:', newsletterError);
            
            // Fallback: Try simple newsletter generation
            try {
              content = await generatePersonalizedContent('newsletter', theme, userId, description);
              console.log(`📰 NEWSLETTER: Fallback generation succeeded (${content?.length || 0} chars)`);
            } catch (fallbackError) {
              console.error('📰 NEWSLETTER: Fallback also failed:', fallbackError);
              
              // Last resort: Create basic newsletter content
              content = `# ${theme} - Weekly Newsletter

**This Week's Focus: ${description || theme}**

Welcome to our weekly newsletter! This week we're focusing on ${theme}.

## What's New This Week
Our team has been working on bringing you the latest insights and updates about ${theme}.

## Tips & Insights
Here are some key points to consider about ${theme} this week.

## Looking Ahead
Stay tuned for more updates and insights in our upcoming newsletters.

---
*Thank you for reading our newsletter!*`;
              
              console.log('📰 NEWSLETTER: Using emergency fallback content');
            }
          }
        } else if (type === 'video') {
          content = await generateVideoScript(theme, userId, description);
        } else {
          content = await generatePersonalizedContent(type, theme, userId, description);
        }

        // Validate content was generated
        if (!content || content.trim() === '') {
          console.warn(`⚠️ No content generated for type: ${type}`);
          failedTypes.push({ type, error: 'Empty content returned' });
          continue;
        }

        console.log(`🔧 Creating ${type} task (${content.length} chars) with ${tenantId ? 'tenant' : 'user'} ownership`);

        const taskData: any = {
          campaign_id: campaignId,
          post_type: type, // 🔧 CRITICAL FIX: Ensure we use the loop variable 'type'
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

        // 🔍 DEBUG: Log the exact data being inserted
        console.log(`🔧 Inserting task data for ${type}:`, {
          post_type: taskData.post_type,
          campaign_id: taskData.campaign_id,
          content_length: taskData.ai_output?.length || 0,
          status: taskData.status,
          tenant_id: taskData.tenant_id || 'none',
          user_id: taskData.user_id || 'none'
        });

        const { data: task, error: taskError } = await supabase
          .from('content_tasks')
          .insert(taskData)
          .select()
          .single();

        if (taskError) {
          console.error(`❌ Error creating ${type} task:`, taskError);
          failedTypes.push({ type, error: taskError.message });
          await logContentGenerationAttempt(campaignId, userId, 'task_creation_failed', tenantId, { 
            contentType: type, 
            error: taskError.message 
          });
        } else {
          results.push(task);
          console.log(`✅ Created ${type} content task (${task.id}) with ${tenantId ? 'tenant_id' : 'user_id'} ownership`);
          
          // 📰 NEWSLETTER SPECIFIC: Extra verification
          if (type === 'newsletter') {
            console.log(`📰 NEWSLETTER TASK CREATED: ID=${task.id}, post_type=${task.post_type}, content_length=${task.ai_output?.length}`);
          }
          
          // Auto-generate images for the task (make this optional and non-blocking)
          generateImagesForTask(task, theme, description, type).catch(error => {
            console.error(`❌ Error generating images for ${type}:`, error);
          });
        }
      } catch (error) {
        console.error(`❌ Error generating ${type} content:`, error);
        failedTypes.push({ type, error: error.message });
        await logContentGenerationAttempt(campaignId, userId, 'content_generation_failed', tenantId, { 
          contentType: type, 
          error: error.message 
        });
        
        // Continue with other content types even if one fails
        console.log(`⚠️ Continuing with other content types despite ${type} failure`);
      }
    }

    // Log successful completion
    await logContentGenerationAttempt(campaignId, userId, 'completed', tenantId, { 
      tasksCreated: results.length,
      failedTypes: failedTypes
    });

    console.log(`🎉 Content generation completed: ${results.length} tasks created`);
    
    // Enhanced success logging
    results.forEach(task => {
      console.log(`✅ Task created: ${task.post_type} (${task.id}) - ${task.ai_output?.length || 0} chars`);
    });

    // Log failed types
    if (failedTypes.length > 0) {
      console.error(`❌ Failed to create ${failedTypes.length} content types:`, failedTypes);
    }

    // 📰 NEWSLETTER VERIFICATION: Check if newsletter was created
    const newsletterTasks = results.filter(task => task.post_type === 'newsletter');
    if (newsletterTasks.length === 0) {
      console.error('📰 CRITICAL: Newsletter task was not created!');
      toast.error('Newsletter content failed to generate. Please try refreshing content again.');
    } else {
      console.log('📰 SUCCESS: Newsletter task created successfully:', newsletterTasks[0].id);
    }

    // Show success toast to user
    if (results.length > 0) {
      const newsletterStatus = newsletterTasks.length > 0 ? '✅ Newsletter included' : '⚠️ Newsletter missing';
      toast.success(`Generated ${results.length} content pieces for review! ${newsletterStatus}`);
    } else {
      toast.error('No content was generated. Please try again.');
    }

    return {
      success: results.length > 0,
      message: results.length > 0 
        ? `Generated ${results.length} content pieces for review and approval`
        : 'No content was generated. Please check your settings and try again.',
      tasks: results,
      failedTypes: failedTypes
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
      error: error,
      tasks: [],
      failedTypes: []
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
    video: 'action process tutorial hands-on behind scenes cinematic garden'
  };
  
  const finalQuery = cleanText || theme || 'garden';
  return `${finalQuery} ${typeKeywords[contentType] || typeKeywords.instagram}`.trim();
};
