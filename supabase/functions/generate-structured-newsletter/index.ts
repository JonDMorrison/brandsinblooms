
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
    
    // Simplified content generation for reliability
    const systemPrompt = `You are a professional newsletter creator for garden centers. Create exactly 4 distinct sections for a weekly newsletter.

BUSINESS: ${businessName}
THEME: ${theme}
FOCUS: ${week_focus}

Create a structured newsletter with exactly 4 sections. Each section should be relevant to gardening and the weekly theme.

Return ONLY valid YAML in this exact format:
\`\`\`yaml
newsletter_md: |
  # ${theme} - Weekly Garden Newsletter
  *Welcome to this week's gardening insights focused on ${theme}*

  ## Section 1: Seasonal Tips
  [2-3 sentences about current seasonal gardening advice related to ${theme}]

  ## Section 2: Plant Spotlight  
  [2-3 sentences featuring a specific plant or technique related to ${theme}]

  ## Section 3: Problem Solving
  [2-3 sentences about common gardening challenges and solutions for ${theme}]

  ## Section 4: Looking Ahead
  [2-3 sentences about upcoming gardening tasks or preparation related to ${theme}]

  ---
  Thanks for reading **${businessName}** 🌿
blocks:
  - title: "Seasonal Tips"
    body: "[Content for seasonal tips section]"
    cta: "Visit us for seasonal supplies"
    link: "#"
    image_prompt: "seasonal gardening ${theme} tips advice"
    alt_text: "Seasonal gardening tips"
  - title: "Plant Spotlight"
    body: "[Content for plant spotlight section]"
    cta: "Shop featured plants"
    link: "#"
    image_prompt: "featured plant ${theme} garden center"
    alt_text: "Featured plant display"
  - title: "Problem Solving"
    body: "[Content for problem solving section]"
    cta: "Get expert advice"
    link: "#"
    image_prompt: "garden problem solution ${theme}"
    alt_text: "Garden problem solution"
  - title: "Looking Ahead"
    body: "[Content for looking ahead section]"
    cta: "Plan your garden"
    link: "#"
    image_prompt: "future garden planning ${theme}"
    alt_text: "Garden planning"
extra_content_ideas:
  - title: "Watering Tips"
    quick_desc: "Efficient watering techniques"
  - title: "Soil Health"
    quick_desc: "Maintaining healthy soil"
  - title: "Pest Management"
    quick_desc: "Natural pest control methods"
  - title: "Seasonal Planting"
    quick_desc: "What to plant this season"
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
            content: `Generate a 4-section newsletter for the theme "${theme}" with focus "${week_focus}". Make it practical and useful for garden center customers.` 
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

    console.log('Generated 4-section newsletter successfully');

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
