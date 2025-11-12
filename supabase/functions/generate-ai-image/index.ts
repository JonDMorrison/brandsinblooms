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

interface GenerateImageResponse {
  imageUrl: string;
  imageId: string;
  globalImageId?: string;
  metadata: {
    generationTime: number;
    prompt: string;
    storagePath?: string;
    channel: string;
    tags?: any[];
  };
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

  // Set up abort signal with timeout (increased to 120s)
  const controller = new AbortController();
  const timeout = setTimeout(() => {
    console.error('⏱️ Function timeout after 120 seconds');
    controller.abort();
  }, 120000); // 120 second timeout

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

    console.log('🎨 [AI Image Generator] Starting generation:', {
      channel,
      contextLength: contentContext.length,
      title: contentTitle?.substring(0, 50),
      uploadToStorage
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
        
        // Call AI with retry logic and timeout
        const aiData = await Promise.race([
          generateWithRetry(imagePrompt, LOVABLE_API_KEY),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('AI generation timeout after 20s')), 20000)
          )
        ]);
        
        const generationTime = ((Date.now() - startTime) / 1000).toFixed(2);
        console.log(`⏱️ Image generated in ${generationTime}s`);

        // Extract base64 image
        const base64Image = extractBase64Image(aiData);
        if (!base64Image) {
          throw new Error('No image data in AI response');
        }

        console.log('✅ Received base64 image data', {
          sizeKB: Math.round(base64Image.length / 1024)
        });

        // Upload to CENTRAL storage ONLY
        let finalImageUrl = base64Image;
        let storagePath: string | undefined;
        let globalImageId: string | undefined;
        let generatedTags: any[] = [];

        if (uploadToStorage) {
          try {
            const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
            const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
            const supabase = createClient(supabaseUrl, supabaseServiceKey);

            // Convert base64 to binary with memory optimization
            const base64Data = base64Image.replace(/^data:image\/\w+;base64,/, '');
            let binaryData: Uint8Array;
            
            try {
              binaryData = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
              console.log('✅ Base64 converted to binary:', {
                sizeKB: Math.round(binaryData.length / 1024),
                sizeMB: (binaryData.length / (1024 * 1024)).toFixed(2)
              });
            } catch (conversionError) {
              console.error('❌ Base64 conversion failed:', conversionError);
              throw new Error('Failed to convert base64 image data');
            }

            // Generate UUID-based filename for central storage
            const imageUuid = crypto.randomUUID();
            const filename = `${imageUuid}.png`;
            storagePath = `global/${filename}`;

            console.log('📤 Uploading to CENTRAL storage:', storagePath);

            // Upload to global-ai-images bucket
            const { error: uploadError } = await supabase.storage
              .from('global-ai-images')
              .upload(storagePath, binaryData, {
                contentType: 'image/png',
                upsert: false
              });

            if (uploadError) {
              throw uploadError;
            }

            // Get public URL
            const { data: { publicUrl } } = supabase.storage
              .from('global-ai-images')
              .getPublicUrl(storagePath);
            
            finalImageUrl = publicUrl;
            console.log('✅ Uploaded to CENTRAL storage successfully:', {
              uuid: imageUuid,
              bucket: 'global-ai-images',
              path: storagePath,
              url: publicUrl,
              size_kb: Math.round(binaryData.length / 1024)
            });

            // Generate tags asynchronously (fire-and-forget to prevent blocking)
            console.log('🏷️ [Tag Generation] Starting async tag generation...');
            const tags: any[] = [];
            generatedTags = tags;  // Initialize empty for immediate return
            
            // Fire-and-forget tag generation - don't wait for it
            (async () => {
              const tagStartTime = Date.now();
              try {
                const tagResult = await Promise.race([
                  supabase.functions.invoke('generate-image-tags', {
                    body: { contentContext, contentTitle, channel }
                  }),
                  new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Tag generation timeout after 30s')), 30000)
                  )
                ]) as any;
                
                const tagDuration = ((Date.now() - tagStartTime) / 1000).toFixed(2);
                
                if (tagResult.error) {
                  console.error(`❌ [Tag Generation] Failed after ${tagDuration}s:`, {
                    error: tagResult.error.message || tagResult.error,
                    code: tagResult.error.code
                  });
                  return;
                }
                
                const generatedTags = (tagResult.data?.tags || []) as any[];
                console.log(`✅ [Tag Generation] Completed in ${tagDuration}s:`, {
                  tagCount: generatedTags.length,
                  samples: generatedTags.slice(0, 5).map((t: any) => `${t.name}(${t.category})`)
                });
                
                // Insert tags if we have a globalImageId and tags
                if (globalImageId && generatedTags.length > 0) {
                  const tagInserts = generatedTags.map((tag: any) => ({
                    image_id: globalImageId,
                    tag_name: tag.name,
                    tag_category: tag.category,
                    confidence_score: tag.confidence,
                    generated_by: 'openai'
                  }));

                  const { data: insertedTags, error: tagsInsertError } = await supabase
                    .from('global_image_tags')
                    .insert(tagInserts)
                    .select('id, tag_name');

                  if (tagsInsertError) {
                    console.error('❌ [Tag Generation] DB insert failed:', tagsInsertError.message);
                  } else {
                    console.log(`✅ [Tag Generation] Inserted ${insertedTags?.length} tags to DB`);
                  }
                }
              } catch (tagError: any) {
                const tagDuration = ((Date.now() - tagStartTime) / 1000).toFixed(2);
                console.error(`⚠️ [Tag Generation] Exception after ${tagDuration}s:`, {
                  message: tagError.message,
                  name: tagError.name
                });
              }
            })();
            // Insert into global_image_gallery immediately
            const { data: imageRecord, error: insertError } = await supabase
              .from('global_image_gallery')
              .insert({
                storage_path: storagePath,
                storage_bucket: 'global-ai-images',
                public_url: finalImageUrl,
                generation_prompt: imagePrompt,
                content_context: contentContext,
                content_title: contentTitle,
                channel: channel,
                file_size_bytes: binaryData.length,
                mime_type: 'image/png',
                generation_model: 'google/gemini-2.5-flash-image-preview'
              })
              .select('id')
              .single();

            if (insertError) {
              console.error('❌ [Database] Failed to insert into global_image_gallery:', {
                error: insertError.message,
                code: insertError.code,
                details: insertError.details
              });
            } else {
              globalImageId = imageRecord.id;
              console.log('✅ [Database] Image record created in global_image_gallery:', {
                globalImageId,
                storagePath,
                channel
              });

              // Tags will be inserted asynchronously - don't wait
              console.log('🏷️ [Tag Generation] Tag insertion will complete in background');
              
              // Final success summary
              console.log('🎯 ═══════════════════════════════════════════════════');
              console.log('🎯 CENTRALIZED STORAGE SUCCESS');
              console.log('🎯 ═══════════════════════════════════════════════════');
              console.log('🆔 Global Image ID:', globalImageId);
              console.log('📦 Storage Path:', storagePath);
              console.log('🔗 Public URL:', finalImageUrl);
              console.log('📺 Channel:', channel);
              console.log('🏷️ Tags: Generating in background');
              console.log('⏱️ Timestamp:', new Date().toISOString());
              console.log('🎯 ═══════════════════════════════════════════════════');
            }
          } catch (storageError: any) {
            console.error('❌ [CRITICAL] Central storage pipeline failed:', {
              error: storageError.message,
              stack: storageError.stack
            });
            console.log('⚠️ Returning base64 image as fallback');
          }
        }

        return {
          imageUrl: finalImageUrl,
          imageId: crypto.randomUUID(),
          globalImageId: globalImageId,
          metadata: {
            generationTime: parseFloat(generationTime),
            prompt: contentTitle || 'AI Generated',
            storagePath,
            channel,
            tags: generatedTags
          }
        };
      } finally {
        setTimeout(() => activeRequests.delete(cacheKey), 60000);
      }
    })();

    activeRequests.set(cacheKey, generationPromise);
    const result = await generationPromise;
    
    clearTimeout(timeout);

    return new Response(
      JSON.stringify(result),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json',
          'Connection': 'keep-alive'
        } 
      }
    );

  } catch (error) {
    clearTimeout(timeout);
    console.error('❌ Error in generate-ai-image:', {
      message: error.message,
      name: error.name,
      stack: error.stack?.substring(0, 200)
    });
    
    const isTimeout = error.message?.includes('timeout') || error.name === 'AbortError';
    const statusCode = isTimeout ? 408 : 500;
    
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Failed to generate image',
        type: isTimeout ? 'timeout' : 'error',
        retryable: true 
      }),
      { 
        status: statusCode, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});

async function generateWithRetry(prompt: string, apiKey: string, maxRetries = 2): Promise<any> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      console.log(`🔄 AI generation attempt ${attempt + 1}/${maxRetries}`);
      
      const controller = new AbortController();
      const fetchTimeout = setTimeout(() => controller.abort(), 18000); // 18s timeout per attempt
      
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
        signal: controller.signal
      });
      
      clearTimeout(fetchTimeout);

      if (response.status === 429 && attempt < maxRetries - 1) {
        const retryAfter = parseInt(response.headers.get('retry-after') || '5');
        console.log(`⏳ Rate limited, waiting ${retryAfter}s...`);
        await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
        continue;
      }

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`AI Gateway error: ${response.status} - ${errorText.substring(0, 200)}`);
      }

      return await response.json();
    } catch (error) {
      console.error(`❌ Attempt ${attempt + 1} failed:`, error.message);
      if (attempt === maxRetries - 1) throw error;
      
      // Exponential backoff
      const backoffMs = 2000 * Math.pow(2, attempt);
      console.log(`⏳ Retrying in ${backoffMs}ms...`);
      await new Promise(resolve => setTimeout(resolve, backoffMs));
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
