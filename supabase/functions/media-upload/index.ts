import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { fileUrl, contentTaskId, canvaDesignId } = await req.json();

    if (!fileUrl || !contentTaskId) {
      return new Response(
        JSON.stringify({ error: 'fileUrl and contentTaskId are required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log('[MEDIA_UPLOAD] Processing upload:', { fileUrl, contentTaskId, canvaDesignId });

    // Download the image from Canva
    const imageResponse = await fetch(fileUrl);
    if (!imageResponse.ok) {
      throw new Error(`Failed to download image: ${imageResponse.statusText}`);
    }

    const imageBlob = await imageResponse.blob();
    const imageBuffer = await imageBlob.arrayBuffer();

    // Generate unique filename
    const timestamp = Date.now();
    const filename = `canva-design-${timestamp}.png`;

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabaseClient.storage
      .from('content-assets')
      .upload(filename, imageBuffer, {
        contentType: 'image/png',
        cacheControl: '3600',
        upsert: false
      });

    if (uploadError) {
      console.error('[MEDIA_UPLOAD] Upload error:', uploadError);
      throw uploadError;
    }

    // Get public URL
    const { data: urlData } = supabaseClient.storage
      .from('content-assets')
      .getPublicUrl(filename);

    const finalImageUrl = urlData.publicUrl;

    console.log('[MEDIA_UPLOAD] Upload successful:', { filename, finalImageUrl });

    // Update content_task with new image
    const { error: updateError } = await supabaseClient
      .from('content_tasks')
      .update({ 
        image_url: finalImageUrl,
        image_source: 'canva'
      })
      .eq('id', contentTaskId);

    if (updateError) {
      console.error('[MEDIA_UPLOAD] Content task update error:', updateError);
      throw updateError;
    }

    // Store/update canva design record
    if (canvaDesignId) {
      const { error: designError } = await supabaseClient
        .from('canva_designs')
        .upsert({
          user_id: (await supabaseClient.auth.getUser()).data.user?.id,
          content_task_id: contentTaskId,
          canva_design_id: canvaDesignId,
          original_image_url: fileUrl,
          final_image_url: finalImageUrl
        }, { 
          onConflict: 'content_task_id' 
        });

      if (designError) {
        console.error('[MEDIA_UPLOAD] Design record error:', designError);
        // Don't throw - this is not critical
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        imageUrl: finalImageUrl,
        filename 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('[MEDIA_UPLOAD] Error:', error);
    
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Upload failed',
        details: error 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});