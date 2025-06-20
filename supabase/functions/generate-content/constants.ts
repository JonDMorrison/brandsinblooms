
import { ContentTypeRules } from './types.ts';

export const CONTENT_TYPE_RULES: Record<string, ContentTypeRules> = {
  instagram: {
    max_words: 150,
    tone: 'engaging and visual-friendly',
    format: 'short paragraphs (1-2 sentences max), mobile-optimized with line breaks between key points',
    cta_style: 'action-oriented, theme-specific',
    specific_requirements: [
      'Use very short paragraphs - maximum 1-2 sentences per paragraph',
      'Add line breaks between different topics or key points',
      'Include specific plant care tips or troubleshooting advice',
      'Address common plant health issues and solutions',
      'Reference plant varieties appropriate for climate zone',
      'Visual storytelling approach with plant care focus',
      'Mention watering, fertilizing, or maintenance techniques when relevant',
      'Use emojis and engaging social media formatting naturally',
      'Format for mobile readability with plenty of white space'
    ]
  },
  facebook: {
    max_words: 125, // Reduced from 250 to make it 50% shorter
    tone: 'conversational and community-focused',
    format: 'very short paragraphs (1-2 sentences max), engagement-focused with line breaks between key points',
    cta_style: 'community-building, discussion-starter',
    specific_requirements: [
      'CRITICAL: Use very short paragraphs - maximum 1-2 sentences per paragraph',
      'Add line breaks between different thoughts, tips, or questions',
      'Include comprehensive plant care instructions or guidance',
      'Address seasonal plant health and maintenance timing',
      'Cover common plant problems and step-by-step solutions',
      'Include questions to encourage plant care experience sharing',
      'Reference unique plant care expertise and services',
      'Feel personal and authentic with practical plant advice',
      'Format for mobile scanning with clear paragraph breaks',
      'End with engaging question on separate line'
    ]
  },
  blog: {
    max_words: 700,
    tone: 'educational and authoritative',
    format: 'structured with headings, short scannable paragraphs (2-3 sentences max), bullet points and lists',
    cta_style: 'educational with actionable advice',
    specific_requirements: [
      'Create compelling, SEO-friendly headlines',
      'Structure content with H2 and H3 headings for readability',
      'Use short paragraphs - maximum 2-3 sentences per paragraph',
      'Add line breaks between different concepts or tips',
      'Provide comprehensive, value-driven educational content',
      'Include detailed plant care instructions and seasonal guidance',
      'Address common gardening challenges with step-by-step solutions',
      'Cover plant varieties, care schedules, and troubleshooting techniques',
      'Provide actionable advice that readers can implement immediately',
      'Use bullet points, numbered lists, and formatting that improves readability',
      'Ensure mobile-friendly paragraph structure'
    ]
  },
  newsletter: {
    max_words: 400,
    tone: 'informative and engaging',
    format: 'structured sections with short paragraphs (2-3 sentences max), mobile-friendly with clear breaks',
    cta_style: 'educational with clear next steps',
    specific_requirements: [
      'Use short paragraphs throughout - maximum 2-3 sentences per paragraph',
      'Add line breaks between different topics or sections',
      'Include comprehensive plant care schedules and techniques',
      'Address seasonal plant health management and timing',
      'Cover specific plant varieties with detailed care instructions',
      'Include plant health troubleshooting and problem prevention',
      'Reference plant care expertise and specialized services',
      'Provide actionable plant care advice for current season',
      'Format for easy mobile scanning with clear paragraph breaks'
    ]
  },
  video: {
    max_words: 180,
    tone: 'natural speaking rhythm',
    format: 'short segments with natural pauses, easy to speak with clear breaks',
    cta_style: 'direct, actionable guidance',
    specific_requirements: [
      'Natural speaking flow for plant care demonstrations',
      'Use short sentences with natural pauses',
      'Break content into digestible segments',
      'Hands-on plant care tips and problem-solving techniques',
      'Step-by-step plant health instructions and timing',
      'Authentic garden center plant care expert voice',
      'Visual plant care education and troubleshooting focus'
    ]
  }
};

export const FALLBACK_MESSAGES = {
  missing_location: "Write region-neutral plant care advice that applies to a wide range of gardeners, but emphasize the importance of knowing your local climate zone and plant care timing.",
  missing_brand_tone: "Use a warm, conversational tone like a helpful garden center plant care expert speaking to familiar customers about their plant health needs.",
  missing_company_profile: "Write as a knowledgeable garden center plant care specialist providing valuable, authentic plant health advice and care techniques."
};

// Relaxed validation patterns - focus only on placeholder issues
export const FORBIDDEN_PATTERNS = [
  /\[company\s*name\]/gi,
  /\[garden\s*center\s*name\]/gi,
  /your\s*garden\s*center(?!\s+name)/gi,
  /\[region\]/gi,
  /\[location\]/gi,
  /\[garden\s*center\s*location\]/gi,
  /\[.*?\]/gi, // Any text in square brackets
  /```/gi, // Code blocks only
];

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-application-name',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
