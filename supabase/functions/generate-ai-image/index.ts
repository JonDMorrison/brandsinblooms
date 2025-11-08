import "https://deno.land/x/xhr@0.1.0/mod.ts";
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

// Active request deduplication cache
const activeRequests = new Map<string, Promise<any>>();

// Sanitize string to only contain Latin1 characters (code points 0-255)
function sanitizeLatin1(input: string): string {
  return input
    .split('')
    .filter(char => char.charCodeAt(0) <= 255)
    .join('');
}

// Cache key generation for deduplication
function getCacheKey(contentContext: string, channel: string): string {
  const hash = contentContext.substring(0, 100) + channel;
  // Sanitize to Latin1 before encoding
  const sanitizedHash = sanitizeLatin1(hash);
  // Now btoa() will work without errors
  return btoa(sanitizedHash).substring(0, 32);
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

    // Check for duplicate request
    const cacheKey = getCacheKey(contentContext, channel);
    if (activeRequests.has(cacheKey)) {
      console.log('🔄 Duplicate request detected, reusing in-progress generation');
      try {
        const result = await activeRequests.get(cacheKey);
        return new Response(JSON.stringify(result), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      } catch (error) {
        activeRequests.delete(cacheKey);
      }
    }

    // Generate enhanced prompt
    const imagePrompt = generateImagePrompt(contentContext, contentTitle, channel);
    console.log('📝 Generated prompt:', imagePrompt.substring(0, 200));

    // Create generation promise and cache it
    const generationPromise = (async () => {
      try {
        const startTime = Date.now();
        
        // Call AI with retry logic
        const aiData = await generateWithRetry(imagePrompt, LOVABLE_API_KEY);
        
        const generationTime = ((Date.now() - startTime) / 1000).toFixed(2);
        console.log(`⏱️ Image generated in ${generationTime}s`);

        // Extract base64 image
        const base64Image = extractBase64Image(aiData);
        if (!base64Image) {
          throw new Error('No image data in AI response');
        }

        console.log('✅ Received base64 image data');

        // Upload to storage if requested
        let finalImageUrl = base64Image;
        let storagePath: string | undefined;

        if (uploadToStorage) {
          try {
            const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
            const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
            const supabase = createClient(supabaseUrl, supabaseServiceKey);

            const base64Data = base64Image.replace(/^data:image\/\w+;base64,/, '');
            const binaryData = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));

            const timestamp = Date.now();
            const randomId = crypto.randomUUID().substring(0, 8);
            const filename = `${timestamp}-${randomId}.png`;
            storagePath = `${userId}/${filename}`;

            console.log('📤 Uploading to storage:', storagePath);

            // Retry upload with exponential backoff
            let uploadSuccess = false;
            let lastError: Error | null = null;
            
            for (let attempt = 0; attempt < 3; attempt++) {
              try {
                const { error: uploadError } = await supabase.storage
                  .from(storageBucket)
                  .upload(storagePath, binaryData, {
                    contentType: 'image/png',
                    upsert: false
                  });

                if (uploadError) {
                  throw uploadError;
                }

                // Successfully uploaded, get public URL
                const { data: { publicUrl } } = supabase.storage
                  .from(storageBucket)
                  .getPublicUrl(storagePath);
                
                finalImageUrl = publicUrl;
                uploadSuccess = true;
                console.log('✅ Uploaded to:', publicUrl);
                break;
              } catch (uploadErr: any) {
                lastError = uploadErr;
                console.warn(`⚠️ Upload attempt ${attempt + 1} failed:`, uploadErr.message);
                
                if (attempt < 2) {
                  // Exponential backoff: 1s, 2s
                  const delay = Math.pow(2, attempt) * 1000;
                  await new Promise(resolve => setTimeout(resolve, delay));
                }
              }
            }

            // If upload failed after retries, log but don't fail the request
            if (!uploadSuccess) {
              console.error('❌ Storage upload failed after 3 attempts:', lastError?.message);
              console.log('⚠️ Returning base64 image as fallback');
              // finalImageUrl remains as base64Image
            }
          } catch (storageError: any) {
            // Catch any unexpected errors in storage setup
            console.error('❌ Storage operation error:', storageError.message);
            console.log('⚠️ Returning base64 image as fallback');
            // finalImageUrl remains as base64Image
          }
        }

        return {
          imageUrl: finalImageUrl,
          imageId: crypto.randomUUID(),
          metadata: {
            generationTime: parseFloat(generationTime),
            prompt: contentTitle || 'AI Generated',
            storagePath,
            channel
          }
        };
      } finally {
        setTimeout(() => activeRequests.delete(cacheKey), 60000);
      }
    })();

    activeRequests.set(cacheKey, generationPromise);
    const result = await generationPromise;

    return new Response(
      JSON.stringify(result),
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

async function generateWithRetry(prompt: string, apiKey: string, maxRetries = 2): Promise<any> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash-image-preview',
          messages: [{ role: 'user', content: prompt }],
          modalities: ['image', 'text']
        }),
      });

      if (response.status === 429 && attempt < maxRetries - 1) {
        const retryAfter = parseInt(response.headers.get('retry-after') || '5');
        console.log(`⏳ Rate limited, waiting ${retryAfter}s...`);
        await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
        continue;
      }

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`AI Gateway error: ${response.status} - ${errorText}`);
      }

      return await response.json();
    } catch (error) {
      if (attempt === maxRetries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
}

function generateImagePrompt(context: string, title: string, channel: string): string {
  const channelSpecs: Record<string, string> = {
    newsletter: 'Professional, clean photography. Landscape 16:9.',
    instagram: 'Vibrant, eye-catching square image. 1:1 aspect ratio.',
    facebook: 'Engaging, shareable landscape format.',
    blog: 'High-quality, informative landscape format.'
  };

  return `Create a high-quality, photorealistic image for a garden center marketing campaign.

Content Context: "${context}"
Title: "${title}"

Channel: ${channel}
Specifications: ${channelSpecs[channel] || channelSpecs.newsletter}

Visual Requirements:
- Professional garden center or nursery setting
- Vibrant, healthy plants and natural colors
- Bright, natural lighting
- Sharp focus on main subject
- Welcoming, inspiring mood

Style: Photorealistic, high-quality garden photography suitable for professional marketing materials.

DO NOT include: Text overlays, logos, brand names, watermarks, or any written text.

Generate an image that perfectly captures the essence of this content for a garden center's ${channel} campaign.`;
}

function extractBase64Image(aiData: any): string | null {
  try {
    if (aiData.choices?.[0]?.message?.images?.[0]?.image_url?.url) {
      return aiData.choices[0].message.images[0].image_url.url;
    }
    if (aiData.choices?.[0]?.message?.content) {
      const content = aiData.choices[0].message.content;
      if (typeof content === 'string' && content.startsWith('data:image')) {
        return content;
      }
    }
    return null;
  } catch (error) {
    console.error('Error extracting image:', error);
    return null;
  }
}
