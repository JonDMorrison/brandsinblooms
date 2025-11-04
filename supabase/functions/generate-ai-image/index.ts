import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.10';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface GenerateImageRequest {
  contentContext: string;
  contentTitle?: string;
  channel: 'newsletter' | 'blog' | 'instagram' | 'facebook';
  uploadToStorage?: boolean;
  storageBucket?: string;
  userId?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    const body: GenerateImageRequest = await req.json();
    const {
      contentContext,
      contentTitle = '',
      channel = 'newsletter',
      uploadToStorage = true,
      storageBucket = 'campaign-images',
      userId = 'anonymous'
    } = body;

    if (!contentContext) {
      return new Response(
        JSON.stringify({ error: 'contentContext is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('🎨 Generating AI image:', {
      channel,
      contextLength: contentContext.length,
      title: contentTitle?.substring(0, 50)
    });

    // Step 1: Generate descriptive prompt based on content
    const imagePrompt = generateImagePrompt(contentContext, contentTitle, channel);
    console.log('📝 Generated prompt:', imagePrompt.substring(0, 200));

    // Step 2: Call Lovable AI Gateway for image generation
    const startTime = Date.now();
    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
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
            content: imagePrompt
          }
        ],
        modalities: ['image', 'text']
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('❌ Lovable AI error:', aiResponse.status, errorText);
      
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ 
            error: 'Rate limit exceeded', 
            message: 'Please try again in a moment.',
            retryable: true 
          }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ 
            error: 'Payment required', 
            message: 'Please add credits to your Lovable AI workspace.',
            retryable: false 
          }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      throw new Error(`Lovable AI error: ${aiResponse.status} - ${errorText}`);
    }

    const aiData = await aiResponse.json();
    const generationTime = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`⏱️ Image generated in ${generationTime}s`);

    // Extract base64 image from response
    const base64Image = extractBase64Image(aiData);
    if (!base64Image) {
      throw new Error('No image data in AI response');
    }

    console.log('✅ Received base64 image data:', base64Image.substring(0, 100));

    // Step 3: Upload to Supabase Storage if requested
    let finalImageUrl = base64Image;
    let storagePath: string | undefined;

    if (uploadToStorage) {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseServiceKey);

      // Convert base64 to binary
      const base64Data = base64Image.replace(/^data:image\/\w+;base64,/, '');
      const binaryData = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));

      // Generate unique filename
      const timestamp = Date.now();
      const randomId = crypto.randomUUID().substring(0, 8);
      const filename = `${timestamp}-${randomId}.png`;
      storagePath = `${userId}/${filename}`;

      console.log('📤 Uploading to storage:', storagePath);

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from(storageBucket)
        .upload(storagePath, binaryData, {
          contentType: 'image/png',
          upsert: false
        });

      if (uploadError) {
        console.error('❌ Storage upload error:', uploadError);
        // Don't fail the request, just return base64
        console.warn('⚠️ Falling back to base64 URL');
      } else {
        // Get public URL
        const { data: { publicUrl } } = supabase.storage
          .from(storageBucket)
          .getPublicUrl(storagePath);
        
        finalImageUrl = publicUrl;
        console.log('✅ Uploaded to:', publicUrl);
      }
    }

    // Step 4: Return result
    return new Response(
      JSON.stringify({
        imageUrl: finalImageUrl,
        imageId: crypto.randomUUID(),
        metadata: {
          generationTime: parseFloat(generationTime),
          prompt: imagePrompt.substring(0, 200),
          storagePath,
          channel
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Error in generate-ai-image:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Failed to generate image',
        retryable: true 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

/**
 * Generate detailed prompt for garden center imagery
 */
function generateImagePrompt(context: string, title: string, channel: string): string {
  // Extract garden-related keywords
  const gardenTerms = extractGardenTerms(context + ' ' + title);
  
  // Channel-specific style instructions
  const styleInstructions = {
    newsletter: 'Professional, clean garden center photography style. Well-lit, vibrant colors. Landscape format.',
    instagram: 'Eye-catching, lifestyle-focused garden photography. Warm tones, shallow depth of field. Square format.',
    facebook: 'Friendly, approachable garden imagery. Natural lighting, community feel. Landscape format.',
    blog: 'Educational, detailed garden imagery. Clear focus on subject matter. Landscape format.'
  };
  
  const style = styleInstructions[channel] || styleInstructions.newsletter;
  
  // Build comprehensive prompt
  return `Create a high-quality ${channel} marketing image featuring: ${gardenTerms.join(', ')}.

Style: ${style}
Setting: Garden center, retail nursery, or home garden setting.
Quality: Professional photography, sharp focus, vibrant natural colors.
Mood: Inviting, fresh, seasonal, inspiring.

Important: Show real plants, realistic garden scenes, no artificial or cartoon elements.
Focus on: ${title || gardenTerms[0] || 'beautiful garden plants'}

Generate a photorealistic image that would work well for a garden center marketing campaign.`;
}

/**
 * Extract garden-related keywords from content
 */
function extractGardenTerms(text: string): string[] {
  const gardenKeywords = [
    'hydrangea', 'rose', 'tomato', 'vegetable', 'flower', 'plant', 'garden',
    'soil', 'compost', 'mulch', 'pruning', 'watering', 'planting', 'growing',
    'spring', 'summer', 'fall', 'winter', 'seasonal', 'perennial', 'annual',
    'shrub', 'tree', 'herb', 'succulent', 'fern', 'grass', 'vine'
  ];
  
  const lowerText = text.toLowerCase();
  const found = gardenKeywords.filter(keyword => lowerText.includes(keyword));
  
  return found.length > 0 ? found : ['garden', 'plants', 'flowers'];
}

/**
 * Extract base64 image from AI response
 */
function extractBase64Image(aiData: any): string | null {
  try {
    console.log('🔍 Extracting image from AI response structure:', JSON.stringify(aiData).substring(0, 500));
    
    // Primary path: choices[0].message.images[0].image_url.url
    if (aiData.choices?.[0]?.message?.images?.[0]?.image_url?.url) {
      const imageUrl = aiData.choices[0].message.images[0].image_url.url;
      console.log('✅ Found image at choices[0].message.images[0].image_url.url');
      return imageUrl;
    }
    
    // Alternative: Check if content is a base64 string
    if (aiData.choices?.[0]?.message?.content) {
      const content = aiData.choices[0].message.content;
      
      if (typeof content === 'string' && content.startsWith('data:image')) {
        console.log('✅ Found image in message.content as base64');
        return content;
      }
      
      // Check if content has image data
      if (content.image_data) {
        console.log('✅ Found image in content.image_data');
        return content.image_data;
      }
    }
    
    // Check direct image field
    if (aiData.image) {
      console.log('✅ Found image in aiData.image');
      return aiData.image;
    }
    
    // Check data field
    if (aiData.data?.[0]) {
      console.log('✅ Found image in aiData.data[0]');
      return aiData.data[0];
    }
    
    console.error('❌ No image found in any expected location');
    console.error('Available keys:', Object.keys(aiData));
    return null;
  } catch (error) {
    console.error('Error extracting base64 image:', error);
    return null;
  }
}
