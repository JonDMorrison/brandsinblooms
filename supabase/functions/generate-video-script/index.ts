
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

    // Build enhanced company context for 90-second holiday teaching videos
    let companyContext = '';
    if (companyProfile) {
      companyContext = `
COMPANY PROFILE FOR SINGLE-PERSON TEACHING VIDEO:
Company Name: ${companyProfile.company_name || 'Garden Center'}
Overview: ${companyProfile.company_overview || ''}
Brand Voice: ${companyProfile.brand_voice || ''}
Target Audience: ${companyProfile.target_audience || ''}
Location Info: ${companyProfile.location_info || ''}
Specializations: ${companyProfile.specializations || ''}

STRICT SINGLE-PERSON TEACHING VIDEO REQUIREMENTS:
- Duration: EXACTLY 90 seconds MAXIMUM
- Format: ONE PERSON standing/sitting in front of ONE STATIC CAMERA
- Structure: Opening Hook (10-15s) → Problem Explanation (15-20s) → Teaching Solution (45-50s) → Summary/Action (10-15s)
- Include [GESTURE] and [PROP] suggestions for demonstrations
- Focus on ONE specific holiday gardening topic with step-by-step instruction
- Include "why" explanations, not just "how"
- Add common mistake warnings and tips
- Make it region-specific using their location information
- Use natural speaking rhythm with pause indicators
- Sound like a knowledgeable garden center owner teaching their community about holiday gardening

ABSOLUTE PROHIBITIONS:
- NEVER write "SCENE 1", "SCENE 2", or any scene divisions
- NEVER suggest camera movements, pans, or position changes
- NEVER include text overlays, graphics, or end screens
- NEVER require multiple locations or setups
- NEVER use "Green Thumbs", "green thumb", or variations
- NEVER use bullet points (•), numbered lists (1., 2., 3.), or dashes (-) for lists
- NEVER start with "Welcome to" or mention week numbers
- NEVER use emojis anywhere in the content
- Write ONLY in flowing paragraphs with natural speaking rhythm
- Include timing markers like [0:00-0:15] for each segment
- MUST be directly related to the holiday/seasonal topic provided
`;
    } else {
      companyContext = `
STRICT SINGLE-PERSON TEACHING VIDEO REQUIREMENTS:
- Duration: EXACTLY 90 seconds MAXIMUM
- Format: ONE PERSON standing/sitting in front of ONE STATIC CAMERA
- Structure: Opening Hook (10-15s) → Problem Explanation (15-20s) → Teaching Solution (45-50s) → Summary/Action (10-15s)
- Include [GESTURE] and [PROP] suggestions for demonstrations
- Focus on ONE specific holiday gardening topic with step-by-step instruction
- Include "why" explanations and common mistake warnings
- Use natural speaking rhythm with pause indicators
- Sound like a knowledgeable garden center owner teaching about holiday gardening
- MUST be directly related to the holiday/seasonal topic provided

ABSOLUTE PROHIBITIONS:
- NEVER write "SCENE 1", "SCENE 2", or any scene divisions
- NEVER suggest camera movements, pans, or position changes
- NEVER include text overlays, graphics, or end screens
- NEVER require multiple locations or setups
- NEVER use "Green Thumbs", "green thumb", or variations
- NEVER use bullet points, numbered lists, or dashes
- NEVER start with "Welcome to" or mention week numbers
- NEVER use emojis
- Write in flowing paragraphs with natural speaking rhythm
- Include timing markers like [0:00-0:15] for each segment
`;
    }

    const prompt = `Create a 90-second maximum single-person teaching video script about "${campaignTitle}" for a garden center owner/expert. This MUST be specifically about ${campaignTitle} and holiday/seasonal gardening topics. ${companyContext}

SINGLE-PERSON TEACHING SCRIPT FORMAT (EXACTLY 90 SECONDS MAXIMUM):

[0:00-0:15] OPENING HOOK (10-15 seconds):
- Start with a compelling seasonal problem related to ${campaignTitle}
- Create curiosity or urgency about this holiday gardening topic
- [GESTURE] Simple hand movements to emphasize points
- Speaker looks directly at camera, no movement required

[0:15-0:35] PROBLEM EXPLANATION (15-20 seconds): 
- Explain the specific ${campaignTitle} gardening challenge in detail
- Share why this matters for holiday garden success
- Mention common mistakes people make during this season
- [PROP] Hold up or point to relevant item if needed

[0:35-1:25] TEACHING SOLUTION (45-50 seconds):
- Provide clear step-by-step instruction for the holiday gardening solution
- Explain the "why" behind each step related to ${campaignTitle}
- Include season-specific timing and techniques
- [PROP] Demonstrate with simple props within arm's reach
- [GESTURE] Use hands to show sizes, directions, techniques
- Add natural [PAUSE] points for emphasis
- Mark key teaching points with [EMPHASIZE]

[1:25-1:30] SUMMARY AND ACTION (10-15 seconds):
- Summarize the key ${campaignTitle} teaching point
- Provide clear next steps for viewers regarding this holiday
- Connect naturally to their garden center business
- End with direct eye contact to camera

FILMING REQUIREMENTS:
- Everything must be achievable by ONE PERSON in front of ONE CAMERA
- No camera movement or position changes
- All props must be within easy reach of the speaker
- Use conversational tone like explaining to a neighbor
- Include [PAUSE] markers for natural speaking rhythm
- Include [EMPHASIZE] markers for key points
- Realistic timing for actual speaking pace

CRITICAL: This video MUST be specifically about ${campaignTitle} and related holiday gardening topics. Do not create generic gardening content. Focus on what makes this holiday special for gardeners. The entire script should revolve around the holiday theme provided and be achievable with one person, one camera, and simple props.

Make this educational, practical, and holiday-specific. Focus on ONE clear teaching point that viewers can immediately apply for ${campaignTitle}. Sound like a trusted local expert sharing valuable knowledge about this specific holiday gardening opportunity.`;

    console.log('Generating single-person holiday teaching video script');

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: `You are a professional video script writer specializing in 90-second maximum single-person educational content for garden centers. Create teaching scripts that are perfectly timed for one person standing or sitting in front of one static camera. 

ABSOLUTE RULES YOU MUST NEVER BREAK:
- NEVER write "SCENE 1", "SCENE 2", or any scene divisions
- NEVER suggest camera movements, pans, zooms, or position changes  
- NEVER include text overlays, graphics, end screens, or visual effects
- NEVER require multiple locations, setups, or complex production
- NEVER use "Green Thumbs", "green thumb", or any variation
- NEVER use bullet points (•), numbered lists (1., 2., 3.), or dashes (-) for lists
- NEVER start with "Welcome to" or mention week numbers
- NEVER use emojis anywhere

WHAT YOU MUST DO:
- Write for ONE PERSON teaching in front of ONE STATIC CAMERA
- Include detailed timing breakdowns [0:00-0:15] format
- Add simple [GESTURE] and [PROP] suggestions only
- Write in flowing paragraphs with natural speaking rhythm
- Focus on the specific holiday topic provided
- Sound like a knowledgeable garden center owner teaching their community
- Keep everything achievable with minimal equipment and setup` },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 1200,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const videoScript = data.choices[0].message.content;

    console.log('Generated single-person holiday teaching video script:', videoScript);

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
