import { ContentTypeRules } from '../types/contentGeneration';

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
  blog: {
    max_words: 700,
    tone: 'educational and authoritative',
    format: 'structured with headings, scannable sections',
    cta_style: 'educational with actionable advice',
    specific_requirements: [
      'Create compelling, SEO-friendly headlines',
      'Structure content with H2 and H3 headings for readability',
      'Provide comprehensive, value-driven educational content',
      'Include detailed plant care instructions and seasonal guidance',
      'Address common gardening challenges with step-by-step solutions',
      'Cover plant varieties, care schedules, and troubleshooting techniques',
      'Provide actionable advice that readers can implement immediately'
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
  },
  newsletter: {
    max_words: 600,
    tone: 'comprehensive yet personal',
    format: 'structured sections, mobile-friendly',
    cta_style: 'personalized, community-focused',
    specific_requirements: [
      'Include comprehensive plant care schedules and techniques',
      'Address seasonal plant health management and timing',
      'Cover specific plant varieties with detailed care instructions',
      'Include plant health troubleshooting and problem prevention',
      'Highlight plant care expertise and specialized services',
      'Regional plant care timing and variety recommendations'
    ]
  }
};
