
import { supabase } from "@/integrations/supabase/client";
import { getSeasonalContent } from "./SeasonalContent";
import { getCurrentWeekNumber } from "./homepageUtils";

export const generateNewsletterContent = async (campaignId: string, campaignTitle: string, weekNumber: number, userId?: string) => {
  try {
    console.log('Generating newsletter for campaign:', campaignTitle);
    
    const { data, error } = await supabase.functions.invoke('generate-newsletter', {
      body: {
        campaignId,
        campaignTitle,
        weekNumber,
        userId
      }
    });

    if (error) {
      console.error('Error generating newsletter:', error);
      return generateFallbackNewsletter(campaignTitle, weekNumber);
    }

    // Extract clean content from the response
    if (data?.content) {
      // If it's an object with content property, use that
      if (typeof data.content === 'object' && data.content.content) {
        return data.content.content;
      }
      // If it's already a string, use it directly
      if (typeof data.content === 'string') {
        return data.content;
      }
    }

    return generateFallbackNewsletter(campaignTitle, weekNumber);
  } catch (error) {
    console.error('Error generating newsletter:', error);
    return generateFallbackNewsletter(campaignTitle, weekNumber);
  }
};

export const generatePersonalizedContent = async (postType: string, campaignTitle: string, userId?: string) => {
  try {
    // Fetch company profile for personalization
    let companyProfile = null;
    if (userId) {
      const { data: profileData, error: profileError } = await supabase
        .from('company_profiles')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (!profileError && profileData) {
        companyProfile = profileData;
      }
    }

    const seasonalContent = getSeasonalContent();
    
    // Use company profile to generate personalized content
    if (companyProfile && postType !== 'newsletter' && postType !== 'video') {
      return generateContentWithProfile(postType, campaignTitle, companyProfile, seasonalContent);
    }

    // Fallback to generic content
    return getContentForType(postType, seasonalContent);
  } catch (error) {
    console.error('Error generating personalized content:', error);
    const seasonalContent = getSeasonalContent();
    return getContentForType(postType, seasonalContent);
  }
};

const generateContentWithProfile = (postType: string, campaignTitle: string, profile: any, seasonalContent: any) => {
  const companyName = profile.company_name || 'Garden Center';
  const specializations = profile.specializations || '';
  const uniqueSellingPoints = profile.unique_selling_points || '';
  const targetAudience = profile.target_audience || 'gardeners';
  
  switch (postType) {
    case 'instagram':
      return `🌱 ${campaignTitle} at ${companyName}! ${specializations ? `Our specialty in ${specializations} ` : ''}means we know exactly how to help you succeed. ${uniqueSellingPoints ? `What sets us apart: ${uniqueSellingPoints}. ` : ''}Perfect for ${targetAudience} looking to level up their garden game! Visit us today for expert advice tailored to your needs. #${companyName.replace(/\s+/g, '')} #GardenLife #PlantParent #ExpertAdvice`;
      
    case 'facebook':
      return `${campaignTitle} is the perfect focus for this week at ${companyName}! 🌿\n\n${profile.company_overview ? profile.company_overview.substring(0, 100) + '...' : 'We\'re passionate about helping you grow your best garden.'}\n\n${uniqueSellingPoints ? `What makes us different: ${uniqueSellingPoints}\n\n` : ''}Whether you're ${profile.ideal_customer || 'a gardening enthusiast'}, our team is here to provide personalized guidance. ${specializations ? `Ask us about our expertise in ${specializations}!` : ''}\n\nStop by this week and let's discuss your gardening goals. What questions can we answer for you?`;
      
    case 'email':
      return `This week at ${companyName}, we're focusing on ${campaignTitle}! ${profile.brand_voice ? `True to our ${profile.brand_voice} approach, ` : ''}we've prepared something special for ${targetAudience}.\n\n${uniqueSellingPoints ? `Remember what makes us unique: ${uniqueSellingPoints}. ` : ''}${profile.seasonal_focus ? `This ties perfectly into our seasonal focus: ${profile.seasonal_focus}. ` : ''}\n\nDon't miss our expert recommendations and fresh arrivals this week. ${specializations ? `Plus, get specialized advice on ${specializations}!` : ''}\n\nSee you soon at ${companyName}!`;
      
    default:
      return `${campaignTitle} at ${companyName} - expert advice for ${targetAudience}. ${specializations ? `Specializing in ${specializations}.` : ''}`;
  }
};

export const generateFallbackNewsletter = (campaignTitle: string, weekNumber: number) => {
  return `🌿 WEEKLY GARDEN NEWSLETTER - WEEK ${weekNumber}

Dear Garden Enthusiasts,

Welcome to another exciting week at our garden center! This week, we're focusing on ${campaignTitle}, and we have some wonderful insights to share with you.

🌱 FEATURED THIS WEEK: ${campaignTitle}

Spring is the perfect time to dive deep into ${campaignTitle.toLowerCase()}. Whether you're a seasoned gardener or just starting your green journey, mastering these techniques will transform your garden into a thriving oasis.

Our expert team has been busy curating the best products, plants, and advice specifically for this week's focus. We believe that success in gardening comes from understanding both the science and the art behind each practice.

🌸 WHAT'S HAPPENING AT THE GARDEN CENTER

This week brings exciting developments to our garden center. We've received fresh shipments of premium plants perfect for the current season, and our greenhouse is bursting with healthy specimens ready for their new homes.

Join us for our weekend workshop series where we'll dive hands-on into the world of ${campaignTitle.toLowerCase()}. These sessions are designed to give you practical skills you can immediately apply in your own garden.

🌿 EXPERT TIP OF THE WEEK

The secret to mastering ${campaignTitle.toLowerCase()} lies in understanding your garden's unique microclimate. Take time to observe how sunlight moves across your space, where water naturally collects, and how your soil responds to different conditions.

Remember: every garden tells a story, and your job as a gardener is to listen carefully and respond thoughtfully to what your plants are telling you.

🌻 COMMUNITY SPOTLIGHT

We love seeing the incredible transformations happening in our customers' gardens! This week, we're inspired by the creative approaches our community members are taking with ${campaignTitle.toLowerCase()}.

Stop by and share your own garden photos with us - we'd love to feature your success story in next week's newsletter!

🌱 VISIT US THIS WEEK

Come experience the difference that expert guidance and quality plants can make in your gardening journey. Our knowledgeable team is here to help you succeed with personalized advice tailored to your specific needs.

Happy gardening, and remember - every day is a chance to grow something beautiful!

The Garden Center Team

P.S. Follow us on social media for daily inspiration and quick tips! 🌱`;
};

