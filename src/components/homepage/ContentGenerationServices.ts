
import { supabase } from "@/integrations/supabase/client";

// REMOVED TOKEN SPENDING - Edge functions now handle this to prevent double charging

export const generatePersonalizedContent = async (postType: string, campaignTitle: string, userId?: string, weekDescription?: string) => {
  console.log(`🎯 Generating validated ${postType} content for: ${campaignTitle} with description: ${weekDescription}`);
  
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

export const generateNewsletterContent = async (campaignId: string, campaignTitle: string, weekNumber: number, userId?: string, weekDescription?: string) => {
  console.log(`🎯 Generating newsletter content for campaign: ${campaignTitle} (Week ${weekNumber}) with description: ${weekDescription}`);
  
  try {
    console.log('📡 About to call generate-newsletter function');

    const { data, error } = await supabase.functions.invoke('generate-newsletter', {
      body: {
        campaignId: campaignId,
        campaignTitle: campaignTitle,
        weekNumber: weekNumber,
        weekDescription: weekDescription,
        userId: userId,
        enforceCompanyName: true
      }
    });

    console.log('📨 Response from generate-newsletter function:', { data, error });

    if (error) {
      console.error('❌ Error generating newsletter content:', error);
      throw new Error(`Newsletter generation failed: ${error.message || 'Unknown error'}`);
    }

    const content = data?.content || data?.generatedText;
    if (!content) {
      throw new Error('No newsletter content returned');
    }

    console.log(`✅ Generated newsletter content successfully (${content.length} chars):`, content.substring(0, 100) + '...');
    return content;
  } catch (error) {
    console.error('❌ Error in generateNewsletterContent:', error);
    throw error;
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

export const generateContentForCampaign = async (
  campaignId: string,
  theme: string,
  description: string,
  userId: string,
  weekNumber?: number
) => {
  console.log(`🎯 Generating content pack for campaign: ${campaignId}`);
  
  try {
    // Spend tokens for content generation (5 content types = 5 tokens)
    const { data: tokenSpent, error: tokenError } = await supabase.rpc('spend_tokens', {
      p_user_id: userId,
      p_tokens: 5,
      p_action_type: 'generation',
      p_content_type: 'content_pack',
      p_campaign_id: campaignId
    });

    if (tokenError) {
      console.error('❌ Error spending tokens:', tokenError);
      throw new Error('Failed to process tokens for content generation');
    }

    // Generate content for all required types
    const contentTypes = ['newsletter', 'instagram', 'facebook', 'email', 'video'];
    const results = [];

    for (const type of contentTypes) {
      try {
        let content;
        if (type === 'newsletter') {
          content = await generateNewsletterContent(campaignId, theme, weekNumber || 1, userId, description);
        } else if (type === 'video') {
          content = await generateVideoScript(theme, userId, description);
        } else {
          content = await generatePersonalizedContent(type, theme, userId, description);
        }

        // Create content task - FIXED: Set status to 'review' instead of 'generated' or 'posted'
        const { data: task, error: taskError } = await supabase
          .from('content_tasks')
          .insert({
            campaign_id: campaignId,
            post_type: type,
            ai_output: content,
            status: 'review', // FIXED: Always set to 'review' so content requires explicit approval
            scheduled_date: new Date().toISOString().split('T')[0],
            user_id: userId,
            notes: `Generated from theme: ${theme}`
          })
          .select()
          .single();

        if (taskError) {
          console.error(`❌ Error creating ${type} task:`, taskError);
        } else {
          results.push(task);
          console.log(`✅ Created ${type} content task with status 'review' - requires approval`);
          
          // Auto-generate images for the task
          try {
            console.log(`🖼️ Auto-generating images for ${type} content`);
            const imageQuery = extractImageKeywords(theme, description, type);
            
            await supabase.functions.invoke('fetch-unsplash-images', {
              body: { 
                query: imageQuery,
                contentTaskId: task.id 
              }
            });
            
            console.log(`✅ Generated images for ${type} content`);
          } catch (imageError) {
            console.error(`❌ Error generating images for ${type}:`, imageError);
            // Don't fail the content generation if images fail
          }
        }
      } catch (error) {
        console.error(`❌ Error generating ${type} content:`, error);
      }
    }

    return {
      success: true,
      message: `Generated ${results.length} content pieces for review and approval`,
      tasks: results
    };
  } catch (error) {
    console.error('❌ Error in generateContentForCampaign:', error);
    return {
      success: false,
      message: error.message || 'Failed to generate content'
    };
  }
};

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
    email: 'simple clean product focused before after landscape garden tips',
    newsletter: 'professional seasonal informative clean organized landscape header garden',
    video: 'action process tutorial hands-on behind scenes landscape cinematic garden'
  };
  
  const finalQuery = cleanText || theme || 'garden';
  return `${finalQuery} ${typeKeywords[contentType] || typeKeywords.instagram}`.trim();
};
