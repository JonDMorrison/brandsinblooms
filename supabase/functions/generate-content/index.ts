
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

// Content type specific rules
const CONTENT_TYPE_RULES = {
  instagram: {
    max_words: 150,
    tone: 'engaging and visual-friendly',
    format: 'short paragraphs, mobile-optimized',
    cta_style: 'action-oriented, theme-specific',
    specific_requirements: [
      'Reference company specializations when relevant',
      'Plant varieties appropriate for climate zone',
      'Visual storytelling approach'
    ]
  },
  facebook: {
    max_words: 250,
    tone: 'conversational and community-focused',
    format: 'readable chunks, engagement-focused',
    cta_style: 'community-building, discussion-starter',
    specific_requirements: [
      'Include questions to encourage engagement',
      'Reference unique selling points',
      'Feel personal and authentic'
    ]
  },
  email: {
    max_words: 200,
    tone: 'informative and valuable',
    format: 'scannable, professional yet warm',
    cta_style: 'helpful instructions, clear next steps',
    specific_requirements: [
      'Reference seasonal focus when relevant',
      'Provide region-specific advice',
      'Professional but approachable'
    ]
  },
  video: {
    max_words: 180,
    tone: 'natural speaking rhythm',
    format: 'short segments, easy to speak',
    cta_style: 'direct, actionable guidance',
    specific_requirements: [
      'Natural speaking flow',
      'Practical tips aligned with values',
      'Authentic garden center expert voice'
    ]
  }
};

const FALLBACK_MESSAGES = {
  missing_location: "Write region-neutral advice that applies to a wide range of gardeners, but emphasize the importance of knowing your local climate zone.",
  missing_brand_tone: "Use a warm, conversational tone like a helpful garden center owner speaking to familiar customers.",
  missing_company_profile: "Write as a knowledgeable garden center expert providing valuable, authentic advice."
};

// Content validation
const FORBIDDEN_PATTERNS = [
  /green\s*thumb/gi,
  /welcome\s*to/gi,
  /week\s*\d+/gi,
  /this\s*week/gi,
  /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]/gu,
  /^\s*[-•]\s/gm,
  /^\s*\d+\.\s/gm,
];

function validateContent(content) {
  const issues = [];
  
  FORBIDDEN_PATTERNS.forEach((pattern, index) => {
    if (pattern.test(content)) {
      switch (index) {
        case 0: issues.push('Contains "green thumb" phrase'); break;
        case 1: issues.push('Contains "Welcome to" opening'); break;
        case 2:
        case 3: issues.push('Contains week number references'); break;
        case 4: issues.push('Contains emojis'); break;
        case 5: issues.push('Contains bullet points'); break;
        case 6: issues.push('Contains numbered lists'); break;
      }
    }
  });
  
  return { isValid: issues.length === 0, issues };
}

