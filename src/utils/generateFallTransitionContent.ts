import { generateCampaignContent } from '@/components/homepage/ContentGenerationServices';

export const generateFallTransitionPlanningContent = async () => {
  const campaignId = 'e7acb1d0-4bdd-46ee-ad98-9b1f6c5a2e85';
  const userId = '2e43e993-fd88-46f6-9a16-be4cc3dcfcac';
  
  try {
    console.log('🌱 Generating Fall Transition Planning content...');
    
    const result = await generateCampaignContent(
      campaignId,
      'Fall Transition Planning',
      'Fall garden planning, transition crops, autumn preparation, season extension',
      userId,
      29 // week number
    );
    
    if (result.success) {
      console.log('✅ Fall Transition Planning content generated successfully!', result);
      return { success: true, message: result.message };
    } else {
      console.error('❌ Failed to generate Fall Transition Planning content:', result);
      return { success: false, message: result.message };
    }
  } catch (error) {
    console.error('❌ Error generating Fall Transition Planning content:', error);
    return { success: false, message: 'Failed to generate content' };
  }
};

// Auto-execute the generation
generateFallTransitionPlanningContent().then(result => {
  console.log('Fall Transition Planning generation result:', result);
});