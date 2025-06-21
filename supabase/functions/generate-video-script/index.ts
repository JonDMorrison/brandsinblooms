
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

    // Build enhanced company context for 2-minute teaching videos
    let companyContext = '';
    if (companyProfile) {
      companyContext = `
COMPANY PROFILE FOR 2-MINUTE TEACHING VIDEO:
Company Name: ${companyProfile.company_name || 'Garden Center'}
Overview: ${companyProfile.company_overview || ''}
Brand Voice: ${companyProfile.brand_voice || ''}
Target Audience: ${companyProfile.target_audience || ''}
Location Info: ${companyProfile.location_info || ''}
Specializations: ${companyProfile.specializations || ''}

ENHANCED 2-MINUTE TEACHING VIDEO REQUIREMENTS:
- Duration: EXACTLY 2 minutes (120 seconds) with timing breakdown for each segment
- Structure: Hook (15-20s) → Problem/Challenge (20-30s) → Solution/Teaching (60-70s) → Recap/CTA (15-20s)
- Include [VISUAL CUES] for single-person filming throughout
- Add [PROPS NEEDED] suggestions for demonstrations
- Specify [HAND GESTURES] and [BODY LANGUAGE] directions
- Include [CAMERA FOCUS] instructions (close-ups, wide shots)
- Focus on ONE specific teaching point with step-by-step instruction
- Include "why" explanations, not just "how"
- Add common mistake warnings and before/after scenarios
- Make it region-specific using their location information
- Use natural pause indicators and transition phrases
- Add emphasis markers for key teaching points
- Sound like a knowledgeable garden center owner teaching their local community

CRITICAL CONTENT RESTRICTIONS: 
- ABSOLUTELY NEVER use the phrase "Green Thumbs", "green thumb", "Green Thumb", or any variation
- ABSOLUTELY NEVER use bullet points (•) or numbered lists (1., 2., 3.) 
- ABSOLUTELY NEVER use dashes (-) to create lists
- ABSOLUTELY NEVER start with "Welcome to" or mention week numbers
- ABSOLUTELY NEVER use emojis anywhere in the content
- Write ONLY in flowing paragraphs with natural speaking rhythm
- Use regional timing references instead of week numbers
- Include timing markers like [0:00-0:15] for each segment
`;
    } else {
      companyContext = `
ENHANCED 2-MINUTE TEACHING VIDEO REQUIREMENTS:
- Duration: EXACTLY 2 minutes (120 seconds) with timing breakdown
- Structure: Hook (15-20s) → Problem/Challenge (20-30s) → Solution/Teaching (60-70s) → Recap/CTA (15-20s)
- Include [VISUAL CUES] for single-person filming
- Add [PROPS NEEDED] and [HAND GESTURES] directions
- Include [CAMERA FOCUS] instructions
- Focus on ONE specific teaching point with step-by-step instruction
- Include "why" explanations and common mistake warnings
- Use natural pause indicators and transition phrases
- Sound like a knowledgeable garden center owner teaching

CRITICAL CONTENT RESTRICTIONS: 
- ABSOLUTELY NEVER use "Green Thumbs", "green thumb", or variations
- ABSOLUTELY NEVER use bullet points, numbered lists, or dashes
- ABSOLUTELY NEVER start with "Welcome to" or mention week numbers
- ABSOLUTELY NEVER use emojis
- Write in flowing paragraphs with natural speaking rhythm
- Include timing markers like [0:00-0:15] for each segment
`;
    }

    const prompt = `Create a 2-minute teaching video script about "${campaignTitle}" for a garden center owner/expert. ${companyContext}

SCRIPT STRUCTURE (EXACTLY 2 MINUTES / 120 SECONDS):

[0:00-0:15] HOOK (15-20 seconds):
- Start with a compelling seasonal problem or curiosity gap
- Make viewers feel the urgency or importance
- [VISUAL CUE] and [CAMERA FOCUS] instructions

[0:15-0:45] PROBLEM/CHALLENGE (20-30 seconds): 
- Explain the specific gardening challenge in detail
- Share why this matters for their garden's success
- Mention common mistakes people make
- [VISUAL CUE] Show the problem or demonstrate what goes wrong

[0:45-1:45] SOLUTION/TEACHING (60-70 seconds):
- Provide step-by-step instruction on the solution
- Explain the "why" behind each step
- Include region-specific timing and techniques
- [PROPS NEEDED] List what to have ready for demonstration
- [HAND GESTURES] Describe specific movements
- [VISUAL CUE] Close-ups, demonstrations, before/after comparisons
- Add natural pause points and emphasis markers

[1:45-2:00] RECAP/CALL-TO-ACTION (15-20 seconds):
- Summarize the key teaching point
- Provide clear next steps for viewers
- Connect to their business naturally
- [CAMERA FOCUS] Return to speaking directly to camera

FILMING REQUIREMENTS:
- All content must be filmable by ONE PERSON in front of camera
- Include specific [VISUAL CUE], [PROPS NEEDED], [HAND GESTURES], and [CAMERA FOCUS] directions throughout
- Use conversational, teaching tone like explaining to a neighbor
- Add natural pause indicators with [PAUSE] markers
- Include emphasis markers like [EMPHASIZE] for key points
- Make timing realistic for actual speaking pace

Make this educational, practical, and region-specific. Focus on ONE clear teaching point that viewers can immediately apply. Sound like a trusted local expert sharing valuable knowledge.`;

    console.log('Generating enhanced 2-minute teaching video script with comprehensive filming directions');

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You are a professional video script writer specializing in 2-minute educational content for garden centers. Create teaching scripts that are perfectly timed, include comprehensive filming directions for single-person production, and focus on one clear educational objective. CRITICAL RULES: ABSOLUTELY NEVER use "Green Thumbs", "green thumb", or any variation of this phrase. ABSOLUTELY NEVER use bullet points (•), numbered lists (1., 2., 3.), or dashes (-) for lists. ABSOLUTELY NEVER start with "Welcome to" or mention week numbers. ABSOLUTELY NEVER use emojis. Write only in flowing paragraphs with natural speaking rhythm. Include detailed timing breakdowns, visual cues, props needed, hand gestures, and camera focus instructions throughout the script.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 1500,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const videoScript = data.choices[0].message.content;

    console.log('Generated 2-minute teaching video script with filming directions:', videoScript);

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
