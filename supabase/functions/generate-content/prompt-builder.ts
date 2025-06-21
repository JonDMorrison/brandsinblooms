
export function buildContentPrompt(
  postType: string, 
  campaignTitle: string, 
  companyProfile: any, 
  weekDescription?: string,
  enforceCompanyName: boolean = true
): string {
  const companyName = companyProfile?.company_name || 'Your Garden Center';
  const location = companyProfile?.location_info || 'your local area';
  const specializations = companyProfile?.specializations || 'full-service garden center offerings';
  
  // Garden center context for all content
  const gardenCenterContext = `
GARDEN CENTER BUSINESS CONTEXT:
- Business: ${companyName} - a professional garden center serving ${location}
- Specializations: ${specializations}
- Focus: Plants, gardening supplies, landscaping, seasonal horticulture
- Audience: Home gardeners, landscapers, plant enthusiasts of all skill levels
- Expertise: Plant care, seasonal gardening, local growing conditions, troubleshooting
`;

  // Enhanced plant care guidance with storytelling elements
  const plantCareGuidance = `
CONTENT VALUE REQUIREMENTS (CRITICAL for quality):
- Include specific, actionable plant care instructions that customers can implement immediately
- Address common seasonal plant issues and provide step-by-step solutions
- Share practical watering, fertilizing, pruning, or pest management advice
- Include timing recommendations for plant care activities
- Reference specific plant varieties when relevant to the theme
- Use storytelling elements to make plant care relatable and engaging
- Address different skill levels from beginner to advanced gardeners
- Include "why" explanations to help customers understand plant care principles
`;

  // CRITICAL: Headline and content restrictions
  const headlineRestrictions = `
HEADLINE & CONTENT RESTRICTIONS (MANDATORY):
- NEVER mention week numbers (Week 1, Week 25, etc.) anywhere in content
- NEVER use generic terms like "Weekly Newsletter" or "This Week"
- NO boring, generic headlines like "Problem Solving", "Plant Spotlight", "Seasonal Tips"
- Headlines must be ENGAGING and benefit-driven using copywriting principles
- Use power words: save, transform, discover, secret, proven, instant, rescue, boost
- Create curiosity: "The Secret Your Tomatoes Don't Want You to Know"
- Focus on outcomes: "Turn Brown Leaves Green Again" vs "Plant Care Tips"
- Use urgency: "Before Your Garden Suffers This Month"
- Ask compelling questions: "Is This Pest Destroying Your Vegetables?"
- Promise transformations: "How to Save Dying Plants in 24 Hours"
- Avoid industry jargon in headlines - use customer language that creates emotion
`;

  const basePrompt = `${gardenCenterContext}

${plantCareGuidance}

${headlineRestrictions}

CAMPAIGN: ${campaignTitle}
${weekDescription ? `DESCRIPTION: ${weekDescription}` : ''}

Create professional ${postType} content for this garden center campaign. Content must be:
- Genuinely valuable with practical plant care advice customers can use today
- Engaging with natural storytelling and seasonal relevance
- Professional yet conversational tone that builds trust and expertise
- Mention ${companyName} naturally when appropriate (${enforceCompanyName ? 'REQUIRED' : 'preferred'})
- Formatted for maximum readability and engagement on the platform
- Shareable content that customers will want to save and share with others
- ALL headlines and subheadlines must follow copywriting best practices for engagement`;

  switch (postType.toLowerCase()) {
    case 'instagram':
      return `${basePrompt}

INSTAGRAM POST REQUIREMENTS:
- 250-350 words for comprehensive plant care storytelling
- Include 2-3 specific, actionable plant care tips customers can implement today
- Address a common plant problem or seasonal gardening opportunity
- Use engaging visual storytelling that connects emotionally with plant lovers
- Include 8-12 relevant gardening hashtags (#plantcare #gardening #seasonal #planttips #gardenlife)
- Use natural formatting: short paragraphs, bullet points, emojis where engaging
- Include an engaging question or call-to-action that encourages comments
- Share seasonal plant care timing or variety recommendations
- Make it save-worthy content that customers will reference later
- Format: Engaging caption with story + practical tips + community question + hashtags

HEADLINE REQUIREMENTS FOR INSTAGRAM:
- Create scroll-stopping hooks that grab attention immediately
- Use benefit-driven openings: "Save Your Plants from..." or "Discover the Secret to..."
- Ask compelling questions: "Tired of watching your plants struggle?"
- Use emotional triggers: "Don't let your garden dreams die this season"
- Promise quick results: "Transform your garden in one weekend"
- Create urgency: "Before summer heat kills your plants"`;

    case 'facebook':
      return `${basePrompt}

FACEBOOK POST REQUIREMENTS:
- 400-500 words for comprehensive educational content
- Include 3-4 detailed plant care instructions with step-by-step guidance
- Address seasonal plant health challenges with practical solutions
- Share specific plant varieties, care schedules, and timing recommendations
- Include troubleshooting advice for common plant problems
- Use conversational storytelling that makes plant care accessible and engaging
- Ask thoughtful questions about gardening experiences to encourage discussion
- Include calls-to-action for visiting the garden center or trying techniques
- Reference unique plant care expertise and specialized services available
- Use natural formatting with bullet points or numbered lists for clarity
- Make it shareable content that provides genuine educational value
- Include seasonal timing advice and regional plant care considerations

HEADLINE REQUIREMENTS FOR FACEBOOK:
- Create conversation-starting headlines that encourage engagement
- Use problem-solution format: "Struggling with Yellow Leaves? Here's Why..."
- Promise valuable insights: "3 Signs Your Soil is Crying for Help"
- Use curiosity gaps: "This Common Mistake is Killing Your Houseplants"
- Appeal to emotions: "Rescue Your Dying Garden Before It's Too Late"
- Focus on transformations: "From Wilted to Wonderful: A Plant Recovery Story"`;

    case 'blog':
      return `${basePrompt}

BLOG POST REQUIREMENTS:
- Create an engaging, benefit-focused headline that captures the plant care value (NO company name in headline)
- 600-800 words of comprehensive, educational plant care content
- Structure with clear H2 and H3 headings for plant care topics (NO H1 tags in content)
- Include detailed plant care instructions with seasonal timing
- Address common gardening challenges with step-by-step solutions
- Cover specific plant varieties, care techniques, and troubleshooting methods
- Provide actionable advice customers can implement in their own gardens
- Include seasonal plant care schedules and regional considerations
- Educational tone that establishes deep plant care expertise
- SEO-friendly with natural integration of gardening and plant care keywords
- Include calls-to-action for expert consultation and garden center resources
- Make it comprehensive enough to be bookmarked as a plant care reference

HEADLINE & SUBHEADLINE REQUIREMENTS FOR BLOG:
- Main headline must be benefit-driven and SEO-friendly without being generic
- Use proven formulas: "How to [Achieve Benefit] Without [Common Problem]"
- Promise solutions: "The Complete Guide to Saving Overwatered Plants"
- Create urgency: "Don't Wait: Early Signs Your Garden Needs Emergency Care"
- H2 subheadlines should follow copywriting principles:
  * "The Hidden Reason Your Plants Keep Dying"
  * "What Professional Gardeners Know (That You Don't)"
  * "The 5-Minute Fix That Saves Struggling Plants"
  * "Before You Give Up: Try This Simple Solution"
- Each subheadline should promise value and create anticipation`;

    case 'newsletter':
      return `${basePrompt}

NEWSLETTER SECTION REQUIREMENTS:
- 400-500 words of valuable plant care education
- Include comprehensive plant care schedules and seasonal techniques
- Address multiple plant care topics: featured plants, care instructions, problem solutions
- Cover specific plant varieties with detailed maintenance guidance
- Include plant health troubleshooting and problem prevention strategies
- Provide seasonal timing for plant care activities and variety selection
- Reference specialized plant care services and expert consultation available
- Professional plant care expertise with step-by-step actionable instructions
- Organize content around practical plant care themes customers can use immediately
- Include regional plant care timing and climate-specific recommendations

NEWSLETTER HEADLINE REQUIREMENTS:
- Main newsletter title must be engaging and theme-focused (NO "Weekly" or week numbers)
- Use magazine-style headlines: "Garden Rescue Guide" or "Plant Health Emergency Kit"
- Section headlines must follow copywriting principles:
  * Instead of "Seasonal Tips" → "Beat the Heat: Your Plant's Summer Survival Guide"
  * Instead of "Problem Solving" → "SOS: Save Your Plants Before It's Too Late"
  * Instead of "Plant Spotlight" → "This Month's Garden Game-Changer"
  * Instead of "Looking Ahead" → "Get Ready: Your Garden's Next Power Move"
- Each section should promise specific benefits and create anticipation
- Use emotional triggers and urgency where appropriate`;

    case 'video':
      return `${basePrompt}

VIDEO SCRIPT REQUIREMENTS:
- 2-3 minute script for hands-on plant care demonstration
- Focus on practical plant care techniques customers can see and replicate
- Include visual cues for plant care demonstrations and problem identification
- Natural speaking rhythm with clear plant care instruction and timing
- Strong opening hook about a common plant care challenge or seasonal opportunity  
- Step-by-step plant care guidance with visual demonstration notes
- Professional but engaging presentation style for plant care education
- Include plant health troubleshooting and maintenance techniques
- Clear calls-to-action for plant care supplies and expert consultation
- Format: [VISUAL: Detailed plant care demonstration] NARRATION: "Clear instruction"
- Make it educational content customers will want to save and reference

VIDEO HEADLINE & SEGMENT REQUIREMENTS:
- Video title must grab attention: "Save Dying Plants in Under 5 Minutes"
- Opening hook should create immediate interest: "If your plants look like this, don't panic..."
- Segment titles should build anticipation:
  * "The #1 Mistake Everyone Makes"
  * "The Secret Professional Gardeners Use"
  * "What Happens Next Will Surprise You"
  * "The Results That Changed Everything"
- Use curiosity gaps and benefit-driven language throughout
- Promise quick, visible results to maintain engagement`;

    default:
      return `${basePrompt}

Create engaging ${postType} content that provides genuine plant care value related to the campaign theme. Include specific plant care knowledge, seasonal gardening advice, and actionable tips customers can implement. Use appropriate formatting including lists, bullets, or other elements that improve readability and engagement while focusing on practical plant care education.

HEADLINE REQUIREMENTS:
- ALL headlines must be engaging and benefit-driven using copywriting principles
- NO generic titles or week number references
- Focus on customer outcomes and emotional appeal
- Use power words and create curiosity
- Promise specific benefits or transformations`;
  }
}
