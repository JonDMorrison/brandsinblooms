
export interface CompanyProfile {
  company_name?: string;
  company_overview?: string;
  brand_voice?: string;
  tone_of_writing?: string;
  target_audience?: string;
  ideal_customer?: string;
  unique_selling_points?: string;
  company_values?: string;
  seasonal_focus?: string;
  specializations?: string;
  location_info?: string;
}

export interface ContentTask {
  post_type: string;
  ai_output: string;
  hashtags: string;
  image_idea: string;
}

export const buildCompanyContext = (companyProfile: CompanyProfile | null): string => {
  if (companyProfile) {
    return `
COMPANY PROFILE:
Company Name: ${companyProfile.company_name || 'Garden Center'}
Overview: ${companyProfile.company_overview || ''}
Brand Voice: ${companyProfile.brand_voice || ''}
Tone of Writing: ${companyProfile.tone_of_writing || ''}
Target Audience: ${companyProfile.target_audience || ''}
Ideal Customer: ${companyProfile.ideal_customer || ''}
Unique Selling Points: ${companyProfile.unique_selling_points || ''}
Company Values: ${companyProfile.company_values || ''}
Seasonal Focus: ${companyProfile.seasonal_focus || ''}
Specializations: ${companyProfile.specializations || ''}
Location Info: ${companyProfile.location_info || ''}

REGIONAL NEWSLETTER FOCUS:
- Use the Location Info to create content highly specific to their geographic region and climate
- Reference local growing seasons, weather patterns, and gardening calendars specific to their area
- Include region-appropriate plant recommendations and gardening advice
- Consider local hardiness zones, frost dates, and seasonal timing for their specific location
- Address regional gardening challenges (drought, humidity, snow, heat, soil conditions, local pests)
- Reference local gardening culture, preferences, and community events when appropriate
- Use seasonal timing advice that's accurate for their specific climate zone
- Include locally-relevant tips that would resonate with gardeners in their specific region

IMPORTANT: Use this company information to personalize the newsletter with highly location-specific content that reflects their specific geographic region, local climate, and regional gardening conditions.

${getWritingStyleDirectives()}
`;
  } else {
    return getWritingStyleDirectives();
  }
};

export const getWritingStyleDirectives = (): string => {
  return `
ENHANCED WRITING STYLE DIRECTIVES (CRITICAL - APPLY TO ALL CONTENT):
1. ALWAYS START WITH A HOOK: Begin with a powerful opening that sparks curiosity, urgency, or seasonal awareness. Never open with "Welcome to," "This week," or generic greetings. Subject lines and openings should be strong, specific, and emotionally engaging.

2. AGITATE BEFORE YOU EDUCATE: After the hook, highlight common challenges or seasonal mistakes before giving advice. Make the reader feel the problem before introducing solutions.

3. KEEP PARAGRAPHS SHORT: Use paragraphs no longer than 2-3 sentences. Break long ideas into multiple short, readable chunks for mobile-friendliness.

4. MAKE IT VISUALLY SUGGESTIVE: Use words that help readers picture what you're talking about (e.g. "lush beds," "cracked soil," "overflowing baskets"). Avoid dry, abstract phrasing. Create scenes with your words.

5. USE A CONVERSATIONAL TONE: Sound like a local garden center owner writing to familiar customers. Avoid corporate, robotic, or overly polished language. Use friendly contractions, plain language, and warm phrasing.

6. INCLUDE A CLEAR, ALIGNED CTA: End with a single clear call-to-action that ties directly to the newsletter's main topic. Avoid vague CTAs like "Check it out" — use concrete, helpful instructions.

7. ANCHOR TIME WITHOUT NUMBERED REFERENCES: Reference seasonal timing in natural, relatable ways like "Now that the evenings are warmer…" or "This is the last cool stretch before summer hits…" NEVER use any numbered week references.

CRITICAL CONTENT RESTRICTIONS: 
- ABSOLUTELY NEVER use the phrase "Green Thumbs", "green thumb", "Green Thumb", or any variation of this phrase in any content
- ABSOLUTELY NEVER use bullet points (•) or numbered lists (1., 2., 3.) in the content
- ABSOLUTELY NEVER use dashes (-) to create lists
- ABSOLUTELY NEVER mention numbered weeks in the content (e.g., "Happy Week 23", "This is week 15", "Week 26", etc.)
- ABSOLUTELY NEVER start with "Welcome to" language or similar generic openings
- ABSOLUTELY NEVER use emojis in any content - keep all text completely emoji-free
- ALWAYS start with a powerful, attention-grabbing hook that immediately engages the reader
- Write ONLY in flowing paragraphs and natural sentences
- Avoid ALL cliché gardening phrases and focus on fresh, authentic language
- Make all advice regionally appropriate and climate-specific
- If you need to present multiple points, weave them into natural paragraph flow
`;
};

export const buildNewsletterPrompt = (
  companyContext: string,
  campaignTitle: string,
  contentSummary: any[]
): string => {
  return `You are a professional newsletter writer for a garden center with deep expertise in regional gardening differences across various climate zones and geographic areas. Create an engaging newsletter that reflects the specific company's brand, personality, and most importantly their local region and climate conditions.

${companyContext}

Campaign: ${campaignTitle}

Content created for this campaign:
${contentSummary.map(item => `
${item.type.toUpperCase()}:
Content: ${item.content}
Hashtags: ${item.hashtags}
Image idea: ${item.imageIdea}
`).join('\n')}

Create a comprehensive newsletter that:
1. STARTS WITH A POWERFUL HOOK in both subject line and opening - NO "Welcome to" language or numbered week mentions
2. AGITATES BEFORE EDUCATING: Highlights common seasonal challenges or mistakes before providing solutions
3. Uses SHORT PARAGRAPHS (2-3 sentences max) throughout for mobile readability
4. Makes content VISUALLY SUGGESTIVE with descriptive language that creates mental pictures
5. Sounds CONVERSATIONAL like a trusted local expert writing to familiar customers
6. Uses the company's specific name and brand voice throughout
7. Reflects their unique selling points and specializations
8. Speaks directly to their target audience and ideal customer
9. Incorporates their company values naturally
10. References their location and seasonal focus with high specificity to their region
11. Maintains their preferred tone of writing
12. Highlights the campaign's main theme from the content
13. Includes practical gardening tips that are specifically relevant to their geographic location and climate zone
14. Mentions seasonal activities and timing that's accurate for their specific region
15. Addresses local gardening challenges and regional growing conditions
16. References plants, techniques, and timing appropriate for their local hardiness zone
17. Considers local weather patterns, soil conditions, and regional gardening culture
18. Uses natural seasonal timing references instead of any numbered references
19. Ends with a personalized, SPECIFIC call-to-action that reflects their local community and provides clear next steps
20. ABSOLUTELY NEVER uses "Green Thumbs", "green thumb", or any variation of this phrase
21. ABSOLUTELY NEVER uses bullet points, numbered lists, or dashes - write in flowing paragraphs only
22. ABSOLUTELY NEVER mentions numbered weeks in any form (including "Week 26", "Week 15", etc.)
23. ABSOLUTELY NEVER starts with "Welcome to" or similar generic openings
24. ABSOLUTELY NEVER uses emojis anywhere in the content - keep all text completely emoji-free

Format the response as a JSON object with:
- subject: The email subject line (incorporating company name and regional relevance, starting with a hook)
- content: The full newsletter content in HTML format
- summary: A brief plain text summary

The newsletter should be 400-600 words and feel personal, authentic, and highly relevant to this specific garden center and their local region/climate.`;
};
