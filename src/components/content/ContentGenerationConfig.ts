
// Content generation configuration and validation system
export interface StyleTokens {
  use_paragraphs: boolean;
  no_emojis: boolean;
  hook_start: boolean;
  regionally_specific: boolean;
  brand_voice: 'auto' | 'custom';
  agitate_before_educate: boolean;
  visual_language: boolean;
  conversational_tone: boolean;
  clear_cta: boolean;
  natural_timing: boolean;
  enforce_company_name: boolean; // New flag for company name enforcement
}

export interface ContentTypeRules {
  max_words: number;
  tone: string;
  format: string;
  cta_style: string;
  specific_requirements: string[];
}

export interface ClimateZoneData {
  hardiness_zone: string;
  first_frost_date: string;
  last_frost_date: string;
  common_pests: string[];
  native_plants: string[];
  seasonal_challenges: string[];
}

export interface BrandVoiceProfile {
  tone: string;
  style: string;
  traits: string[];
  use_contractions: boolean;
  expertise_level: string;
}

export const DEFAULT_STYLE_TOKENS: StyleTokens = {
  use_paragraphs: true,
  no_emojis: true,
  hook_start: true,
  regionally_specific: true,
  brand_voice: 'auto',
  agitate_before_educate: true,
  visual_language: true,
  conversational_tone: true,
  clear_cta: true,
  natural_timing: true,
  enforce_company_name: true // Enable company name enforcement by default
};

export const CONTENT_TYPE_RULES: Record<string, ContentTypeRules> = {
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
    max_words: 180, // ~60-90 seconds spoken
    tone: 'natural speaking rhythm',
    format: 'short segments, easy to speak',
    cta_style: 'direct, actionable guidance',
    specific_requirements: [
      'Natural speaking flow',
      'Practical tips aligned with values',
      'Authentic garden center expert voice'
    ]
  },
  newsletter: {
    max_words: 600,
    tone: 'comprehensive yet personal',
    format: 'structured sections, mobile-friendly',
    cta_style: 'personalized, community-focused',
    specific_requirements: [
      'Include subject line with company name',
      'Highlight weekly theme',
      'Regional timing and plant recommendations'
    ]
  }
};

export const DEFAULT_BRAND_VOICE: BrandVoiceProfile = {
  tone: 'Friendly but expert',
  style: 'Confident, clear, not salesy',
  traits: ['Humble', 'Trustworthy', 'Locally rooted', 'Helpful'],
  use_contractions: true,
  expertise_level: 'Local garden center expert'
};

export const FALLBACK_MESSAGES = {
  missing_location: "Write region-neutral advice that applies to a wide range of gardeners, but emphasize the importance of knowing your local climate zone.",
  missing_brand_tone: "Use a warm, conversational tone like a helpful garden center owner speaking to familiar customers.",
  missing_company_profile: "Write as a knowledgeable garden center expert providing valuable, authentic advice."
};

// Forbidden content validation
export const FORBIDDEN_PATTERNS = [
  /green\s*thumb/gi,
  /welcome\s*to/gi,
  /week\s*\d+/gi,
  /this\s*week/gi,
  /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]/gu, // emojis
  /^\s*[-•]\s/gm, // bullet points
  /^\s*\d+\.\s/gm, // numbered lists
  /\[company\s*name\]/gi, // company name placeholders
  /\[garden\s*center\s*name\]/gi, // garden center name placeholders
  /your\s*garden\s*center/gi, // generic garden center references
  /\[region\]/gi, // region placeholders
  /\[location\]/gi, // location placeholders
  /\[garden\s*center\s*location\]/gi, // garden center location placeholders
];

export const FORBIDDEN_PHRASES = [
  'green thumb',
  'green thumbs',
  'welcome to',
  'this week',
  'week number',
  'happy week',
  '[company name]',
  '[garden center name]',
  'your garden center',
  '[region]',
  '[location]',
  '[garden center location]'
];

export function validateContent(content: string): { isValid: boolean; issues: string[] } {
  const issues: string[] = [];
  
  // Check for forbidden patterns
  FORBIDDEN_PATTERNS.forEach((pattern, index) => {
    if (pattern.test(content)) {
      switch (index) {
        case 0:
          issues.push('Contains "green thumb" phrase');
          break;
        case 1:
          issues.push('Contains "Welcome to" opening');
          break;
        case 2:
        case 3:
          issues.push('Contains week number references');
          break;
        case 4:
          issues.push('Contains emojis');
          break;
        case 5:
          issues.push('Contains bullet points');
          break;
        case 6:
          issues.push('Contains numbered lists');
          break;
        case 7:
          issues.push('Contains company name placeholder');
          break;
        case 8:
          issues.push('Contains garden center name placeholder');
          break;
        case 9:
          issues.push('Contains generic garden center reference');
          break;
        case 10:
          issues.push('Contains region placeholder');
          break;
        case 11:
          issues.push('Contains location placeholder');
          break;
        case 12:
          issues.push('Contains garden center location placeholder');
          break;
      }
    }
  });
  
  // Check for forbidden phrases
  const lowerContent = content.toLowerCase();
  FORBIDDEN_PHRASES.forEach(phrase => {
    if (lowerContent.includes(phrase)) {
      issues.push(`Contains forbidden phrase: "${phrase}"`);
    }
  });
  
  return {
    isValid: issues.length === 0,
    issues
  };
}

