
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

  const basePrompt = `${gardenCenterContext}

${plantCareGuidance}

CAMPAIGN: ${campaignTitle}
${weekDescription ? `DESCRIPTION: ${weekDescription}` : ''}

Create professional ${postType} content for this garden center campaign. Content must be:
- Genuinely valuable with practical plant care advice customers can use today
- Engaging with natural storytelling and seasonal relevance
- Professional yet conversational tone that builds trust and expertise
- Mention ${companyName} naturally when appropriate (${enforceCompanyName ? 'REQUIRED' : 'preferred'})
- Formatted for maximum readability and engagement on the platform
- Shareable content that customers will want to save and share with others`;

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
- Format: Engaging caption with story + practical tips + community question + hashtags`;

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
- Include seasonal timing advice and regional plant care considerations`;

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
- Make it comprehensive enough to be bookmarked as a plant care reference`;

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
- Include regional plant care timing and climate-specific recommendations`;

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
- Make it educational content customers will want to save and reference`;

    default:
      return `${basePrompt}

Create engaging ${postType} content that provides genuine plant care value related to the campaign theme. Include specific plant care knowledge, seasonal gardening advice, and actionable tips customers can implement. Use appropriate formatting including lists, bullets, or other elements that improve readability and engagement while focusing on practical plant care education.`;
  }
}