function buildContentPrompt(contentType, campaignTitle, companyProfile, weekDescription) {
  const rules = CONTENT_TYPE_RULES[contentType];
  if (!rules) {
    throw new Error(`Unknown content type: ${contentType}`);
  }
  
  let prompt = `Create ${contentType} content specifically about "${campaignTitle}"`;
  if (weekDescription) {
    prompt += ` with focus on: ${weekDescription}`;
  }
  
  prompt += `\n\nCONTENT TYPE REQUIREMENTS:
- Maximum ${rules.max_words} words
- Tone: ${rules.tone}
- Format: ${rules.format}
- Call-to-action style: ${rules.cta_style}
- Specific requirements: ${rules.specific_requirements.join(', ')}`;
  
  if (companyProfile) {
    const brandVoice = companyProfile.brand_voice || 'Friendly but expert';
    const toneOfWriting = companyProfile.tone_of_writing || 'Confident, clear, not salesy';
    
    prompt += `\n\nCOMPANY PROFILE:
Company Name: ${companyProfile.company_name || 'Garden Center'}
Brand Voice: ${brandVoice}
Tone of Writing: ${toneOfWriting}
Target Audience: ${companyProfile.target_audience || ''}
Specializations: ${companyProfile.specializations || ''}
Location Info: ${companyProfile.location_info || ''}`;
    
    if (companyProfile.location_info) {
      prompt += `\n\nREGIONAL FOCUS:
- Create content highly specific to their geographic region and climate
- Reference local growing seasons, weather patterns, and gardening calendars
- Include region-appropriate plant recommendations and techniques
- Consider local hardiness zones, frost dates, and seasonal timing
- Address regional gardening challenges and local growing conditions`;
    } else {
      prompt += `\n\n${FALLBACK_MESSAGES.missing_location}`;
    }
  } else {
    prompt += `\n\n${FALLBACK_MESSAGES.missing_company_profile}`;
    prompt += `\n${FALLBACK_MESSAGES.missing_location}`;
  }
  
  prompt += `\n\nWRITING STYLE DIRECTIVES (CRITICAL):
1. START WITH A POWERFUL HOOK: Begin with a compelling first sentence that sparks curiosity or urgency about "${campaignTitle}" - never use "Welcome to" or generic openings
2. AGITATE BEFORE EDUCATING: Highlight a common challenge related to the theme before providing solutions
3. USE SHORT PARAGRAPHS: 2-3 sentences max for mobile readability
4. MAKE IT VISUALLY SUGGESTIVE: Use descriptive words that create mental images
5. SOUND CONVERSATIONAL: Like a local expert talking to familiar customers
6. INCLUDE A CLEAR CTA: End with a specific call-to-action related to the theme
7. USE NATURAL TIMING: Reference seasons naturally, avoid week numbers

CRITICAL RESTRICTIONS:
- ABSOLUTELY NEVER use "Green Thumbs", "green thumb", or any variation
- ABSOLUTELY NEVER use bullet points (•), numbered lists (1., 2., 3.), or dashes (-) 
- ABSOLUTELY NEVER start with "Welcome to" or mention week numbers
- ABSOLUTELY NEVER use emojis anywhere in content
- Write ONLY in flowing paragraphs and natural sentences
- Make content specific to the "${campaignTitle}" theme`;
  
  return prompt;
}

async function generateContentWithValidation(prompt, maxAttempts = 3) {
  let attempts = 0;
  let lastIssues = [];
  
  while (attempts < maxAttempts) {
    attempts++;
    
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { 
            role: 'system', 
            content: 'You are a professional content writer specializing in garden center marketing with deep knowledge of regional gardening differences. Create authentic, personalized content that reflects the specific company\'s brand and local region. CRITICAL RULES: ABSOLUTELY NEVER use "Green Thumbs", "green thumb", or any variation. ABSOLUTELY NEVER use bullet points, numbered lists, or dashes. ABSOLUTELY NEVER start with "Welcome to" or mention week numbers. ABSOLUTELY NEVER use emojis. Write only in flowing paragraphs.' 
          },
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
    const generatedContent = data.choices[0].message.content;
    
    // Validate content
    const validation = validateContent(generatedContent);
    
    if (validation.isValid) {
      console.log(`Content generated successfully on attempt ${attempts}`);
      return { content: generatedContent, attempts, issues: [] };
    }
    
    lastIssues = validation.issues;
    console.log(`Content validation failed (attempt ${attempts}):`, validation.issues);
    
    if (attempts < maxAttempts) {
      // Add validation feedback to prompt for next attempt
      prompt += `\n\nIMPORTANT: The previous attempt failed validation due to: ${validation.issues.join(', ')}. Please ensure you avoid these issues completely.`;
    }
  }
  
  console.log(`Content generation failed after ${attempts} attempts. Last issues:`, lastIssues);
  throw new Error(`Content generation failed validation after ${attempts} attempts: ${lastIssues.join(', ')}`);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { postType, campaignTitle, userId, weekDescription } = await req.json();

    if (!openAIApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    // Initialize Supabase client
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

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

    // Build content-type specific prompt
    const prompt = buildContentPrompt(postType, campaignTitle, companyProfile, weekDescription);
    
    console.log(`Generating validated ${postType} content for: ${campaignTitle}`);

    // Generate content with validation
    const result = await generateContentWithValidation(prompt);

    console.log(`Generated content successfully after ${result.attempts} attempts`);

    return new Response(JSON.stringify({ 
      content: result.content,
      generationAttempts: result.attempts,
      validationPassed: true
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in generate-content function:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
