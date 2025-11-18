/**
 * Weekly Theme Image Generator Service
 * Specialized service for generating contextual, season-aware images for weekly theme content
 */

import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';

interface WeeklyThemeImageRequest {
  theme: string;
  weekNumber: number;
  content: string;
  title: string;
  channel?: string;
}

interface ImageGenerationResult {
  imageUrl: string;
  globalImageId?: string;
  error?: string;
}

/**
 * Generates a contextual image for weekly theme content
 * Uses theme, season, and content to create highly relevant image queries
 */
export const generateWeeklyThemeImage = async (
  request: WeeklyThemeImageRequest
): Promise<ImageGenerationResult> => {
  const { theme, weekNumber, content, title, channel = 'newsletter' } = request;
  
  console.log(`🎨 [WeeklyThemeImageGen] Generating image for Week ${weekNumber}: ${theme}`);
  
  try {
    // Determine current season for context
    const currentMonth = new Date().getMonth() + 1; // 1-12
    const season = getSeasonFromMonth(currentMonth);
    
    // Create enhanced context for image generation
    const enhancedContext = buildEnhancedImageContext({
      theme,
      season,
      content,
      title,
      weekNumber
    });
    
    console.log(`📝 [WeeklyThemeImageGen] Enhanced context: "${enhancedContext.substring(0, 100)}..."`);
    
    // Call AI image generation with enhanced context
    const { data, error } = await supabase.functions.invoke('generate-ai-image', {
      body: {
        contentContext: enhancedContext,
        contentTitle: title,
        channel,
        uploadToStorage: true,
        isWeeklyTheme: true, // Flag for special handling
        weekNumber,
        season
      }
    });
    
    if (error) {
      console.error(`❌ [WeeklyThemeImageGen] Failed for Week ${weekNumber}:`, error);
      throw new Error(`Image generation failed: ${error.message}`);
    }
    
    if (!data?.imageUrl) {
      throw new Error('No image URL returned from generation');
    }
    
    console.log(`✅ [WeeklyThemeImageGen] Generated image for Week ${weekNumber}:`, data.imageUrl);
    
    return {
      imageUrl: data.imageUrl,
      globalImageId: data.metadata?.globalImageId
    };
    
  } catch (error: any) {
    console.error(`❌ [WeeklyThemeImageGen] Error generating image for Week ${weekNumber}:`, error);
    
    // Return fallback instead of throwing
    return {
      imageUrl: '',
      error: error.message || 'Image generation failed'
    };
  }
};

/**
 * Batch generates images for multiple blocks in parallel
 * Optimized for weekly theme content creation
 */
export const generateWeeklyThemeImagesInParallel = async (
  blocks: Array<{
    id: string;
    theme: string;
    weekNumber: number;
    content: string;
    title: string;
  }>
): Promise<Map<string, ImageGenerationResult>> => {
  console.log(`🎨 [WeeklyThemeImageGen] Batch generating ${blocks.length} images in parallel`);
  
  const results = new Map<string, ImageGenerationResult>();
  
  // Generate all images in parallel
  const promises = blocks.map(async (block) => {
    const result = await generateWeeklyThemeImage({
      theme: block.theme,
      weekNumber: block.weekNumber,
      content: block.content,
      title: block.title
    });
    
    return { blockId: block.id, result };
  });
  
  // Wait for all to complete
  const settled = await Promise.allSettled(promises);
  
  // Map results back to block IDs
  settled.forEach((outcome, index) => {
    if (outcome.status === 'fulfilled') {
      results.set(outcome.value.blockId, outcome.value.result);
    } else {
      console.error(`❌ [WeeklyThemeImageGen] Failed for block ${blocks[index].id}:`, outcome.reason);
      results.set(blocks[index].id, {
        imageUrl: '',
        error: outcome.reason?.message || 'Generation failed'
      });
    }
  });
  
  const successCount = Array.from(results.values()).filter(r => !r.error).length;
  console.log(`✅ [WeeklyThemeImageGen] Batch complete: ${successCount}/${blocks.length} succeeded`);
  
  return results;
};

/**
 * Build enhanced context that includes seasonal and thematic information
 */
function buildEnhancedImageContext(params: {
  theme: string;
  season: string;
  content: string;
  title: string;
  weekNumber: number;
}): string {
  const { theme, season, content, title, weekNumber } = params;
  
  // Extract key topics from content
  const contentSnippet = content.substring(0, 200);
  
  // Build context with seasonal awareness
  const context = [
    `Garden center ${season} theme: ${theme}`,
    `Week ${weekNumber} focus: ${title}`,
    contentSnippet,
    `Season: ${season}`,
    'Professional garden center photography style',
    'High quality, bright, inviting atmosphere'
  ].join('. ');
  
  return context;
}

/**
 * Determine season from month number
 */
function getSeasonFromMonth(month: number): string {
  if (month >= 3 && month <= 5) return 'spring';
  if (month >= 6 && month <= 8) return 'summer';
  if (month >= 9 && month <= 11) return 'fall';
  return 'winter';
}

/**
 * Generate fallback image query for weekly theme
 * Used when AI generation fails
 */
export const generateFallbackImageQuery = (theme: string, season: string): string => {
  return `${season} ${theme.toLowerCase()} garden center flowers plants`;
};

/**
 * Validates that all blocks have images
 * Returns array of block IDs missing images
 */
export const validateWeeklyThemeImages = (blocks: Array<{ id: string; imageUrl?: string }>): string[] => {
  return blocks
    .filter(block => !block.imageUrl || block.imageUrl === '')
    .map(block => block.id);
};
