
import { StyleTokens, CompanyProfile } from '../types/contentGeneration';
import { CONTENT_TYPE_RULES } from '../config/contentTypeRules';
import { DEFAULT_STYLE_TOKENS, DEFAULT_BRAND_VOICE, FALLBACK_MESSAGES } from '../config/styleTokens';

export function buildContentPrompt(
  contentType: string,
  campaignTitle: string,
  companyProfile: CompanyProfile | null,
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
