
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { theme, month, tone, channels, campaignId, userId } = await req.json();
    
    console.log('🎯 Generating campaign content for:', { theme, month, tone, channels });

    if (!openAIApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get company profile for context
    let companyProfile = null;
    if (userId) {
      const { data: profile } = await supabase
        .from('company_profiles')
        .select('*')
        .eq('user_id', userId)
        .single();
      companyProfile = profile;
    }

    const businessName = companyProfile?.company_name || 'Your Garden Center';
    const businessContext = companyProfile?.company_overview || 'A local garden center helping customers grow beautiful gardens';

    // FIXED: Use standardized content channels - blog instead of newsletter
    // Filter out newsletter from channels since it's handled separately
    const contentChannels = channels.filter(channel => channel !== 'newsletter');
    
    console.log('📝 Generating content for channels (excluding newsletter):', contentChannels);

    const content = {};

    // Generate content for each channel (excluding newsletter)
    for (const channel of contentChannels) {
      try {
        console.log(`📝 Generating ${channel} content...`);
        
        const channelPrompts = {
          instagram: `Create an engaging Instagram post about ${theme} for ${businessName}. Include relevant hashtags and a call-to-action. Keep it concise and visually appealing. Make it feel authentic and personal.`,
          facebook: `Write a Facebook post about ${theme} for ${businessName}. Make it conversational and community-focused. Include tips or advice that would be valuable to garden center customers.`,
          blog: `Write a comprehensive blog post about ${theme} for ${businessName}. Include an engaging title, introduction, main content with helpful tips, and a conclusion. Make it SEO-friendly and informative for garden center customers.`,
          video: `Create a video script about ${theme} for ${businessName}. Include scene descriptions, dialogue, and key points to cover. Make it engaging and educational for garden center customers.`
        };

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${openAIApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            temperature: 0.7,
            messages: [
              {
                role: 'system',
                content: `You are a professional content creator for garden centers. Create engaging, helpful content that reflects the business context: ${businessContext}. Current month: ${month}. Tone: ${tone}.`
              },
              {
                role: 'user',
                content: channelPrompts[channel]
              }
            ]
          }),
        });

        if (!response.ok) {
          throw new Error(`OpenAI API error for ${channel}: ${response.status}`);
        }

        const data = await response.json();
        content[channel] = data.choices[0].message.content;
        
        console.log(`✅ Generated ${channel} content (${content[channel].length} chars)`);
        
      } catch (error) {
        console.error(`❌ Error generating ${channel} content:`, error);
        content[channel] = `Error generating ${channel} content: ${error.message}`;
      }
    }

    // NOTE: Newsletter content is NOT generated here - it's handled separately 
    // by the generate-structured-newsletter function to ensure proper 4-section format

    console.log('✅ Content generation completed for:', Object.keys(content));

    return new Response(JSON.stringify({
      success: true,
      content: content,
      message: `Generated content for ${Object.keys(content).length} channels (newsletter handled separately)`
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('❌ Error in generate_campaign_content:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
