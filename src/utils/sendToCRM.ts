import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/utils/toast';
import { convertNewsletterToCRM, createCRMCampaignFromNewsletter } from './newsletterToCrmSync';
import { generateCampaignSlug } from './campaignSlugUtils';

interface SendToCRMPayload {
  contentTaskId: string;
  title: string;
  themeSource: 'weekly' | 'holiday' | 'event' | 'custom';
  content: string;
  images?: string[];
  personaTags?: string[];
  segmentSuggestions?: string[];
  campaignId?: string;
  // Enhanced for newsletter sync
  newsletterBlocks?: any[];
  isNewsletterContent?: boolean;
}

export const sendToCRM = async (contentTaskId: string): Promise<boolean> => {
  try {
    console.log('🔄 [sendToCRM] Starting CRM transfer for content task:', contentTaskId);

    // Fetch the content task with campaign details
    const { data: contentTask, error: taskError } = await supabase
      .from('content_tasks')
      .select(`
        *,
        campaigns (
          title,
          theme,
          week_number,
          source
        )
      `)
      .eq('id', contentTaskId)
      .single();

    if (taskError || !contentTask) {
      console.error('❌ [sendToCRM] Failed to fetch content task:', taskError);
      toast.error('Failed to load content for CRM transfer');
      return false;
    }

    console.log('✅ [sendToCRM] Content task fetched:', {
      id: contentTask.id,
      hasContent: !!contentTask.ai_output,
      contentLength: contentTask.ai_output?.length || 0,
      postType: contentTask.post_type,
      campaignTitle: contentTask.campaigns?.title
    });

    // Extract content details
    const campaign = contentTask.campaigns;
    const title = campaign?.title || contentTask.notes || 'Newsletter Campaign';
    
    // Determine theme source
    let themeSource: SendToCRMPayload['themeSource'] = 'custom';
    if (campaign?.source === 'system' && campaign?.week_number) {
      themeSource = 'weekly';
    } else if (contentTask.holiday_id) {
      themeSource = 'holiday';
    } else if (campaign?.source === 'event') {
      themeSource = 'event';
    }

    // Enhanced newsletter handling
    let personaTags: string[] = [];
    let segmentSuggestions: string[] = [];
    let newsletterBlocks: any[] = [];
    
    const isNewsletterContent = contentTask.post_type === 'newsletter';
    
    if (isNewsletterContent) {
      console.log('📧 [sendToCRM] Processing newsletter content for CRM conversion');
      const conversionResult = convertNewsletterToCRM(contentTask.ai_output || '', title, contentTaskId);
      
      personaTags = conversionResult.personaTags;
      segmentSuggestions = conversionResult.segments;
      newsletterBlocks = conversionResult.blocks;
      
      console.log('✨ [sendToCRM] Newsletter conversion complete:', {
        blocksCount: newsletterBlocks.length,
        theme: conversionResult.theme,
        readingTime: conversionResult.readingTime
      });
    } else {
      // Standard content processing
      personaTags = extractPersonaTags(contentTask.ai_output || '');
      segmentSuggestions = generateSegmentSuggestions(
        contentTask.ai_output || '',
        campaign?.theme || '',
        personaTags
      );
    }
    
    console.log('🏷️ [sendToCRM] Extracted persona tags:', personaTags);
    console.log('📊 [sendToCRM] Generated segment suggestions:', segmentSuggestions);

    // Extract images from attachments and content
    const images = extractImages(contentTask);
    console.log('🖼️ [sendToCRM] Extracted images:', images);

    // Create unique campaign slug for newsletter content
    let crmUrl: string;
    
    if (isNewsletterContent) {
      const campaignSlug = generateCampaignSlug(title, contentTaskId);
      
      // Navigate to unique campaign URL with essential parameters
      const searchParams = new URLSearchParams({
        contentTaskId: contentTaskId,
        source: 'newsletter_content',
        themeSource,
        title: encodeURIComponent(title),
        type: 'newsletter',
        isNewsletterContent: 'true',
        ...(personaTags?.length && { 
          personaTags: encodeURIComponent(JSON.stringify(personaTags)) 
        }),
        ...(segmentSuggestions?.length && { 
          segmentSuggestions: encodeURIComponent(JSON.stringify(segmentSuggestions)) 
        }),
        ...(contentTask.campaign_id && { campaignId: contentTask.campaign_id }),
        ...(images?.length && { 
          images: encodeURIComponent(JSON.stringify(images)) 
        }),
        ...(newsletterBlocks.length && {
          newsletterBlocks: encodeURIComponent(JSON.stringify(newsletterBlocks))
        })
      });

      crmUrl = `/crm/campaigns/new/${campaignSlug}?${searchParams.toString()}`;
      
      console.log('🎯 [sendToCRM] Generated CRM URL for newsletter:', {
        contentTaskId,
        campaignSlug,
        title,
        crmUrl: crmUrl.substring(0, 100) + '...'
      });
    } else {
      // Use generic route for non-newsletter content
      const searchParams = new URLSearchParams({
        contentTaskId: contentTaskId,
        source: 'newsletter_content',
        themeSource,
        title: encodeURIComponent(title),
        content: encodeURIComponent(contentTask.ai_output || ''),
        type: 'content',
        isNewsletterContent: 'false',
        ...(personaTags?.length && { 
          personaTags: encodeURIComponent(JSON.stringify(personaTags)) 
        }),
        ...(segmentSuggestions?.length && { 
          segmentSuggestions: encodeURIComponent(JSON.stringify(segmentSuggestions)) 
        }),
        ...(contentTask.campaign_id && { campaignId: contentTask.campaign_id }),
        ...(images?.length && { 
          images: encodeURIComponent(JSON.stringify(images)) 
        })
      });

      crmUrl = `/crm/campaigns/new?${searchParams.toString()}`;
    }
    
    console.log('✅ [sendToCRM] Navigating to CRM with parameters:', { 
      contentTaskId,
      title,
      themeSource,
      personaTagsCount: personaTags?.length || 0,
      segmentSuggestionsCount: segmentSuggestions?.length || 0,
      imagesCount: images?.length || 0
    });
    
    // Use window.location for navigation to ensure URL parameters are preserved
    window.location.href = crmUrl;
    
    const successMessage = isNewsletterContent 
      ? `Newsletter "${title}" converted to CRM with ${newsletterBlocks.length} blocks, ${personaTags?.length || 0} tags and ${segmentSuggestions?.length || 0} segments`
      : `"${title}" sent to CRM Campaign Builder with ${personaTags?.length || 0} tags and ${segmentSuggestions?.length || 0} segments`;
    
    toast.success(successMessage);
    return true;

  } catch (error) {
    console.error('❌ Error in sendToCRM:', error);
    toast.error('Failed to send content to CRM');
    return false;
  }
};

