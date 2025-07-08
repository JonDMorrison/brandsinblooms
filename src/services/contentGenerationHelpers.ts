
import { fetchSmartImage, fetchSmartImageFromContent } from './unsplashService';
import { extractKeywordsFromContent } from '@/utils/markdownUtils';

export async function attachImagesToTask(taskId: string | null, holidayName?: string): Promise<any> {
  try {
    console.log(`[IMAGE_ATTACH] Processing task for: ${holidayName || 'Unknown'}`);
    
    // Extract primary keyword from holiday name or fallback
    const title = holidayName || 'Garden Care';
    const primary = title.split(':')[0] || title.split(' - ')[0] || title;
    
    // Determine secondary context based on content analysis
    let secondary = '';
    const titleLower = title.toLowerCase();
    
    if (titleLower.includes('water')) {
      secondary = 'water garden aquatic';
    } else if (/veggies?|vegetable|tomato|pepper|cucumber/i.test(titleLower)) {
      secondary = 'vegetable produce edible';
    } else if (/rose|flower|bloom|petal/i.test(titleLower)) {
      secondary = 'flower bloom colorful';
    } else if (/tree|oak|maple|pine|shade/i.test(titleLower)) {
      secondary = 'tree landscaping shade';
    } else if (/herb|basil|mint|oregano|culinary/i.test(titleLower)) {
      secondary = 'herb culinary cooking';
    } else if (/lawn|grass|turf|mow/i.test(titleLower)) {
      secondary = 'lawn grass green';
    } else if (/succulent|cactus|drought/i.test(titleLower)) {
      secondary = 'succulent desert drought';
    } else {
      secondary = 'garden center nursery plants';
    }
    
    console.log(`[IMAGE_ATTACH] Query: "${primary}" + "${secondary}"`);
    
    const image = await fetchSmartImage(primary, secondary);
    
    if (image) {
      console.log(`[IMAGE_ATTACH] Successfully found image for: ${primary}`);
      return { image };
    } else {
      console.warn(`[IMAGE_ATTACH] No image found for: ${primary}`);
      return null;
    }
  } catch (error) {
    console.error('[IMAGE_ATTACH] Error fetching images:', error);
    return null;
  }
}

export async function attachMultipleImagesToTask(task: any, count = 3): Promise<any> {
  try {
    // Extract multiple keywords for variety
    const keywords = extractKeywordsFromContent(task.ai_output || '', 'mixed');
    const title = task.campaigns?.title || task.holidays?.holiday_name || 'Garden Care';
    
    // Include title as primary keyword
    const allKeywords = [title.split(':')[0], ...keywords].slice(0, count);
    
    const images = [];
    for (const keyword of allKeywords) {
      const image = await fetchSmartImage(keyword, 'garden');
      if (image) images.push(image);
    }
    
    if (images.length > 0) {
      task.images = images;
      task.image = images[0]; // Primary image
    }
    
    return task;
  } catch (error) {
    console.error('[IMAGE_ATTACH] Error attaching multiple images:', error);
    return task;
  }
}
