
import { ContentTypeRules } from './types.ts';

export const CONTENT_TYPE_RULES: Record<string, ContentTypeRules> = {
  instagram: {
    max_words: 350,  // Increased from 150 for better storytelling
    tone: 'engaging and visual-friendly with storytelling elements',
    format: 'short paragraphs, mobile-optimized with emojis and natural formatting for maximum engagement',
    cta_style: 'action-oriented, community-building with questions',
    specific_requirements: [
      'Include 2-3 specific, actionable plant care tips customers can implement today',
      'Address common plant health issues with step-by-step solutions',
      'Reference specific plant varieties appropriate for season and climate zone',  
      'Use engaging visual storytelling that connects emotionally with plant lovers',
      'Include seasonal plant care timing and variety recommendations',
      'Make it save-worthy content that customers will reference later',
      'Use natural formatting with emojis and engaging social media elements',
      'Include community engagement questions about gardening experiences'
    ]
  },
  facebook: {
    max_words: 500,  // Increased from 250 for comprehensive education
    tone: 'conversational and educational with storytelling elements',
    format: 'readable chunks with natural formatting, lists, and engagement-focused structure',
    cta_style: 'community-building, educational discussion-starter',
    specific_requirements: [
      'Include 3-4 detailed plant care instructions with step-by-step guidance',
      'Address seasonal plant health management with comprehensive timing advice',
      'Cover common plant problems with detailed troubleshooting solutions',
      'Include thoughtful questions to encourage plant care experience sharing',
      'Reference unique plant care expertise and specialized services available',
      'Use conversational storytelling that makes plant care accessible to all skill levels',
      'Provide genuine educational value that customers will want to share',
      'Include seasonal timing advice and regional plant care considerations'
    ]
  },
  blog: {
    max_words: 800,  // Maintained for comprehensive content
    tone: 'educational and authoritative with accessible explanations',
    format: 'structured with headings, scannable sections, lists and comprehensive formatting',
    cta_style: 'educational with actionable plant care advice',
    specific_requirements: [
      'Create compelling, benefit-focused headlines that capture plant care value',
      'Structure content with H2 and H3 headings for plant care topics and readability',
      'Provide comprehensive, value-driven plant care education',
      'Include detailed plant care instructions with seasonal timing guidance',
      'Address common gardening challenges with comprehensive step-by-step solutions',
      'Cover specific plant varieties, care schedules, and troubleshooting techniques',
      'Provide actionable advice that readers can implement immediately in their gardens',
      'Use formatting that improves readability: bullet points, numbered lists, clear sections',
      'Make it comprehensive enough to be bookmarked as a plant care reference'
    ]
  },
  newsletter: {
    max_words: 500,  // Increased from 400 for more comprehensive content
    tone: 'informative and engaging with practical focus',
    format: 'structured sections, scannable layout with lists and comprehensive formatting',
    cta_style: 'educational with clear plant care next steps',
    specific_requirements: [
      'Include comprehensive plant care schedules and seasonal techniques',
      'Address seasonal plant health management with detailed timing advice',
      'Cover specific plant varieties with detailed care and maintenance instructions',
      'Include plant health troubleshooting and comprehensive problem prevention',
      'Reference specialized plant care expertise and consultation services',
      'Provide actionable plant care advice customers can use for current season',
      'Use organized formatting with bullet points for easy scanning and reference',
      'Include regional plant care timing and climate-specific recommendations'
    ]
  },
  video: {
    max_words: 200,  // Slightly increased from 180 for better instruction
    tone: 'natural speaking rhythm with clear plant care instruction',
    format: 'short segments, easy to speak with natural flow and clear demonstration cues',
    cta_style: 'direct, actionable plant care guidance',
    specific_requirements: [
      'Natural speaking flow for hands-on plant care demonstrations',
      'Step-by-step plant care tips and problem-solving techniques with visual cues',
      'Clear plant health instructions with seasonal timing and technique guidance',
      'Authentic garden center plant care expert voice with professional credibility',
      'Visual plant care education and troubleshooting focus with demonstration notes',
      'Make it educational content customers will want to save and reference'
    ]
  }
};

export const FALLBACK_MESSAGES = {
  missing_location: "Write region-neutral plant care advice that applies to a wide range of gardeners, but emphasize the importance of knowing your local climate zone and seasonal plant care timing for optimal results.",
  missing_brand_tone: "Use a warm, conversational tone like a trusted garden center plant care expert speaking to regular customers about their specific plant health needs and seasonal gardening challenges.",
  missing_company_profile: "Write as a knowledgeable garden center plant care specialist providing valuable, authentic plant health advice, care techniques, and seasonal guidance that customers can trust and implement."
};

// Relaxed validation patterns - focus only on placeholder issues, allow creative content
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
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
