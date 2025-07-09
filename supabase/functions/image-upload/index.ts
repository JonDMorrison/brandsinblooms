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

    // Parse form data
    const formData = await req.formData();
    const file = formData.get('file') as File;
    const contentTaskId = formData.get('contentTaskId') as string;

    if (!file) {
      return new Response(
        JSON.stringify({ error: 'No file provided' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log('[IMAGE_UPLOAD] Processing upload:', { 
      fileName: file.name, 
      fileSize: file.size, 
      fileType: file.type,
      contentTaskId 
    });

    // Validate file
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
    const maxSize = 10 * 1024 * 1024; // 10MB

    if (!allowedTypes.includes(file.type)) {
      return new Response(
        JSON.stringify({ error: 'Invalid file type. Please upload JPEG, PNG, WebP, or GIF.' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    if (file.size > maxSize) {
      return new Response(
        JSON.stringify({ error: 'File too large. Maximum size is 10MB.' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Generate unique filename
    const timestamp = Date.now();
    const fileExt = file.name.split('.').pop();
    const filename = `upload-${timestamp}-${Math.random().toString(36).substring(7)}.${fileExt}`;

    // Convert file to array buffer
    const fileBuffer = await file.arrayBuffer();

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabaseClient.storage
      .from('content-assets')
      .upload(filename, fileBuffer, {
        contentType: file.type,
        cacheControl: '3600',
        upsert: false
      });

    if (uploadError) {
      console.error('[IMAGE_UPLOAD] Upload error:', uploadError);
      throw uploadError;
    }

    // Get public URL
    const { data: urlData } = supabaseClient.storage
      .from('content-assets')
      .getPublicUrl(filename);

    const finalImageUrl = urlData.publicUrl;

    console.log('[IMAGE_UPLOAD] Upload successful:', { filename, finalImageUrl });

    // Update content_task if provided
    if (contentTaskId) {
      const { error: updateError } = await supabaseClient
        .from('content_tasks')
        .update({ 
          image_url: finalImageUrl,
          image_source: 'upload',
          status: 'review' // Set to review when image changes
        })
        .eq('id', contentTaskId);

      if (updateError) {
        console.error('[IMAGE_UPLOAD] Content task update error:', updateError);
        // Don't throw - the upload was successful
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
    console.error('[IMAGE_UPLOAD] Error:', error);
    
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