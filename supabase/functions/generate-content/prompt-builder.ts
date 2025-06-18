
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

  // Enhanced plant care focus section
  const plantCareFocus = `
MANDATORY PLANT CARE EMPHASIS:
- ALWAYS include specific plant care instructions and techniques
- Address common plant health issues and their solutions
- Provide actionable watering, fertilizing, and maintenance advice
- Include seasonal plant care timing and scheduling
- Cover pest and disease prevention/treatment when relevant
- Mention soil health, nutrition, and growing conditions
- Offer plant selection guidance for different situations
- Include pruning, propagation, or maintenance tips when appropriate
- Address both indoor and outdoor plant care as relevant
- Provide troubleshooting advice for common plant problems
`;

  const basePrompt = `${gardenCenterContext}

${plantCareFocus}

CAMPAIGN: ${campaignTitle}
${weekDescription ? `DESCRIPTION: ${weekDescription}` : ''}

Create professional ${postType} content for this garden center campaign. Content must be:
- Specifically relevant to garden centers and plant retail
- Include comprehensive plant care advice and practical instructions
- Focus heavily on plant health, care techniques, and problem-solving
- Mention ${companyName} naturally (${enforceCompanyName ? 'REQUIRED' : 'preferred'})
- Provide seasonal plant care guidance and expert recommendations
- Address common plant care challenges with actionable solutions
- Professional yet approachable tone for gardening community`;

  switch (postType.toLowerCase()) {
    case 'instagram':
      return `${basePrompt}

INSTAGRAM POST REQUIREMENTS:
- 150-200 words maximum
- Include 5-8 relevant gardening hashtags (#gardening #plants #seasonal #plantcare)
- Visual storytelling about plants, gardens, or seasonal activities
- MANDATORY: Include specific plant care tips or problem-solving advice
- Focus on common plant issues and their solutions
- Call-to-action encouraging garden center visit or plant care activity
- Highlight plant health techniques, watering tips, or seasonal care
- Address plant care challenges customers commonly face

Format: Caption text followed by hashtags on separate lines.`;

    case 'facebook':
      return `${basePrompt}

FACEBOOK POST REQUIREMENTS:
- 200-300 words
- Educational plant care content with detailed practical tips
- Community engagement focus - ask questions about plant care experiences
- MANDATORY: Include comprehensive plant care instructions or troubleshooting
- Cover seasonal plant health, watering schedules, or fertilizing advice
- Address common plant problems and provide step-by-step solutions
- Professional but conversational tone about plant care expertise
- Encourage comments and community discussion about plant care challenges
- Include call-to-action for visiting garden center or trying plant care techniques

Format: Engaging post text only.`;

    case 'email':
      return `${basePrompt}

EMAIL CONTENT REQUIREMENTS:
- Subject line that mentions seasonal plant care opportunity or problem-solving
- 300-400 words
- Valuable plant care advice with specific, actionable instructions
- Personal, helpful tone from garden center plant care experts
- MANDATORY: Include detailed plant care tips, timing, and techniques
- Cover specific plant varieties, care schedules, or health solutions
- Address seasonal plant care challenges and prevention strategies
- Call-to-action to visit garden center for plants/supplies or expert consultation
- Format as complete email with subject line

Format:
Subject: [compelling subject line about plant care]

[Email body content with plant care focus]`;

    case 'newsletter':
      return `${basePrompt}

NEWSLETTER SECTION REQUIREMENTS:
- 400-500 words
- Educational focus on comprehensive plant care and health management
- Multiple topics: featured plants with care instructions, seasonal plant health tips, troubleshooting guide
- MANDATORY: Include specific plant care schedules, techniques, and problem solutions
- Cover plant varieties with detailed care requirements and common issues
- Professional plant care expertise with step-by-step instructions
- Sections: seasonal plant care highlights, plant health spotlight, detailed care techniques
- Address watering, fertilizing, pruning, and pest management timing
- Call-to-action for garden center visit and expert plant care consultation

Format: Newsletter-style content with clear sections focused on plant care education.`;

    case 'video':
      return `${basePrompt}

VIDEO SCRIPT REQUIREMENTS:
- 2-3 minute script for garden center plant care demonstration video
- Educational content about specific plant care techniques, health solutions, or seasonal maintenance
- Include visual cues for plant care demonstrations, problem identification, or technique tutorials
- MANDATORY: Focus on hands-on plant care instruction and problem-solving
- Professional but engaging presentation style for plant care education
- Specific plant care instructions, timing, and step-by-step techniques
- Address common plant health issues and demonstrate solutions
- Strong opening hook about plant care opportunity or problem-solving
- Clear call-to-action to visit garden center for supplies or expert consultation

Format:
[VISUAL: Description of plant care demonstration or problem being shown]
NARRATION: "Expert plant care instruction and explanation"

Include multiple visual and narration segments focused on plant care education.`;

    default:
      return `${basePrompt}

Create engaging ${postType} content that showcases comprehensive plant care expertise and seasonal plant health knowledge. Focus heavily on educating customers about specific plant care techniques, health solutions, and seasonal maintenance requirements.`;
  }
}
