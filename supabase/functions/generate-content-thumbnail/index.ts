import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!openAIApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const { bundleId, content, mode, title } = await req.json();
    
    console.log(`[generate-content-thumbnail] Generating thumbnail for bundle ${bundleId}`);

    // Create descriptive prompt based on content
    const contentPreview = content?.items?.[0]?.body || content?.items?.[0]?.caption || title || '';
    const contentType = mode === 'seasonal' ? 'seasonal garden content' : 
                       mode === 'holiday' ? 'holiday celebration' : 'garden center content';
    
    const prompt = `Create a beautiful, professional thumbnail image for ${contentType}. 
    Style: Clean, modern design with vibrant colors that would appeal to garden center customers.
    Theme: ${contentPreview.substring(0, 200)}
    
    Requirements:
    - High-quality, professional photography style
    - Bright, appealing colors suitable for marketing
    - Garden/plant-themed with modern aesthetic
    - 16:9 aspect ratio, social media ready
    - No text overlays needed
    - Ultra high resolution`;

    console.log(`[generate-content-thumbnail] Using prompt: ${prompt.substring(0, 100)}...`);

    // Generate image with OpenAI
    const imageResponse = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'dall-e-3',
        prompt: prompt,
        n: 1,
        size: '1792x1024', // 16:9 aspect ratio
        quality: 'hd',
        style: 'vivid'
      }),
    });

    if (!imageResponse.ok) {
      const errorData = await imageResponse.text();
      console.error(`[generate-content-thumbnail] OpenAI API error:`, errorData);
      throw new Error(`OpenAI API error: ${imageResponse.status} - ${errorData}`);
    }

    const imageData = await imageResponse.json();
    const imageUrl = imageData.data[0].url;

    console.log(`[generate-content-thumbnail] Generated image URL: ${imageUrl}`);

    // Download the image
    const imageDownloadResponse = await fetch(imageUrl);
    if (!imageDownloadResponse.ok) {
      throw new Error(`Failed to download generated image: ${imageDownloadResponse.status}`);
    }

    const imageBuffer = await imageDownloadResponse.arrayBuffer();
    const imageFile = new Uint8Array(imageBuffer);

    // Upload to Supabase Storage
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
    const fileName = `${bundleId}-thumbnail-${Date.now()}.png`;
    const filePath = `thumbnails/${fileName}`;

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('content-thumbnails')
      .upload(filePath, imageFile, {
        contentType: 'image/png',
        upsert: false
      });

    if (uploadError) {
      console.error(`[generate-content-thumbnail] Upload error:`, uploadError);
      throw new Error(`Failed to upload thumbnail: ${uploadError.message}`);
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('content-thumbnails')
      .getPublicUrl(filePath);

    console.log(`[generate-content-thumbnail] Thumbnail uploaded successfully: ${publicUrl}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        thumbnailUrl: publicUrl,
        fileName: fileName 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[generate-content-thumbnail] Error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Failed to generate thumbnail', 
        details: error.message 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
        status: 500 
      }
    );
  }
});