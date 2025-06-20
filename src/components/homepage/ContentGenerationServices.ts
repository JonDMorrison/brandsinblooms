
import { supabase } from "@/integrations/supabase/client";
import { generateStructuredNewsletter } from "./StructuredNewsletterService";

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

export const generateCampaignContent = async (
  campaignId: string,
  theme: string,
  description: string,
  userId: string,
  weekNumber?: number
) => {
  console.log(`🎯 Generating campaign content pack for campaign: ${campaignId}`);
  
  try {
    // Get current month for the new edge function
    const currentMonth = new Date().toLocaleString('default', { month: 'long' });
    
    // Call the new generate_campaign_content edge function
    console.log('📡 Calling generate_campaign_content function');
    
    const { data, error } = await supabase.functions.invoke('generate_campaign_content', {
      body: {
        theme: theme,
        month: currentMonth,
        tone: 'professional',
        // FIXED: Updated content types to use blog instead of email
        channels: ['facebook', 'instagram', 'newsletter', 'blog', 'video'],
        campaignId: campaignId,
        userId: userId
      }
    });

    if (error) {
      console.error('❌ Error from generate_campaign_content function:', error);
      throw new Error(`Campaign content generation failed: ${error.message || 'Unknown error'}`);
    }

    if (!data || !data.success) {
      throw new Error('Failed to generate campaign content');
    }

    const generatedContent = data.content;
    console.log('📋 Generated campaign content:', generatedContent);

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

    // FIXED: Updated content types to use blog instead of email
    const contentTypes = ['instagram', 'facebook', 'blog', 'video'];
    const results = [];

    // Handle regular content types
    for (const type of contentTypes) {
      try {
        const content = generatedContent[type] || '';

        if (!content) {
          console.warn(`⚠️ No content generated for type: ${type}`);
          continue;
        }

        // FIXED: Set status to 'review' and include user_id
        const { data: task, error: taskError } = await supabase
          .from('content_tasks')
          .insert({
            campaign_id: campaignId,
            post_type: type,
            ai_output: content,
            status: 'review',
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
          console.log(`✅ Created ${type} content task with status 'review'`);
          
          // FIXED: Enhanced image generation with improved error handling
          if (type === 'facebook' || type === 'instagram' || type === 'blog') {
            try {
              console.log(`🖼️ Auto-generating images for ${type} content`);
              const imageQuery = extractImageKeywords(theme, description, type);
              
              const { data: imageData, error: imageError } = await supabase.functions.invoke('fetch-unsplash-images', {
                body: { 
                  query: imageQuery,
                  contentTaskId: task.id 
                }
              });
              
              if (imageError) {
                console.warn(`⚠️ Image generation failed for ${type}, creating placeholder:`, imageError);
                // Create placeholder image suggestion
                await supabase
                  .from('image_suggestions')
                  .insert([{
                    content_task_id: task.id,
                    query: imageQuery,
                    thumb_url: `https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=400&h=300&fit=crop&crop=center`,
                    download_url: `https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=1200&h=800&fit=crop&crop=center`,
                    alt: `${theme} garden center content`,
                    photographer: 'Placeholder Image',
                    unsplash_id: 'placeholder-garden'
                  }]);
              } else {
                console.log(`✅ Generated images for ${type} content`);
              }
            } catch (imageError) {
              console.error(`❌ Error generating images for ${type}:`, imageError);
              // Don't fail the content generation if images fail
            }
          }
        }
      } catch (error) {
        console.error(`❌ Error generating ${type} content:`, error);
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

      const { data: newsletterTask, error: newsletterError } = await supabase
        .from('content_tasks')
        .insert({
          campaign_id: campaignId,
          post_type: 'newsletter',
          ai_output: newsletterContent,
          status: 'review',
          scheduled_date: new Date().toISOString().split('T')[0],
          user_id: userId,
          notes: `Structured newsletter generated from theme: ${theme}`
        })
        .select()
        .single();

      if (newsletterError) {
        console.error('❌ Error creating newsletter task:', newsletterError);
      } else {
        results.push(newsletterTask);
        console.log('✅ Created structured newsletter content task');
      }
    } catch (error) {
      console.error('❌ Error generating structured newsletter:', error);
    }

    return {
      success: true,
      message: `Generated ${results.length} content pieces for review and approval`,
      tasks: results
    };
  } catch (error) {
    console.error('❌ Error in generateCampaignContent:', error);
    return {
      success: false,
      message: error.message || 'Failed to generate content'
    };
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
