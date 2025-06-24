
/**
 * Transforms campaign titles to remove numbered week references and use natural seasonal descriptions
 */
export const transformCampaignTitle = (title: string): string => {
  // Remove "Week X" patterns and replace with seasonal context
  const weekNumberPattern = /Week\s+\d+\s*[-:]?\s*/gi;
  const seasonalFocusPattern = /Seasonal\s+\w+\s+Focus\s*[-:]?\s*/gi;
  
  let transformedTitle = title
    .replace(weekNumberPattern, '')
    .replace(seasonalFocusPattern, '')
    .trim();
  
  // Remove leading/trailing dashes or colons
  transformedTitle = transformedTitle.replace(/^[-:\s]+|[-:\s]+$/g, '');
  
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
  // Remove various patterns of week references
  const patterns = [
    /Week\s+\d+\s*[-:]\s*/gi,
    /Seasonal\s+\w+\s+Focus\s*[-:]\s*Week\s+\d+/gi,
    /Week\s+\d+\s+of\s+\d+/gi,
    /This\s+week\s*\(\s*Week\s+\d+\s*\)/gi
  ];
  
  let cleanedContent = content;
  patterns.forEach(pattern => {
    cleanedContent = cleanedContent.replace(pattern, '');
  });
  
  // Clean up double spaces and normalize spacing
  cleanedContent = cleanedContent.replace(/\s{2,}/g, ' ').trim();
  
  return cleanedContent;
};
