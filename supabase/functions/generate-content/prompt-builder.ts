
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
  
  // Extract city and region from location if available
  const locationParts = location.split(',').map(part => part.trim());
  const city = locationParts[0] || 'your city';
  const region = locationParts[1] || locationParts[0] || 'your region';

  // Map content type to specific parameters
  const contentFormatMap = {
    instagram: { format: 'Instagram post', wordCount: '60-120', cta: 'visit our garden center' },
    facebook: { format: 'Facebook post', wordCount: '100-200', cta: 'stop by for expert advice' },
    blog: { format: 'blog article', wordCount: '400-600', cta: 'schedule a consultation' },
    newsletter: { format: 'email newsletter', wordCount: '300-400', cta: 'visit this weekend' },
    video: { format: 'video script', wordCount: '90-120 seconds', cta: 'come in for supplies' }
  };

  const contentParams = contentFormatMap[postType.toLowerCase()] || contentFormatMap.instagram;

  // StoryBrand Framework System Prompt
  const storyBrandPrompt = `
# ROLE
You are a certified StoryBrand Guide and seasoned garden center marketing expert.

# OUTPUT PARAMETERS
• Content format: ${contentParams.format}
• Brand: ${companyName}  
• Audience: Home gardeners and plant enthusiasts in/near ${city}, ${region}
• Goal: ${contentParams.cta}
• Target length: ${contentParams.wordCount} words (±10%)

# NON-NEGOTIABLE RULES
1. **Absolutely no emojis** in any part of the text—headlines, body, signatures, or hashtags.
2. Never mention you are an AI or reference the prompt.
3. Respect the content-format style guidelines below.

# STORYBRAND FRAMEWORK
1. Character – identify the gardener as the hero of their garden story
2. Problem – external gardening challenge + internal frustration/desire for success
3. Guide – show ${companyName}'s empathy + horticultural authority
4. Plan – provide 2-3 clear, actionable steps they can take
5. Call to Action – single, direct invitation to ${contentParams.cta}
6. Success – paint vivid picture of their thriving garden outcome

# VOICE & TONE
Warm, conversational, confident. Use contractions; avoid jargon and filler.
Concrete plant names and sensory garden details. Vary sentence length for natural rhythm.

# CAMPAIGN FOCUS
Transform "${campaignTitle}" into compelling garden center narrative.
${weekDescription ? `Additional context: ${weekDescription}` : ''}

# FORMAT-SPECIFIC GUIDELINES`;

  // Add format-specific guidelines based on content type
  const formatGuidelines = getFormatGuidelines(postType.toLowerCase(), companyName);

  const selfCheckPrompt = `
# SELF-CHECK BEFORE RETURN
✓ StoryBrand steps 2, 5, 6 included?
✓ Tone sounds human and expert?
✓ **No emojis present—verify with regex /[\\p{Emoji}]/u**.
✓ CTA clear and matches goal?
✓ Specific plant care advice included?
✓ Sensory garden details present?

# OUTPUT
Return only the finished ${contentParams.format} content—no headings, markdown labels, or notes.`;

  return `${storyBrandPrompt}
${formatGuidelines}
${selfCheckPrompt}`;
}

function getFormatGuidelines(postType: string, companyName: string): string {
  switch (postType) {
    case 'instagram':
      return `
Instagram post → 60-120 words, line breaks for readability, 6-8 relevant hashtags
• Hook: Start with customer's garden challenge or seasonal opportunity
• Problem: Name the external plant issue + internal frustration
• Guide: Position ${companyName} as the trusted garden expert
• Plan: Give 2-3 specific plant care steps
• CTA: Natural invitation to visit for supplies/advice
• Success: Describe the beautiful garden outcome they'll achieve
• End with location-specific hashtags and plant care tags`;

    case 'facebook':
      return `
Facebook post → 100-200 words, conversational and community-focused
• Character: Address fellow gardeners and their aspirations
• Problem: Identify common gardening challenge + emotional impact
• Guide: Show ${companyName}'s understanding + plant expertise
• Plan: Provide step-by-step gardening solution
• CTA: Invite community discussion or visit
• Success: Paint picture of garden transformation
• Include question to encourage engagement`;

    case 'blog':
      return `
Blog article → 400-600 words, SEO-friendly structure with H2 subheadings
• Title: Benefit-focused headline (no company name in title)
• Character: Identify target gardener's goals
• Problem: External plant/garden issue + internal gardening desires
• Guide: Establish ${companyName}'s expertise with plant knowledge
• Plan: Detailed 3-step action plan with timing
• Success: Vivid description of thriving garden results
• CTA: Clear next step invitation
• Include 1-2 specific plant varieties and care techniques`;

    case 'newsletter':
      return `
Email newsletter → 300-400 words, friendly and informative
• Subject: Benefit-driven headline
• Character: Address subscriber gardeners directly
• Problem: Seasonal gardening challenge + desire for success
• Guide: Share ${companyName}'s seasonal expertise
• Plan: Multiple actionable gardening tips with timing
• Success: Describe seasonal garden achievements
• CTA: Weekend visit invitation
• Structure with skimmable sections and clear organization`;

    case 'video':
      return `
Video script → 90-120 seconds, conversational with visual cues
• Character: Address gardener viewer's goals
• Problem: Visual plant issue + emotional gardening frustration
• Guide: On-camera expertise from ${companyName} team
• Plan: Demonstrate 2-3 hands-on techniques
• Success: Show before/after plant transformation
• CTA: Visit for supplies and consultation
• Format: [VISUAL: description] NARRATION: "natural speech"
• Include plant demonstrations and problem identification`;

    default:
      return `
${postType} content → Engaging and actionable
• Apply full StoryBrand framework
• Include specific gardening advice
• Use natural, conversational language
• End with clear call to action`;
  }
}
