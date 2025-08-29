import * as Sentry from "https://esm.sh/@sentry/deno@8.55.0";
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

// Initialize Sentry
Sentry.init({
  dsn: Deno.env.get("SENTRY_DSN_BACKEND"),
  environment: Deno.env.get("ENV") ?? "production",
});

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface SentryIssue {
  id: string;
  title: string;
  culprit: string;
  count: number;
  userCount: number;
  firstSeen: string;
  lastSeen: string;
  level: string;
  status: string;
  shortId: string;
  permalink: string;
  metadata: {
    type?: string;
    value?: string;
    filename?: string;
    function?: string;
  };
}

interface ProcessedError {
  id: string;
  title: string;
  description: string;
  errorType: string;
  count: number;
  userCount: number;
  firstSeen: string;
  lastSeen: string;
  level: string;
  status: string;
  shortId: string;
  permalink: string;
  location: string;
  suggestedFix?: string;
}

async function handler(req: Request): Promise<Response> {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Test error endpoint for Sentry verification
  const url = new URL(req.url);
  if (url.searchParams.get('testError') === '1') {
    throw new Error('Test error from sentry-integration edge function - Sentry should capture this!');
  }

  try {
    const sentryApiToken = Deno.env.get('SENTRY_API_TOKEN');
    if (!sentryApiToken) {
      return new Response(
        JSON.stringify({ error: 'Sentry API token not configured' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Parse request body for organization and project info
    let orgSlug = 'brands-in-blooms'; // Default org
    let projectSlug = 'javascript-react'; // Default project
    let limit = 25; // Default limit

    try {
      const body = await req.json();
      orgSlug = body.orgSlug || orgSlug;
      projectSlug = body.projectSlug || projectSlug;
      limit = body.limit || limit;
    } catch {
      // Use defaults if no body provided
    }

    console.log(`Fetching Sentry issues for ${orgSlug}/${projectSlug}`);

    // Fetch issues from Sentry API
    const sentryResponse = await fetch(
      `https://sentry.io/api/0/projects/${orgSlug}/${projectSlug}/issues/?limit=${limit}&statsPeriod=14d`,
      {
        headers: {
          'Authorization': `Bearer ${sentryApiToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!sentryResponse.ok) {
      const errorText = await sentryResponse.text();
      console.error('Sentry API error:', sentryResponse.status, errorText);
      return new Response(
        JSON.stringify({ 
          error: `Sentry API error: ${sentryResponse.status}`,
          details: errorText
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const issues: SentryIssue[] = await sentryResponse.json();
    
    // Process and enhance the issues
    const processedErrors: ProcessedError[] = issues.map(issue => {
      const location = issue.culprit || 
        `${issue.metadata.filename || 'Unknown file'}${issue.metadata.function ? ` in ${issue.metadata.function}()` : ''}`;
      
      let suggestedFix = '';
      const errorType = issue.metadata.type || 'Unknown';
      const errorValue = issue.metadata.value || issue.title;

      // Generate suggested fixes based on error patterns
      if (errorType.includes('TypeError')) {
        suggestedFix = 'Check for null/undefined values and add proper type guards or optional chaining.';
      } else if (errorType.includes('ReferenceError')) {
        suggestedFix = 'Verify that all variables and functions are properly declared and imported.';
      } else if (errorType.includes('ChunkLoadError')) {
        suggestedFix = 'This is usually a deployment issue. Clear browser cache or redeploy the application.';
      } else if (errorValue.includes('Network Error') || errorValue.includes('fetch')) {
        suggestedFix = 'Check network connectivity and API endpoint availability. Add proper error handling for network requests.';
      } else if (errorValue.includes('Hydration')) {
        suggestedFix = 'Ensure server and client render the same content. Check for dynamic content that differs between server and client.';
      } else if (errorType.includes('SyntaxError')) {
        suggestedFix = 'Review the code syntax at the error location. Check for missing brackets, quotes, or semicolons.';
      }

      return {
        id: issue.id,
        title: issue.title,
        description: errorValue,
        errorType,
        count: issue.count,
        userCount: issue.userCount,
        firstSeen: issue.firstSeen,
        lastSeen: issue.lastSeen,
        level: issue.level,
        status: issue.status,
        shortId: issue.shortId,
        permalink: issue.permalink,
        location,
        suggestedFix: suggestedFix || 'Review the error context and stack trace for specific debugging steps.'
      };
    });

    // Sort by count (most frequent first)
    processedErrors.sort((a, b) => b.count - a.count);

    return new Response(
      JSON.stringify({ 
        success: true, 
        errors: processedErrors,
        summary: {
          total: processedErrors.length,
          unresolved: processedErrors.filter(e => e.status === 'unresolved').length,
          highPriority: processedErrors.filter(e => e.level === 'error' || e.level === 'fatal').length
        }
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Error in sentry-integration function:', error);
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