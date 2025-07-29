
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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
      userId,
      is_holiday = false,
      holiday_context = '',
      existingContent = null,
      personas = []
    } = await req.json();

    console.log('Generating StoryBrand-enhanced 4-section newsletter:', { 
      business_name, 
      theme, 
      week_focus, 
      promo_items: promo_items.length,
      is_holiday,
      holiday_context
    });

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
    
    // Format personas for prompt context
    const formatPersonasForPrompt = (personas: any[]): string => {
      if (!personas || personas.length === 0) {
        return "general garden center customers interested in plants, gardening supplies, and outdoor living";
      }
      const personaNames = personas.map(p => p.persona_name || p.name);
      if (personaNames.length === 1) return personaNames[0];
      if (personaNames.length === 2) return `${personaNames[0]} and ${personaNames[1]}`;
      const allButLast = personaNames.slice(0, -1).join(", ");
      return `${allButLast}, and ${personaNames[personaNames.length - 1]}`;
    };

    const formattedPersonas = formatPersonasForPrompt(personas);
    
    // Check if we're restructuring existing content
    const isRestructuring = existingContent && existingContent.length > 100;
    
    // Enhanced StoryBrand system prompt
    const contentType = is_holiday ? 'holiday celebration' : 'seasonal focus';
    const contextualFocus = is_holiday ? `celebrating ${holiday_context || theme}` : week_focus;
    
    console.log('Newsletter generation mode:', {
      isRestructuring,
      hasExistingContent: !!existingContent,
      existingContentLength: existingContent?.length || 0,
      personasCount: personas.length,
      targetPersonas: formattedPersonas
    });
    
    const systemPrompt = `# ROLE
You are a certified StoryBrand Guide and garden center marketing expert with deep knowledge of the StoryBrand framework.

${isRestructuring ? `# RESTRUCTURING TASK
You are converting existing newsletter content into proper YAML structure. Take the existing content and:
1. Extract key themes and messages
2. Convert into StoryBrand framework structure
3. Create 4 compelling sections with proper headlines
4. Remove any email headers, subject lines, or formatting issues
5. Maintain the core value and offers from the original content

