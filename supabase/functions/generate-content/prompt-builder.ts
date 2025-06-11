
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
    const companyName = companyProfile.company_name || '';
    
    prompt += `\n\nCOMPANY PROFILE:
Company Name: ${companyName}
Brand Voice: ${brandVoice}
Tone of Writing: ${toneOfWriting}
Target Audience: ${companyProfile.target_audience || ''}
Specializations: ${companyProfile.specializations || ''}
Location Info: ${companyProfile.location_info || ''}`;
    
    // CRITICAL COMPANY NAME ENFORCEMENT
    if (companyName && companyName.trim() !== '') {
      prompt += `\n\n🚨 CRITICAL RULE - COMPANY NAME ENFORCEMENT (FAILURE = REGENERATION):
- ALWAYS use the exact company name "${companyName}" when referring to the business
- NEVER use "[Company Name]", "[Garden Center Name]", "Garden Center", or "Your Garden Center"
- NEVER use any placeholder text in square brackets like [business name] or [location]
- When mentioning the business, ALWAYS use "${companyName}" specifically
- Make the content personal and authentic to ${companyName}
- This rule CANNOT be violated under any circumstances`;
    } else {
      prompt += `\n\n🚨 CRITICAL RULE - NO PLACEHOLDER TEXT (FAILURE = REGENERATION):
- NEVER use "[Company Name]", "[Garden Center Name]", "Garden Center", or "Your Garden Center"
- NEVER use any placeholder text in square brackets like [business name] or [location]
- Use "we", "us", "our team", or "our experts" instead of placeholder company names
- Make the content personal and authentic without generic placeholders
- This rule CANNOT be violated under any circumstances`;
    }
    
    if (companyProfile.location_info) {
      const locationInfo = companyProfile.location_info;
      prompt += `\n\n🚨 CRITICAL RULE - LOCATION ENFORCEMENT (FAILURE = REGENERATION):
- ALWAYS use the actual location "${locationInfo}" when referring to the region
- NEVER use "[Region]", "[Location]", or "[Garden Center Location]"
- NEVER use any placeholder text in square brackets
- Reference the specific city, region, or area name directly
- Make location references authentic and specific to ${locationInfo}
- This rule CANNOT be violated under any circumstances`;
    } else {
      prompt += `\n\n🚨 CRITICAL RULE - NO LOCATION PLACEHOLDERS (FAILURE = REGENERATION):
- NEVER use "[Region]", "[Location]", or "[Garden Center Location]"
- NEVER use any placeholder text in square brackets
- Use "your area", "your region", or "locally" instead of placeholder locations
- Make location references authentic without generic placeholders
- This rule CANNOT be violated under any circumstances`;
    }
  } else {
    prompt += `\n\n${FALLBACK_MESSAGES.missing_company_profile}`;
    prompt += `\n${FALLBACK_MESSAGES.missing_location}`;
    
    prompt += `\n\n🚨 CRITICAL RULE - NO PLACEHOLDER TEXT (FAILURE = REGENERATION):
- NEVER use "[Company Name]", "[Garden Center Name]", "Garden Center", or "Your Garden Center"
- NEVER use "[Region]", "[Location]", or "[Garden Center Location]"
- NEVER use any placeholder text in square brackets
- Use "we", "us", "our team", or "our experts" instead of placeholder company names
- Use "your area", "your region", or "locally" instead of placeholder locations
- This rule CANNOT be violated under any circumstances`;
  }
  
  prompt += `\n\n🎯 WRITING STYLE REQUIREMENTS (CRITICAL - FAILURE = REGENERATION):
1. PLAIN LANGUAGE ONLY: Write in natural, conversational language like speaking to a friend
2. SHORT PARAGRAPHS: Maximum 2-3 sentences per paragraph for mobile readability
3. NO TECHNICAL FORMATTING: Absolutely no markdown, code blocks, bullet points, or numbered lists
4. NO SQUARE BRACKETS: Never use [anything] - all content must be complete and specific
5. CONVERSATIONAL TONE: Sound like a local garden expert talking to familiar customers
6. NATURAL FLOW: Write in flowing paragraphs, not lists or formatted blocks

🚨 ABSOLUTE PROHIBITIONS (VIOLATION = IMMEDIATE REGENERATION):
- NO "Welcome to" phrases - ABSOLUTELY FORBIDDEN
- NO week numbers or week references (week 1, week 23, this week, etc.) - ABSOLUTELY FORBIDDEN
- NO "Green Thumbs", "green thumb", or any variation
- NO bullet points (•), numbered lists (1., 2., 3.), or dashes (-)
- NO emojis anywhere in content
- NO square bracket placeholders like [Company Name], [Region], [Location]
- NO markdown formatting like **bold**, *italic*, or \`code\`
- NO code blocks with \`\`\` or technical formatting
- Write ONLY in natural, flowing paragraphs

CONTENT MUST BE:
- Written in plain English like natural speech
- Broken into short, mobile-friendly paragraphs
- Completely free of any placeholder text
- Specific to the "${campaignTitle}" theme
- Authentic and personal without generic references
- NEVER mention weeks, week numbers, or use "Welcome to" phrases`;
  
  return prompt;
}
