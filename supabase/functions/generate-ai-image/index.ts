import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { taskId, imageQuery, userId } = await req.json();
    console.log('[AI-IMAGE] Starting generation:', { taskId, imageQuery, userId });

    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Update task status to generating
    await supabaseClient
      .from('content_tasks')
      .update({ 
        image_generation_status: 'generating',
        image_generation_error: null 
      })
      .eq('id', taskId);

    // Enhance prompt with garden context
    const gardenPrompt = `Create a beautiful, professional photograph for a garden center marketing campaign. ${imageQuery}. 
    Style: High-quality product photography, natural lighting, vibrant colors. 
    Context: Professional garden center, plants, gardening tools, outdoor lifestyle.
    Important: NO text, logos, or watermarks in the image.`;

    console.log('[AI-IMAGE] Calling Lovable AI with prompt:', gardenPrompt);

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
      console.error('[AI-IMAGE] Lovable AI error:', response.status, errorText);
      throw new Error(`AI generation failed: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log('[AI-IMAGE] AI response received');

    // Extract base64 image from response
    const imageBase64 = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    if (!imageBase64) {
      throw new Error('No image returned from AI');
    }

    // Convert base64 to blob for upload
    const base64Data = imageBase64.split(',')[1]; // Remove data:image/png;base64, prefix
    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    // Upload to Supabase Storage
    const fileName = `${userId}/${taskId}-${Date.now()}.png`;
    console.log('[AI-IMAGE] Uploading to storage:', fileName);

    const { data: uploadData, error: uploadError } = await supabaseClient
      .storage
      .from('ai-generated-images')
      .upload(fileName, bytes, {
        contentType: 'image/png',
        upsert: false
      });

    if (uploadError) {
      console.error('[AI-IMAGE] Upload error:', uploadError);
      throw uploadError;
    }

    // Get public URL
    const { data: { publicUrl } } = supabaseClient
      .storage
      .from('ai-generated-images')
      .getPublicUrl(fileName);

    console.log('[AI-IMAGE] Image uploaded successfully:', publicUrl);

    // Update content task with image URL
    const { error: updateError } = await supabaseClient
      .from('content_tasks')
      .update({
        image_url: publicUrl,
        image_source: 'ai_generated',
        image_generation_status: 'complete',
        image_generated_at: new Date().toISOString(),
        image_metadata: {
          prompt: imageQuery,
          model: 'google/gemini-2.5-flash-image-preview',
          generated_at: new Date().toISOString()
        }
      })
      .eq('id', taskId);

    if (updateError) {
      console.error('[AI-IMAGE] Update error:', updateError);
      throw updateError;
    }

    console.log('[AI-IMAGE] Task updated successfully');

    return new Response(
      JSON.stringify({ 
        success: true, 
        imageUrl: publicUrl,
        taskId 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('[AI-IMAGE] Error:', error);

    // Try to update task with error status
    if (req.json && (await req.json())?.taskId) {
      const { taskId } = await req.json();
      const supabaseClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      );

      await supabaseClient
        .from('content_tasks')
        .update({
          image_generation_status: 'failed',
          image_generation_error: error.message
        })
        .eq('id', taskId);
    }

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