# EXISTING CONTENT TO RESTRUCTURE:
${existingContent}` : ''}

# OUTPUT PARAMETERS
• Content format: structured newsletter with 4 sections
• Brand: ${businessName}
• Audience: Home gardeners and plant enthusiasts
• Goal: visit garden center for expert advice and supplies
• Theme: ${theme}
• Focus: ${contextualFocus}
• Target length: 300-400 words total
${isRestructuring ? '• Task: Restructure existing content into proper YAML format' : ''}

# NON-NEGOTIABLE RULES
1. **Absolutely no emojis** in any part of the text—headlines, body, signatures, or hashtags.
2. **CRITICAL: Use exactly two spaces after every sentence ending (period, question mark, exclamation mark) before starting the next sentence throughout the entire newsletter.**
3. Never mention you are an AI or reference the prompt.
4. **NEVER use numbered weeks** (Week 1, Week 26, etc.) or "weekly" language anywhere.
5. **NEVER start with "Welcome to"** or generic greetings.
6. **NEVER use bullet points (•) or numbered lists (1., 2., 3.)** - write in flowing paragraphs only.
7. **NEVER use the phrase "Green Thumbs"** or any variation.
8. **MANDATORY: Verify proper sentence spacing before finalizing - every sentence must end with exactly two spaces before the next sentence.**

# STORYBRAND FRAMEWORK FOR EACH SECTION
Each section must incorporate StoryBrand elements:
1. Character – identify the gardener as the hero
2. Problem – external gardening challenge + internal frustration
3. Guide – show garden center's empathy + authority
4. Plan – actionable steps in paragraph form
5. Call to Action – invitation to visit garden center
6. Success – vivid picture of thriving garden outcome

# HEADLINE REQUIREMENTS
Create compelling, benefit-driven headlines using copywriting best practices:
- Use power words: save, transform, discover, secret, proven, rescue, boost
- Create curiosity and emotional appeal
- Focus on customer outcomes and benefits
- NO generic titles like "Seasonal Tips" or "Weekly Updates"
${is_holiday ? `- Incorporate ${holiday_context || theme} themes naturally` : ''}

HEADLINE EXAMPLES TO FOLLOW (adapt to actual theme):
${theme.toLowerCase().includes('tree') ? `- Instead of "Tree Tips" → "Essential Tree Health Assessment: Your Property's Foundation Check"
- Instead of "Tree Problems" → "Warning Signs: When Your Trees Need Professional Attention"  
- Instead of "Tree Spotlight" → "National Tree Month: The Perfect Time for Tree Care Planning"
- Instead of "Tree Future" → "Invest in Tomorrow: Strategic Tree Care for Long-term Success"` : `- Instead of "Seasonal Tips" → "Beat the Heat: Your Garden's Summer Survival Guide"
- Instead of "Problem Solving" → "SOS: Save Your Plants Before It's Too Late"  
- Instead of "Plant Spotlight" → "This Month's Garden Game-Changer"
- Instead of "Looking Ahead" → "Get Ready: Your Garden's Next Power Move"`}

# VOICE & TONE
Warm, conversational, confident.  Use contractions; avoid jargon and filler.  
Concrete plant names and sensory garden details.  Vary sentence length for natural rhythm.  
Sound like a knowledgeable local garden expert talking to familiar customers.  
**CRITICAL: Maintain exactly two spaces after every sentence ending throughout all content.**

# AUDIENCE INSIGHTS
This campaign is targeted toward the following customer personas: ${formattedPersonas}. Write with empathy and clarity to resonate with these profiles. Ensure relevance, tone, and examples match their goals and challenges.

Create a structured newsletter with exactly 4 sections using engaging, StoryBrand-driven headlines${is_holiday ? ` that celebrate ${holiday_context || theme}` : ''}.

Return ONLY valid YAML in this exact format:`;

    const generateThemeSpecificTemplate = (theme: string, businessName: string) => {
      if (theme.toLowerCase().includes('tree')) {
        return `
\`\`\`yaml
newsletter_md: |
  # ${theme} Newsletter
  *Essential tree care insights${is_holiday ? ` for ${holiday_context || theme}` : ` for ${theme}`} to maintain healthy, thriving trees on your property*

  ## Essential Tree Health Assessment: Your Property's Foundation Check
  [Write 2-3 sentences about the importance of regular tree health checks, StoryBrand framework.]

  ## National Tree Month: The Perfect Time for Tree Care Planning  
  [Write 2-3 sentences about timing tree care for optimal results, positioning customer as proactive steward.]

  ## Warning Signs: When Your Trees Need Professional Attention
  [Write 2-3 sentences about identifying tree problems early, with garden center as expert guide.]

  ## Invest in Tomorrow: Strategic Tree Care for Long-term Success
  [Write 2-3 sentences about long-term tree investment and future property value.]

  ---
  Expert tree care with **${businessName}** 🌿
blocks:
  - title: "Essential Tree Health Assessment: Your Property's Foundation Check"
    body: "[StoryBrand content: tree health importance in paragraph form]"
    cta: "Schedule tree assessment"
    link: "#"
    image_prompt: "professional arborist examining tree trunk for health"
    alt_text: "Professional tree health assessment"
  - title: "National Tree Month: The Perfect Time for Tree Care Planning"
    body: "[StoryBrand content: optimal timing for tree care in paragraph form]"
    cta: "Get tree care supplies"
    link: "#"
    image_prompt: "healthy mature trees in residential landscape"
    alt_text: "Well-maintained residential trees"
  - title: "Warning Signs: When Your Trees Need Professional Attention"
    body: "[StoryBrand content: early problem identification in paragraph form]"
    cta: "Consult tree experts"
    link: "#"
    image_prompt: "tree care tools and professional equipment"
    alt_text: "Professional tree care tools"
  - title: "Invest in Tomorrow: Strategic Tree Care for Long-term Success"
    body: "[StoryBrand content: long-term tree investment in paragraph form]"
    cta: "Plan tree strategy"
    link: "#"
    image_prompt: "beautiful mature trees enhancing property value"
    alt_text: "Mature trees adding property value"`;
      } else {
        return `
\`\`\`yaml
newsletter_md: |
  # ${theme} Garden Newsletter
  *Discover expert gardening insights${is_holiday ? ` for ${holiday_context || theme}` : ` for ${theme}`} that transform your garden into a thriving paradise*

  ## Beat the Heat: Your Garden's Summer Survival Guide
  [Write 2-3 sentences following StoryBrand: identify gardener challenge, show empathy, provide solution. No lists or bullets - flowing paragraphs only.]

  ## This Month's Garden Game-Changer  
  [Write 2-3 sentences featuring a transformative plant or technique, positioning customer as hero achieving garden success.]

  ## SOS: Save Your Plants Before It's Too Late
  [Write 2-3 sentences about preventing garden problems, with garden center as trusted guide providing expert solutions.]

  ## Get Ready: Your Garden's Next Power Move
  [Write 2-3 sentences about upcoming opportunities, painting picture of future garden success.]

  ---
  Transform your garden with **${businessName}** 🌿
blocks:
  - title: "Beat the Heat: Your Garden's Summer Survival Guide"
    body: "[StoryBrand content: gardener challenge + expert solution in paragraph form]"
    cta: "Get seasonal garden supplies"
    link: "#"
    image_prompt: "lush garden thriving in summer sunlight"
    alt_text: "Garden thriving in summer heat"
  - title: "This Month's Garden Game-Changer"
    body: "[StoryBrand content: featured plant transformation in paragraph form]"
    cta: "Discover game-changing plants"
    link: "#"
    image_prompt: "featured plant transformation garden center"
    alt_text: "Garden transformation with featured plant"
  - title: "SOS: Save Your Plants Before It's Too Late"
    body: "[StoryBrand content: problem prevention and expert solution in paragraph form]"
    cta: "Get plant rescue solutions"
    link: "#"
    image_prompt: "healthy plants protected from pests naturally"
    alt_text: "Successful plant rescue and recovery"
  - title: "Get Ready: Your Garden's Next Power Move"
    body: "[StoryBrand content: future planning and success visualization in paragraph form]"
    cta: "Plan your garden success"
    link: "#"
    image_prompt: "garden planning preparation for success"
    alt_text: "Garden planning for success"`;
      }
    };

    const yamlTemplate = generateThemeSpecificTemplate(theme, businessName)
