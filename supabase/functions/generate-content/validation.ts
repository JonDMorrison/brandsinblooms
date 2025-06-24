
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
  
  // Check for emojis (critical requirement)
  const emojiRegex = /[\p{Emoji}]/u;
  if (emojiRegex.test(content)) {
    issues.push('Content contains emojis');
  }
  
  // Check for AI-like language patterns
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
      issues.push('Content contains AI-like language or formatting');
    }
  });
  
  // Check for corporate buzzwords
  const corporateWords = ['leverage', 'optimize', 'maximize', 'seamless', 'synergy', 'utilize', 'engagement', 'solutions'];
  const contentLower = content.toLowerCase();
  const foundCorporateWords = corporateWords.filter(word => contentLower.includes(word));
  if (foundCorporateWords.length > 0) {
    issues.push(`Content uses corporate buzzwords: ${foundCorporateWords.join(', ')}`);
  }
  
  // Check for natural, conversational language
  const hasContractions = /won't|don't|can't|we're|you're|they're|it's|there's|here's|what's|that's|let's/i.test(content);
  if (!hasContractions && content.length > 100) {
    issues.push('Content lacks natural contractions and conversational tone');
  }
  
  // StoryBrand framework validation
  const storyBrandValidation = validateStoryBrandElements(content);
  issues.push(...storyBrandValidation.issues);
  
  // Content type specific validation
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
  const characterWords = ['you', 'your', 'gardener', 'garden', 'customer'];
  const hasCharacter = characterWords.some(word => contentLower.includes(word));
  if (!hasCharacter) {
    issues.push('Missing character focus (customer as hero)');
  }
  
  // Problem - should identify challenges
  const problemWords = ['problem', 'challenge', 'struggle', 'difficult', 'frustrat', 'issue', 'trouble', 'worry'];
  const hasProblem = problemWords.some(word => contentLower.includes(word));
  if (!hasProblem) {
    issues.push('Missing problem identification');
  }
  
  // Guide - should show empathy and authority
  const guideWords = ['expert', 'experience', 'help', 'understand', 'know', 'years', 'professional', 'team'];
  const hasGuide = guideWords.some(word => contentLower.includes(word));
  if (!hasGuide) {
    issues.push('Missing guide positioning (empathy + authority)');
  }
  
  // Plan - should provide clear steps
  const planWords = ['step', 'first', 'second', 'third', 'then', 'next', 'start', 'begin'];
  const hasPlan = planWords.some(word => contentLower.includes(word));
  if (!hasPlan) {
    issues.push('Missing clear action plan');
  }
  
  // Call to Action - should invite specific action
  const ctaWords = ['visit', 'come', 'stop by', 'call', 'contact', 'see us', 'drop by', 'schedule', 'book'];
  const hasCTA = ctaWords.some(word => contentLower.includes(word));
  if (!hasCTA) {
    issues.push('Missing clear call to action');
  }
  
  // Success - should paint picture of positive outcome
  const successWords = ['beautiful', 'thrive', 'bloom', 'flourish', 'success', 'gorgeous', 'stunning', 'healthy', 'vibrant'];
  const hasSuccess = successWords.some(word => contentLower.includes(word));
  if (!hasSuccess) {
    issues.push('Missing success visualization');
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
        issues.push(`Instagram post too long: ${wordCount} words (max 120)`);
      }
      if (wordCount < 50) {
        issues.push(`Instagram post too short: ${wordCount} words (min 60)`);
      }
      // Check for hashtags
      if (!content.includes('#')) {
        issues.push('Instagram post should include relevant hashtags');
      }
      break;
      
    case 'facebook':
      if (wordCount > 220) {
        issues.push(`Facebook post too long: ${wordCount} words (max 200)`);
      }
      if (wordCount < 80) {
        issues.push(`Facebook post too short: ${wordCount} words (min 100)`);
      }
      break;
      
    case 'blog':
      if (wordCount > 660) {
        issues.push(`Blog post too long: ${wordCount} words (max 600)`);
      }
      if (wordCount < 350) {
        issues.push(`Blog post too short: ${wordCount} words (min 400)`);
      }
      break;
      
    case 'newsletter':
      if (wordCount > 440) {
        issues.push(`Newsletter too long: ${wordCount} words (max 400)`);
      }
      if (wordCount < 250) {
        issues.push(`Newsletter too short: ${wordCount} words (min 300)`);
      }
      break;
  }
  
  return { issues };
}
