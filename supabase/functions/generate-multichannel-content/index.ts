import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    console.log('📨 Request body:', JSON.stringify(body, null, 2));

    // Return mock data for now - full AI implementation coming
    const mockContent = {
      content: [
        {
          type: 'email',
          items: [
            {
              week: 1,
              title: 'Welcome Email',
              caption: 'Mock content - AI generation coming soon',
              imageQuery: 'garden newsletter',
              themeId: 'mock',
              themeName: 'Mock Theme',
              dayOfWeek: 1
            }
          ]
        }
      ]
    };

    return new Response(
      JSON.stringify(mockContent),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
