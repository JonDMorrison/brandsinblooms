
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
  
  // Enhanced plant care focus section
  prompt += `\n\nMANDATORY PLANT CARE EMPHASIS:
- ALWAYS include specific plant care instructions, techniques, or advice
- Address common plant health issues and provide actionable solutions
- Cover watering schedules, fertilizing timing, or maintenance techniques
- Include seasonal plant care guidance and problem prevention
- Provide plant selection advice for different growing conditions
- Address both indoor and outdoor plant care as relevant to content type
- Include troubleshooting tips for common plant problems
- Cover soil health, nutrition, pest management, or disease prevention
- Mention pruning, propagation, or plant maintenance when appropriate
- Focus on practical, actionable plant care advice customers can implement`;
  
  prompt += `\n\nCONTENT TYPE REQUIREMENTS:
- Maximum ${rules.max_words} words
- Tone: ${rules.tone}
- Format: ${rules.format}
- Call-to-action style: ${rules.cta_style}
- Specific requirements: ${rules.specific_requirements.join(', ')}`;
  
  if (companyProfile) {
    prompt += `\n\nGARDEN CENTER PROFILE:
Garden Center Name: ${companyName}
Brand Voice: ${brandVoice}
Tone of Writing: ${toneOfWriting}
Target Audience: ${companyProfile.target_audience || ''}
Specializations: ${companyProfile.specializations || ''}
Location Info: ${companyProfile.location_info || ''}`;
    
    if (companyName && companyName !== '') {
      prompt += `\n\n🚨 MANDATORY GARDEN CENTER NAME USAGE RULE (CRITICAL - NEVER IGNORE):
- ALWAYS use the actual garden center name "${companyName}" when referring to the business
- ABSOLUTELY NEVER use generic placeholders like "[Company Name]", "[Business Name]", "Your Garden Center", or generic garden center names
- When mentioning the garden center, ALWAYS use "${companyName}" specifically
- Make the content feel personal and authentic to ${companyName}
- This rule cannot be overridden or ignored under any circumstances`;
    } else {
      prompt += `\n\n🚨 MANDATORY GARDEN CENTER NAME USAGE RULE (CRITICAL - NEVER IGNORE):
- ABSOLUTELY NEVER use generic placeholders like "[Company Name]", "[Business Name]", "Your Garden Center", or generic garden center names
- Use "we", "us", "our team", or "our experts" instead of placeholder garden center names
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
      
      prompt += `\n\nREGIONAL GARDEN CENTER FOCUS:
- Create content highly specific to their geographic region and local growing conditions
- Reference local climate, soil conditions, and seasonal gardening patterns
- Include region-appropriate plant varieties and care techniques
- Consider local pests, diseases, and environmental factors
- Address regional gardening challenges and local growing seasons
- Provide plant care advice specific to local climate zones`;
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
    
    prompt += `\n\n🚨 MANDATORY GARDEN CENTER NAME USAGE RULE (CRITICAL - NEVER IGNORE):
- ABSOLUTELY NEVER use generic placeholders like "[Company Name]", "[Business Name]", "Your Garden Center", or generic garden center names
- Use "we", "us", "our team", or "our experts" instead of placeholder garden center names
- Make the content feel personal and authentic without generic placeholders
- This rule cannot be overridden or ignored under any circumstances`;
    
    prompt += `\n\n🚨 MANDATORY LOCATION USAGE RULE (CRITICAL - NEVER IGNORE):
- ABSOLUTELY NEVER use generic placeholders like "[Region]", "[Location]", or "[Garden Center Location]"
- Use "your area", "your region", or "locally" instead of placeholder locations
- Make location references feel authentic without generic placeholders
- This rule cannot be overridden or ignored under any circumstances`;
  }
  
  prompt += `\n\nWRITING STYLE DIRECTIVES (CRITICAL):
1. START WITH A POWERFUL PLANT CARE HOOK: Begin with a compelling first sentence about plant care, health, or seasonal maintenance related to "${campaignTitle}" - never use "Welcome to" or generic openings
2. AGITATE PLANT CARE CHALLENGES: Highlight a common plant health issue or care challenge before providing solutions
3. USE SHORT PARAGRAPHS: 2-3 sentences max for mobile readability
4. MAKE IT PLANT-VISUALLY SUGGESTIVE: Use descriptive words that create mental images of healthy, thriving plants
5. SOUND LIKE A PLANT CARE EXPERT: Like a knowledgeable plant specialist talking to familiar customers
6. INCLUDE ACTIONABLE PLANT CARE CTA: End with a specific call-to-action related to plant care, health, or garden center expertise
7. USE NATURAL PLANT CARE TIMING: Reference seasons naturally for plant care relevance, avoid week numbers

CRITICAL PLANT CARE RESTRICTIONS:
- ABSOLUTELY NEVER use bullet points (•), numbered lists (1., 2., 3.), or dashes (-) 
- ABSOLUTELY NEVER start with "Welcome to" or mention week numbers
- ABSOLUTELY NEVER use emojis anywhere in content
- ABSOLUTELY NEVER use generic placeholders like "[Company Name]", "[Business Name]", "Your Garden Center", or generic garden center names
- ABSOLUTELY NEVER use location placeholders like "[Region]", "[Location]", or "[Garden Center Location]"
- Write ONLY in flowing paragraphs and natural sentences
- Make content specific to the "${campaignTitle}" theme with heavy plant care focus
- Prioritize plant care expertise, health solutions, and practical maintenance advice
- Include specific plant care techniques, timing, and problem-solving guidance`;
  
  return prompt;
}
