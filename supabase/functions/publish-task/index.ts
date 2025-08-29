import * as Sentry from "https://esm.sh/@sentry/deno@8.55.0";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Initialize Sentry
Sentry.init({
  dsn: Deno.env.get("SENTRY_DSN_BACKEND"),
  environment: Deno.env.get("ENV") ?? "production",
});

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  console.log('[PUBLISH-TASK] Function invoked - Sentry logging test');
  
  // Test error endpoint for Sentry verification
  const url = new URL(req.url);
  if (url.searchParams.get('testError') === '1') {
    console.log('[PUBLISH-TASK] Triggering test error for Sentry');
    throw new Error('Test error from publish-task edge function - Sentry should capture this!');
  }

  try {
    const { taskId, action } = await req.json();

    if (!taskId) {
      return new Response(
        JSON.stringify({ error: 'Task ID is required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Initialize Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    console.log(`[PUBLISH-TASK] Processing task ${taskId} with action: ${action}`);

    // Simulate task processing based on action
    let result;
    switch (action) {
      case 'publish':
        console.log(`[PUBLISH-TASK] Publishing task ${taskId}`);
        result = { status: 'published', taskId, timestamp: new Date().toISOString() };
        break;
      case 'schedule':
        console.log(`[PUBLISH-TASK] Scheduling task ${taskId}`);
        result = { status: 'scheduled', taskId, timestamp: new Date().toISOString() };
        break;
      case 'cancel':
        console.log(`[PUBLISH-TASK] Cancelling task ${taskId}`);
        result = { status: 'cancelled', taskId, timestamp: new Date().toISOString() };
        break;
      default:
        console.log(`[PUBLISH-TASK] Unknown action: ${action}`);
        result = { status: 'unknown', taskId, action };
    }

    // Add a deliberate test log line
    console.log('[PUBLISH-TASK] Test log line - this should appear in logs');

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
    Sentry.captureException(error);
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