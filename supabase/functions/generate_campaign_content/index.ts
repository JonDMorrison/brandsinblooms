
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// Define all 5 required content types
const REQUIRED_CONTENT_TYPES = ['instagram', 'facebook', 'blog', 'video', 'newsletter'];

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

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

    // Define content prompts
    const contentPrompts = {
      instagram: `Create an engaging Instagram post about ${campaign_title} for ${businessName}. Include relevant hashtags and a call-to-action. Keep it concise and visually appealing. Make it feel authentic and personal. Focus on gardening advice and tips.`,
      facebook: `Write a Facebook post about ${campaign_title} for ${businessName}. Make it conversational and community-focused. Include tips or advice that would be valuable to garden center customers. Share practical gardening knowledge.`,
      blog: `Write a comprehensive blog post about ${campaign_title} for ${businessName}. Include an engaging title, introduction, main content with helpful tips, and a conclusion. Make it SEO-friendly and informative for garden center customers. Focus on detailed gardening advice.`,
      video: `Create a 90-second video script about ${campaign_title} for ${businessName}. Include scene descriptions, dialogue, and key points to cover. Make it engaging and educational for garden center customers. Focus on one clear teaching point about ${campaign_title}.`,
      newsletter: `Create a structured newsletter about ${campaign_title} for ${businessName}. Include multiple sections with gardening tips, seasonal advice, and practical information. Make it valuable for garden center customers with actionable insights.`
    };

    // Function to generate content for a single content type
    const generateContentForType = async (contentType: string) => {
      try {
        console.log(`📝 Generating ${contentType} content...`);
        
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${openAIApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            temperature: 0.7,
            max_tokens: contentType === 'blog' ? 2000 : 1000, // Optimize token usage
            messages: [
              {
                role: 'system',
                content: `You are a professional content creator for garden centers. Create engaging, helpful content. Business: ${businessName}. Focus: ${campaign_title}. ${description ? `Context: ${description}` : ''} Focus on practical gardening advice.`
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
        const content = data.choices[0].message.content;
        
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

    // Generate all content in parallel
    const startTime = Date.now();
    const contentResults = await Promise.allSettled(
      REQUIRED_CONTENT_TYPES.map(contentType => generateContentForType(contentType))
    );
    const generationTime = Date.now() - startTime;
    console.log(`🚀 All content generation completed in ${generationTime}ms`);

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
    const failedTasks = generatedTasks.filter(task => task.error);

    return new Response(JSON.stringify({
      success: failedTasks.length < REQUIRED_CONTENT_TYPES.length, // Success if at least some content was generated
      tasks: generatedTasks,
      message: `Generated ${successfulTasks.length}/${REQUIRED_CONTENT_TYPES.length} content pieces${failedTasks.length > 0 ? `. Failed: ${failedTasks.map(t => t.post_type).join(', ')}` : ''}`
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('❌ Error in generate_campaign_content:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      tasks: []
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
