
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.10';

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
- Duration: 90 seconds of natural speaking (about 200-250 words)
- Style: Conversational teaching like explaining to a friend or customer
- Focus: ONE specific holiday gardening topic with practical advice
- Flow: Natural introduction → explain the topic → share practical tips → wrap up with encouragement
- Voice: Knowledgeable garden center owner sharing expertise
- NO production cues, timing markers, or artificial structure
- Sound completely natural and conversational
- Include "why" explanations, not just "how"
- Add helpful warnings about common mistakes
- Make it region-specific using their location information
- Use natural speaking rhythm without any cue markers

ABSOLUTE PROHIBITIONS:
- NEVER use timing markers like [0:00-0:15] or any time references
- NEVER use gesture cues like [GESTURE], [PROP], [PAUSE], or [EMPHASIZE]
- NEVER mention cameras, filming, or production elements
- NEVER use structured segments or artificial divisions
- NEVER use "Welcome to" or formal introductions
- NEVER use emojis anywhere in the content
- NEVER use bullet points, numbered lists, or dashes
- Write in flowing, natural paragraphs like normal conversation
- MUST be directly related to the holiday/seasonal topic provided
`;
    } else {
      companyContext = `
NATURAL TEACHING CONVERSATION REQUIREMENTS:
- Duration: 90 seconds of natural speaking (about 200-250 words)
- Style: Conversational teaching like explaining to a friend or customer
- Focus: ONE specific holiday gardening topic with practical advice
- Flow: Natural introduction → explain the topic → share practical tips → wrap up
- Voice: Knowledgeable garden center owner sharing expertise
- NO production cues, timing markers, or artificial structure
- Sound completely natural and conversational
- Include "why" explanations and helpful warnings
- MUST be directly related to the holiday/seasonal topic provided

ABSOLUTE PROHIBITIONS:
- NEVER use timing markers or production cues
- NEVER mention cameras, filming, or production
- NEVER use structured segments or artificial divisions
- NEVER use bullet points, numbered lists, or dashes
- NEVER use emojis
- Write in flowing, natural conversation style
`;
    }

    const prompt = `Create a natural, conversational teaching script about "${campaignTitle}" for a knowledgeable garden center owner. This should sound like someone explaining gardening advice to a customer or friend, covering this specific holiday/seasonal topic in about 90 seconds of natural speaking. ${companyContext}

NATURAL CONVERSATION SCRIPT (90 seconds of speaking):

Write this as a flowing, natural conversation where someone knowledgeable is explaining ${campaignTitle} and related holiday gardening advice. The person should sound helpful, knowledgeable, and conversational - like they're talking to someone who just walked into their garden center asking for advice about this topic.

Structure it naturally:
- Start by connecting with the seasonal opportunity of ${campaignTitle}
- Explain why this timing matters for gardeners
- Share practical, actionable advice they can use right now
- Include helpful warnings about common mistakes people make
- End with encouragement and confidence in their success

Make this sound completely natural - no artificial structure, no production language, no cues. Just pure conversational teaching about ${campaignTitle} and how it relates to gardening success. The entire script should focus on this specific holiday theme and provide genuine value to gardeners.

Sound like a trusted local expert sharing valuable knowledge about this specific holiday gardening opportunity. Keep it conversational, helpful, and focused on practical advice people can immediately use for ${campaignTitle}.`;

    console.log('Generating natural teaching conversation script');

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: `You are a professional content writer specializing in natural, conversational teaching content for garden centers. Create authentic teaching conversations that sound like a knowledgeable garden center owner explaining gardening advice to customers.

ABSOLUTE RULES YOU MUST NEVER BREAK:
- NEVER use timing markers like [0:00-0:15] or any time references
- NEVER use production cues like [GESTURE], [PROP], [PAUSE], [EMPHASIZE], or any bracketed instructions
- NEVER mention cameras, filming, production, or any technical elements
- NEVER use structured segments, scene divisions, or artificial formatting
- NEVER use bullet points, numbered lists, or dashes for organization
- NEVER use "Welcome to" or formal broadcast-style introductions
- NEVER use emojis anywhere

WHAT YOU MUST DO:
- Write in completely natural, flowing conversation style
- Sound like a knowledgeable person explaining gardening to a friend
- Focus on the specific holiday topic provided
- Include practical advice and helpful warnings
- Write about 200-250 words for 90 seconds of natural speaking
- Make it sound authentic and conversational throughout
- Keep everything focused on the holiday gardening topic provided` },
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

    console.log('Generated natural teaching conversation script:', videoScript);

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
