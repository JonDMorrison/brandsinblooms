
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

  // CRITICAL: Enhanced headline and engagement restrictions
  const headlineRestrictions = `
HEADLINE & ENGAGEMENT REQUIREMENTS (MANDATORY):
- NEVER mention week numbers (Week 1, Week 25, etc.) anywhere in content
- NEVER use generic terms like "Weekly Newsletter" or "This Week"
- NO boring, generic headlines like "Problem Solving", "Plant Spotlight", "Seasonal Tips"
- Headlines must be SCROLL-STOPPING and benefit-driven using proven copywriting principles
- Use power words: save, transform, discover, secret, proven, instant, rescue, boost, master, unlock
- Create curiosity: "The Secret Your Tomatoes Don't Want You to Know"
- Focus on outcomes: "Turn Brown Leaves Green Again" vs "Plant Care Tips"
- Use urgency: "Before Your Garden Suffers This Month"
- Ask compelling questions: "Is This Pest Destroying Your Vegetables?"
- Promise transformations: "How to Save Dying Plants in 24 Hours"
- Create emotional hooks: "Don't Let Your Garden Dreams Die This Season"
- Use numbers and specifics: "5 Signs Your Soil is Crying for Help"
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
- ALL headlines and subheadlines must follow copywriting best practices for engagement
- Create SCROLL-STOPPING content that makes people stop and read`;

  switch (postType.toLowerCase()) {
    case 'instagram':
      return `${basePrompt}

INSTAGRAM POST REQUIREMENTS - CREATE SCROLL-STOPPING CONTENT:
- 250-350 words for comprehensive plant care storytelling that creates engagement
- HEADLINE MUST be scroll-stopping using these proven formulas:
  * "The [Number] [Plant Care Secret] That [Transforms Gardens/Saves Plants]"
  * "Why Your [Plants] Keep [Dying/Struggling] (And How to Fix It)"
  * "This [Time Period] Mistake is Killing Your [Plant Type]"
  * "Stop! Don't [Common Action] Until You Read This"
  * "The [Plant Care Secret] That Changed Everything"
  * "[Shocking Truth] About [Common Plant Care Belief]"
- Include 2-3 specific, actionable plant care tips customers can implement today
- Address a common plant problem with expert solutions that create "aha moments"
- Use engaging visual storytelling that connects emotionally with plant lovers
- Include 8-12 relevant gardening hashtags (#plantcare #gardening #seasonal #planttips #gardenlife)
- Use natural formatting: short paragraphs, bullet points, emojis where engaging
- Include an engaging question or call-to-action that encourages saves and comments
- Share seasonal plant care timing or variety recommendations
- Make it SAVE-WORTHY content that customers will reference later
- Create curiosity gaps that make people want to read the entire post
- Format: Scroll-stopping hook + story + practical tips + community question + hashtags

EXAMPLE SCROLL-STOPPING INSTAGRAM OPENINGS:
- "STOP watering your plants like this (you're slowly killing them) 🚨"
- "Your plant is screaming for help - here are the 3 signs you missed 👀"
- "This $2 trick saved my dying garden (gardeners hate this secret) 🤫"
- "POV: You've been fertilizing wrong your entire life (don't panic, here's the fix) 😱"
- "That moment when you realize you've been [doing X wrong] for years... 🤯"`;

    case 'facebook':
      return `${basePrompt}

FACEBOOK POST REQUIREMENTS - CREATE ENGAGING CONVERSATIONS:
- 400-500 words for comprehensive educational content that sparks discussion
- HEADLINE must be conversation-starting and benefit-driven:
  * "The Truth About [Plant Care Topic] That Will Change Your Garden"
  * "Here's Why Your [Plants] Are [Problem] (And the Simple Fix)"
  * "I've Been [Gardening Action] for 20 Years - Here's What I Learned"
  * "This Changed My Garden Forever (And It'll Change Yours Too)"
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
- Include seasonal timing advice and regional plant care considerations`;

    case 'blog':
      return `${basePrompt}

BLOG POST REQUIREMENTS - CREATE COMPREHENSIVE PLANT CARE GUIDES:
- Create an engaging, benefit-focused headline that captures the plant care value (NO company name in headline)
- Use proven blog headline formulas:
  * "The Complete Guide to [Plant Care Topic] (Step-by-Step)"
  * "How to [Achieve Result] Without [Common Problem]"
  * "[Number] Signs Your [Plants] Need [Care Action] (Don't Ignore #3)"
  * "The Ultimate [Plant Care] Guide: From [Problem] to [Success]"
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

BLOG SUBHEADLINE REQUIREMENTS (use copywriting principles):
- "The Hidden Reason Your Plants Keep Dying"
- "What Professional Gardeners Know (That You Don't)"
- "The 5-Minute Fix That Saves Struggling Plants"
- "Before You Give Up: Try This Simple Solution"
- "The Mistake 90% of Gardeners Make (And How to Avoid It)"`;

    case 'newsletter':
      return `${basePrompt}

NEWSLETTER REQUIREMENTS - CREATE VALUABLE PLANT CARE EDUCATION:
- 400-500 words of valuable plant care education across multiple topics
- MAIN NEWSLETTER TITLE must be engaging and theme-focused (NO "Weekly" or week numbers):
  * "Garden Rescue Guide: [Seasonal Focus]"
  * "Plant Health Emergency Kit: [Problem Solutions]"
  * "[Season] Garden Mastery: [Specific Benefits]"
  * "Your [Season] Success Blueprint: [Plant Care Focus]"
- Include comprehensive plant care schedules and seasonal techniques
- Address multiple plant care topics: featured plants, care instructions, problem solutions
- Cover specific plant varieties with detailed maintenance guidance
- Include plant health troubleshooting and problem prevention strategies
- Provide seasonal timing for plant care activities and variety selection
- Reference specialized plant care services and expert consultation available
- Professional plant care expertise with step-by-step actionable instructions
- Organize content around practical plant care themes customers can use immediately
- Include regional plant care timing and climate-specific recommendations

NEWSLETTER SECTION HEADLINES (use engaging copywriting):
- Instead of "Seasonal Tips" → "Beat the Heat: Your Plant's Summer Survival Guide"
- Instead of "Problem Solving" → "SOS: Save Your Plants Before It's Too Late"
- Instead of "Plant Spotlight" → "This Month's Garden Game-Changer"
- Instead of "Looking Ahead" → "Get Ready: Your Garden's Next Power Move"`;

    case 'video':
      return `${basePrompt}

VIDEO SCRIPT REQUIREMENTS - CREATE ENGAGING PLANT CARE DEMONSTRATIONS:
- 2-3 minute script for hands-on plant care demonstration
- VIDEO TITLE must grab attention immediately:
  * "Save Dying Plants in Under 5 Minutes"
  * "The Plant Care Mistake Everyone Makes"
  * "Transform Your Garden With This Secret"
  * "Why Your Plants Are Dying (The Shocking Truth)"
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

VIDEO SEGMENT TITLES (build anticipation):
- "The #1 Mistake Everyone Makes"
- "The Secret Professional Gardeners Use"
- "What Happens Next Will Surprise You"
- "The Results That Changed Everything"`;

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
