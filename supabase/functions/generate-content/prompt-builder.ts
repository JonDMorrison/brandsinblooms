
import { CONTENT_TYPE_RULES, FALLBACK_MESSAGES } from './constants.ts';
import { CompanyProfile } from './types.ts';

export function buildContentPrompt(
  contentType: string, 
  campaignTitle: string, 
  companyProfile: CompanyProfile | null, 
  weekDescription?: string,
  enforceCompanyName?: boolean
): string {
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
    const companyName = companyProfile.company_name || 'Garden Center';
    
    prompt += `\n\nCOMPANY PROFILE:
Company Name: ${companyName}
Brand Voice: ${brandVoice}
Tone of Writing: ${toneOfWriting}
Target Audience: ${companyProfile.target_audience || ''}
Specializations: ${companyProfile.specializations || ''}
Location Info: ${companyProfile.location_info || ''}`;
    
    // Add company name enforcement rule
    if (enforceCompanyName && companyName && companyName !== 'Garden Center') {
      prompt += `\n\nCOMPANY NAME USAGE REQUIREMENT:
- ALWAYS use the actual company name "${companyName}" in the content
- NEVER use generic placeholders like "[Company Name]", "Garden Center", or "Your Garden Center"
- When referring to the business, always use "${companyName}" specifically
- Make the content feel personal and authentic to ${companyName}`;
    }
    
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
    
    // Even without a profile, enforce not using placeholders
    if (enforceCompanyName) {
      prompt += `\n\nCOMPANY NAME USAGE REQUIREMENT:
- AVOID using generic placeholders like "[Company Name]", "Garden Center", or "Your Garden Center"
- Use "we", "us", or "our team" instead of placeholder company names
- Make the content feel personal and authentic without generic placeholders`;
    }
  }
  
  prompt += `\n\n🧠 WRITING STYLE DIRECTIVES (CRITICAL):
1. ALWAYS START WITH A HOOK: Begin with a powerful first sentence that sparks curiosity, urgency, or seasonal awareness about "${campaignTitle}" - never use "Welcome to" or generic openings
2. AGITATE BEFORE EDUCATING: After the hook, highlight a common challenge or seasonal mistake related to the theme before providing solutions
3. USE SHORT PARAGRAPHS: 2-3 sentences max for mobile readability
4. MAKE IT VISUALLY SUGGESTIVE: Use descriptive words that create mental images (e.g., "lush beds," "cracked soil," "overflowing baskets")
5. SOUND CONVERSATIONAL: Like a local garden center owner or expert talking to familiar customers
6. INCLUDE A CLEAR CTA: End with a single clear call-to-action that ties directly to the post's topic - use concrete, helpful instructions
7. ANCHOR TIME NATURALLY: Reference seasonal timing in natural ways, avoid week numbers entirely

CRITICAL RESTRICTIONS:
- ABSOLUTELY NEVER use "Green Thumbs", "green thumb", or any variation
- ABSOLUTELY NEVER use bullet points (•), numbered lists (1., 2., 3.), or dashes (-) 
- ABSOLUTELY NEVER start with "Welcome to" or mention week numbers
- ABSOLUTELY NEVER use emojis anywhere in content
- ABSOLUTELY NEVER use generic placeholders like "[Company Name]" - use the actual company name when available
- Write ONLY in flowing paragraphs and natural sentences
- Make content specific to the "${campaignTitle}" theme`;
  
  return prompt;
}