export const generateVideoScript = (campaignTitle: string, seasonalContent: any, companyProfile?: any) => {
  const companyName = companyProfile?.company_name || 'our garden center';
  const specializations = companyProfile?.specializations || '';
  const brandVoice = companyProfile?.brand_voice || 'friendly and knowledgeable';
  const targetAudience = companyProfile?.target_audience || 'fellow garden lovers';
  
  return `Hey there, ${targetAudience}! ${companyProfile?.company_name ? `Welcome back to ${companyProfile.company_name}` : 'Welcome to our garden center'}. Today I want to talk about something that's been on my mind - ${campaignTitle.toLowerCase()}.

${brandVoice.includes('expert') || brandVoice.includes('professional') ? 
  `With years of experience helping gardeners succeed, I can tell you that ${campaignTitle.toLowerCase()} doesn't have to be complicated.` :
  `If you've been struggling with this in your garden, you're definitely not alone.`
}

${specializations ? 
  `Here at ${companyName}, we specialize in ${specializations}, and I've learned that ` :
  `I've been helping gardeners for years now, and I can tell you that `
}${campaignTitle.toLowerCase()} is really about understanding just a few key principles.

${companyProfile?.company_values ? 
  `True to our values of ${companyProfile.company_values}, we believe in keeping things simple and effective.` :
  `Here's what I've learned: most people overthink this. They get caught up in complex techniques when really, nature has already given us everything we need to succeed.`
}

The first thing to understand is timing. Your garden operates on its own schedule, and working with that rhythm rather than against it makes all the difference.

Second, it's about observation. Your plants are constantly communicating with you - through their leaves, their growth patterns, even how they respond to watering.

${companyProfile?.unique_selling_points ? 
  `And here's what sets us apart: ${companyProfile.unique_selling_points}. ` :
  `And here's the secret that separates successful gardeners from everyone else: `
}Consistency beats intensity every time. Small, regular actions compound into amazing results.

This week, I challenge you to spend just five minutes each day really observing your garden. Notice what's thriving, what's struggling, and how different areas respond to your care.

${companyProfile?.location_info ? 
  `Come visit us at ${companyName} - ${companyProfile.location_info} - ` :
  `Come visit us at ${companyName} `
}this week, and I'll show you exactly what to look for in your own space. We'll walk through some simple techniques that can dramatically improve your results with ${campaignTitle.toLowerCase()}.

What's your biggest challenge with ${campaignTitle.toLowerCase()} right now? Drop a comment below and let's solve it together!`;
};

export const getContentForType = (postType: string, seasonalContent: any) => {
  switch (postType) {
    case 'instagram':
      const instaPost = seasonalContent.posts.find((p: any) => p.type === 'instagram');
      return instaPost?.content || '🌱 Transform your garden this week with expert tips! Our team has been perfecting these techniques for years, and now we\'re sharing them with you. Visit us today for personalized advice and quality plants. #GardenLife #PlantParent #GrowWithUs';
    case 'facebook':
      const fbPost = seasonalContent.posts.find((p: any) => p.type === 'facebook');
      return fbPost?.content || 'Spring is the perfect time to focus on your garden goals! Our expert team is here to help you succeed with personalized consultations, quality plants, and proven techniques. Stop by this week to see what\'s new and get advice tailored to your unique garden. What are your gardening plans for this season?';
    case 'email':
      const emailContent = seasonalContent.posts.find((p: any) => p.type === 'email');
      return emailContent?.content || 'Don\'t miss this week\'s special focus on seasonal gardening techniques! We\'ve prepared expert recommendations, fresh plant arrivals, and exclusive tips just for our email subscribers. Plus, join us for our weekend workshop where you\'ll learn hands-on skills from our experienced team.';
    default:
      return `Expert gardening advice and quality plants for your ${postType} audience.`;
  }
};

export const getHashtagsForType = (postType: string) => {
  switch (postType) {
    case 'newsletter':
      return '#WeeklyNewsletter #GardenTips #Community';
    case 'instagram':
      return '#GardenLife #Plants #Instagram #GreenThumb';
    case 'facebook':
      return '#GardenCenter #Community #Facebook #Gardening';
    case 'email':
      return '#Newsletter #EmailMarketing #GardenTips';
    case 'video':
      return '#GardenVideo #Tutorial #HowTo #Gardening';
    default:
      return `#${postType} #WeeklyCampaign #Gardening`;
  }
};

export const getImageIdeaForType = (postType: string) => {
  switch (postType) {
    case 'newsletter':
      return 'Newsletter header with seasonal garden imagery';
    case 'instagram':
      return 'Square format photo of featured plants or garden scene';
    case 'facebook':
      return 'Landscape photo showcasing garden center or seasonal plants';
    case 'email':
      return 'Email header with garden center branding and seasonal elements';
    case 'video':
      return 'Video thumbnail with gardening tools and plants';
    default:
      return `${postType} post image idea`;
  }
};
