
/**
 * Transforms campaign titles to remove numbered week references and use natural seasonal descriptions
 */
export const transformCampaignTitle = (title: string): string => {
  // Enhanced patterns to catch more week references
  const weekNumberPattern = /Week\s+\d+\s*[-:]?\s*/gi;
  const seasonalFocusPattern = /Seasonal\s+\w+\s+Focus\s*[-:]?\s*/gi;
  const weeklyPattern = /Weekly\s+[-:]?\s*/gi;
  const thisWeekPattern = /This\s+Week\s*[-:]?\s*/gi;
  const weekOfPattern = /Week\s+of\s+\w+\s*[-:]?\s*/gi;
  
  let transformedTitle = title
    .replace(weekNumberPattern, '')
    .replace(seasonalFocusPattern, '')
    .replace(weeklyPattern, '')
    .replace(thisWeekPattern, '')
    .replace(weekOfPattern, '')
    .trim();
  
  // Remove leading/trailing dashes, colons, or other punctuation
  transformedTitle = transformedTitle.replace(/^[-:\s,]+|[-:\s,]+$/g, '');
  
  // If the title becomes empty or too short, provide a seasonal default
  if (!transformedTitle || transformedTitle.length < 5) {
    const month = new Date().getMonth() + 1;
    if (month >= 3 && month <= 5) {
      transformedTitle = "Spring Garden Care Tips";
    } else if (month >= 6 && month <= 8) {
      transformedTitle = "Summer Garden Maintenance";
    } else if (month >= 9 && month <= 11) {
      transformedTitle = "Fall Garden Preparation";
    } else {
      transformedTitle = "Winter Plant Care";
    }
  }
  
  return transformedTitle;
};

/**
 * Validates and cleans generated content to remove any remaining week number references
 */
export const cleanContentFromWeekReferences = (content: string): string => {
  // Enhanced patterns to catch more week references
  const patterns = [
    /Week\s+\d+\s*[-:]\s*/gi,
    /Seasonal\s+\w+\s+Focus\s*[-:]\s*Week\s+\d+/gi,
    /Week\s+\d+\s+of\s+\d+/gi,
    /This\s+week\s*\(\s*Week\s+\d+\s*\)/gi,
    /Weekly\s+[-:]\s*/gi,
    /This\s+Week\s*[-:]\s*/gi,
    /Week\s+of\s+\w+\s*[-:]\s*/gi,
    /Happy\s+Week\s+\d+/gi,
    /Welcome\s+to\s+Week\s+\d+/gi,
    /In\s+Week\s+\d+/gi
  ];
  
  let cleanedContent = content;
  patterns.forEach(pattern => {
    cleanedContent = cleanedContent.replace(pattern, '');
  });
  
  // Clean up double spaces and normalize spacing
  cleanedContent = cleanedContent.replace(/\s{2,}/g, ' ').trim();
  
  // Remove common generic openings that might remain
  const genericOpenings = [
    /^Welcome\s+to\s+[^.!?]*[.!?]\s*/gi,
    /^This\s+week\s+[^.!?]*[.!?]\s*/gi,
    /^In\s+this\s+[^.!?]*[.!?]\s*/gi
  ];
  
  genericOpenings.forEach(pattern => {
    cleanedContent = cleanedContent.replace(pattern, '');
  });
  
  return cleanedContent.trim();
};

/**
 * Validates content to ensure it doesn't contain forbidden elements
 */
export const validateContentCompliance = (content: string): {
  isValid: boolean;
  issues: string[];
} => {
  const issues: string[] = [];
  
  // Check for week references
  if (/week\s*\d+/gi.test(content) || /weekly/gi.test(content)) {
    issues.push('Contains week number references');
  }
  
  // Check for generic openings
  if (/^welcome\s+to/gi.test(content.trim())) {
    issues.push('Uses generic "Welcome to" opening');
  }
  
  // Check for bullet points and lists
  if (/•|^\s*\d+\.|^\s*-\s/gm.test(content)) {
    issues.push('Contains bullet points or numbered lists');
  }
  
  // Check for Green Thumbs phrase
  if (/green\s*thumbs?/gi.test(content)) {
    issues.push('Contains forbidden "Green Thumbs" phrase');
  }
  
  // Check for emojis
  const emojiRegex = /[\p{Emoji}]/u;
  if (emojiRegex.test(content)) {
    issues.push('Contains emojis');
  }
  
  return {
    isValid: issues.length === 0,
    issues
  };
};
