
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
const supabaseUrl = Deno.env.get('SUPABASE_URL');
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-application-name',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { campaignTitle, userId, weekDescription } = await req.json();

    if (!openAIApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    // Initialize Supabase client
    const supabase = createClient(supabaseUrl!, supabaseServiceKey!);

    // Fetch company profile for personalization
    let companyProfile = null;
    if (userId) {
      const { data: profileData, error: profileError } = await supabase
        .from('company_profiles')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (!profileError && profileData) {
        companyProfile = profileData;
      }
    }

    // Build enhanced company context for natural teaching conversation
    let companyContext = '';
    if (companyProfile) {
      companyContext = `
COMPANY PROFILE FOR NATURAL TEACHING CONVERSATION:
Company Name: ${companyProfile.company_name || 'Garden Center'}
Overview: ${companyProfile.company_overview || ''}
Brand Voice: ${companyProfile.brand_voice || ''}
Target Audience: ${companyProfile.target_audience || ''}
Location Info: ${companyProfile.location_info || ''}
Specializations: ${companyProfile.specializations || ''}

NATURAL TEACHING CONVERSATION REQUIREMENTS:
- Duration: About 200-250 words of natural speaking
- Style: Direct, helpful teaching without any greetings or introductions
- Focus: ONE specific holiday gardening topic with practical advice
- Flow: Jump straight into the gardening advice → explain why it matters → share practical tips → end with encouragement
- Voice: Knowledgeable garden center expert sharing expertise
- NO production cues, timing markers, scene directions, or artificial structure
- Sound completely natural and conversational
- Include "why" explanations, not just "how"
- Add helpful warnings about common mistakes
- Make it region-specific using their location information
- NEVER start with greetings like "Hey there", "Hello gardeners", or similar
- Jump straight into valuable gardening information

ABSOLUTE PROHIBITIONS:
- NEVER use any greetings or salutations ("Hey there", "Hello", "Hi gardeners", etc.)
- NEVER use timing markers like [0:00-0:15] or any time references
- NEVER use scene directions like "Visual:", "Narration:", "Cut to:", etc.
- NEVER use gesture cues like [GESTURE], [PROP], [PAUSE], or [EMPHASIZE]
- NEVER mention cameras, filming, or production elements
- NEVER use structured segments or artificial divisions
- NEVER use emojis anywhere in the content
- NEVER use bullet points, numbered lists, or dashes
- Write in flowing, natural paragraphs like normal conversation
- MUST be directly related to the holiday/seasonal topic provided
`;
    } else {
      companyContext = `
NATURAL TEACHING CONVERSATION REQUIREMENTS:
- Duration: About 200-250 words of natural speaking
- Style: Direct, helpful teaching without any greetings or introductions
- Focus: ONE specific holiday gardening topic with practical advice
- Flow: Jump straight into the gardening advice → explain why it matters → share practical tips → end with encouragement
- Voice: Knowledgeable garden center expert sharing expertise
- NO production cues, timing markers, scene directions, or artificial structure
- Sound completely natural and conversational
- Include "why" explanations and helpful warnings
- NEVER start with greetings - jump straight into valuable content
- MUST be directly related to the holiday/seasonal topic provided

ABSOLUTE PROHIBITIONS:
- NEVER use any greetings or salutations
- NEVER use timing markers or production cues
- NEVER use scene directions or artificial structure
- NEVER use bullet points, numbered lists, or dashes
- NEVER use emojis
- Write in flowing, natural conversation style
`;
    }

    const prompt = `Create natural teaching content about "${campaignTitle}" for a knowledgeable garden center expert. This should sound like someone explaining gardening advice directly - NO greetings, NO introductions, just straight into the valuable information. ${companyContext}

DIRECT TEACHING CONTENT (200-250 words):

Start immediately with the most important gardening information about ${campaignTitle}. NO greetings like "Hey there" or "Hello gardeners" - jump straight into what gardeners need to know about this specific holiday/seasonal topic.

Structure naturally:
- Open with the most critical timing or opportunity about ${campaignTitle}
- Explain why this specific timing matters for gardeners
- Share practical, actionable advice they can use right now
- Include helpful warnings about common mistakes people make
- End with confidence-building encouragement about their success

Make this sound completely natural - no artificial structure, no production language, no cues. Just pure conversational teaching about ${campaignTitle} and how it relates to gardening success. The entire content should focus on this specific holiday theme and provide genuine value to gardeners.

Sound like a trusted local expert sharing valuable knowledge about this specific holiday gardening opportunity. Keep it conversational, helpful, and focused on practical advice people can immediately use for ${campaignTitle}.

CRITICAL: Start immediately with gardening information. No "Welcome", no "Hey there", no greetings of any kind. Jump straight into the valuable content.`;

    console.log('Generating natural teaching content without greetings or production cues');

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: `You are a professional content writer specializing in natural, conversational teaching content for garden centers. Create authentic teaching content that sounds like a knowledgeable garden center expert explaining gardening advice directly to customers.

ABSOLUTE RULES YOU MUST NEVER BREAK:
- NEVER start with any greeting ("Hey there", "Hello", "Hi gardeners", etc.)
- NEVER use timing markers or production cues
- NEVER use scene directions like "Visual:", "Narration:", "Cut to:"
- NEVER use production cues like [GESTURE], [PROP], [PAUSE], [EMPHASIZE]
- NEVER mention cameras, filming, production, or any technical elements
- NEVER use structured segments, scene divisions, or artificial formatting
- NEVER use bullet points, numbered lists, or dashes for organization
- NEVER use emojis anywhere

WHAT YOU MUST DO:
- Start immediately with valuable gardening information
- Write in completely natural, flowing conversation style
- Sound like a knowledgeable person explaining gardening directly
- Focus on the specific holiday topic provided
- Include practical advice and helpful warnings
- Write about 200-250 words for natural speaking
- Make it sound authentic and conversational throughout
- Keep everything focused on the holiday gardening topic provided
- Jump straight into the most important information` },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 800,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const videoScript = data.choices[0].message.content;

    console.log('Generated natural teaching content:', videoScript);

    return new Response(JSON.stringify({ script: videoScript }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in generate-video-script function:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
