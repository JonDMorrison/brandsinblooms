
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

  const basePrompt = `${gardenCenterContext}

CAMPAIGN: ${campaignTitle}
${weekDescription ? `DESCRIPTION: ${weekDescription}` : ''}

Create professional ${postType} content for this garden center campaign. Content must be:
- Specifically relevant to garden centers and plant retail
- Include seasonal gardening advice and plant care tips
- Mention ${companyName} naturally (${enforceCompanyName ? 'REQUIRED' : 'preferred'})
- Focus on gardening expertise and seasonal plant needs
- Professional yet approachable tone for gardening community`;

  switch (postType.toLowerCase()) {
    case 'instagram':
      return `${basePrompt}

INSTAGRAM POST REQUIREMENTS:
- 150-200 words maximum
- Include 5-8 relevant gardening hashtags (#gardening #plants #seasonal)
- Visual storytelling about plants, gardens, or seasonal activities
- Engaging caption that educates about plant care or seasonal gardening
- Call-to-action encouraging garden center visit or gardening activity
- Focus on visual aspects: plant displays, seasonal color, garden transformations

Format: Caption text followed by hashtags on separate lines.`;

    case 'facebook':
      return `${basePrompt}

FACEBOOK POST REQUIREMENTS:
- 200-300 words
- Educational gardening content with practical tips
- Community engagement focus - ask questions about gardening experiences
- Include seasonal plant care advice or garden center highlights
- Professional but conversational tone
- Encourage comments and community discussion about gardening
- Include call-to-action for visiting the garden center or trying gardening techniques

Format: Engaging post text only.`;

    case 'email':
      return `${basePrompt}

EMAIL CONTENT REQUIREMENTS:
- Subject line that mentions seasonal gardening opportunity
- 300-400 words
- Valuable gardening advice or seasonal plant information
- Personal, helpful tone from garden center experts
- Include specific plant care tips or seasonal gardening tasks
- Call-to-action to visit garden center for plants/supplies
- Format as complete email with subject line

Format:
Subject: [compelling subject line]

[Email body content]`;

    case 'newsletter':
      return `${basePrompt}

NEWSLETTER SECTION REQUIREMENTS:
- 400-500 words
- Educational focus on seasonal gardening and plant care
- Multiple topics: featured plants, seasonal tips, garden center news
- Include specific plant varieties and care instructions
- Professional gardening expertise throughout
- Sections: seasonal highlights, plant spotlight, gardening tips
- Call-to-action for garden center visit and plant purchases

Format: Newsletter-style content with clear sections and gardening focus.`;

    case 'video':
      return `${basePrompt}

VIDEO SCRIPT REQUIREMENTS:
- 2-3 minute script for garden center video
- Educational content about plants, seasonal gardening, or plant care
- Include visual cues for plant demonstrations or garden tours
- Professional but engaging presentation style
- Specific plant care instructions or seasonal gardening advice
- Strong opening hook about gardening opportunity
- Clear call-to-action to visit garden center

Format:
[VISUAL: Description of what viewers see]
NARRATION: "What the presenter says about gardening/plants"

Include multiple visual and narration segments.`;

    default:
      return `${basePrompt}

Create engaging ${postType} content that showcases garden center expertise and seasonal plant knowledge. Focus on educating customers about plants, gardening techniques, and seasonal opportunities.`;
  }
}