export function buildContentPrompt(
  contentType: string,
  campaignTitle: string,
  companyProfile: any,
  styleTokens: StyleTokens = DEFAULT_STYLE_TOKENS,
  weekDescription?: string
): string {
  const rules = CONTENT_TYPE_RULES[contentType];
  if (!rules) {
    throw new Error(`Unknown content type: ${contentType}`);
  }
  
  const brandVoice = companyProfile?.brand_voice || DEFAULT_BRAND_VOICE.tone;
  const toneOfWriting = companyProfile?.tone_of_writing || DEFAULT_BRAND_VOICE.style;
  const companyName = companyProfile?.company_name || 'Garden Center';
  
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
    prompt += `\n\nCOMPANY PROFILE:
Company Name: ${companyName}
Brand Voice: ${brandVoice}
Tone of Writing: ${toneOfWriting}
Target Audience: ${companyProfile.target_audience || ''}
Specializations: ${companyProfile.specializations || ''}
Location Info: ${companyProfile.location_info || ''}`;
    
    // MANDATORY COMPANY NAME USAGE RULE - ALWAYS ENFORCED
    if (companyName && companyName !== 'Garden Center') {
      prompt += `\n\n🚨 MANDATORY COMPANY NAME USAGE RULE (CRITICAL - NEVER IGNORE):
- ALWAYS use the actual company name "${companyName}" when referring to the business
- ABSOLUTELY NEVER use generic placeholders like "[Company Name]", "[Garden Center Name]", "Garden Center", or "Your Garden Center"
- When mentioning the business, ALWAYS use "${companyName}" specifically
- Make the content feel personal and authentic to ${companyName}
- This rule cannot be overridden or ignored under any circumstances`;
    } else {
      prompt += `\n\n🚨 MANDATORY COMPANY NAME USAGE RULE (CRITICAL - NEVER IGNORE):
- ABSOLUTELY NEVER use generic placeholders like "[Company Name]", "[Garden Center Name]", "Garden Center", or "Your Garden Center"
- Use "we", "us", "our team", or "our experts" instead of placeholder company names
- Make the content feel personal and authentic without generic placeholders
- This rule cannot be overridden or ignored under any circumstances`;
    }
    
    if (companyProfile.location_info) {
      const locationInfo = companyProfile.location_info;
      prompt += `\n\n🚨 MANDATORY LOCATION USAGE RULE (CRITICAL - NEVER IGNORE):
- ALWAYS use the actual location "${locationInfo}" when referring to the region or location
- ABSOLUTELY NEVER use generic placeholders like "[Region]", "[Location]", or "[Garden Center Location]"
- Reference the specific city, region, or area name directly
- Make location references feel authentic and specific
- This rule cannot be overridden or ignored under any circumstances`;
      
      prompt += `\n\nREGIONAL FOCUS:
- Create content highly specific to their geographic region and climate
- Reference local growing seasons, weather patterns, and gardening calendars
- Include region-appropriate plant recommendations and techniques
- Consider local hardiness zones, frost dates, and seasonal timing
- Address regional gardening challenges and local growing conditions`;
    } else {
      prompt += `\n\n🚨 MANDATORY LOCATION USAGE RULE (CRITICAL - NEVER IGNORE):
- ABSOLUTELY NEVER use generic placeholders like "[Region]", "[Location]", or "[Garden Center Location]"
- Use "your area", "your region", or "locally" instead of placeholder locations
- Make location references feel authentic without generic placeholders
- This rule cannot be overridden or ignored under any circumstances`;
    }
  } else {
    prompt += `\n\n${FALLBACK_MESSAGES.missing_company_profile}`;
    prompt += `\n${FALLBACK_MESSAGES.missing_location}`;
    
    // Even without a profile, strictly enforce no placeholders
    prompt += `\n\n🚨 MANDATORY COMPANY NAME USAGE RULE (CRITICAL - NEVER IGNORE):
- ABSOLUTELY NEVER use generic placeholders like "[Company Name]", "[Garden Center Name]", "Garden Center", or "Your Garden Center"
- Use "we", "us", "our team", or "our experts" instead of placeholder company names
- Make the content feel personal and authentic without generic placeholders
- This rule cannot be overridden or ignored under any circumstances`;
    
    prompt += `\n\n🚨 MANDATORY LOCATION USAGE RULE (CRITICAL - NEVER IGNORE):
- ABSOLUTELY NEVER use generic placeholders like "[Region]", "[Location]", or "[Garden Center Location]"
- Use "your area", "your region", or "locally" instead of placeholder locations
- Make location references feel authentic without generic placeholders
- This rule cannot be overridden or ignored under any circumstances`;
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
- ABSOLUTELY NEVER use generic placeholders like "[Company Name]", "[Garden Center Name]", "Garden Center", or "Your Garden Center"
- ABSOLUTELY NEVER use location placeholders like "[Region]", "[Location]", or "[Garden Center Location]"
- Write ONLY in flowing paragraphs and natural sentences
- Make content specific to the "${campaignTitle}" theme`;
  
  return prompt;
}
