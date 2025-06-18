
import { ContentTypeRules } from './types.ts';

export const CONTENT_TYPE_RULES: Record<string, ContentTypeRules> = {
  instagram: {
    max_words: 150,
    tone: 'engaging and visual-friendly',
    format: 'short paragraphs, mobile-optimized',
    cta_style: 'action-oriented, theme-specific',
    specific_requirements: [
      'Include specific plant care tips or troubleshooting advice',
      'Address common plant health issues and solutions',
      'Reference plant varieties appropriate for climate zone',
      'Visual storytelling approach with plant care focus',
      'Mention watering, fertilizing, or maintenance techniques when relevant'
    ]
  },
  facebook: {
    max_words: 250,
    tone: 'conversational and community-focused',
    format: 'readable chunks, engagement-focused',
    cta_style: 'community-building, discussion-starter',
    specific_requirements: [
      'Include comprehensive plant care instructions or guidance',
      'Address seasonal plant health and maintenance timing',
      'Cover common plant problems and step-by-step solutions',
      'Include questions to encourage plant care experience sharing',
      'Reference unique plant care expertise and services',
      'Feel personal and authentic with practical plant advice'
    ]
  },
  email: {
    max_words: 200,
    tone: 'informative and valuable',
    format: 'scannable, professional yet warm',
    cta_style: 'helpful instructions, clear next steps',
    specific_requirements: [
      'Include detailed plant care tips and seasonal timing',
      'Address specific plant health challenges and solutions',
      'Provide region-specific plant care advice and schedules',
      'Cover watering, fertilizing, or pruning techniques',
      'Professional but approachable plant care guidance'
    ]
  },
  newsletter: {
    max_words: 400,
    tone: 'informative and engaging',
    format: 'structured sections, scannable layout',
    cta_style: 'educational with clear next steps',
    specific_requirements: [
      'Include comprehensive plant care schedules and techniques',
      'Address seasonal plant health management and timing',
      'Cover specific plant varieties with detailed care instructions',
      'Include plant health troubleshooting and problem prevention',
      'Reference plant care expertise and specialized services',
      'Provide actionable plant care advice for current season'
    ]
  },
  video: {
    max_words: 180,
    tone: 'natural speaking rhythm',
    format: 'short segments, easy to speak',
    cta_style: 'direct, actionable guidance',
    specific_requirements: [
      'Natural speaking flow for plant care demonstrations',
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

// Simplified validation patterns - removed overly restrictive rules for Instagram
export const FORBIDDEN_PATTERNS = [
  /green\s*thumb/gi,
  /welcome\s*to/gi,
  /week\s*\d+/gi,
  /this\s*week/gi,
  /week\s*number/gi,
  /\bweek\s*(?:\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty)\b/gi,
  /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]/gu,
  /\[company\s*name\]/gi,
  /\[garden\s*center\s*name\]/gi,
  /your\s*garden\s*center/gi,
  /\[region\]/gi,
  /\[location\]/gi,
  /\[garden\s*center\s*location\]/gi,
  /\[.*?\]/gi, // Any text in square brackets
  /```/gi, // Code blocks
];

// Relaxed validation for Instagram - allow some natural social media formatting
export const INSTAGRAM_FORBIDDEN_PATTERNS = [
  /green\s*thumb/gi,
  /welcome\s*to/gi,
  /week\s*\d+/gi,
  /\[.*?\]/gi, // Square bracket placeholders only
  /```/gi, // Code blocks only
];

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-application-name',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
