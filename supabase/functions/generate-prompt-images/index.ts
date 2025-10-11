// Force deployment v2.0 - Streamlined image generation with robust error handling
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders, handleCorsPrelight, corsJsonResponse } from "../_shared/cors.ts";

console.log('🚀 generate-prompt-images function loaded');

const UNSPLASH_ACCESS_KEY = Deno.env.get('UNSPLASH_ACCESS_KEY');
const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');

interface PromptImageRequest {
  prompt: string;
  maxImages?: number;
  orientation?: 'landscape' | 'portrait' | 'squarish';
}

serve(async (req) => {
  console.log('📨 Request received:', req.method, req.url);
  
  const corsResponse = handleCorsPrelight(req);
  if (corsResponse) {
    console.log('✅ CORS preflight handled');
    return corsResponse;
  }

  try {
    console.log('🔍 Processing request body...');
    const { prompt, maxImages = 4, orientation = 'squarish' }: PromptImageRequest = await req.json();

    if (!prompt || prompt.trim().length === 0) {
      return corsJsonResponse(
        { error: 'Prompt is required' },
        { status: 400 }
      );
    }

    console.log(`🎨 Generating images for prompt: "${prompt}"`);

    // Step 1: Generate simple visual keywords using OpenAI
    const keywordResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are an expert at generating simple, visual search keywords for stock photos. Return 3-5 short, descriptive keywords that would find relevant images on Unsplash. Return ONLY a JSON array of strings, nothing else.'
          },
          {
            role: 'user',
            content: `Generate 3-5 simple visual keywords for finding images about: "${prompt}"\n\nReturn format: ["keyword1", "keyword2", "keyword3"]`
          }
        ],
        temperature: 0.7,
        max_tokens: 100
      })
    });

    if (!keywordResponse.ok) {
      console.error('OpenAI API error:', await keywordResponse.text());
      throw new Error('Failed to generate keywords');
    }

    const keywordData = await keywordResponse.json();
    const keywordsText = keywordData.choices[0].message.content.trim();
    const keywords = JSON.parse(keywordsText) as string[];
    
    console.log('✅ Generated keywords:', keywords);

    // Step 2: Try each keyword until we find images
    let images: any[] = [];
    let usedQuery = '';
    let lastError = null;

    for (const keyword of keywords) {
      try {
        const unsplashUrl = new URL('https://api.unsplash.com/search/photos');
        unsplashUrl.searchParams.set('query', keyword);
        unsplashUrl.searchParams.set('per_page', maxImages.toString());
        unsplashUrl.searchParams.set('orientation', orientation);

        console.log(`🔍 Searching Unsplash with: "${keyword}"`);

        const unsplashResponse = await fetch(unsplashUrl.toString(), {
          headers: {
            'Authorization': `Client-ID ${UNSPLASH_ACCESS_KEY}`,
            'Accept-Version': 'v1'
          }
        });

        if (unsplashResponse.status === 403) {
          lastError = 'Rate limit exceeded. Please try again in a moment.';
          console.warn('⚠️ Unsplash rate limit hit');
          continue; // Try next keyword
        }

        if (!unsplashResponse.ok) {
          console.warn(`⚠️ Unsplash error for "${keyword}":`, unsplashResponse.status);
          continue;
        }

        const data = await unsplashResponse.json();
        
        if (data.results && data.results.length > 0) {
          images = data.results.map((photo: any) => ({
            id: photo.id,
            urls: {
              regular: photo.urls.regular,
              small: photo.urls.small,
              thumb: photo.urls.thumb
            },
            alt: photo.alt_description || photo.description || keyword,
            photographer: photo.user?.name || 'Unknown'
          }));
          
          usedQuery = keyword;
          console.log(`✅ Found ${images.length} images with: "${keyword}"`);
          break; // Success! Exit loop
        }
      } catch (error) {
        console.warn(`⚠️ Error with keyword "${keyword}":`, error);
        continue; // Try next keyword
      }
    }

    // If no images found after trying all keywords
    if (images.length === 0) {
      return corsJsonResponse(
        { 
          error: lastError || 'No images found',
          keywords,
          details: lastError ? 'Unsplash API rate limit exceeded' : 'Try a different prompt or wait a moment'
        },
        { status: lastError ? 429 : 404 }
      );
    }

    return corsJsonResponse({
      images,
      keywords,
      usedQuery,
      count: images.length
    });

  } catch (error) {
    console.error('❌ Error in generate-prompt-images:', error);
    return corsJsonResponse(
      { 
        error: 'Failed to generate images',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
});
