import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Maps frontend platform values to database enum values
 * Database expects: "FB" | "IG_FEED" | "IG_REEL"
 * Frontend sends: "facebook" | "instagram"
 */
function mapPlatformToEnum(platform: string): "FB" | "IG_FEED" | "IG_REEL" {
  const map: Record<string, "FB" | "IG_FEED" | "IG_REEL"> = {
    'facebook': 'FB',
    'instagram': 'IG_FEED',
    'fb': 'FB',
    'ig_feed': 'IG_FEED',
    'ig_reel': 'IG_REEL'
  };
  return map[platform.toLowerCase()] || 'FB';
}

async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  console.log('[PUBLISH-TASK] Function invoked');

  // FIX: [SC2] - Add JWT authentication to prevent unauthenticated access
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Authorization required' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
  const token = authHeader.replace('Bearer ', '');

  try {
    const requestBody = await req.json();
    const { taskId, contentId, platforms, accountId, caption, imageUrl, mediaUrls, isCarousel, firstComment, publishAt } = requestBody;

    console.log('[PUBLISH-TASK] Request:', { 
      taskId, 
      contentId, 
      platforms, 
      accountId, 
      hasCaption: !!caption, 
      hasImage: !!imageUrl,
      isCarousel,
      carouselImageCount: mediaUrls?.length || 0,
      publishAt 
    });

    if (!taskId) {
      return new Response(
        JSON.stringify({ error: 'Task ID is required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Determine action based on request data
    const action = publishAt ? 'schedule' : 'publish';
    console.log(`[PUBLISH-TASK] Processing task ${taskId} with action: ${action}`);

    // Initialize Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // FIX: [SC2] - Verify JWT token against Supabase auth
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Get task details to retrieve user_id and tenant_id
    const { data: taskData, error: taskError } = await supabase
      .from('content_tasks')
      .select('user_id, tenant_id')
      .eq('id', taskId)
      .single();

    if (taskError || !taskData) {
      console.error('[PUBLISH-TASK] Failed to fetch task:', taskError);
      return new Response(
        JSON.stringify({ error: 'Task not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Declare result outside the retry loop
    let result: any = null;

    // Add retry logic with exponential backoff
    let attempt = 0;
    const maxRetries = 2;
    let lastError: Error | null = null;

    while (attempt <= maxRetries) {
      try {
        // Process task based on action
        switch (action) {
          case 'publish':
            console.log(`[PUBLISH-TASK] Publishing task ${taskId} (attempt ${attempt + 1})`);
            
            // Validate required fields - carousel or single image
            const hasContent = caption || imageUrl || (isCarousel && mediaUrls && mediaUrls.length > 0);
            
            if (!hasContent) {
              console.warn('No content to publish', { 
                taskId, 
                platform: platforms?.[0] || "unknown", 
                attempt: attempt + 1 
              });
              
              if (attempt < maxRetries) {
                attempt++;
                await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
                continue;
              } else {
                return new Response(
                  JSON.stringify({ ok: false, code: "NO_CONTENT", message: "No content to publish" }),
                  { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                );
              }
            }

            // Validate carousel requirements
            if (isCarousel) {
              if (!mediaUrls || mediaUrls.length < 2) {
                return new Response(
                  JSON.stringify({ ok: false, code: "INVALID_CAROUSEL", message: "Carousel requires at least 2 images" }),
                  { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                );
              }
              if (mediaUrls.length > 10) {
                return new Response(
                  JSON.stringify({ ok: false, code: "INVALID_CAROUSEL", message: "Carousel cannot exceed 10 images" }),
                  { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                );
              }
            }
            
            // FIX: [SC1] - Actually invoke Facebook/Instagram API instead of just updating DB status
            // Store carousel metadata if applicable
            if (isCarousel && mediaUrls) {
              const { error: attachError } = await supabase
                .from('content_tasks')
                .update({
                  attachments: {
                    carousel: {
                      isCarousel: true,
                      mediaUrls: mediaUrls,
                      imageCount: mediaUrls.length
                    }
                  }
                })
                .eq('id', taskId);
              if (attachError) throw attachError;
            }

            // Determine platform from request or look up from content_tasks record
            const platform = platforms?.[0] || 'facebook';
            const edgeFunctionName = platform.toLowerCase().includes('instagram')
              ? 'post-to-instagram'
              : 'post-to-facebook';

            console.log(`[PUBLISH-TASK] Invoking ${edgeFunctionName} for task ${taskId}`);

            // Invoke the appropriate platform edge function
            const { data: apiResponse, error: apiError } = await supabase.functions.invoke(edgeFunctionName, {
              body: { content_task_id: taskId }
            });

            if (apiError) {
              console.error(`[PUBLISH-TASK] API call to ${edgeFunctionName} failed:`, apiError);
              // Set status to 'failed' with error message
              await supabase
                .from('content_tasks')
                .update({ status: 'failed', last_posting_error: apiError.message || 'API call failed' })
                .eq('id', taskId);
              throw new Error(`${edgeFunctionName} failed: ${apiError.message}`);
            }

            // Only mark as published AFTER successful API response
            const { error: publishError } = await supabase
              .from('content_tasks')
              .update({ status: 'published' })
              .eq('id', taskId);

            if (publishError) throw publishError;

            // Create scheduled post record with correct schema
            const { error: scheduleError } = await supabase
              .from('scheduled_posts')
              .insert({
                content_id: contentId,
                task_id: taskId,
                user_id: taskData.user_id,
                tenant_id: taskData.tenant_id,
                platform: mapPlatformToEnum(platform),
                publish_at: new Date().toISOString(),
                status: 'PUBLISHED',
                mode: 'MANUAL'
              });

            if (scheduleError) throw scheduleError;

            result = {
              status: 'published',
              taskId,
              timestamp: new Date().toISOString(),
              platform: platform,
              apiResponse: apiResponse
            };
            break;

          case 'schedule':
            console.log(`[PUBLISH-TASK] Scheduling task ${taskId} for ${publishAt}`);
            
            // Validate required fields
            if (!publishAt) {
              return new Response(
                JSON.stringify({ error: 'publishAt is required for scheduling' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
              );
            }
            
            // Update task status to scheduled
            const { error: scheduleUpdateError } = await supabase
              .from('content_tasks')
              .update({ status: 'scheduled' })
              .eq('id', taskId);

            if (scheduleUpdateError) throw scheduleUpdateError;

            // Create scheduled post record with correct schema
            const { error: createScheduleError } = await supabase
              .from('scheduled_posts')
              .insert({
                content_id: contentId,
                task_id: taskId,  // NEW: Direct link to content_tasks
                user_id: taskData.user_id,
                tenant_id: taskData.tenant_id,
                platform: mapPlatformToEnum(platforms?.[0] || 'facebook'),
                publish_at: publishAt,
                status: 'QUEUED',
                mode: 'MANUAL'
              });

            if (createScheduleError) throw createScheduleError;
            
            result = { 
              status: 'scheduled', 
              taskId, 
              scheduledFor: publishAt,
              platform: platforms?.[0] || 'facebook'
            };
            break;

          default:
            console.log(`[PUBLISH-TASK] Unknown action: ${action}`);
            result = { status: 'unknown', taskId, action };
        }
        
        break; // Success, exit retry loop
      } catch (error) {
        lastError = error as Error;
        console.error(`[PUBLISH-TASK] Attempt ${attempt + 1} failed:`, error);
        
        if (attempt < maxRetries) {
          attempt++;
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
        } else {
          console.error('Publish retry exhausted', { 
            taskId, 
            lastError: lastError.message,
            totalAttempts: attempt + 1
          });
          throw lastError;
        }
      }
    }

    console.log('[PUBLISH-TASK] Task processed successfully:', result);

    return new Response(
      JSON.stringify({ 
        success: true,
        result,
        message: `Task ${taskId} processed successfully`
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('[PUBLISH-TASK] Error processing task:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        details: error.message 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
}

Deno.serve(handler);