extra_content_ideas:
  - title: "${theme.toLowerCase().includes('tree') ? 'Professional Tree Pruning Secrets' : 'The Watering Secret Pros Use'}"
    quick_desc: "${theme.toLowerCase().includes('tree') ? 'Expert pruning techniques for healthy tree growth' : 'Advanced watering techniques for maximum plant health'}"
  - title: "${theme.toLowerCase().includes('tree') ? 'Soil Health for Strong Trees' : 'Soil Transformation Magic'}"
    quick_desc: "${theme.toLowerCase().includes('tree') ? 'Soil amendments that promote strong root systems' : 'Turn poor soil into plant paradise'}"
  - title: "${theme.toLowerCase().includes('tree') ? 'Tree Disease Prevention Guide' : 'Natural Pest Defense System'}"
    quick_desc: "${theme.toLowerCase().includes('tree') ? 'Protect trees from common diseases naturally' : 'Protect plants without harmful chemicals'}"
  - title: "${theme.toLowerCase().includes('tree') ? 'Strategic Tree Planting Timeline' : 'Seasonal Planting Power Strategy'}"
    quick_desc: "${theme.toLowerCase().includes('tree') ? 'Best timing for tree planting and establishment' : 'Time plantings for maximum success'}"
meta:
  reading_time: "≈3 min"
  theme: "${theme}"
  week_focus: "${contextualFocus}"
\`\`\``;

    console.log('Calling OpenAI API for StoryBrand newsletter generation...');

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        temperature: 0.7,
        messages: [
          { role: 'system', content: systemPrompt },
          { 
            role: 'user', 
            content: existingContent ? 
              `RESTRUCTURE this existing newsletter content into proper YAML format for "${theme}" with focus "${contextualFocus}":

EXISTING CONTENT:
---
${existingContent}
---

Convert this into the structured YAML format while:
- Maintaining all key messages, offers, and calls to action
- Following StoryBrand framework for each section
- Using engaging, benefit-driven headlines
- Writing in flowing paragraphs only - no bullet points or lists
- NO week numbers or "weekly" language anywhere

Template to follow: ${yamlTemplate}` :
              `Generate a 4-section StoryBrand newsletter for "${theme}" with focus "${contextualFocus}". Each section must follow the StoryBrand framework: position gardeners as heroes, identify their challenges, show garden center as trusted guide, provide actionable solutions, and paint success pictures. Use engaging, benefit-driven headlines. Write in flowing paragraphs only - absolutely no bullet points or numbered lists. NO week numbers or "weekly" language anywhere.${is_holiday ? ` Incorporate ${holiday_context || theme} themes naturally.` : ''}

Template to follow: ${yamlTemplate}`
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

    // Validate content for StoryBrand compliance
    const validation = validateStoryBrandContent(yamlContent);
    if (!validation.isValid) {
      console.warn('⚠️ Generated content has StoryBrand validation issues:', validation.issues);
    }

    console.log(`Generated StoryBrand 4-section newsletter successfully for ${contentType}`);

    return new Response(JSON.stringify({
      success: true,
      yamlContent: yamlContent, // Keep existing field name for compatibility
      content: yamlContent,     // Also provide as content for flexibility
      meta: {
        campaign_id: null, // Will be set when associated with campaign
        source: isRestructuring ? "content_restructure" : "weekly_theme",
        crm_enabled: true,
        linked_theme: theme,
        generated_at: new Date().toISOString(),
        content_type: isRestructuring ? "restructured_newsletter" : contentType,
        restructured: isRestructuring
      }
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

function validateStoryBrandContent(content: string): {
  isValid: boolean;
  issues: string[];
} {
  const issues: string[] = [];
  
  // Check for week references
  const weekPatterns = [
    /week\s*\d+/gi,
    /weekly/gi,
    /this week/gi
  ];
  
  weekPatterns.forEach(pattern => {
    if (pattern.test(content)) {
      issues.push('Content contains week number references');
    }
  });
  
  // Check for bullet points and lists
  const listPatterns = [
    /•/g,
    /^\s*\d+\./gm,
    /^\s*-\s/gm
  ];
  
  listPatterns.forEach(pattern => {
    if (pattern.test(content)) {
      issues.push('Content contains bullet points or numbered lists');
    }
  });
  
  // Check for generic openings
  if (/welcome to/gi.test(content)) {
    issues.push('Content uses generic "Welcome to" opening');
  }
  
  // Check for Green Thumbs phrase
  if (/green\s*thumbs?/gi.test(content)) {
    issues.push('Content contains forbidden "Green Thumbs" phrase');
  }
  
  // Check for emojis
  const emojiRegex = /[\p{Emoji}]/u;
  if (emojiRegex.test(content)) {
    issues.push('Content contains emojis');
  }
  
  return {
    isValid: issues.length === 0,
    issues
  };
}
