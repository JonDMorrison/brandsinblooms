import { sanitizeWeekNumbers, validateNoWeekNumbers } from './weekNumberSanitizer';

export interface ContentQualityCheck {
  isValid: boolean;
  score: number; // 0-100
  issues: string[];
  suggestions: string[];
  level: 'excellent' | 'good' | 'fair' | 'poor';
}

export const assessContentQuality = (content: string, type: 'subject' | 'preheader' | 'body' = 'body'): ContentQualityCheck => {
  const issues: string[] = [];
  const suggestions: string[] = [];
  let score = 100;

  // Check for week number violations
  const weekValidation = validateNoWeekNumbers(content);
  if (!weekValidation.isValid) {
    issues.push('Contains week number references');
    suggestions.push('Remove specific week references - use seasonal language instead');
    score -= 20;
  }

  // Content type specific checks
  if (type === 'subject') {
    return assessSubjectLineQuality(content, issues, suggestions, score);
  } else if (type === 'preheader') {
    return assessPreheaderQuality(content, issues, suggestions, score);
  } else {
    return assessBodyContentQuality(content, issues, suggestions, score);
  }
};

const assessSubjectLineQuality = (content: string, issues: string[], suggestions: string[], score: number): ContentQualityCheck => {
  const length = content.length;
  
  // Length checks
  if (length < 20) {
    issues.push('Too short for optimal engagement');
    suggestions.push('Add more descriptive words or seasonal context');
    score -= 15;
  } else if (length > 60) {
    issues.push('May be truncated in email clients');
    suggestions.push('Keep under 60 characters for better visibility');
    score -= 10;
  }

  // Generic/weak language detection
  const weakPatterns = [
    /welcome to \w+!/i,
    /get ready/i,
    /tips and advice/i,
    /expert tips/i,
    /seasonal advice/i
  ];

  if (weakPatterns.some(pattern => pattern.test(content))) {
    issues.push('Contains generic language');
    suggestions.push('Use specific, action-oriented language that creates urgency');
    score -= 15;
  }

  // Positive indicators
  if (/[🌱🌸🌿🍂❄️🌺🌼]/.test(content)) {
    score += 5; // Emoji bonus
  }

  if (/[!?]/.test(content)) {
    score += 3; // Punctuation engagement bonus
  }

  return {
    isValid: score >= 60,
    score: Math.max(0, score),
    issues,
    suggestions,
    level: getQualityLevel(score)
  };
};

const assessPreheaderQuality = (content: string, issues: string[], suggestions: string[], score: number): ContentQualityCheck => {
  const length = content.length;
  
  if (length < 50) {
    issues.push('Too short to be effective');
    suggestions.push('Expand with compelling preview text (50-160 characters ideal)');
    score -= 10;
  } else if (length > 160) {
    issues.push('May be truncated in email preview');
    suggestions.push('Keep under 160 characters for full visibility');
    score -= 5;
  }

  // Generic language
  if (/preview text/i.test(content)) {
    issues.push('Contains placeholder text');
    suggestions.push('Write compelling preview text that complements the subject line');
    score -= 20;
  }

  return {
    isValid: score >= 60,
    score: Math.max(0, score),
    issues,
    suggestions,
    level: getQualityLevel(score)
  };
};

const assessBodyContentQuality = (content: string, issues: string[], suggestions: string[], score: number): ContentQualityCheck => {
  const length = content.length;
  
  if (length < 100) {
    issues.push('Content is too brief');
    suggestions.push('Add more valuable information and specific tips');
    score -= 20;
  }

  // Generic content patterns
  const genericPatterns = [
    /get ready for/i,
    /expert tips and/i,
    /seasonal advice/i,
    /welcome to \w+/i
  ];

  if (genericPatterns.some(pattern => pattern.test(content))) {
    issues.push('Contains generic language');
    suggestions.push('Use specific, actionable content that provides real value');
    score -= 15;
  }

  // Missing call-to-action indicators
  if (!/(?:shop|visit|learn|discover|get|buy|order|browse)/i.test(content)) {
    issues.push('Lacks clear call-to-action');
    suggestions.push('Add compelling calls-to-action to drive engagement');
    score -= 10;
  }

  return {
    isValid: score >= 60,
    score: Math.max(0, score),
    issues,
    suggestions,
    level: getQualityLevel(score)
  };
};

const getQualityLevel = (score: number): 'excellent' | 'good' | 'fair' | 'poor' => {
  if (score >= 85) return 'excellent';
  if (score >= 70) return 'good';
  if (score >= 50) return 'fair';
  return 'poor';
};

export const sanitizeTitle = (title: string): string => {
  if (!title) return title;
  
  // Remove "Week X" patterns and clean up
  return title
    .replace(/Week\s+\d+\s*[-:]\s*/gi, '')
    .replace(/\s*[-:]\s*Week\s+\d+/gi, '')
    .replace(/Week\s+\d+/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
};

export const sanitizeAndImproveContent = (content: string): string => {
  let improved = sanitizeWeekNumbers(content);
  
  // Replace generic phrases with better alternatives
  const improvements = {
    'Get ready for': 'Discover the secrets of',
    'Welcome to October!': 'October brings exciting opportunities for',
    'expert tips and seasonal advice': 'proven strategies and actionable insights',
    'with expert tips': 'with proven techniques',
    'seasonal advice': 'timely guidance'
  };

  Object.entries(improvements).forEach(([generic, improved_text]) => {
    improved = improved.replace(new RegExp(generic, 'gi'), improved_text);
  });

  return improved;
};

export const generateContentSuggestions = (contentType: 'subject' | 'preheader' | 'body', currentContent: string, theme?: string): string[] => {
  const suggestions: string[] = [];
  
  if (contentType === 'subject') {
    if (theme?.includes('houseplant')) {
      suggestions.push(
        '🌿 Transform Your Home Into a Green Oasis This October',
        'The Secret to Thriving Houseplants (October Edition)',
        'Your Houseplants Are Begging for These October Care Tips',
        '🌱 October Houseplant Magic: 5 Game-Changing Tips Inside'
      );
    } else {
      suggestions.push(
        '🌱 October Garden Secrets You Need to Know',
        'Transform Your Garden This October (Insider Tips)',
        'Your Best October Garden Starts Here',
        '🍂 Fall Garden Magic: Expert Strategies Inside'
      );
    }
  } else if (contentType === 'preheader') {
    suggestions.push(
      'Discover proven techniques to keep your plants thriving through autumn and beyond.',
      'Expert strategies, seasonal plant care, and insider tips to maximize your garden success.',
      'Get actionable advice that transforms struggling plants into showstoppers.',
      'Unlock the secrets successful gardeners use to create stunning displays.'
    );
  }

  return suggestions;
};