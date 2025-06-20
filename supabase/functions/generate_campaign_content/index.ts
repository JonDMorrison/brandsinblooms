
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-application-name',
};

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🚀 generate_campaign_content: Function started');
    
    // Check if OpenAI API key is configured
    if (!openAIApiKey) {
      console.error('❌ OpenAI API key not configured');
      return new Response(JSON.stringify({ 
        success: false,
        error: 'OpenAI API key not configured' 
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { theme, month, tone, channels, campaignId, userId } = await req.json();

    console.log('📋 Request parameters:', { theme, month, tone, channels, campaignId, userId });

    // Initialize Supabase client
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get company profile for personalization
    let companyProfile = null;
    if (userId) {
      try {
        const { data: profile, error: profileError } = await supabase
          .from('company_profiles')
          .select('*')
          .eq('user_id', userId)
          .single();
        
        if (profileError) {
          console.warn('⚠️ Could not fetch company profile:', profileError.message);
        } else {
          companyProfile = profile;
          console.log('✅ Company profile loaded:', companyProfile?.company_name || 'No name');
        }
      } catch (error) {
        console.warn('⚠️ Error fetching company profile:', error.message);
      }
    }

    const systemPrompt = `You are a garden-center marketing assistant that creates comprehensive content packs.

CRITICAL REQUIREMENTS:
- Create content for ALL channels: Facebook, Instagram, Blog, Video, Newsletter
- Newsletter MUST be an array of exactly 5 blocks with this structure:
  [
    {"heading":"8-word hook","body":"300 chars max","image_prompt":"image description"},
    {"heading":"8-word hook","body":"300 chars max","image_prompt":"image description"},
    {"heading":"8-word hook","body":"300 chars max","image_prompt":"image description"},
    {"heading":"8-word hook","body":"300 chars max","image_prompt":"image description"},
    {"heading":"8-word hook","body":"300 chars max","image_prompt":"image description"}
  ]

CONTENT GUIDELINES:
- Theme: ${theme} for ${month}
- Channel limits: Facebook <600 chars, Instagram <180 chars, Blog ≤1,400 chars, Video ≤900 chars
- NO emojis, max 2 sentences per paragraph
- Professional garden center tone
${companyProfile?.company_name ? `- Company: ${companyProfile.company_name}` : ''}
${companyProfile?.brand_voice ? `- Brand voice: ${companyProfile.brand_voice}` : ''}
${companyProfile?.location_info ? `- Location: ${companyProfile.location_info}` : ''}

Return EXACTLY this JSON structure:
{
  "facebook":"[Facebook post content]",
  "instagram":"[Instagram post content]",
  "blog":"[Blog article content]",
  "video":"[Video script content]",
  "newsletter":[
    {"heading":"Hook 1","body":"Content 1","image_prompt":"Image 1"},
    {"heading":"Hook 2","body":"Content 2","image_prompt":"Image 2"},
    {"heading":"Hook 3","body":"Content 3","image_prompt":"Image 3"},
    {"heading":"Hook 4","body":"Content 4","image_prompt":"Image 4"},
    {"heading":"Hook 5","body":"Content 5","image_prompt":"Image 5"}
  ]
}`;

    console.log('🤖 Making OpenAI API call...');
    
    try {
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
            { role: 'system', content: systemPrompt },
            { 
              role: 'user', 
              content: `Generate comprehensive marketing content for theme: "${theme}" for the month of ${month}. Tone: ${tone}. Include all channels: ${channels.join(', ')}. Make sure newsletter is an array of exactly 5 blocks.` 
            }
          ],
          response_format: {
            type: "json_object"
          }
        }),
      });

      console.log('📡 OpenAI API response status:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ OpenAI API error response:', errorText);
        throw new Error(`OpenAI API error (${response.status}): ${errorText}`);
      }

      const data = await response.json();
      console.log('✅ OpenAI API response received, parsing content...');
      
      let generatedContent;
      try {
        generatedContent = JSON.parse(data.choices[0].message.content);
        console.log('✅ Content parsed successfully, keys:', Object.keys(generatedContent));
      } catch (parseError) {
        console.error('❌ Failed to parse OpenAI response as JSON:', data.choices[0].message.content);
        throw new Error('Failed to parse generated content as JSON');
      }

      // Validate required fields
      const requiredFields = ['facebook', 'instagram', 'blog', 'video', 'newsletter'];
      for (const field of requiredFields) {
        if (!generatedContent[field]) {
          console.error(`❌ Missing required field: ${field}`);
          
          // Provide fallback content
          if (field === 'newsletter') {
            generatedContent[field] = [
              {"heading": "Seasonal Garden Tips", "body": `Discover essential ${theme.toLowerCase()} strategies for your garden this ${month}.`, "image_prompt": `${theme} gardening tips`},
              {"heading": "Best Plants This Month", "body": `Learn about the perfect plants to grow during ${month} season.`, "image_prompt": `${month} seasonal plants`},
              {"heading": "Garden Care Essentials", "body": "Expert advice on maintaining your garden's health and beauty.", "image_prompt": "garden maintenance tools"},
              {"heading": "Seasonal Plant Selection", "body": "Choose the right plants for optimal growth this season.", "image_prompt": "plant selection display"},
              {"heading": "Professional Garden Support", "body": "Visit us for expert guidance and quality garden supplies.", "image_prompt": "garden center consultation"}
            ];
          } else {
            generatedContent[field] = `Professional ${field} content about ${theme} for ${month}. Visit our garden center for expert advice and quality supplies.`;
          }
        }
      }

      // Ensure newsletter is properly formatted
      if (!Array.isArray(generatedContent.newsletter)) {
        console.log('Newsletter is not an array, converting...');
        generatedContent.newsletter = [
          {"heading": "Seasonal Garden Focus", "body": `Essential ${theme.toLowerCase()} tips for ${month}.`, "image_prompt": `${theme} gardening`},
          {"heading": "Expert Plant Selection", "body": "Choose the perfect plants for this season.", "image_prompt": "seasonal plant display"},
          {"heading": "Garden Care Made Easy", "body": "Professional tips for garden maintenance.", "image_prompt": "garden care tools"},
          {"heading": "Quality Garden Supplies", "body": "Find everything you need for garden success.", "image_prompt": "garden center products"},
          {"heading": "Visit Our Garden Center", "body": "Get expert advice from our gardening professionals.", "image_prompt": "garden center consultation"}
        ];
      }

      // Ensure exactly 5 newsletter blocks
      while (generatedContent.newsletter.length < 5) {
        const blockNum = generatedContent.newsletter.length + 1;
        generatedContent.newsletter.push({
          heading: `${theme} Guide ${blockNum}`,
          body: `Additional ${theme.toLowerCase()} information for your gardening success.`,
          image_prompt: `${theme} gardening guide ${blockNum}`
        });
      }

      if (generatedContent.newsletter.length > 5) {
        generatedContent.newsletter = generatedContent.newsletter.slice(0, 5);
      }

      // Enforce character limits
      if (generatedContent.facebook?.length > 600) {
        generatedContent.facebook = generatedContent.facebook.substring(0, 597) + '...';
      }
      if (generatedContent.instagram?.length > 180) {
        generatedContent.instagram = generatedContent.instagram.substring(0, 177) + '...';
      }
      if (generatedContent.blog?.length > 1400) {
        generatedContent.blog = generatedContent.blog.substring(0, 1397) + '...';
      }
      if (generatedContent.video?.length > 900) {
        generatedContent.video = generatedContent.video.substring(0, 897) + '...';
      }

      // Validate and fix newsletter blocks
      generatedContent.newsletter.forEach((block, index) => {
        if (!block.heading || !block.body || !block.image_prompt) {
          console.log(`Fixing newsletter block ${index + 1}`);
          block.heading = block.heading || `${theme} Tips ${index + 1}`;
          block.body = block.body || `Essential ${theme.toLowerCase()} information for your garden.`;
          block.image_prompt = block.image_prompt || `${theme} gardening visual ${index + 1}`;
        }
        if (block.heading?.length > 60) {
          block.heading = block.heading.substring(0, 57) + '...';
        }
        if (block.body?.length > 300) {
          block.body = block.body.substring(0, 297) + '...';
        }
        if (block.image_prompt?.length > 140) {
          block.image_prompt = block.image_prompt.substring(0, 137) + '...';
        }
      });

      console.log('✅ Content validation completed successfully');
      console.log('📧 Newsletter blocks:', generatedContent.newsletter.length);

      return new Response(JSON.stringify({
        success: true,
        content: generatedContent
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });

    } catch (openaiError) {
      console.error('❌ OpenAI API call failed:', openaiError);
      return new Response(JSON.stringify({ 
        success: false,
        error: `OpenAI API error: ${openaiError.message}` 
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

  } catch (error) {
    console.error('❌ Function error:', error);
    console.error('❌ Error stack:', error.stack);
    return new Response(JSON.stringify({ 
      success: false,
      error: error.message || 'Unknown error occurred'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
