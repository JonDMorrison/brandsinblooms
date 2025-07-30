import { regenerateNewsletterContent } from '@/utils/regenerateNewsletterContent';

/**
 * Regenerate the World Vegetarian Day newsletter with proper vegetable-focused content
 */
export async function regenerateWorldVegetarianNewsletter() {
  const contentTaskId = '180d7fec-6ce1-47f9-9a10-8e43e6c3c65a';
  const campaignTitle = 'World Vegetarian Day';
  
  // The existing content that needs to be improved (contains "Beat the Heat" instead of vegetable content)
  const existingContent = `# World Vegetarian Day Newsletter Content`;
  
  try {
    console.log('🌱 Starting World Vegetarian Day newsletter regeneration...');
    
    const regeneratedContent = await regenerateNewsletterContent(
      contentTaskId,
      existingContent,
      campaignTitle
    );
    
    console.log('✅ Successfully regenerated World Vegetarian Day newsletter');
    console.log('🔍 Verifying content focuses on vegetables and plant-based living...');
    
    // Check if the regenerated content contains vegetable-related themes
    const hasVegetableContent = regeneratedContent.toLowerCase().includes('vegetable') ||
                               regeneratedContent.toLowerCase().includes('plant-based') ||
                               regeneratedContent.toLowerCase().includes('homegrown') ||
                               regeneratedContent.toLowerCase().includes('vegetarian');
    
    const hasUnwantedContent = regeneratedContent.toLowerCase().includes('beat the heat') ||
                              regeneratedContent.toLowerCase().includes('summer care');
    
    if (hasVegetableContent && !hasUnwantedContent) {
      console.log('✅ Content verification passed: Proper vegetable-focused theme detected');
    } else {
      console.warn('⚠️  Content verification concern: May still contain irrelevant themes');
    }
    
    return {
      success: true,
      content: regeneratedContent,
      hasVegetableContent,
      hasUnwantedContent
    };
    
  } catch (error) {
    console.error('❌ Failed to regenerate World Vegetarian Day newsletter:', error);
    return {
      success: false,
      error: error.message
    };
  }
}