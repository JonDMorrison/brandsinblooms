
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.10';

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
    const { 
      business_name, 
      theme, 
      week_focus, 
      promo_items = [], 
      tone_note = '',
      userId 
    } = await req.json();

    console.log('Generating magazine-style newsletter:', { business_name, theme, week_focus, promo_items: promo_items.length });

    if (!openAIApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get company profile for additional context
    let companyProfile = null;
    if (userId) {
      const { data: profile } = await supabase
        .from('company_profiles')
        .select('*')
        .eq('user_id', userId)
        .single();
      companyProfile = profile;
    }

    const contentIdeas = [
      "Quick Gardening Tip", "Seasonal Plant Care", "Local Weather Advisory", "Featured Plant Variety", 
      "Garden Problem Solution", "Customer Success Story", "Expert Plant Advice", 
      `Spotlight on ${theme}`
    ];

    const systemPrompt = `You are a professional newsletter creator for garden centers, specializing in magazine-style layouts.

MAGAZINE FORMAT REQUIREMENTS:
- Main headline: Compelling, benefit-focused ≤ 50 characters
- Intro paragraph: Engaging hook ≤ 100 characters  
- Section headlines: Bold, specific ≤ 45 characters
- Body paragraphs: Exactly 2-3 concise sentences ≤ 180 characters
- Call-to-action: Clear, actionable ≤ 50 characters
- Professional, scannable format
- Grade 7-8 reading level

BUSINESS CONTEXT:
- Business: ${business_name || companyProfile?.company_name || 'Your Garden Center'}
- Theme: ${theme}
- Week Focus: ${week_focus}
- Promotional Items: ${JSON.stringify(promo_items)}
- Tone: ${tone_note || 'friendly-expert'}

Create exactly 4 content sections. Use promo_items for promotional sections, fill remaining with valuable gardening content from: ${contentIdeas.join(', ')}.

Each section needs a specific, detailed image_prompt for garden-related photography.

Return ONLY valid YAML in this exact format:
\`\`\`yaml
newsletter_md: |
  # [Compelling headline ≤50 chars]
  *[Engaging intro hook ≤100 chars]*

  ## [Section 1 headline ≤45 chars]
  [Exactly 2-3 sentences about gardening topic. Keep under 180 characters total.]

  ## [Section 2 headline ≤45 chars] 
  [Exactly 2-3 sentences about gardening topic. Keep under 180 characters total.]

  ## [Section 3 headline ≤45 chars]
  [Exactly 2-3 sentences about gardening topic. Keep under 180 characters total.]

  ## [Section 4 headline ≤45 chars]
  [Exactly 2-3 sentences about gardening topic. Keep under 180 characters total.]

  ---
  Thanks for reading **${business_name || companyProfile?.company_name || 'Your Garden Center'}** 🌿
blocks:
  - title: "[Section 1 headline]"
    body: "[2-3 sentences ≤180 chars]"
    cta: "[Clear action ≤50 chars]"
    link: "[relevant link]"
    image_prompt: "[Detailed garden/plant photography prompt]"
    alt_text: "[Descriptive alt text ≤60 chars]"
  - title: "[Section 2 headline]"
    body: "[2-3 sentences ≤180 chars]"
    cta: "[Clear action ≤50 chars]"
    link: "[relevant link]"
    image_prompt: "[Detailed garden/plant photography prompt]"
    alt_text: "[Descriptive alt text ≤60 chars]"
  - title: "[Section 3 headline]"
    body: "[2-3 sentences ≤180 chars]"
    cta: "[Clear action ≤50 chars]"
    link: "[relevant link]"
    image_prompt: "[Detailed garden/plant photography prompt]"
    alt_text: "[Descriptive alt text ≤60 chars]"
  - title: "[Section 4 headline]"
    body: "[2-3 sentences ≤180 chars]"
    cta: "[Clear action ≤50 chars]"
    link: "[relevant link]"
    image_prompt: "[Detailed garden/plant photography prompt]"
    alt_text: "[Descriptive alt text ≤60 chars]"
extra_content_ideas:
  - title: "[Future idea ≤35 chars]"
    quick_desc: "[Brief description ≤35 chars]"
  - title: "[Future idea ≤35 chars]"
    quick_desc: "[Brief description ≤35 chars]"
  - title: "[Future idea ≤35 chars]"
    quick_desc: "[Brief description ≤35 chars]"
  - title: "[Future idea ≤35 chars]"
    quick_desc: "[Brief description ≤35 chars]"
meta:
  reading_time: "≈3 min"
  theme: "${theme}"
  week_focus: "${week_focus}"
\`\`\``;

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
            content: `Generate a magazine-style structured newsletter for theme "${theme}" with focus "${week_focus}". Create exactly 4 sections with compelling headlines, concise 2-3 sentence bodies, and specific image prompts for garden photography.` 
          }
        ]
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices[0].message.content;

    // Extract YAML from response
    const yamlMatch = content.match(/```yaml\n([\s\S]*?)\n```/) || content.match(/```\n([\s\S]*?)\n```/);
    const yamlContent = yamlMatch ? yamlMatch[1] : content;

    console.log('Generated magazine-style newsletter YAML');

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
