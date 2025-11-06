/**
 * ⚠️ LEGACY FUNCTION - Primarily for individual image regeneration
 * 
 * Campaign content generation now handles images in parallel during content generation.
 * This function is kept for:
 * - Manual image regeneration for individual tasks
 * - Batch regeneration of failed images
 * - Backwards compatibility with older workflows
 * 
 * New campaigns should use the parallel generation in generate_campaign_content instead.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsJsonResponse, handleCorsPrelight } from "../_shared/cors.ts";

interface TaskImageRequest {
  task_id: string;
  post_type: string;
  content: string;
  title: string;
}

interface ImageFetchResult {
  task_id: string;
  image_url: string | null;
  metadata: Record<string, any> | null;
  error: string | null;
  status: 'completed' | 'failed' | 'rate_limited';
}

serve(async (req) => {
  const corsResponse = handleCorsPrelight(req);
  if (corsResponse) return corsResponse;

  try {
    console.warn('⚠️ fetch-content-images called - consider using parallel generation in generate_campaign_content for better performance');
    
    const { tasks } = await req.json() as { tasks: TaskImageRequest[] };
    
    if (!tasks || !Array.isArray(tasks) || tasks.length === 0) {
      return corsJsonResponse({
        success: false,
        error: 'No tasks provided'
      }, { status: 400 });
    }

    console.log(`🎨 [FETCH-IMAGES] Starting image fetch for ${tasks.length} tasks`);
    const startTime = Date.now();

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase credentials');
    }

    // Fetch images for all tasks in parallel
    const imagePromises = tasks.map(async (task): Promise<ImageFetchResult> => {
      try {
        console.log(`🖼️ [TASK ${task.task_id}] Fetching image for ${task.post_type}`);
        
        // Step 1: Generate keywords with garden_ prefix
        const keywordsResponse = await fetch(`${supabaseUrl}/functions/v1/generate-image-keywords`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            content: task.content,
            channel: task.post_type,
            title: task.title
          })
        });

        if (!keywordsResponse.ok) {
          const errorText = await keywordsResponse.text();
          throw new Error(`Keywords generation failed: ${errorText}`);
        }

        const keywordsData = await keywordsResponse.json();
        const keywords = keywordsData.keywords || keywordsData.primaryQuery || 'garden_plants garden_flowers';
        
        console.log(`✅ [TASK ${task.task_id}] Generated keywords: ${keywords}`);

        // Step 2: Generate AI image using Lovable AI
        const imageResponse = await fetch(`${supabaseUrl}/functions/v1/generate-ai-image`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            contentContext: task.content,
            contentTitle: task.title || keywords,
            channel: task.post_type === 'newsletter' ? 'newsletter' : 
                     task.post_type === 'blog' ? 'blog' :
                     task.post_type === 'instagram' ? 'instagram' : 'facebook',
            uploadToStorage: true,
            storageBucket: 'campaign-images',
            userId: 'campaign'
          })
        });

        if (!imageResponse.ok) {
          const errorText = await imageResponse.text();
          // Check for rate limiting
          if (imageResponse.status === 429 || errorText.includes('rate limit')) {
            console.warn(`⚠️ [TASK ${task.task_id}] AI generation rate limit hit`);
            return {
              task_id: task.task_id,
              image_url: null,
              metadata: { error: 'rate_limited', keywords },
              error: 'AI image generation rate limit exceeded',
              status: 'rate_limited'
            };
          }
          throw new Error(`AI image generation failed: ${errorText}`);
        }

        const imageData = await imageResponse.json();

        if (!imageData.imageUrl) {
          console.warn(`⚠️ [TASK ${task.task_id}] No image generated`);
          return {
            task_id: task.task_id,
            image_url: null,
            metadata: { error: 'no_image_generated', keywords },
            error: 'No image generated',
            status: 'failed'
          };
        }

        const metadata = {
          source: 'ai_generated',
          model: 'google/gemini-2.5-flash-image-preview',
          prompt: task.title || keywords,
          keywords: keywords,
          channel: task.post_type,
          generation_time: imageData.metadata?.generationTime,
          storage_path: imageData.metadata?.storagePath,
          generated_at: new Date().toISOString()
        };

        console.log(`✅ [TASK ${task.task_id}] AI image generated: ${imageData.imageUrl}`);

        // Step 3: Update the content_tasks table
        const updateResponse = await fetch(`${supabaseUrl}/rest/v1/content_tasks?id=eq.${task.task_id}`, {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${supabaseKey}`,
            'apikey': supabaseKey,
            'Content-Type': 'application/json',
            'Prefer': 'return=minimal'
          },
          body: JSON.stringify({
            image_url: imageData.imageUrl,
            image_metadata: metadata,
            image_source: 'ai_generated',
            image_generation_status: 'completed',
            image_generated_at: new Date().toISOString()
          })
        });

        if (!updateResponse.ok) {
          const errorText = await updateResponse.text();
          throw new Error(`Database update failed: ${errorText}`);
        }

        console.log(`✅ [TASK ${task.task_id}] Database updated successfully`);

        return {
          task_id: task.task_id,
          image_url: imageData.imageUrl,
          metadata,
          error: null,
          status: 'completed'
        };

      } catch (error) {
        console.error(`❌ [TASK ${task.task_id}] Error:`, error.message);
        
        // Update task with error status
        try {
          await fetch(`${supabaseUrl}/rest/v1/content_tasks?id=eq.${task.task_id}`, {
            method: 'PATCH',
            headers: {
              'Authorization': `Bearer ${supabaseKey}`,
              'apikey': supabaseKey,
              'Content-Type': 'application/json',
              'Prefer': 'return=minimal'
            },
            body: JSON.stringify({
              image_generation_status: 'failed',
              image_generation_error: error.message
            })
          });
        } catch (updateError) {
          console.error(`❌ [TASK ${task.task_id}] Failed to update error status:`, updateError.message);
        }

        return {
          task_id: task.task_id,
          image_url: null,
          metadata: null,
          error: error.message,
          status: 'failed'
        };
      }
    });

    // Wait for all image fetches to complete
    const results = await Promise.all(imagePromises);
    
    const duration = Date.now() - startTime;
    const successful = results.filter(r => r.status === 'completed').length;
    const failed = results.filter(r => r.status === 'failed').length;
    const rateLimited = results.filter(r => r.status === 'rate_limited').length;

    console.log(`🎨 [FETCH-IMAGES] Completed in ${duration}ms`);
    console.log(`✅ Success: ${successful}, ❌ Failed: ${failed}, ⚠️ Rate Limited: ${rateLimited}`);

    return corsJsonResponse({
      success: successful > 0,
      results,
      summary: {
        total: tasks.length,
        successful,
        failed,
        rateLimited,
        duration_ms: duration
      }
    });

  } catch (error) {
    console.error('❌ [FETCH-IMAGES] Fatal error:', error);
    return corsJsonResponse({
      success: false,
      error: error.message,
      results: []
    }, { status: 500 });
  }
});
