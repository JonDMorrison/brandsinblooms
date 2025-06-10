
import { ContentTypeRules } from '../types/contentGeneration';

export const CONTENT_TYPE_RULES: Record<string, ContentTypeRules> = {
  instagram: {
    max_words: 150,
    tone: 'engaging and visual-friendly',
    format: 'short paragraphs, mobile-optimized',
    cta_style: 'action-oriented, theme-specific',
    specific_requirements: [
      'Reference company specializations when relevant',
      'Plant varieties appropriate for climate zone',
      'Visual storytelling approach'
    ]
  },
  facebook: {
    max_words: 250,
    tone: 'conversational and community-focused',
    format: 'readable chunks, engagement-focused',
    cta_style: 'community-building, discussion-starter',
    specific_requirements: [
      'Include questions to encourage engagement',
      'Reference unique selling points',
      'Feel personal and authentic'
    ]
  },
  email: {
    max_words: 200,
    tone: 'informative and valuable',
    format: 'scannable, professional yet warm',
    cta_style: 'helpful instructions, clear next steps',
    specific_requirements: [
      'Reference seasonal focus when relevant',
      'Provide region-specific advice',
      'Professional but approachable'
    ]
  },
  video: {
    max_words: 180,
    tone: 'natural speaking rhythm',
    format: 'short segments, easy to speak',
    cta_style: 'direct, actionable guidance',
    specific_requirements: [
      'Natural speaking flow',
      'Practical tips aligned with values',
      'Authentic garden center expert voice'
    ]
  },
  newsletter: {
    max_words: 600,
    tone: 'comprehensive yet personal',
    format: 'structured sections, mobile-friendly',
    cta_style: 'personalized, community-focused',
    specific_requirements: [
      'Include subject line with company name',
      'Highlight weekly theme',
      'Regional timing and plant recommendations'
    ]
  }
};
