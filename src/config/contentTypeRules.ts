
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
