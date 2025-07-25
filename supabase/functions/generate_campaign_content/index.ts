
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, handleCorsPrelight, corsJsonResponse } from '../_shared/cors.ts';

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// Define all 5 required content types
const REQUIRED_CONTENT_TYPES = ['instagram', 'facebook', 'blog', 'video', 'newsletter'];

serve(async (req) => {
  // Handle CORS preflight requests
  const corsResponse = handleCorsPrelight(req);
  if (corsResponse) return corsResponse;

  try {
    const { campaign_id, campaign_title, description, user_id, week_number, tenant_id } = await req.json();
    
    console.log('🎯 Generating campaign content for:', { campaign_id, campaign_title, user_id, tenant_id });

    if (!openAIApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get company profile for context
    let companyProfile = null;
    if (user_id) {
      const { data: profile } = await supabase
        .from('company_profiles')
        .select('*')
        .eq('user_id', user_id)
        .single();
      companyProfile = profile;
    }

    const businessName = companyProfile?.company_name || 'Your Garden Center';
    const businessContext = companyProfile?.company_overview || 'A local garden center helping customers grow beautiful gardens';

    console.log('📝 Generating content for all 5 required types in parallel:', REQUIRED_CONTENT_TYPES);

    // Check for existing content to prevent duplicates
    const { data: existingTasks } = await supabase
      .from('content_tasks')
      .select('post_type')
      .eq('campaign_id', campaign_id)
      .in('post_type', REQUIRED_CONTENT_TYPES);

    const existingTypes = existingTasks?.map(task => task.post_type) || [];
    const typesToGenerate = REQUIRED_CONTENT_TYPES.filter(type => !existingTypes.includes(type));
    
    if (typesToGenerate.length === 0) {
      console.log('⚠️ All content types already exist for this campaign');
      return corsJsonResponse({
        success: true,
        tasks: [],
        message: 'All content types already exist for this campaign'
      });
    }

    console.log(`📝 Generating content for missing types: ${typesToGenerate.join(', ')}`);

    // Define content prompts with structured output instructions
    const contentPrompts = {
      instagram: `Create an engaging Instagram post about ${campaign_title} for ${businessName}. 

      Structure the response as multiple slides/sections if the content is long enough:
      - Main post content with gardening advice
      - Include relevant hashtags 
      - Call-to-action to visit the garden center
      
      Focus on practical tips, seasonal advice, and authentic gardening insights. Do NOT use any emojis.`,
      
      facebook: `Write a Facebook post about ${campaign_title} for ${businessName}. 

      Create engaging, community-focused content with:
      - Introduction hook about the topic
      - Practical gardening tips and advice  
      - Community engagement element
      - Call-to-action to visit or contact
      
      Make it conversational and valuable for garden center customers. Do NOT use any emojis.`,
      
      blog: `Write a comprehensive blog post about ${campaign_title} for ${businessName}. 

      Structure the blog with clear sections:
      - Engaging title and introduction
      - 3-4 main content sections with helpful tips
      - Practical advice and actionable insights
      - Conclusion with call-to-action
      
      Make it SEO-friendly, informative, and valuable for gardening enthusiasts. Do NOT use any emojis.`,
      
      video: `Create a 90-second video script about ${campaign_title} for ${businessName}. 

      Structure the script in segments:
      - Opening hook (10-15 seconds)
      - Main teaching content in 2-3 segments (60-70 seconds)
      - Closing with call-to-action (15-20 seconds)
      
      Write ONLY the spoken words - no scene descriptions or production notes. Focus on one clear teaching point. Do NOT use any emojis.`,
      
      newsletter: `Create a structured newsletter about ${campaign_title} for ${businessName} in this YAML format:

      newsletter_md: |
        # ${campaign_title} Newsletter
        [Newsletter introduction paragraph]

      blocks:
        - title: "Section 1 Title"
          body: "Detailed content with gardening tips and advice"
          cta: "Learn more"
          link: "#"
          image_prompt: "${campaign_title} gardening professional"
          alt_text: "Section 1 image description"
        - title: "Section 2 Title"
          body: "More valuable content for garden center customers"
          cta: "Visit us"
          link: "#"
          image_prompt: "${campaign_title} garden center advice"
          alt_text: "Section 2 image description"

      extra_content_ideas:
        - title: "Follow-up Content Idea"
          quick_desc: "Brief description of related content"

      meta:
        reading_time: "≈3 min"
        theme: "${campaign_title}"
        week_focus: "Main focus description"
      
      Focus on actionable gardening insights and seasonal advice. Do NOT use any emojis.`
    };

    // Function to validate and clean content
    const validateAndCleanContent = (content: string, contentType: string) => {
      let cleanedContent = content;
      
      // Strip emojis from all content
      cleanedContent = cleanedContent.replace(/[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu, '');
      
      // Clean video scripts of production formatting
      if (contentType === 'video') {
        cleanedContent = cleanedContent
          // Remove scene headers and formatting
          .replace(/\*\*\[Scene \d+:.*?\]\*\*/g, '')
          .replace(/\[Scene \d+:.*?\]/g, '')
          .replace(/\*\*\[.*?\]\*\*/g, '')
          .replace(/\[.*?\]/g, '')
          // Remove visual and audio cues
          .replace(/\*Visual:.*?\*/g, '')
          .replace(/\*Background Music:.*?\*/g, '')
          .replace(/\*.*?music.*?\*/gi, '')
          // Remove narrator and host labels
          .replace(/\*\*Narrator \(Voiceover\):\*\*/g, '')
          .replace(/Narrator \(Voiceover\):/g, '')
          .replace(/\*\*Host:\*\*/g, '')
          .replace(/Host:/g, '')
          .replace(/\*\*Host \(.*?\):\*\*/g, '')
          // Remove video title formatting
          .replace(/\*\*Video Title:.*?\*\*/g, '')
          .replace(/\*\*Title:.*?\*\*/g, '')
          // Clean up separators and extra formatting
          .replace(/---+/g, '')
          .replace(/\*\*\[End.*?\]\*\*/g, '')
          .replace(/\[End.*?\]/g, '')
          // Clean up extra whitespace
          .replace(/\n\s*\n\s*\n/g, '\n\n')
          .trim();
      }
      
      // Remove any remaining placeholders
      cleanedContent = cleanedContent
        .replace(/\[company\s*name\]/gi, businessName)
        .replace(/\[garden\s*center\s*name\]/gi, businessName)
        .replace(/\[business\s*name\]/gi, businessName)
        .replace(/your\s*garden\s*center(?!\s+name)/gi, 'our garden center')
        .replace(/\[region\]/gi, 'your area')
        .replace(/\[location\]/gi, 'your area')
        .replace(/\[garden\s*center\s*location\]/gi, 'your area');

      return cleanedContent;
    };

    // Function to generate content for a single content type
    const generateContentForType = async (contentType: string) => {
      try {
        console.log(`📝 Generating ${contentType} content...`);
        
        // Enhanced prompts to prevent emojis and video formatting
        let systemPrompt = `You are a professional content creator for garden centers. Create engaging, helpful content. Business: ${businessName}. Focus: ${campaign_title}. ${description ? `Context: ${description}` : ''} 
        
        CRITICAL RULES:
        - NEVER use emojis or emoticons
        - Focus on practical gardening advice
        - Write in a professional, friendly tone
        - ${contentType === 'video' ? 'Write ONLY the script dialogue/narration without any scene descriptions, visual cues, or production notes. Just the spoken words.' : ''}`;

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${openAIApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            temperature: 0.7,
            max_tokens: contentType === 'blog' ? 2000 : 1000,
            messages: [
              {
                role: 'system',
                content: systemPrompt
              },
              {
                role: 'user',
                content: contentPrompts[contentType]
              }
            ]
          }),
        });

        if (!response.ok) {
          throw new Error(`OpenAI API error for ${contentType}: ${response.status}`);
        }

        const data = await response.json();
        let content = data.choices[0].message.content;
        
        // Validate and clean the content
        content = validateAndCleanContent(content, contentType);
        
        console.log(`✅ Generated ${contentType} content (${content.length} chars)`);

        return {
          contentType,
          content,
          success: true
        };
        
      } catch (error) {
        console.error(`❌ Error generating ${contentType} content:`, error);
        return {
          contentType,
          error: error.message,
          success: false
        };
      }
    };

    // Generate only missing content types in parallel
    const startTime = Date.now();
    const contentResults = await Promise.allSettled(
      typesToGenerate.map(contentType => generateContentForType(contentType))
    );
    const generationTime = Date.now() - startTime;
    console.log(`🚀 Content generation completed for ${typesToGenerate.length} types in ${generationTime}ms`);

    // Process results and prepare database inserts
    const tasksToInsert = [];
    const failedTasks = [];

    for (const result of contentResults) {
      if (result.status === 'fulfilled' && result.value.success) {
        const { contentType, content } = result.value;
        tasksToInsert.push({
          campaign_id,
          post_type: contentType,
          ai_output: content,
          status: 'review',
          scheduled_date: new Date().toISOString().split('T')[0],
          user_id,
          tenant_id,
          created_by_user_id: user_id,
          notes: `Generated for ${campaign_title} campaign`
        });
      } else {
        const errorInfo = result.status === 'fulfilled' ? result.value : { contentType: 'unknown', error: result.reason };
        failedTasks.push({
          post_type: errorInfo.contentType,
          error: errorInfo.error,
          status: 'failed'
        });
      }
    }

    // Batch insert all successful tasks
    let generatedTasks = [...failedTasks];
    if (tasksToInsert.length > 0) {
      console.log(`💾 Batch inserting ${tasksToInsert.length} tasks...`);
      const { data: tasks, error: batchError } = await supabase
        .from('content_tasks')
        .insert(tasksToInsert)
        .select();

      if (batchError) {
        console.error('❌ Batch insert error:', batchError);
        // Fallback to individual inserts
        for (const taskData of tasksToInsert) {
          try {
            const { data: task, error: taskError } = await supabase
              .from('content_tasks')
              .insert(taskData)
              .select()
              .single();
            
            if (taskError) {
              failedTasks.push({
                post_type: taskData.post_type,
                error: taskError.message,
                status: 'failed'
              });
            } else {
              generatedTasks.push(task);
            }
          } catch (error) {
            failedTasks.push({
              post_type: taskData.post_type,
              error: error.message,
              status: 'failed'
            });
          }
        }
      } else {
        generatedTasks.push(...tasks);
        console.log(`✅ Successfully created ${tasks.length} tasks`);
      }
    }

    console.log('✅ Content generation completed for all types');

    const successfulTasks = generatedTasks.filter(task => !task.error);
    const finalFailedTasks = generatedTasks.filter(task => task.error);

    return corsJsonResponse({
      success: finalFailedTasks.length < REQUIRED_CONTENT_TYPES.length, // Success if at least some content was generated
      tasks: generatedTasks,
      message: `Generated ${successfulTasks.length}/${REQUIRED_CONTENT_TYPES.length} content pieces${finalFailedTasks.length > 0 ? `. Failed: ${finalFailedTasks.map(t => t.post_type).join(', ')}` : ''}`
    });

  } catch (error) {
    console.error('❌ Error in generate_campaign_content:', error);
    return corsJsonResponse({
      success: false,
      error: error.message,
      tasks: []
    }, { status: 500 });
  }
});
