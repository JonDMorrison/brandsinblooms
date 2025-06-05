
interface ThemeDescriptionGeneratorProps {
  theme: string;
  onDescriptionGenerated: (description: string) => void;
  onLoadingChange: (isLoading: boolean) => void;
}

export const generateThemeDescription = async (
  theme: string,
  onDescriptionGenerated: (description: string) => void,
  onLoadingChange: (isLoading: boolean) => void
) => {
  if (!theme.trim()) return;
  
  onLoadingChange(true);
  
  try {
    // For now, we'll use a smart fallback since we can't access the API key in the browser
    // In a production app, this would be handled by an edge function
    console.log('Generating theme description for:', theme);
    
    // Generate a contextual description based on the theme
    let description = "";
    const themeLower = theme.toLowerCase();
    
    if (themeLower.includes('plant') || themeLower.includes('seed')) {
      description = `This week's content will focus on plant selection and growing techniques for ${theme.toLowerCase()}, helping customers choose the right varieties and understand proper planting methods. All materials will emphasize seasonal timing, care instructions, and the quality plants and supplies available at our garden center.`;
    } else if (themeLower.includes('sale') || themeLower.includes('promotion')) {
      description = `This week's content will highlight our special ${theme.toLowerCase()} promotion, showcasing featured products and exclusive deals for our customers. All materials will emphasize value, quality, and limited-time savings opportunities at our garden center.`;
    } else if (themeLower.includes('workshop') || themeLower.includes('class')) {
      description = `This week's content will promote our educational ${theme.toLowerCase()} and provide helpful tips and techniques for participants. All materials will emphasize hands-on learning, expert guidance, and practical skills customers can apply in their own gardens.`;
    } else if (themeLower.includes('seasonal') || themeLower.includes('spring') || themeLower.includes('summer') || themeLower.includes('fall') || themeLower.includes('winter')) {
      description = `This week's content will focus on seasonal gardening activities related to ${theme.toLowerCase()}, helping customers prepare their gardens for the current season. All materials will emphasize timing, proper techniques, and seasonal products available at our garden center.`;
    } else {
      description = `This week's content will showcase practical techniques and expert guidance for ${theme.toLowerCase()}, helping customers achieve successful results in their gardens. All materials will emphasize step-by-step instructions, seasonal timing, and the quality products available at our garden center to support their gardening goals.`;
    }
    
    onDescriptionGenerated(description);
  } catch (error) {
    console.error('Error generating description:', error);
    // Fallback description
    const fallbackDescription = `This week's content will focus on promoting ${theme.toLowerCase()} and helping customers understand the value and benefits. All materials will emphasize practical information, seasonal timing, and how our garden center can support their gardening goals.`;
    onDescriptionGenerated(fallbackDescription);
  } finally {
    onLoadingChange(false);
  }
};
