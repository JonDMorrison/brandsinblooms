
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
- Audience: Home gardeners, landscapers, plant enthusiasts
- Expertise: Plant care, seasonal gardening, local growing conditions
`;

  // Critical formatting rules for all content
  const formattingRules = `
CRITICAL FORMATTING REQUIREMENTS:
- Use VERY SHORT paragraphs - maximum 1-2 sentences per paragraph for social media, 2-3 for longer content
- Add line breaks between different thoughts, tips, or key points
- Format for mobile readability with plenty of white space
- Each major point should be on its own line or paragraph
- Make content scannable and easy to read on mobile devices
- Break up long blocks of text into digestible chunks
`;

  // Contextual plant care emphasis (not mandatory for every piece)
  const plantCareGuidance = `
PLANT CARE INTEGRATION (when relevant to campaign theme):
- Include specific plant care instructions when the theme relates to plant health, maintenance, or seasonal care
- Address common plant issues and solutions when discussing plant problems or troubleshooting
- Provide actionable advice for watering, fertilizing, pruning when relevant to the content theme
- Cover seasonal plant care timing when discussing seasonal topics
- Include plant selection guidance when the theme relates to choosing plants
- Focus on practical, implementable advice that garden center customers can use
`;

  const basePrompt = `${gardenCenterContext}

${formattingRules}

${plantCareGuidance}

CAMPAIGN: ${campaignTitle}
${weekDescription ? `DESCRIPTION: ${weekDescription}` : ''}

Create professional ${postType} content for this garden center campaign. Content should be:
- Specifically relevant to garden centers and the gardening community
- Include plant care advice when it naturally fits the campaign theme
- Professional yet approachable tone for gardening enthusiasts
- Mention ${companyName} naturally when appropriate (${enforceCompanyName ? 'REQUIRED' : 'preferred'})
- Engaging and valuable to customers interested in gardening, plants, and outdoor living`;

  switch (postType.toLowerCase()) {
    case 'instagram':
      return `${basePrompt}

INSTAGRAM POST REQUIREMENTS:
- 150 words maximum
- CRITICAL: Use very short paragraphs - maximum 1-2 sentences per paragraph
- Add line breaks between different topics or key points
- Include 5-8 relevant gardening hashtags (#gardening #plants #seasonal #plantcare)
- Visual storytelling about plants, gardens, or seasonal activities
- Use engaging formatting: short paragraphs, emojis where appropriate
- Include plant care tips when they naturally fit the campaign theme
- Call-to-action encouraging garden center visit or gardening activity
- Format: Caption text with frequent line breaks followed by hashtags on separate lines
- Style: Social media friendly with natural formatting optimized for mobile scanning

EXAMPLE FORMATTING:
"First paragraph with 1-2 sentences about the topic.

Second key point on its own line.

Another important tip or insight.

Final call-to-action or question.

#hashtags #here"`;

    case 'facebook':
      return `${basePrompt}

FACEBOOK POST REQUIREMENTS:
- 125 words maximum (KEEP IT SHORT AND SCANNABLE)
- CRITICAL: Use very short paragraphs - maximum 1-2 sentences per paragraph
- Add line breaks between different thoughts, tips, or questions
- Educational content with practical gardening tips when relevant to theme
- Community engagement focus - ask questions about gardening experiences
- Include plant care information when it fits naturally with the campaign theme
- Professional but conversational tone about gardening expertise
- Encourage comments and community discussion about gardening challenges
- Include call-to-action for visiting garden center or trying gardening techniques
- End with engaging question on separate line
- Format: Short paragraphs with frequent line breaks for mobile readability

EXAMPLE FORMATTING:
"Opening sentence or two about the topic.

Key tip or insight on its own line.

Another important point with line break.

Plant care advice when relevant.

What's your experience with this? Share in the comments!"`;

    case 'blog':
      return `${basePrompt}

BLOG POST REQUIREMENTS:
- Create an engaging, descriptive headline that captures the campaign theme WITHOUT including the company name
- The headline should focus on the gardening topic, seasonal advice, or plant care theme
- 600-800 words of comprehensive, educational content
- Structure with clear H2 and H3 headings for better readability (NO H1 tags in content)
- CRITICAL: Use short paragraphs throughout - maximum 2-3 sentences per paragraph
- Add line breaks between different concepts or tips for mobile readability
- Value-driven content that provides actionable gardening advice
- Include detailed plant care instructions when relevant to campaign theme
- Address seasonal gardening challenges and solutions
- Cover plant varieties, care techniques, and troubleshooting when appropriate
- Educational tone that establishes garden center expertise
- Include call-to-action for garden center visit or expert consultation
- Format: Complete blog post with headline and structured content sections with frequent paragraph breaks
- SEO considerations: natural keyword integration related to gardening and plants
- IMPORTANT: Do NOT use H1 tags in the content body - start with H2 for main sections

EXAMPLE PARAGRAPH FORMATTING:
"Short opening paragraph with 2-3 sentences max.

Another key point in its own paragraph.

Plant care tip or instruction broken into digestible chunks."`;

    case 'newsletter':
      return `${basePrompt}

NEWSLETTER SECTION REQUIREMENTS:
- 400-500 words
- CRITICAL: Use short paragraphs throughout - maximum 2-3 sentences per paragraph
- Add line breaks between different topics or sections for mobile scanning
- Educational focus on gardening topics related to campaign theme
- Multiple topics when relevant: featured plants, seasonal tips, gardening techniques
- Include plant care information when it naturally supports the campaign theme
- Professional gardening expertise with step-by-step instructions when appropriate
- Sections organized around campaign theme with practical gardening advice
- Address gardening challenges and solutions relevant to the campaign
- Call-to-action for garden center visit and expert gardening consultation
- Format: Newsletter-style content with clear sections and frequent paragraph breaks for mobile readability

EXAMPLE FORMATTING:
"Section header or topic introduction.

Key point or tip in short paragraph.

Another important insight with line break.

Plant care instruction when relevant."`;

    case 'video':
      return `${basePrompt}

VIDEO SCRIPT REQUIREMENTS:
- 2-3 minute script for garden center demonstration or educational video
- Use short sentences with natural pauses between key points
- Break content into digestible segments with clear transitions
- Educational content about gardening topics related to campaign theme
- Include visual cues for gardening demonstrations, plant showcases, or technique tutorials
- Focus on hands-on gardening instruction when theme supports it
- Professional but engaging presentation style for gardening education
- Include plant care instructions and techniques when relevant to campaign theme
- Strong opening hook related to campaign theme and gardening opportunity
- Clear call-to-action to visit garden center for supplies or expert consultation
- Format: [VISUAL: Description] followed by NARRATION: "Content with natural pauses"
- Style: Natural, conversational instruction with practical gardening advice broken into clear segments`;

    default:
      return `${basePrompt}

Create engaging ${postType} content that showcases gardening expertise related to the campaign theme. 

CRITICAL FORMATTING:
- Use very short paragraphs with frequent line breaks
- Format for mobile readability and scanning
- Break up content into digestible chunks

Include plant care knowledge and seasonal gardening advice when it naturally fits the campaign focus. Use appropriate formatting for the content type including lists, bullets, or other elements that improve readability and engagement.`;
  }
}
