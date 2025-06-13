
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { 
  generatePersonalizedContent, 
  generateNewsletterContent, 
  generateVideoScript 
} from "../homepage/ContentGenerationServices";

interface BulkGenerationOptions {
  campaignId: string;
  campaignTitle: string;
  theme: string;
  description?: string;
  userId: string;
  weekNumber?: number;
}

interface GenerationResult {
  success: boolean;
  generatedCount: number;
  failedTypes: string[];
  tokenCost: number;
}

export const generateContentPack = async (options: BulkGenerationOptions): Promise<GenerationResult> => {
  const { campaignId, campaignTitle, theme, description, userId, weekNumber = 1 } = options;
  
  console.log('🚀 Starting bulk content generation for theme:', theme);
  
  // Check token balance first
  const { data: tokenBalance, error: balanceError } = await supabase.rpc('get_token_balance', {
    p_user_id: userId
  });

  if (balanceError) {
    console.error('❌ Error checking token balance:', balanceError);
    toast.error('Failed to check token balance');
    return { success: false, generatedCount: 0, failedTypes: [], tokenCost: 0 };
  }

  const balance = tokenBalance && tokenBalance.length > 0 ? tokenBalance[0] : null;
  if (!balance) {
    toast.error('Unable to verify token balance');
    return { success: false, generatedCount: 0, failedTypes: [], tokenCost: 0 };
  }

  const totalTokensNeeded = 8; // 2+1+1+1+2+1 for newsletter, facebook, instagram, email, video, linkedin
  const willGoIntoOverage = balance.tokens_balance < totalTokensNeeded;
  
  if (willGoIntoOverage) {
    const overageAmount = totalTokensNeeded - Math.max(0, balance.tokens_balance);
    const overageCost = overageAmount * 0.25;
    
    const proceed = window.confirm(
      `Generate content pack (5 pieces) for "${theme}"?\n\n` +
      `Cost: ${totalTokensNeeded} tokens\n` +
      `Current balance: ${Math.max(0, balance.tokens_balance)} tokens\n` +
      `Overage: ${overageAmount} tokens (+$${overageCost.toFixed(2)})\n\n` +
      `Continue?`
    );
    
    if (!proceed) {
      toast.info('Content generation cancelled');
      return { success: false, generatedCount: 0, failedTypes: [], tokenCost: 0 };
    }
  }

  const contentTypes = [
    { type: 'newsletter', tokens: 2 },
    { type: 'facebook', tokens: 1 },
    { type: 'instagram', tokens: 1 },
    { type: 'email', tokens: 1 },
    { type: 'video', tokens: 2 },
    { type: 'linkedin', tokens: 1 }
  ];

  const results = [];
  const failedTypes = [];
  let generatedCount = 0;
  let totalTokenCost = 0;

  // Generate content in parallel for better performance
  const generationPromises = contentTypes.map(async ({ type, tokens }) => {
    try {
      console.log(`🤖 Generating ${type} content for theme: ${theme}`);
      
      let generatedContent = '';
      const contextPrompt = `Theme: ${theme}${description ? `\nDescription: ${description}` : ''}`;
      
      if (type === 'newsletter') {
        generatedContent = await generateNewsletterContent(campaignId, campaignTitle, weekNumber, userId, contextPrompt);
      } else if (type === 'video') {
        generatedContent = await generateVideoScript(campaignTitle, userId, contextPrompt);
      } else {
        generatedContent = await generatePersonalizedContent(type, campaignTitle, userId, contextPrompt);
      }
      
      if (!generatedContent || generatedContent.trim() === '') {
        throw new Error(`Generated content is empty for ${type}`);
      }

      // Create scheduled date (spread over next 5 days)
      const today = new Date();
      const scheduledDate = new Date(today);
      scheduledDate.setDate(today.getDate() + contentTypes.findIndex(ct => ct.type === type) + 1);

      // Create content task
      const { error: insertError } = await supabase
        .from('content_tasks')
        .insert({
          campaign_id: campaignId,
          post_type: type,
          status: 'review',
          scheduled_date: scheduledDate.toISOString().split('T')[0],
          ai_output: generatedContent,
          hashtags: getHashtagsForType(type),
          image_idea: getImageIdeaForType(type),
          notes: `Generated from theme: ${theme}`
        });

      if (insertError) {
        throw insertError;
      }

      console.log(`✅ Successfully generated ${type} content`);
      totalTokenCost += tokens;
      generatedCount++;
      
      return { type, success: true };
    } catch (error) {
      console.error(`❌ Failed to generate ${type} content:`, error);
      failedTypes.push(type);
      return { type, success: false, error };
    }
  });

  // Wait for all generations to complete
  await Promise.all(generationPromises);

  if (generatedCount > 0) {
    const message = generatedCount === contentTypes.length 
      ? `🎉 Generated ${generatedCount} pieces of content! Check the review queue.`
      : `⚠️ Generated ${generatedCount}/${contentTypes.length} pieces of content. ${failedTypes.length} failed.`;
    
    toast.success(message);
  } else {
    toast.error('Failed to generate any content. Please try again.');
  }

  return {
    success: generatedCount > 0,
    generatedCount,
    failedTypes,
    tokenCost: totalTokenCost
  };
};

// Helper functions for content metadata
const getHashtagsForType = (type: string): string => {
  const hashtags = {
    facebook: '#GardenCenter #LocalGardening #PlantLife #GreenThumb',
    instagram: '#GardenCenter #Plants #Gardening #LocalBusiness #GreenLife #PlantParent',
    email: '',
    newsletter: '',
    video: '#GardenTips #Gardening #LocalExperts #PlantCare',
    linkedin: '#GardenIndustry #LocalBusiness #Sustainability #GreenBusiness'
  };
  return hashtags[type as keyof typeof hashtags] || '';
};

const getImageIdeaForType = (type: string): string => {
  const imageIdeas = {
    facebook: 'Vibrant garden display with seasonal plants and flowers',
    instagram: 'Aesthetic plant arrangement with natural lighting',
    email: 'Professional garden center storefront or featured products',
    newsletter: 'Seasonal garden showcase or expert demonstration',
    video: 'Behind-the-scenes footage of garden center operations',
    linkedin: 'Professional team photo or business achievement highlight'
  };
  return imageIdeas[type as keyof typeof imageIdeas] || 'Garden center related imagery';
};
