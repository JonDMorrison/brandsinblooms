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
    const { imageQuery } = await req.json();
    console.log('[PREVIEW-IMAGE] Starting generation with query:', imageQuery);

    // Enhance prompt with garden context
    const gardenPrompt = `Create a beautiful, professional photograph for a garden center marketing campaign. ${imageQuery}. 
    Style: High-quality product photography, natural lighting, vibrant colors. 
    Context: Professional garden center, plants, gardening tools, outdoor lifestyle.
    Important: NO text, logos, or watermarks in the image.`;

    console.log('[PREVIEW-IMAGE] Calling Lovable AI');

    // Call Lovable AI Gateway for image generation
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash-image-preview',
        messages: [
          {
            role: 'user',
            content: gardenPrompt
          }
        ],
        modalities: ['image', 'text']
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[PREVIEW-IMAGE] Lovable AI error:', response.status, errorText);
      throw new Error(`AI generation failed: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log('[PREVIEW-IMAGE] AI response received');

    // Extract base64 image from response
    const imageBase64 = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    if (!imageBase64) {
      throw new Error('No image returned from AI');
    }

    console.log('[PREVIEW-IMAGE] Image generated successfully');

    // Return base64 image directly (client can convert to blob URL)
    return new Response(
      JSON.stringify({ 
        success: true, 
        imageUrl: imageBase64,
        format: 'base64'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('[PREVIEW-IMAGE] Error:', error);

    return new Response(
      JSON.stringify({ 
        error: error.message,
        success: false 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});
