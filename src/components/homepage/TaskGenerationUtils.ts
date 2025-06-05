
import { supabase } from "@/integrations/supabase/client";
import { getSeasonalContent } from "./SeasonalContent";
import { getCurrentWeekNumber } from "./homepageUtils";

export const generateNewsletterContent = async (campaignId: string, campaignTitle: string, weekNumber: number) => {
  try {
    console.log('Generating newsletter for campaign:', campaignTitle);
    
    const { data, error } = await supabase.functions.invoke('generate-newsletter', {
      body: {
        campaignId,
        campaignTitle,
        weekNumber
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

export const generateVideoScript = (campaignTitle: string, seasonalContent: any) => {
  const theme = campaignTitle.toLowerCase();
  
  return `Hey there, fellow garden lovers! Today I want to talk about something that's been on my mind - ${theme}. If you've been struggling with this in your garden, you're definitely not alone.

I've been helping gardeners for over fifteen years now, and I can tell you that ${theme} doesn't have to be complicated. In fact, some of the best results I've seen come from understanding just a few key principles.

Here's what I've learned: most people overthink ${theme}. They get caught up in complex techniques and expensive products when really, nature has already given us everything we need to succeed.

The first thing to understand is timing. Your garden operates on its own schedule, and working with that rhythm rather than against it makes all the difference. When you start paying attention to these natural signals, everything becomes clearer.

Second, it's about observation. Your plants are constantly communicating with you - through their leaves, their growth patterns, even how they respond to watering. Learning to read these signs is like having a conversation with your garden.

And here's the secret that separates successful gardeners from everyone else: consistency beats intensity every time. Small, regular actions compound into amazing results.

This week, I challenge you to spend just five minutes each day really observing your garden. Notice what's thriving, what's struggling, and how different areas respond to your care.

Come visit us at the garden center this week, and I'll show you exactly what to look for in your own space. We'll walk through some simple techniques that can dramatically improve your results with ${theme}.

What's your biggest challenge with ${theme} right now? Drop a comment below and let's solve it together!`;
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