const extractPersonaTags = (content: string): string[] => {
  const tags: string[] = [];
  
  // Analyze content for persona indicators
  const lowerContent = content.toLowerCase();
  
  if (lowerContent.includes('beginner') || lowerContent.includes('new to') || lowerContent.includes('getting started')) {
    tags.push('New Gardeners');
  }
  
  if (lowerContent.includes('expert') || lowerContent.includes('advanced') || lowerContent.includes('professional')) {
    tags.push('Expert Gardeners');
  }
  
  if (lowerContent.includes('vegetable') || lowerContent.includes('herb') || lowerContent.includes('tomato')) {
    tags.push('Vegetable Gardeners');
  }
  
  if (lowerContent.includes('flower') || lowerContent.includes('bloom') || lowerContent.includes('rose')) {
    tags.push('Flower Enthusiasts');
  }
  
  if (lowerContent.includes('indoor') || lowerContent.includes('houseplant') || lowerContent.includes('container')) {
    tags.push('Indoor Plant Lovers');
  }

  return [...new Set(tags)]; // Remove duplicates
};

const generateSegmentSuggestions = (
  content: string, 
  theme: string, 
  personaTags: string[]
): string[] => {
  const suggestions: string[] = [];
  
  // Add persona-based segments
  suggestions.push(...personaTags);
  
  // Add seasonal segments based on content
  const lowerContent = content.toLowerCase();
  const currentMonth = new Date().getMonth();
  
  if (currentMonth >= 2 && currentMonth <= 4) { // Spring
    if (lowerContent.includes('spring') || lowerContent.includes('planting')) {
      suggestions.push('Spring Preparation');
    }
  } else if (currentMonth >= 5 && currentMonth <= 7) { // Summer
    if (lowerContent.includes('summer') || lowerContent.includes('watering')) {
      suggestions.push('Summer Care');
    }
  } else if (currentMonth >= 8 && currentMonth <= 10) { // Fall
    if (lowerContent.includes('fall') || lowerContent.includes('harvest')) {
      suggestions.push('Fall Preparation');
    }
  } else { // Winter
    if (lowerContent.includes('winter') || lowerContent.includes('protection')) {
      suggestions.push('Winter Protection');
    }
  }
  
  // Add engagement-based segments
  if (theme?.includes('care') || lowerContent.includes('maintenance')) {
    suggestions.push('Regular Maintenance');
  }
  
  return [...new Set(suggestions)]; // Remove duplicates
};

const extractImages = (contentTask: any): string[] => {
  const images: string[] = [];
  
  // Extract from image_url field
  if (contentTask.image_url) {
    images.push(contentTask.image_url);
  }
  
  // Extract from attachments
  if (contentTask.attachments) {
    const attachments = typeof contentTask.attachments === 'string' 
      ? JSON.parse(contentTask.attachments) 
      : contentTask.attachments;
    
    if (attachments.image?.url) {
      images.push(attachments.image.url);
    }
    
    if (attachments.selectedImages) {
      Object.values(attachments.selectedImages).forEach((url: any) => {
        if (typeof url === 'string' && url.startsWith('http')) {
          images.push(url);
        }
      });
    }
  }
  
  return [...new Set(images)]; // Remove duplicates
};
