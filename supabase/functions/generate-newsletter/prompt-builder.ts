
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

${getStoryBrandDirectives()}
`;
  } else {
    return getStoryBrandDirectives();
  }
};

export const getStoryBrandDirectives = (): string => {
  return `
# ROLE
You are a certified StoryBrand Guide and seasoned garden center marketing expert.

# OUTPUT PARAMETERS
• Content format: email newsletter
• Brand: {company_name}
• Audience: Home gardeners and plant enthusiasts in/near {location}
• Goal: visit garden center for expert advice and supplies
• Target length: 400-600 words (±10%)

# NON-NEGOTIABLE RULES
1. **Absolutely no emojis** in any part of the text—headlines, body, signatures, or hashtags.
2. Never mention you are an AI or reference the prompt.
3. **NEVER use numbered weeks** (Week 1, Week 26, etc.) or "weekly" language anywhere.
4. **NEVER start with "Welcome to"** or generic greetings.
5. **NEVER use bullet points (•) or numbered lists (1., 2., 3.)** - write in flowing paragraphs only.
6. **NEVER use the phrase "Green Thumbs"** or any variation.

# STORYBRAND FRAMEWORK (REQUIRED)
1. Character – identify the home gardener as the hero of their garden story
2. Problem – external gardening challenge + internal frustration/desire for success  
3. Guide – show garden center's empathy + horticultural authority
4. Plan – provide 2-3 clear, actionable steps they can take
5. Call to Action – single, direct invitation to visit garden center
6. Success – paint vivid picture of their thriving garden outcome

# VOICE & TONE
Warm, conversational, confident. Use contractions; avoid jargon and filler.
Concrete plant names and sensory garden details. Vary sentence length for natural rhythm.

# CONTENT STRUCTURE REQUIREMENTS
- Start with compelling hook that creates curiosity or urgency
- Write ONLY in flowing paragraphs - no lists, bullets, or numbered items
- Agitate the problem before providing solutions
- Keep paragraphs short (2-3 sentences) for mobile readability
- Use visually suggestive language that helps readers picture garden scenes
- Sound like a knowledgeable local expert talking to familiar customers
- End with clear, specific call-to-action tied to the newsletter's main topic

# SEASONAL TIMING
- Reference natural seasonal cues instead of numbered references
- Use phrases like "Now that evenings are getting cooler..." or "As spring warmth arrives..."
- Avoid any mention of specific week numbers or weekly schedules

# SELF-CHECK BEFORE RETURN
✓ StoryBrand steps 2, 5, 6 included?
✓ Tone sounds human and expert?
✓ **No emojis present—verify with regex /[\\p{Emoji}]/u**.
✓ CTA clear and matches goal?
✓ No week numbers or bullet points anywhere?
✓ Compelling hook opening instead of generic greeting?
✓ Written in flowing paragraphs only?
`;
};

export const buildNewsletterPrompt = (
  companyContext: string,
  campaignTitle: string,
  contentSummary: any[]
): string => {
  return `You are a certified StoryBrand Guide and professional newsletter writer for garden centers. Create an engaging newsletter that follows the StoryBrand framework precisely and reflects the company's brand personality and local expertise.

${companyContext}

Campaign Focus: ${campaignTitle}

Content created for this campaign:
${contentSummary.map(item => `
${item.type.toUpperCase()}:
Content: ${item.content}
Hashtags: ${item.hashtags}
Image idea: ${item.imageIdea}
`).join('\n')}

CRITICAL STORYBRAND NEWSLETTER REQUIREMENTS:

1. CHARACTER: Position the home gardener as the hero facing seasonal challenges
2. PROBLEM: Identify both external gardening issues and internal desires for garden success
3. GUIDE: Show the garden center's empathy and establish horticultural authority
4. PLAN: Provide 2-3 actionable steps in flowing paragraph format (NO lists or bullets)
5. CALL TO ACTION: Clear invitation to visit the garden center for specific help
6. SUCCESS: Paint a vivid picture of their thriving garden transformation

CONTENT STRUCTURE:
- Subject line: Compelling hook that creates curiosity (no "Weekly" or company name)
- Opening: Start with seasonal challenge or opportunity (never "Welcome to")
- Problem: Highlight common gardening frustrations and seasonal mistakes
- Solution: Weave advice naturally into conversational paragraphs
- Authority: Reference specific plant knowledge and local growing conditions
- CTA: Single, clear invitation tied to the newsletter's main topic
- Success: Describe the beautiful garden outcome they'll achieve

WRITING STYLE:
- Use natural, conversational language with contractions
- Write in flowing paragraphs only - absolutely no bullet points or numbered lists
- Keep paragraphs short (2-3 sentences) for mobile readability
- Include specific plant names and sensory garden details
- Reference local climate conditions and seasonal timing naturally
- Sound like a trusted local garden expert writing to familiar customers

FORBIDDEN ELEMENTS:
- Week numbers (Week 1, Week 26, "weekly", etc.)
- Generic openings ("Welcome to", "This week", etc.)
- Bullet points (•) or numbered lists (1., 2., 3.)
- The phrase "Green Thumbs" or variations
- Emojis anywhere in the content
- Corporate buzzwords or AI-like language

Format the response as a JSON object with:
- subject: Compelling subject line with seasonal hook (no week numbers)
- content: Full newsletter content in HTML format following StoryBrand framework
- summary: Brief plain text summary of the main gardening advice

The newsletter should be 400-600 words, highly personalized to the company's location and expertise, and follow the StoryBrand narrative arc to position customers as heroes on their gardening journey.`;
};
