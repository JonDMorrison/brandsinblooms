
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
  const companyName = companyProfile?.company_name || '';
  
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
    
    if (companyName && companyName !== '') {
      prompt += `\n\n🚨 MANDATORY COMPANY NAME USAGE RULE (CRITICAL - NEVER IGNORE):
- ALWAYS use the actual company name "${companyName}" when referring to the business
- ABSOLUTELY NEVER use generic placeholders like "[Company Name]", "[Business Name]", "Your Business", or generic business names
- When mentioning the business, ALWAYS use "${companyName}" specifically
- Make the content feel personal and authentic to ${companyName}
- This rule cannot be overridden or ignored under any circumstances`;
    } else {
      prompt += `\n\n🚨 MANDATORY COMPANY NAME USAGE RULE (CRITICAL - NEVER IGNORE):
- ABSOLUTELY NEVER use generic placeholders like "[Company Name]", "[Business Name]", "Your Business", or generic business names
- Use "we", "us", "our team", or "our experts" instead of placeholder company names
- Make the content feel personal and authentic without generic placeholders
- This rule cannot be overridden or ignored under any circumstances`;
    }
    
    if (companyProfile.location_info) {
      const locationInfo = companyProfile.location_info;
      prompt += `\n\n🚨 MANDATORY LOCATION USAGE RULE (CRITICAL - NEVER IGNORE):
- ALWAYS use the actual location "${locationInfo}" when referring to the region or location
- ABSOLUTELY NEVER use generic placeholders like "[Region]", "[Location]", or "[Business Location]"
- Reference the specific city, region, or area name directly
- Make location references feel authentic and specific
- This rule cannot be overridden or ignored under any circumstances`;
      
      prompt += `\n\nREGIONAL FOCUS:
- Create content highly specific to their geographic region and local market
- Reference local business conditions, economic factors, and market opportunities
- Include region-appropriate business strategies and marketing techniques
- Consider local competition, customer behaviors, and seasonal business patterns
- Address regional business challenges and local market conditions`;
    } else {
      prompt += `\n\n🚨 MANDATORY LOCATION USAGE RULE (CRITICAL - NEVER IGNORE):
- ABSOLUTELY NEVER use generic placeholders like "[Region]", "[Location]", or "[Business Location]"
- Use "your area", "your region", or "locally" instead of placeholder locations
- Make location references feel authentic without generic placeholders
- This rule cannot be overridden or ignored under any circumstances`;
    }
  } else {
    prompt += `\n\n${FALLBACK_MESSAGES.missing_company_profile}`;
    prompt += `\n${FALLBACK_MESSAGES.missing_location}`;
    
    prompt += `\n\n🚨 MANDATORY COMPANY NAME USAGE RULE (CRITICAL - NEVER IGNORE):
- ABSOLUTELY NEVER use generic placeholders like "[Company Name]", "[Business Name]", "Your Business", or generic business names
- Use "we", "us", "our team", or "our experts" instead of placeholder company names
- Make the content feel personal and authentic without generic placeholders
- This rule cannot be overridden or ignored under any circumstances`;
    
    prompt += `\n\n🚨 MANDATORY LOCATION USAGE RULE (CRITICAL - NEVER IGNORE):
- ABSOLUTELY NEVER use generic placeholders like "[Region]", "[Location]", or "[Business Location]"
- Use "your area", "your region", or "locally" instead of placeholder locations
- Make location references feel authentic without generic placeholders
- This rule cannot be overridden or ignored under any circumstances`;
  }
  
  prompt += `\n\nWRITING STYLE DIRECTIVES (CRITICAL):
1. START WITH A POWERFUL HOOK: Begin with a compelling first sentence that sparks curiosity or urgency about "${campaignTitle}" - never use "Welcome to" or generic openings
2. AGITATE BEFORE EDUCATING: Highlight a common business challenge related to the theme before providing solutions
3. USE SHORT PARAGRAPHS: 2-3 sentences max for mobile readability
4. MAKE IT VISUALLY SUGGESTIVE: Use descriptive words that create mental images of business success
5. SOUND CONVERSATIONAL: Like a knowledgeable business expert talking to familiar customers
6. INCLUDE A CLEAR CTA: End with a specific call-to-action related to the theme
7. USE NATURAL TIMING: Reference seasons naturally for business relevance, avoid week numbers

CRITICAL RESTRICTIONS:
- ABSOLUTELY NEVER use bullet points (•), numbered lists (1., 2., 3.), or dashes (-) 
- ABSOLUTELY NEVER start with "Welcome to" or mention week numbers
- ABSOLUTELY NEVER use emojis anywhere in content
- ABSOLUTELY NEVER use generic placeholders like "[Company Name]", "[Business Name]", "Your Business", or generic business names
- ABSOLUTELY NEVER use location placeholders like "[Region]", "[Location]", or "[Business Location]"
- Write ONLY in flowing paragraphs and natural sentences
- Make content specific to the "${campaignTitle}" theme
- Focus on universal business value rather than assuming specific industries`;
  
  return prompt;
}
