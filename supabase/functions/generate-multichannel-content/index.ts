import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

async function generateChannelContent(
  channel: string,
  topicTitle: string,
  topicDescription: string,
  companyContext: string
): Promise<any> {
  const systemPrompt = `You are an expert horticulturist and garden center educator creating ${channel} content that TEACHES customers practical gardening skills.

${channel === 'blog' ? `
⚠️⚠️⚠️ CRITICAL FOR BLOG CONTENT - MANDATORY HTML FORMAT ⚠️⚠️⚠️

YOU MUST FORMAT ALL BLOG CONTENT AS HTML. THIS IS NON-NEGOTIABLE.

REQUIRED HTML TAGS (use these and ONLY these):
- <h2>Heading Text</h2> for ALL section headings
- <p>Paragraph text here.</p> for ALL paragraphs  
- <ul><li>Item one</li><li>Item two</li></ul> for ALL lists
- <strong>emphasized text</strong> for emphasis

FORBIDDEN - WILL CAUSE ERRORS:
- ## Markdown headers (USE <h2> instead)
- Plain text paragraphs (USE <p> tags)
- - or * for lists (USE <ul><li> instead)
- ** or __ for bold (USE <strong> instead)

EXAMPLE CORRECT BLOG FORMAT:
<h2>How to Plant Tomatoes Successfully</h2>
<p>Tomatoes are one of the most rewarding vegetables to grow in your garden. Here's everything you need to know to ensure a bountiful harvest.</p>
<ul>
  <li>Choose a sunny location with at least 6-8 hours of direct sunlight</li>
  <li>Prepare soil with compost 2 weeks before planting</li>
  <li>Space plants 24-36 inches apart for proper air circulation</li>
</ul>
<p>Following these steps will give your tomatoes the best start possible.</p>

YOUR BLOG CONTENT MUST LOOK EXACTLY LIKE THIS EXAMPLE - ALL HTML TAGS, ZERO MARKDOWN.
` : ''}

🌱 EDUCATIONAL FOCUS - CRITICAL:
Every piece of content MUST include specific, actionable plant care guidance:

FOR SOCIAL MEDIA (Instagram/Facebook):
- Specific care instructions: watering schedules, fertilizing ratios, pruning techniques
- Measurements and timing: "Plant 18 inches apart", "Water twice weekly", "Deadhead every 3 days"
- Problem-solving: pest identification, disease prevention, troubleshooting tips
- Expert recommendations: varieties to try, tools to use, seasonal best practices
- Step-by-step how-to guidance when relevant

FOR BLOG POSTS:
⚠️ CRITICAL: BLOG CONTENT MUST BE FORMATTED AS HTML, NOT MARKDOWN ⚠️
- MANDATORY: Use <h2> for headings (NEVER use ## markdown syntax)
- MANDATORY: Use <p> for paragraphs (NEVER use plain text)
- MANDATORY: Use <ul><li> for lists (NEVER use - or * markdown syntax)
- MANDATORY: Use <strong> for emphasis (NEVER use ** or * markdown syntax)
- In-depth growing guides with complete care requirements
- Seasonal planning advice with specific timing windows
- Variety comparisons with pros/cons for each
- Problem-solving sections addressing common issues
- Expert tips and tricks from professional growers

BLOG HTML STRUCTURE EXAMPLE (COPY THIS FORMAT):
<h2>Section Heading Here</h2>
<p>Paragraph content goes here with detailed information.</p>
<ul>
  <li>List item one with specific details</li>
  <li>List item two with actionable steps</li>
</ul>

FOR NEWSLETTERS:
- Educational series teaching techniques progressively
- Seasonal checklists with specific tasks and timing
- Featured plant deep-dives with complete care guides
- Q&A sections addressing real customer problems

FOR VIDEO SCRIPTS:
- Visual demonstrations of techniques with clear narration
- Before/after examples showing results
- Common mistakes to avoid with explanations
- Step-by-step tutorials viewers can follow along

🎨 IMAGE QUERY GENERATION:
Generate a descriptive Unsplash search query (3-6 words) showing the SPECIFIC plant or technique.
Be highly specific: exact plant names, growth stages, seasons, colors, actions.

Examples:
- "heirloom tomato seedlings transplanting hands" (NOT "gardening")
- "purple dahlia deadheading pruning shears" (NOT "flowers")
- "autumn kale frost vegetable garden" (NOT "garden")
- "basil propagation cuttings water jar" (NOT "herbs")

CONTENT QUALITY STANDARDS:
- Prioritize education over promotion (80% teaching, 20% selling)
- Include "why" explanations (help customers understand the science)
- Use conversational but authoritative tone
- Make complex topics accessible to beginners
- Provide immediately actionable next steps`;
  
  const userPrompt = `Create ${channel} content for: "${topicTitle}"
Description: ${topicDescription}
Company Context: ${companyContext}

CRITICAL: This content MUST teach customers specific gardening skills and plant care techniques.
Include exact measurements, timing windows, step-by-step instructions, and problem-solving advice.
Think like a master gardener teaching their apprentice.
Make it so valuable that customers will reference it repeatedly.

Generate educational content that empowers garden center customers to succeed.`;

  console.log(`🤖 Generating ${channel} content for: ${topicTitle}`);
  
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openAIApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      temperature: 0.7,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      tools: [{
        type: "function",
        function: {
          name: "generate_marketing_content",
          description: `Generate ${channel} content with image query`,
          parameters: {
            type: "object",
            properties: {
              title: {
                type: "string",
                description: "Engaging title for the content"
              },
              content: {
                type: "string",
                description: "Main content (500-800 chars for social, 1500-2000 for blog/newsletter)"
              },
              caption: {
                type: "string",
                description: "Short compelling hook (100-150 chars)"
              },
              hashtags: {
                type: "array",
                items: { type: "string" },
                description: "Array of relevant hashtags"
              },
              imageQuery: {
                type: "string",
                description: "Garden-focused Unsplash search query (3-5 words, MUST include garden context)"
              },
              cta: {
                type: "string",
                description: "Call to action"
              }
            },
            required: ["title", "content", "caption", "hashtags", "imageQuery", "cta"],
            additionalProperties: false
          }
        }
      }],
      tool_choice: { 
        type: "function", 
        function: { name: "generate_marketing_content" } 
      }
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`❌ AI API error for ${channel}:`, response.status, errorText);
    throw new Error(`AI API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  
  const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
  
  if (!toolCall?.function?.arguments) {
    console.error('❌ No structured output from AI:', JSON.stringify(data, null, 2));
    throw new Error('AI did not return structured output');
  }

  const result = JSON.parse(toolCall.function.arguments);
  
  // Use OpenAI's image query directly
  const imageQuery = result.imageQuery || 'garden center seasonal plants';
  
  console.log(`✅ Generated ${channel} content with imageQuery: "${imageQuery}"`);
  
  return {
    title: result.title,
    content: result.content,
    caption: result.caption,
    hashtags: result.hashtags || [],
    imageQuery: imageQuery,
    cta: result.cta
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Force redeployment - v2.0.0 with userId auth fix
  const FUNCTION_VERSION = '2.0.0';
  console.log(`🚀 Edge function started - v${FUNCTION_VERSION}`);
  console.log(`📋 Configuration check:`, {
    hasOpenAIApiKey: !!Deno.env.get('OPENAI_API_KEY'),
    hasSupabaseUrl: !!Deno.env.get('SUPABASE_URL'),
    timestamp: new Date().toISOString()
  });

  // ✅ Phase 1: Declare variables at function scope with default values
  let mode: string = 'unknown';
  let sourceId: string = 'unknown';
  let topicTitle: string = 'Unknown Topic';
  let topicDescription: string = '';
  let channels: string[] = [];
  let workspaceId: string = '';
  let userId: string = '';

  try {
    const body = await req.json();
    console.log('📨 Request body:', JSON.stringify(body, null, 2));

    // ✅ Assign the actual values from request body
    ({ mode, sourceId, workspaceId, channels, topicTitle, topicDescription, userId } = body);

    // ✅ Phase 2: Validate required fields
    if (!userId) {
      throw new Error('userId is required in request body');
    }
    if (!workspaceId) {
      throw new Error('workspaceId is required in request body');
    }

    if (!openAIApiKey) {
      throw new Error('OPENAI_API_KEY not configured');
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get company context from workspace
    const { data: companyProfile } = await supabase
      .from('company_profiles')
      .select('company_name, about_business, brand_voice')
      .eq('user_id', workspaceId)
      .single();

    const companyContext = companyProfile 
      ? `${companyProfile.company_name || ''} - ${companyProfile.about_business || ''}`
      : 'Garden center business';

    console.log(`🎯 Generating content for ${channels.length} channels`);

    // Generate content for each channel in parallel
    const contentPromises = channels.map(async (channel: string) => {
      try {
        const generatedContent = await generateChannelContent(
          channel,
          topicTitle,
          topicDescription,
          companyContext
        );

        return {
          type: channel,
          items: [{
            week: 1,
            title: generatedContent.title,
            content: generatedContent.content,
            caption: generatedContent.caption,
            hashtags: generatedContent.hashtags || [],
            imageQuery: generatedContent.imageQuery,
            cta: generatedContent.cta,
            themeId: sourceId,
            themeName: topicTitle,
            dayOfWeek: 1
          }]
        };
      } catch (error) {
        console.error(`❌ Failed to generate ${channel} content:`, error);
        throw error;
      }
    });

    const content = await Promise.all(contentPromises);
    
    console.log(`✅ Generated ${content.length} pieces of content`);

    // Generate bundle ID and save to database
    const bundleId = crypto.randomUUID();
    
    // ========== PHASE 2: FETCH IMAGES FOR THE BUNDLE ==========
    console.log('🖼️ Starting image fetch for bundle content...');
    
    // Collect all unique image queries from generated content
    const imageQueries = content.flatMap((channelContent: any) => 
      channelContent.items
        .filter((item: any) => item.imageQuery)
        .map((item: any) => item.imageQuery)
    );
    
    const uniqueQueries = [...new Set(imageQueries)];
    console.log(`🔍 Found ${uniqueQueries.length} unique image queries:`, uniqueQueries);
    
    let fetchedImages: any[] = [];
    
    // Fetch images for the most relevant query (usually the first one)
    if (uniqueQueries.length > 0) {
      try {
        const primaryQuery = uniqueQueries[0];
        console.log(`📸 Fetching images for: "${primaryQuery}"`);
        
        const imageResponse = await supabase.functions.invoke('fetch-unsplash-images', {
          body: { 
            query: primaryQuery,
            maxImages: 12,
            orientation: 'squarish',
            rawQuery: true  // Trust OpenAI's query
          }
        });
        
        if (imageResponse.error) {
          console.error('❌ Image fetch error:', imageResponse.error);
        } else if (imageResponse.data?.images) {
          fetchedImages = imageResponse.data.images;
          console.log(`✅ Fetched ${fetchedImages.length} images from Unsplash`);
        } else {
          console.warn('⚠️ No images returned from fetch function');
        }
      } catch (imageError) {
        console.error('❌ Exception fetching images:', imageError);
      }
    } else {
      console.warn('⚠️ No image queries found in generated content');
    }
    
    // Format images for bundle storage
    const formattedImages = fetchedImages.map((img: any) => ({
      url: img.urls?.regular || img.url,
      thumb: img.urls?.thumb || img.urls?.small || img.url,
      alt: img.alt || img.alt_description || topicTitle,
      photographer: img.photographer || img.user?.name || 'Unknown',
      photographerUrl: img.photographer_url || img.user?.links?.html,
      unsplashId: img.unsplash_id || img.id
    }));
    
    console.log('🖼️ Image fetch summary:', {
      queriesFound: uniqueQueries.length,
      imagesFetched: fetchedImages.length,
      imagesFormatted: formattedImages.length,
      firstImageUrl: formattedImages[0]?.url || null
    });
    
    // Helper function to convert markdown to HTML for blog content
    const markdownToHtml = (text: string): string => {
      if (!text) return text;
      
      // Convert headers (## to <h2>, ### to <h3>)
      let html = text.replace(/^### (.+)$/gm, '<h3>$1</h3>');
      html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
      html = html.replace(/^# (.+)$/gm, '<h2>$1</h2>');
      
      // Convert bold (**text** or __text__ to <strong>)
      html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
      html = html.replace(/__(.+?)__/g, '<strong>$1</strong>');
      
      // Convert italic (*text* or _text_ to <em>)
      html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
      html = html.replace(/_([^_]+)_/g, '<em>$1</em>');
      
      // Convert unordered lists (- or * to <ul><li>)
      html = html.replace(/^[*-]\s+(.+)$/gm, '<li>$1</li>');
      html = html.replace(/(<li>.*<\/li>\n?)+/g, (match) => `<ul>\n${match}</ul>\n`);
      
      // Convert numbered lists (1. to <ol><li>)
      html = html.replace(/^\d+\.\s+(.+)$/gm, '<li>$1</li>');
      html = html.replace(/(<li>.*<\/li>\n?)+/g, (match) => {
        // Check if this is part of unordered list
        if (match.includes('<ul>')) return match;
        return `<ol>\n${match}</ol>\n`;
      });
      
      // Convert paragraphs (text not already in tags)
      const lines = html.split('\n');
      const processed = lines.map(line => {
        const trimmed = line.trim();
        // Skip if empty or already has HTML tags
        if (!trimmed || trimmed.startsWith('<') || trimmed.endsWith('>')) {
          return line;
        }
        return `<p>${trimmed}</p>`;
      });
      
      return processed.join('\n');
    };
    
    // Transform content into GeneratedBundle format
    const bundleContent = {
      id: bundleId,
      mode: mode || 'event',                    // ✅ Root level for view compatibility
      sourceId: sourceId || '',
      sourceLabel: topicTitle || 'Untitled Content',  // ✅ Root level for view
      channels: channels || [],                 // ✅ Root level for view
      items: content.flatMap((channelContent: any) => 
        channelContent.items.map((item: any) => {
          // For blog content, ensure HTML format
          let bodyContent = item.content;
          if (channelContent.type === 'blog') {
            // Check if content contains markdown syntax
            const hasMarkdown = /^#+\s|^\s*[-*+]\s|\*\*|\*[^*]|__/m.test(bodyContent);
            if (hasMarkdown) {
              console.log('🔄 Converting markdown to HTML for blog content');
              bodyContent = markdownToHtml(bodyContent);
            }
            // Ensure content has basic HTML structure if missing
            if (!bodyContent.includes('<h2>') && !bodyContent.includes('<p>')) {
              console.warn('⚠️ Blog content missing HTML tags, converting...');
              bodyContent = markdownToHtml(bodyContent);
            }
          }
          
          return {
            channel: channelContent.type,
            title: item.title,
            body: bodyContent,
            caption: item.caption,
            summary: item.caption,
            hashtags: item.hashtags || [],
            ctaSuggestions: [item.cta],
            media: item.imageQuery ? { 
              alt: item.imageQuery,
              url: null 
            } : null,
            _approved: false
          };
        })
      ),
      recommendedImages: formattedImages,  // ✅ Store fetched images
      thumbnail: formattedImages.length > 0 ? formattedImages[0].url : null,  // ✅ Add thumbnail
      meta: {
        mode: mode as 'event' | 'seasonal' | 'custom',
        sourceId: sourceId,
        sourceLabel: topicTitle,
        topicDescription: topicDescription
      }
    };

    // ✅ Phase 3: Validate bundle structure before saving
    console.log('🔍 Validating bundle structure:', {
      hasId: !!bundleContent.id,
      hasMode: !!bundleContent.mode,
      hasSourceLabel: !!bundleContent.sourceLabel,
      hasChannels: Array.isArray(bundleContent.channels) && bundleContent.channels.length > 0,
      hasItems: Array.isArray(bundleContent.items) && bundleContent.items.length > 0,
      hasThumbnail: !!bundleContent.thumbnail,
      recommendedImagesCount: bundleContent.recommendedImages?.length || 0
    });

    if (!bundleContent.mode || !bundleContent.sourceLabel || !Array.isArray(bundleContent.channels)) {
      console.error('❌ Invalid bundle structure:', bundleContent);
      throw new Error('Bundle missing required metadata fields');
    }
    
    // Warn if images are missing but don't block save
    if (!bundleContent.thumbnail) {
      console.warn('⚠️ Bundle has no thumbnail - images may not have been fetched successfully');
    }
    if (!bundleContent.recommendedImages || bundleContent.recommendedImages.length === 0) {
      console.warn('⚠️ Bundle has no recommendedImages - check image fetch logic');
    }

    console.log(`📦 Saving bundle to database: ${bundleId}`);

    // ✅ Phase 2: Use the provided userId directly (no auth.getUser() needed)
    console.log(`🔐 Using provided user ID: ${userId}`);

    const { data: userTenant, error: tenantError } = await supabase
      .from('users')
      .select('tenant_id')
      .eq('id', userId)
      .single();

    if (tenantError || !userTenant?.tenant_id) {
      console.error('❌ Tenant lookup error:', tenantError);
      throw new Error(`User tenant not found for user ${userId}: ${tenantError?.message || 'Unknown'}`);
    }

    const tenantId = userTenant.tenant_id;
    console.log(`✅ User authenticated: ${userId}, Tenant: ${tenantId}`);

    // Insert directly into draft_snapshots
    const { data: newSnapshot, error: insertError } = await supabase
      .from('draft_snapshots')
      .insert({
        user_id: userId,  // ✅ Use the provided userId
        tenant_id: tenantId,
        doc_type: 'content_bundle',
        doc_id: bundleId,
        version: 1,
        content: bundleContent
      })
      .select('id')
      .single();

    if (insertError || !newSnapshot) {
      console.error('❌ Failed to save bundle to database:', insertError);
      throw new Error(`Database save failed: ${insertError?.message || 'Unknown error'}`);
    }

    const snapshotId = newSnapshot.id;
    console.log(`✅ Bundle saved successfully: ${bundleId}, snapshot: ${snapshotId}`);

    // Return proper response with id, snapshotId, and content
    return new Response(
      JSON.stringify({ 
        id: bundleId,
        snapshotId: snapshotId,
        content: bundleContent
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('❌ Generation error:', {
      message: error.message,
      stack: error.stack,
      name: error.name,
      mode,
      sourceId,
      topicTitle,
      channels
    });
    
    // Return detailed error for debugging
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Failed to generate content',
        details: {
          step: error.step || 'unknown',
          mode,
          topicTitle
        }
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
