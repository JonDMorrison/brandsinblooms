
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
    // Normalize incoming payload keys to be resilient to different callers
    const incoming = await req.json();

    const business_name = incoming.business_name ?? incoming.businessName ?? undefined;
    const themeRaw = incoming.theme ?? incoming.campaignTitle ?? incoming.title ?? '';
    const theme = (typeof themeRaw === 'string' ? themeRaw : String(themeRaw || ''))?.trim() || 'Seasonal Garden';
    const week_focus = incoming.week_focus ?? incoming.weekDescription ?? incoming.context ?? '';
    const promo_items = incoming.promo_items ?? incoming.promoItems ?? [];
    const tone_note = incoming.tone_note ?? incoming.toneNote ?? '';
    const userId = incoming.userId;
    const is_holiday = incoming.is_holiday ?? incoming.isHoliday ?? false;
    const holiday_context = incoming.holiday_context ?? incoming.holidayContext ?? '';
    const existingContent = incoming.existingContent ?? null;
    const personas = incoming.personas ?? [];


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
      // **CRITICAL FIX: Make templates truly theme-specific instead of generic fallbacks**
      
      // Theme-specific headline generators
      const getThemeHeadlines = (campaignTheme: string) => {
        const lowerTheme = campaignTheme.toLowerCase();
        
        // Holiday/Special Event specific headlines
        if (lowerTheme.includes('seed') && lowerTheme.includes('harvest')) {
          return {
            h1: "Master the Art of Seed Collection: Your Legacy Garden Starts Here",
            h2: "Heirloom Treasures: Why Saving Seeds Connects You to Garden History", 
            h3: "Seed Storage Success: Professional Tips for Long-Term Viability",
            h4: "Plan Your Seed Harvest Calendar: Timing is Everything"
          };
        } else if (lowerTheme.includes('vegetarian') && lowerTheme.includes('world')) {
          return {
            h1: "Grow Your Own Vegetarian Paradise: From Seed to Supper",
            h2: "Protein-Packed Plants: The Best Vegetables for Plant-Based Living",
            h3: "Container Vegetable Gardens: Perfect for Small Space Vegetarians", 
            h4: "Herb Garden Essentials: Elevate Your Plant-Based Cooking"
          };
        } else if (lowerTheme.includes('tree')) {
          return {
            h1: "Essential Tree Health Assessment: Your Property's Foundation Check",
            h2: "National Tree Month: The Perfect Time for Tree Care Planning",
            h3: "Warning Signs: When Your Trees Need Professional Attention",
            h4: "Invest in Tomorrow: Strategic Tree Care for Long-term Success"
          };
        } else if (lowerTheme.includes('fall') || lowerTheme.includes('autumn')) {
          return {
            h1: "Fall Garden Transformation: Prepare for Autumn's Bounty",
            h2: "Soil Prep Secrets: Set Your Garden Up for Next Year's Success",
            h3: "Fall Planting Power: Plants That Thrive in Cool Weather",
            h4: "Winter Protection Strategy: Keep Your Garden Healthy All Season"
          };
        } else if (lowerTheme.includes('spring') || lowerTheme.includes('planting')) {
          return {
            h1: "Spring Garden Revolution: Transform Your Space This Season",
            h2: "Soil Revival: Wake Up Your Garden After Winter",
            h3: "Early Planting Success: Beat the Rush for Best Selection",
            h4: "Garden Planning Mastery: Design Your Dream Growing Space"
          };
        } else if (lowerTheme.includes('summer') || lowerTheme.includes('heat')) {
          return {
            h1: "Beat the Heat: Your Garden's Summer Survival Guide",
            h2: "Water-Smart Gardening: Efficiency Meets Plant Health",
            h3: "Summer Problem Solving: Keep Plants Thriving in Extreme Weather",
            h4: "Late Summer Prep: Position Your Garden for Fall Success"
          };
        } else {
          // Dynamic headline generation based on actual theme
          return {
            h1: `${campaignTheme} Garden Focus: Expert Insights for Success`,
            h2: `This Month's ${campaignTheme} Strategy: Professional Techniques`,
            h3: `${campaignTheme} Problem Prevention: Stay Ahead of Issues`,
            h4: `Future-Proof Your ${campaignTheme} Success: Long-term Planning`
          };
        }
      };
      
      // Get theme-specific image queries
      const getThemeImageQueries = (campaignTheme: string) => {
        const lowerTheme = campaignTheme.toLowerCase();
        
        if (lowerTheme.includes('seed') && lowerTheme.includes('harvest')) {
          return [
            "hands collecting heirloom tomato seeds harvest time",
            "variety of seeds organized for storage containers",
            "professional seed drying equipment garden center",
            "seed packet collection heirloom varieties display"
          ];
        } else if (lowerTheme.includes('vegetarian') && lowerTheme.includes('world')) {
          return [
            "abundant vegetable garden fresh harvest vegetables",
            "container vegetable garden apartment balcony herbs",
            "protein rich beans peas growing garden trellis",
            "herb garden cooking ingredients fresh basil oregano"
          ];
        } else if (lowerTheme.includes('tree')) {
          return [
            "professional arborist examining tree trunk for health",
            "healthy mature trees in residential landscape", 
            "tree care tools and professional equipment",
            "beautiful mature trees enhancing property value"
          ];
        } else {
          return [
            `${campaignTheme.toLowerCase()} garden center professional advice`,
            `beautiful ${campaignTheme.toLowerCase()} garden thriving plants`,
            `${campaignTheme.toLowerCase()} gardening tools and supplies`,
            `successful ${campaignTheme.toLowerCase()} garden transformation`
          ];
        }
      };
      
      const headlines = getThemeHeadlines(theme);
      const imageQueries = getThemeImageQueries(theme);
      
      return `
\`\`\`yaml
newsletter_md: |
  # ${theme} Garden Newsletter
  *Discover expert gardening insights${is_holiday ? ` for ${holiday_context || theme}` : ` for ${theme}`} that transform your garden into a thriving paradise*

  ## ${headlines.h1}
  [Write 2-3 sentences following StoryBrand: identify gardener challenge, show empathy, provide solution. No lists or bullets - flowing paragraphs only.]

  ## ${headlines.h2}
  [Write 2-3 sentences featuring a transformative approach, positioning customer as hero achieving garden success.]

  ## ${headlines.h3}
  [Write 2-3 sentences about preventing problems, with garden center as trusted guide providing expert solutions.]

  ## ${headlines.h4}
  [Write 2-3 sentences about upcoming opportunities, painting picture of future garden success.]

  ---
  Transform your garden with **${businessName}** 🌿
blocks:
  - title: "${headlines.h1}"
    body: "[StoryBrand content: specific to ${theme} theme in paragraph form]"
    cta: "Get ${theme.toLowerCase()} supplies"
    link: "#"
    image_prompt: "${imageQueries[0]}"
    alt_text: "${theme} gardening success"
  - title: "${headlines.h2}"
    body: "[StoryBrand content: ${theme}-focused transformation in paragraph form]"
    cta: "Discover ${theme.toLowerCase()} solutions"
    link: "#"
    image_prompt: "${imageQueries[1]}"
    alt_text: "${theme} garden transformation"
  - title: "${headlines.h3}"
    body: "[StoryBrand content: ${theme} problem prevention in paragraph form]"
    cta: "Get expert ${theme.toLowerCase()} advice"
    link: "#"
    image_prompt: "${imageQueries[2]}"
    alt_text: "${theme} problem prevention"
  - title: "${headlines.h4}"
    body: "[StoryBrand content: ${theme} future planning in paragraph form]"
    cta: "Plan your ${theme.toLowerCase()} success"
    link: "#"
    image_prompt: "${imageQueries[3]}"
    alt_text: "${theme} planning for success"
extra_content_ideas:
  - title: "Advanced ${theme} Techniques"
    quick_desc: "Professional techniques for ${theme.toLowerCase()} success"
  - title: "${theme} Timing Mastery"
    quick_desc: "Perfect timing strategies for ${theme.toLowerCase()}"
  - title: "${theme} Problem Solving"
    quick_desc: "Expert solutions for ${theme.toLowerCase()} challenges"
  - title: "${theme} Planning Guide"
    quick_desc: "Strategic planning for ${theme.toLowerCase()} success"
meta:
  reading_time: "≈3 min"
  theme: "${theme}"
  week_focus: "${contextualFocus}"
\`\`\``;
    };

    const yamlTemplate = generateThemeSpecificTemplate(theme, businessName);

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
              `CRITICAL THEME ENFORCEMENT: Generate a 4-section StoryBrand newsletter that is 100% focused on "${theme}" with emphasis on "${contextualFocus}".

🚨 ABSOLUTE REQUIREMENTS:
1. **EVERY headline and content block MUST directly relate to "${theme}"**
2. **FORBIDDEN**: Do NOT include generic phrases like "Beat the Heat", "SOS: Save Your Plants", "This Month's Garden Game-Changer" unless they specifically relate to "${theme}"
3. **REQUIRED**: All content must celebrate, explain, or provide actionable advice for "${theme}"
4. **IMAGE QUERIES**: Must search for images directly related to "${theme}" - not generic garden/summer scenes

EXAMPLE OF WHAT TO AVOID:
❌ "Beat the Heat" when theme is "National Seed Harvest Week"
❌ "Summer Care" when theme is "World Vegetarian Day" 
❌ "General plant tips" when theme is specific

EXAMPLE OF WHAT TO INCLUDE:
✅ For "National Seed Harvest Week": Focus on seed collection, storage, heirloom varieties, seed saving techniques
✅ For "World Vegetarian Day": Focus on growing vegetables, plant-based gardening, container vegetable gardens, herb cultivation

Each section must follow the StoryBrand framework: position gardeners as heroes, identify their challenges, show garden center as trusted guide, provide actionable solutions, and paint success pictures. Use engaging, benefit-driven headlines. Write in flowing paragraphs only - absolutely no bullet points or numbered lists. NO week numbers or "weekly" language anywhere.${is_holiday ? ` Incorporate ${holiday_context || theme} themes naturally.` : ''}

**CONTENT QUALITY CHECK**: Before finalizing, verify that every sentence relates to "${theme}" and would make sense to someone celebrating or participating in "${theme}".

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

    // Validate content for StoryBrand compliance and theme alignment
    const validation = validateStoryBrandContent(yamlContent);
    const themeValidation = validateThemeAlignment(yamlContent, theme);
    
    if (!validation.isValid) {
      console.warn('⚠️ Generated content has StoryBrand validation issues:', validation.issues);
    }
    
    if (!themeValidation.isValid) {
      console.error('🚨 CRITICAL: Newsletter content does not match theme!', {
        theme,
        issues: themeValidation.issues,
        contentPreview: yamlContent.substring(0, 200)
      });
    }
    
    // Log successful theme alignment
    if (themeValidation.isValid && validation.isValid) {
      console.log(`✅ Newsletter successfully generated with proper "${theme}" focus`);
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

function validateThemeAlignment(content: string, theme: string): {
  isValid: boolean;
  issues: string[];
} {
  const issues: string[] = [];
  const lowerContent = content.toLowerCase();
  const lowerTheme = theme.toLowerCase();
  
  // Define forbidden generic phrases that should not appear with specific themes
  const genericFallbacks = [
    'beat the heat',
    'sos: save your plants',
    'this month\'s garden game-changer',
    'get ready: your garden\'s next power move',
    'summer survival guide',
    'plant rescue',
    'seasonal tips',
    'weekly updates',
    'general garden care',
    'summer care',
    'fall transition'
  ];
  
  // Check if theme-specific content is present
  let hasThemeContent = false;
  
  if (lowerTheme.includes('seed') && lowerTheme.includes('harvest')) {
    const seedTerms = ['seed', 'harvest', 'collection', 'storage', 'heirloom', 'saving'];
    hasThemeContent = seedTerms.some(term => lowerContent.includes(term));
  } else if (lowerTheme.includes('vegetarian') && lowerTheme.includes('world')) {
    const vegetarianTerms = ['vegetarian', 'vegetable', 'plant-based', 'herbs', 'container', 'growing'];
    hasThemeContent = vegetarianTerms.some(term => lowerContent.includes(term));
  } else if (lowerTheme.includes('tree')) {
    const treeTerms = ['tree', 'arborist', 'pruning', 'trunk', 'branches'];
    hasThemeContent = treeTerms.some(term => lowerContent.includes(term));
  } else {
    // For other themes, check if theme name appears in content
    hasThemeContent = lowerContent.includes(lowerTheme.split(' ')[0]) || 
                     lowerContent.includes(lowerTheme);
  }
  
  // Check for forbidden generic content when we have a specific theme
  if (!lowerTheme.includes('summer') && !lowerTheme.includes('heat')) {
    genericFallbacks.forEach(generic => {
      if (lowerContent.includes(generic)) {
        issues.push(`Contains generic phrase "${generic}" that doesn't match theme "${theme}"`);
      }
    });
  }
  
  // Flag if theme-specific content is missing
  if (!hasThemeContent) {
    issues.push(`Content does not contain terms related to theme "${theme}"`);
  }
  
  // Check for off-topic image queries
  if (lowerContent.includes('summer sunlight') && !lowerTheme.includes('summer')) {
    issues.push('Image queries are generic summer scenes instead of theme-specific');
  }
  
  // Check if headlines relate to theme
  const headlineMatches = content.match(/title:\s*"([^"]+)"/g) || [];
  let themeRelevantHeadlines = 0;
  
  headlineMatches.forEach(headline => {
    const headlineText = headline.toLowerCase();
    if (lowerTheme.includes('seed') && (headlineText.includes('seed') || headlineText.includes('harvest'))) {
      themeRelevantHeadlines++;
    } else if (lowerTheme.includes('vegetarian') && (headlineText.includes('vegetable') || headlineText.includes('plant'))) {
      themeRelevantHeadlines++;
    } else if (lowerTheme.includes('tree') && headlineText.includes('tree')) {
      themeRelevantHeadlines++;
    }
  });
  
  if (headlineMatches.length > 0 && themeRelevantHeadlines === 0) {
    issues.push('None of the headlines relate to the specified theme');
  }
  
  return {
    isValid: issues.length === 0,
    issues
  };
}
