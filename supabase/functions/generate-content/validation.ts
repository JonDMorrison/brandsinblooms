
export function validateContent(content: string, contentType?: string): {
  isValid: boolean;
  issues: string[];
} {
  const issues: string[] = [];
  
  // Basic content validation
  if (!content || content.trim().length === 0) {
    issues.push('Content is empty');
    return { isValid: false, issues };
  }
  
  // Critical quality checks for content generation improvement
  const emojiRegex = /[\p{Emoji}]/u;
  if (emojiRegex.test(content)) {
    issues.push('Content contains emojis - must be removed');
  }
  
  // Check for AI-like language patterns that reduce quality
  const aiPatterns = [
    /\[.*?\]/g, // Square brackets
    /as an ai/i,
    /i'm an ai/i,
    /i am an ai/i,
    /i don't have/i,
    /i cannot/i,
    /i can't provide/i
  ];
  
  aiPatterns.forEach(pattern => {
    if (pattern.test(content)) {
      issues.push('Content contains AI-like language - needs natural rewrite');
    }
  });
  
  // Check for corporate buzzwords that reduce authenticity
  const corporateWords = ['leverage', 'optimize', 'maximize', 'seamless', 'synergy', 'utilize'];
  const contentLower = content.toLowerCase();
  const foundCorporateWords = corporateWords.filter(word => contentLower.includes(word));
  if (foundCorporateWords.length > 0) {
    issues.push(`Content uses corporate buzzwords: ${foundCorporateWords.join(', ')} - needs conversational rewrite`);
  }
  
  // Check for forbidden greeting patterns that reduce engagement
  const forbiddenGreetings = [
    /hello fellow gardeners/i,
    /dear gardeners/i,
    /hey gardeners/i,
    /greetings gardeners/i,
    /fellow gardeners/i,
    /green thumbs/i
  ];
  
  forbiddenGreetings.forEach(pattern => {
    if (pattern.test(content)) {
      issues.push('Content uses generic gardening greeting - needs specific hook');
    }
  });
  
  // Check for natural conversational language
  const hasContractions = /won't|don't|can't|we're|you're|they're|it's|there's|here's|what's|that's|let's/i.test(content);
  if (!hasContractions && content.length > 100) {
    issues.push('Content lacks natural contractions - needs conversational tone');
  }
  
  // Check for specific gardening value
  const gardeningWords = ['plant', 'flower', 'garden', 'soil', 'water', 'bloom', 'grow', 'seed', 'fertilizer', 'prune'];
  const hasGardeningContent = gardeningWords.some(word => contentLower.includes(word));
  if (!hasGardeningContent) {
    issues.push('Content lacks specific gardening advice - needs plant expertise');
  }
  
  // StoryBrand framework validation for content structure
  const storyBrandValidation = validateStoryBrandElements(content);
  issues.push(...storyBrandValidation.issues);
  
  // Content type specific validation for optimization
  if (contentType) {
    const typeValidation = validateContentType(content, contentType);
    issues.push(...typeValidation.issues);
  }
  
  return {
    isValid: issues.length === 0,
    issues
  };
}

function validateStoryBrandElements(content: string): {
  issues: string[];
} {
  const issues: string[] = [];
  const contentLower = content.toLowerCase();
  
  // Character - should focus on the customer/gardener
  const characterWords = ['you', 'your', 'gardener', 'garden'];
  const hasCharacter = characterWords.some(word => contentLower.includes(word));
  if (!hasCharacter) {
    issues.push('Missing character focus - needs customer as hero');
  }
  
  // Problem - should identify challenges
  const problemWords = ['problem', 'challenge', 'struggle', 'difficult', 'frustrat', 'issue', 'trouble', 'worry'];
  const hasProblem = problemWords.some(word => contentLower.includes(word));
  if (!hasProblem) {
    issues.push('Missing problem identification - needs gardening challenge');
  }
  
  // Guide - should show empathy and authority
  const guideWords = ['expert', 'experience', 'help', 'understand', 'know', 'years', 'professional', 'team'];
  const hasGuide = guideWords.some(word => contentLower.includes(word));
  if (!hasGuide) {
    issues.push('Missing guide positioning - needs empathy and authority');
  }
  
  // Plan - should provide clear steps
  const planWords = ['step', 'first', 'second', 'third', 'then', 'next', 'start', 'begin'];
  const hasPlan = planWords.some(word => contentLower.includes(word));
  if (!hasPlan) {
    issues.push('Missing clear action plan - needs specific steps');
  }
  
  // Call to Action - should invite specific action
  const ctaWords = ['visit', 'come', 'stop by', 'call', 'contact', 'see us', 'drop by', 'schedule', 'book'];
  const hasCTA = ctaWords.some(word => contentLower.includes(word));
  if (!hasCTA) {
    issues.push('Missing clear call to action - needs specific invitation');
  }
  
  // Success - should paint picture of positive outcome
  const successWords = ['beautiful', 'thrive', 'bloom', 'flourish', 'success', 'gorgeous', 'stunning', 'healthy', 'vibrant'];
  const hasSuccess = successWords.some(word => contentLower.includes(word));
  if (!hasSuccess) {
    issues.push('Missing success visualization - needs outcome picture');
  }
  
  return { issues };
}

function validateContentType(content: string, contentType: string): {
  issues: string[];
} {
  const issues: string[] = [];
  const wordCount = content.split(/\s+/).length;
  
  switch (contentType.toLowerCase()) {
    case 'instagram':
      if (wordCount > 130) {
        issues.push(`Instagram post too long: ${wordCount} words (target 60-120 for engagement)`);
      }
      if (wordCount < 50) {
        issues.push(`Instagram post too short: ${wordCount} words (needs 60+ for value)`);
      }
      // Check for hashtags
      if (!content.includes('#')) {
        issues.push('Instagram post missing hashtags - needs 6-8 relevant tags');
      }
      break;
      
    case 'facebook':
      if (wordCount > 220) {
        issues.push(`Facebook post too long: ${wordCount} words (target 100-200 for engagement)`);
      }
      if (wordCount < 80) {
        issues.push(`Facebook post too short: ${wordCount} words (needs 100+ for value)`);
      }
      break;
      
    case 'blog':
      if (wordCount > 660) {
        issues.push(`Blog post too long: ${wordCount} words (target 400-600 for readability)`);
      }
      if (wordCount < 350) {
        issues.push(`Blog post too short: ${wordCount} words (needs 400+ for SEO value)`);
      }
      break;
      
    case 'newsletter':
      if (wordCount > 440) {
        issues.push(`Newsletter too long: ${wordCount} words (target 300-400 for readability)`);
      }
      if (wordCount < 250) {
        issues.push(`Newsletter too short: ${wordCount} words (needs 300+ for value)`);
      }
      break;
  }
  
  return { issues };
}
