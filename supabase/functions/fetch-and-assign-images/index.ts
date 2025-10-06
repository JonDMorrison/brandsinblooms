import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.10";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ImageRequest {
  taskId: string;
  imageQuery: string;
}

interface ImageResult {
  taskId: string;
  success: boolean;
  imageUrl?: string;
  imageMetadata?: any;
  error?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { tasks } = await req.json();
    
    if (!Array.isArray(tasks) || tasks.length === 0) {
      return new Response(
        JSON.stringify({ error: 'tasks array is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[BATCH_IMAGE_FETCH] Processing ${tasks.length} tasks`);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const results: ImageResult[] = [];

    // Process tasks sequentially to respect rate limits
    for (const task of tasks as ImageRequest[]) {
      try {
        if (!task.imageQuery || !task.taskId) {
          console.warn(`[BATCH_IMAGE_FETCH] Skipping task with missing data:`, task);
          results.push({
            taskId: task.taskId,
            success: false,
            error: 'Missing imageQuery or taskId'
          });
          continue;
        }

        console.log(`[BATCH_IMAGE_FETCH] Fetching image for task ${task.taskId} with query: "${task.imageQuery}"`);

        // Call get-unsplash-image function
        const { data: imageData, error: imageError } = await supabase.functions.invoke('get-unsplash-image', {
          body: { query: task.imageQuery }
        });

        if (imageError) {
          console.error(`[BATCH_IMAGE_FETCH] Error fetching image for ${task.taskId}:`, imageError);
          results.push({
            taskId: task.taskId,
            success: false,
            error: imageError.message
          });
          continue;
        }

        if (!imageData?.urls?.regular) {
          console.warn(`[BATCH_IMAGE_FETCH] No image found for query: ${task.imageQuery}`);
          results.push({
            taskId: task.taskId,
            success: false,
            error: 'No image found'
          });
          continue;
        }

        // Update content_tasks with image URL and metadata
        const imageMetadata = {
          photographer: imageData.user?.name,
          photographer_url: imageData.user?.links?.html,
          photographer_username: imageData.user?.username,
          unsplash_id: imageData.id,
          source: 'unsplash_auto',
          alt: imageData.alt_description || task.imageQuery
        };

        const { error: updateError } = await supabase
          .from('content_tasks')
          .update({
            image_url: imageData.urls.regular,
            image_metadata: imageMetadata,
            attachments: {
              images: [{
                url: imageData.urls.regular,
                thumb: imageData.urls.thumb,
                alt: imageData.alt_description || task.imageQuery,
                photographer: imageData.user?.name,
                source: 'unsplash'
              }]
            }
          })
          .eq('id', task.taskId);

        if (updateError) {
          console.error(`[BATCH_IMAGE_FETCH] Error updating task ${task.taskId}:`, updateError);
          results.push({
            taskId: task.taskId,
            success: false,
            error: updateError.message
          });
          continue;
        }

        // Track download with Unsplash API
        if (imageData.links?.download_location) {
          try {
            await supabase.functions.invoke('track-unsplash-download', {
              body: { downloadLocation: imageData.links.download_location }
            });
            console.log(`[BATCH_IMAGE_FETCH] Tracked download for image ${imageData.id}`);
          } catch (trackError) {
            console.warn(`[BATCH_IMAGE_FETCH] Failed to track download:`, trackError);
          }
        }

        console.log(`[BATCH_IMAGE_FETCH] ✓ Successfully assigned image to task ${task.taskId}`);
        results.push({
          taskId: task.taskId,
          success: true,
          imageUrl: imageData.urls.regular,
          imageMetadata
        });

        // Add small delay between requests to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (error) {
        console.error(`[BATCH_IMAGE_FETCH] Exception processing task ${task.taskId}:`, error);
        results.push({
          taskId: task.taskId,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    const successCount = results.filter(r => r.success).length;
    console.log(`[BATCH_IMAGE_FETCH] Completed: ${successCount}/${tasks.length} successful`);

    return new Response(
      JSON.stringify({ 
        success: true,
        results,
        summary: {
          total: tasks.length,
          successful: successCount,
          failed: tasks.length - successCount
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[BATCH_IMAGE_FETCH] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
