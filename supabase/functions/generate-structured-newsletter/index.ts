
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.10';

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
    const { 
      business_name, 
      theme, 
      week_focus, 
      promo_items = [], 
      tone_note = '',
      userId 
    } = await req.json();

    console.log('Generating 4-section magazine newsletter:', { business_name, theme, week_focus, promo_items: promo_items.length });

    if (!openAIApiKey) {
      console.error('OpenAI API key not configured');
      throw new Error('OpenAI API key not configured');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get company profile for additional context
    let companyProfile = null;
    if (userId) {
      const { data: profile, error: profileError } = await supabase
        .from('company_profiles')
        .select('*')
        .eq('user_id', userId)
        .single();
      
      if (!profileError && profile) {
        companyProfile = profile;
        console.log('Retrieved company profile:', companyProfile.company_name);
      }
    }

    const businessName = business_name || companyProfile?.company_name || 'Your Garden Center';
    
    // Enhanced system prompt with engaging headlines
    const systemPrompt = `You are a professional newsletter creator for garden centers who uses proven copywriting principles to create engaging content.

BUSINESS: ${businessName}
THEME: ${theme}
FOCUS: ${week_focus}

CRITICAL HEADLINE REQUIREMENTS:
- NEVER use "Weekly" or mention week numbers anywhere
- ALL headlines must be engaging and benefit-driven using copywriting best practices
- Use power words: save, transform, discover, secret, proven, rescue, boost
- Create curiosity and emotional appeal
- Focus on customer outcomes and benefits
- NO generic titles like "Seasonal Tips" or "Problem Solving"

Create a structured newsletter with exactly 4 sections using engaging, magazine-style headlines.

HEADLINE EXAMPLES TO FOLLOW:
- Instead of "Seasonal Tips" → "Beat the Heat: Your Garden's Summer Survival Guide"
- Instead of "Problem Solving" → "SOS: Save Your Plants Before It's Too Late"  
- Instead of "Plant Spotlight" → "This Month's Garden Game-Changer"
- Instead of "Looking Ahead" → "Get Ready: Your Garden's Next Power Move"

Return ONLY valid YAML in this exact format:
\`\`\`yaml
newsletter_md: |
  # ${theme} Garden Newsletter
  *Discover the secrets to garden success with expert insights tailored for ${theme}*

  ## Beat the Heat: Your Garden's Summer Survival Guide
  [2-3 sentences with actionable seasonal gardening advice that helps plants thrive during challenging conditions]

  ## This Month's Garden Game-Changer  
  [2-3 sentences featuring a specific plant, technique, or product that will transform their gardening results]

  ## SOS: Save Your Plants Before It's Too Late
  [2-3 sentences about preventing or solving common gardening problems with specific solutions they can implement immediately]

  ## Get Ready: Your Garden's Next Power Move
  [2-3 sentences about upcoming gardening opportunities, planning, or preparation that sets them up for success]

  ---
  Transform your garden with **${businessName}** 🌿
blocks:
  - title: "Beat the Heat: Your Garden's Summer Survival Guide"
    body: "[Actionable seasonal advice with specific techniques and timing]"
    cta: "Get seasonal garden supplies"
    link: "#"
    image_prompt: "thriving garden summer heat protection ${theme}"
    alt_text: "Garden thriving in summer heat"
  - title: "This Month's Garden Game-Changer"
    body: "[Featured plant or technique with transformation benefits]"
    cta: "Discover game-changing plants"
    link: "#"
    image_prompt: "featured plant transformation ${theme} garden center"
    alt_text: "Garden transformation with featured plant"
  - title: "SOS: Save Your Plants Before It's Too Late"
    body: "[Problem prevention and solution with step-by-step guidance]"
    cta: "Get plant rescue solutions"
    link: "#"
    image_prompt: "plant rescue recovery solution ${theme}"
    alt_text: "Successful plant rescue and recovery"
  - title: "Get Ready: Your Garden's Next Power Move"
    body: "[Forward-looking preparation and planning advice]"
    cta: "Plan your garden success"
    link: "#"
    image_prompt: "garden planning preparation ${theme} success"
    alt_text: "Garden planning for success"
extra_content_ideas:
  - title: "The Watering Secret Pros Use"
    quick_desc: "Advanced watering techniques for maximum plant health"
  - title: "Soil Transformation Magic"
    quick_desc: "Turn poor soil into plant paradise"
  - title: "Natural Pest Defense System"
    quick_desc: "Protect plants without harmful chemicals"
  - title: "Seasonal Planting Power Strategy"
    quick_desc: "Time plantings for maximum success"
meta:
  reading_time: "≈3 min"
  theme: "${theme}"
  week_focus: "${week_focus}"
\`\`\``;

    console.log('Calling OpenAI API for newsletter generation...');

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
            content: `Generate a 4-section newsletter for the theme "${theme}" with focus "${week_focus}". Use engaging, benefit-driven headlines that follow copywriting best practices. Make it practical and valuable for garden center customers. NO week numbers or "weekly" language anywhere.` 
          }
        ]
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API error:', response.status, errorText);
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices[0].message.content;

    // Extract YAML from response
    const yamlMatch = content.match(/```yaml\n([\s\S]*?)\n```/) || content.match(/```\n([\s\S]*?)\n```/);
    const yamlContent = yamlMatch ? yamlMatch[1] : content;

    console.log('Generated 4-section newsletter with engaging headlines successfully');

    return new Response(JSON.stringify({
      success: true,
      content: yamlContent
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in generate-structured-newsletter function:', error);
    return new Response(JSON.stringify({ 
      success: false,
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
