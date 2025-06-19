
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

    console.log('Generating structured newsletter:', { business_name, theme, week_focus, promo_items: promo_items.length });

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
      "Quick Tip", "Did You Know?", "Local Weather Note", "Tool of the Week", 
      "Recipe Featuring Garden Produce", "Employee Spotlight", "Success Story / Photo Share", 
      `Fun Fact About ${theme}`
    ];

    const systemPrompt = `You are a professional newsletter formatter for garden centers.

STRICT FORMATTING RULES:
- Headline ≤ 60 characters
- Intro paragraph ≤ 120 characters  
- Block body ≤ 220 characters
- CTA line ≤ 55 characters
- Alt text ≤ 80 characters
- Max 1 emoji per block (at start of title or after first sentence)
- Grade 8 reading level maximum

INPUT:
- Business: ${business_name || companyProfile?.company_name || 'Garden Center'}
- Theme: ${theme}
- Week Focus: ${week_focus}
- Promotional Items: ${JSON.stringify(promo_items)}
- Tone: ${tone_note || 'friendly-expert'}

Generate exactly 4-5 content blocks. Use promo_items for promotional blocks, fill remaining with value content from: ${contentIdeas.join(', ')}.

Return ONLY valid YAML in this exact format:
\`\`\`yaml
newsletter_md: |
  # [headline ≤60 chars]
  *[intro ≤120 chars]*

  ## [Block 1 Title]
  [body ≤220 chars]
  **[cta ≤55 chars]** → [link]

  ## [Block 2 Title] 
  [body ≤220 chars]
  **[cta ≤55 chars]** → [link]

  ## [Block 3 Title]
  [body ≤220 chars] 
  **[cta ≤55 chars]** → [link]

  ## [Block 4 Title]
  [body ≤220 chars]
  **[cta ≤55 chars]** → [link]

  ---
  Thanks for reading **${business_name || companyProfile?.company_name || 'Garden Center'}** 🌿
blocks:
  - title: "[title]"
    body: "[body ≤220]"
    cta: "[cta ≤55]"
    link: "[link]"
    image_prompt: "[prompt for relevant image]"
    alt_text: "[alt ≤80]"
  - title: "[title]"
    body: "[body ≤220]"
    cta: "[cta ≤55]"
    link: "[link]"
    image_prompt: "[prompt for relevant image]"
    alt_text: "[alt ≤80]"
  - title: "[title]"
    body: "[body ≤220]"
    cta: "[cta ≤55]"
    link: "[link]"
    image_prompt: "[prompt for relevant image]"
    alt_text: "[alt ≤80]"
  - title: "[title]"
    body: "[body ≤220]"
    cta: "[cta ≤55]"
    link: "[link]"
    image_prompt: "[prompt for relevant image]"
    alt_text: "[alt ≤80]"
extra_content_ideas:
  - title: "[idea 1 ≤40]"
    quick_desc: "[desc ≤40]"
  - title: "[idea 2 ≤40]"
    quick_desc: "[desc ≤40]"
  - title: "[idea 3 ≤40]"
    quick_desc: "[desc ≤40]"
  - title: "[idea 4 ≤40]"
    quick_desc: "[desc ≤40]"
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
            content: `Generate a structured newsletter for theme "${theme}" with focus "${week_focus}". Include ${promo_items.length} promotional items and fill remaining blocks with value content.` 
          }
        ]
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices[0].message.content;

    // Extract YAML from response (remove code block markers if present)
    const yamlMatch = content.match(/```yaml\n([\s\S]*?)\n```/) || content.match(/```\n([\s\S]*?)\n```/);
    const yamlContent = yamlMatch ? yamlMatch[1] : content;

    console.log('Generated structured newsletter YAML');

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
