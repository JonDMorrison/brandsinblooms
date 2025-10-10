import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

// Strip HTML tags to plain text for social media
function stripHtmlToPlainText(text: string): string {
  if (!text) return text;
  
  return text
    // Convert headers to plain text with line breaks
    .replace(/<h[1-6]>(.+?)<\/h[1-6]>/gi, '\n$1\n')
    // Convert list items to bullets before stripping tags
    .replace(/<li>(.+?)<\/li>/gi, '• $1\n')
    // Convert paragraph breaks
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<p>/gi, '')
    // Convert line breaks
    .replace(/<br\s*\/?>/gi, '\n')
    // Strip <strong>, <em>, <b>, <i> but keep text
    .replace(/<\/?strong>/gi, '')
    .replace(/<\/?em>/gi, '')
    .replace(/<\/?b>/gi, '')
    .replace(/<\/?i>/gi, '')
    // Remove remaining HTML tags
    .replace(/<[^>]+>/g, '')
    // Decode HTML entities
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    // Clean up excessive whitespace
    .replace(/\n{3,}/g, '\n\n')
    .replace(/  +/g, ' ')
    .trim();
}

// Strip markdown formatting for social media
function stripMarkdownForSocial(text: string): string {
  if (!text) return text;
  
  return text
    // Bold-italic: ***text*** -> text (must come first)
    .replace(/\*\*\*([^*]+)\*\*\*/g, '$1')
    // Bold: **text** or __text__ -> text
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    // Italic: *text* or _text_ -> text
    .replace(/\*([^*\n]+)\*/g, '$1')
    .replace(/(?<!https?:\/\/[^\s]*)_([^_]+)_/g, '$1')
    // Strikethrough: ~~text~~ -> text
    .replace(/~~([^~]+)~~/g, '$1')
    // Code: `text` -> text
    .replace(/`([^`]+)`/g, '$1')
    // Links: [text](url) -> text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    // Headers: ## text -> text
    .replace(/^#{1,6}\s+/gm, '')
    // Convert bullet * to bullet point
    .replace(/^(\s*)\*\s+/gm, '$1• ')
    // Clean up multiple spaces and trim
    .replace(/\s+/g, ' ')
    .trim();
}

async function generateChannelContent(
  channel: string,
  topicTitle: string,
  topicDescription: string,
  companyContext: string
): Promise<any> {
  const systemPrompt = `You are an expert horticulturist and garden center RETAIL educator creating ${channel} content for a GARDEN CENTER BUSINESS.

🏪 GARDEN CENTER RETAIL CONTEXT - CRITICAL:
You are creating content for a RETAIL garden center where customers:
- Browse greenhouse displays and outdoor plant inventory
- See products arranged by category (perennials, annuals, vegetables, houseplants)
- Interact with staff and ask questions about plant care
- Purchase plants, tools, soil, fertilizers, and garden supplies
- Visit regularly for seasonal supplies and advice

ALL content must reflect this RETAIL ENVIRONMENT and show:
- Customers browsing or shopping in garden center
- Product displays, inventory shelves, greenhouse sections
- Specific plant varieties available for purchase
- Tools and supplies sold in-store
- Staff helping customers or demonstrating products

${channel === 'facebook' || channel === 'instagram' ? `
⚠️⚠️⚠️ CRITICAL FOR SOCIAL MEDIA - PLAIN TEXT ONLY ⚠️⚠️⚠️

ABSOLUTELY FORBIDDEN:
- NO HTML tags (<h2>, <p>, <ul>, <li>, <strong>, <em>, etc.)
- NO markdown syntax (**, __, *, ##, etc.)
- Write like you're typing a normal social media post

ALLOWED:
- Plain text with natural language
- CAPS for emphasis
- Emojis for visual breaks
- Line breaks for structure
- Simple bullets using • symbol

Example CORRECT social media format:
"HARVEST TIPS FOR THIS WEEK

• Pick tomatoes when fully red
• Water deeply twice weekly
• Deadhead flowers every 3 days

Come visit us for fresh supplies! 🌱"

If you use ANY HTML tags or markdown, you have FAILED this task.
` : ''}

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

🎨 IMAGE QUERY GENERATION - MANDATORY REQUIREMENTS:

YOUR imageQuery MUST SHOW A GARDEN CENTER RETAIL ENVIRONMENT.

CHANNEL-SPECIFIC REQUIREMENTS:

${channel === 'facebook' ? `
FACEBOOK imageQuery MUST include:
1. CUSTOMERS or PEOPLE browsing/shopping (REQUIRED)
2. GARDEN CENTER setting (greenhouse, nursery, retail display)
3. SPECIFIC PLANT NAME or product type
4. Action word (browsing, selecting, shopping, viewing)

Examples:
✅ "customers browsing pink hydrangea greenhouse display"
✅ "shoppers selecting tomato seedlings garden center"
✅ "people viewing perennial flowers nursery shelves"
✅ "customer choosing houseplants indoor garden shop"
❌ "hydrangea flowers" (too generic, no retail context)
❌ "garden center" (no specific plant or people)
` : ''}

${channel === 'instagram' ? `
INSTAGRAM imageQuery MUST include:
1. CLOSE-UP of SPECIFIC PLANT (REQUIRED - use exact variety/color)
2. PRODUCT DISPLAY or retail presentation
3. Visual appeal (vibrant colors, detailed textures)
4. Garden center context (tags, pots, shelves visible)

Examples:
✅ "purple echinacea flowers garden center display pot"
✅ "red tomato heirloom seedlings nursery tray close"
✅ "succulent variety collection retail display shelf"
✅ "vibrant orange marigolds garden shop containers"
❌ "flowers" (too generic, no specific plant)
❌ "echinacea plant" (no retail context or color)
` : ''}

${channel === 'blog' ? `
BLOG imageQuery MUST include:
1. SPECIFIC GARDENING TECHNIQUE or plant care activity
2. HANDS or TOOLS performing the action (REQUIRED)
3. Exact plant species or garden element
4. Context showing the process or result

Examples:
✅ "hands deadheading spent roses pruning shears garden"
✅ "pruning tomato suckers fingers removing growth"
✅ "transplanting seedlings trowel compost soil hands"
✅ "mulching garden bed hands spreading wood chips"
❌ "rose garden" (no action or technique shown)
❌ "gardening tools" (no specific plant or activity)
` : ''}

${channel === 'newsletter' ? `
NEWSLETTER imageQuery MUST include:
1. SEASONAL CONTEXT (spring, summer, fall, winter keywords)
2. Garden center INVENTORY or featured products
3. Specific plant varieties or tools for that season
4. Retail display showing selection/abundance

Examples:
✅ "spring seedling trays greenhouse nursery display variety"
✅ "autumn mums chrysanthemum garden center fall selection"
✅ "winter houseplants tropical indoor plant shop inventory"
✅ "summer vegetables tomato pepper garden center abundance"
❌ "seasonal plants" (not specific to season or retail)
❌ "plant variety" (too generic, no season or context)
` : ''}

UNIVERSAL imageQuery RULES (ALL CHANNELS):
- MUST be 5-7 words (shorter queries are too generic)
- MUST include SPECIFIC plant name, color, or variety (not just "plant" or "flower")
- MUST show garden center retail context (display, inventory, greenhouse, customers, shelves)
- MUST be visually descriptive (colors, textures, actions)
- MUST be unique per channel (each channel needs different visual angle)

BAD imageQuery examples (DO NOT USE):
❌ "garden plants" (too generic)
❌ "flowers" (no specifics)
❌ "gardening" (no context)
❌ "plant care" (no visual specifics)
❌ "tomato" (too short, no context)

GOOD imageQuery examples (USE THESE AS TEMPLATES):
✅ "customers browsing purple petunias hanging baskets greenhouse"
✅ "close up pink dahlia blooms garden center pot"
✅ "hands transplanting basil seedlings soil trowel"
✅ "autumn kale varieties colorful garden center display"

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
                description: `MANDATORY GARDEN IMAGE QUERY - 5-7 words ONLY:
                
REQUIREMENTS FOR ALL CHANNELS:
1. MUST include SPECIFIC plant name (e.g., "pink petunia", "red tomato seedlings", "purple hydrangea") - NO generic "flowers" or "plants"
2. MUST include COLOR descriptor for the plant
3. MUST include garden center retail context (greenhouse, nursery, garden center, display, pots, shelves)
4. Extract plant names directly from the content you're writing

CHANNEL-SPECIFIC:
${channel === 'facebook' ? 
  '- MUST show "customers" or "shoppers" or "people" interacting with plants\n- Example: "customers browsing pink hydrangea greenhouse display"' :
  channel === 'instagram' ? 
  '- MUST be close-up showing plant details with vibrant colors\n- Example: "purple echinacea flowers potted garden center display"' :
  channel === 'blog' ? 
  '- MUST show "hands" performing gardening technique\n- Example: "hands deadheading pink roses garden pruning shears"' :
  '- MUST show seasonal inventory display\n- Example: "spring vegetable seedlings greenhouse nursery trays"'
}

FORBIDDEN: Generic terms like "beautiful flowers", "garden plants", abstract concepts, or any query without specific plant names and colors.

EXTRACT the actual plant/topic from this content: "${topicTitle}" - Use those specific plant names in your query.`
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
  let imageQuery = result.imageQuery || 'garden center seasonal plants';
  
  // ========== ENHANCED IMAGE QUERY VALIDATION ==========
  const { validateImageQuery, getChannelFallback } = await import('../_shared/enhanced-keyword-validator.ts');
  
  const validation = validateImageQuery(imageQuery, channel);
  
  console.log(`🔍 [${channel.toUpperCase()}] Image Query Validation:`, {
    query: imageQuery,
    score: validation.score,
    isValid: validation.isValid,
    issues: validation.issues
  });
  
  // If validation score is low, use fallback
  if (validation.score < 70) {
    console.warn(`⚠️ [${channel.toUpperCase()}] Low quality imageQuery (score: ${validation.score})`);
    console.warn(`Issues: ${validation.issues.join(', ')}`);
    console.warn(`Suggestions: ${validation.suggestions.join(', ')}`);
    
    // Use channel-specific fallback
    const fallbackQuery = getChannelFallback(channel, topicTitle);
    console.log(`🔄 Using fallback query: "${fallbackQuery}"`);
    imageQuery = fallbackQuery;
  } else {
    console.log(`✅ [${channel.toUpperCase()}] High-quality image query: "${imageQuery}" (score: ${validation.score})`);
  }
  
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

    // Get company context from workspace with extended details
    const { data: companyProfile } = await supabase
      .from('company_profiles')
      .select('company_name, company_overview, about_business, brand_voice, specializations, location_info, seasonal_focus')
      .eq('user_id', workspaceId)
      .single();

    const companyContext = companyProfile 
      ? `${companyProfile.company_name || 'Garden Center'} - ${companyProfile.company_overview || companyProfile.about_business || 'Retail garden center'}. Specializations: ${companyProfile.specializations || 'General gardening'}. Location: ${companyProfile.location_info || 'Local area'}. Seasonal Focus: ${companyProfile.seasonal_focus || 'Year-round gardening'}.`
      : 'Retail garden center specializing in plants, gardening supplies, and horticultural education';

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
    
    // ========== PHASE 2: MULTI-QUERY IMAGE FETCHING FOR VISUAL DIVERSITY ==========
    console.log('🖼️ Starting MULTI-QUERY image fetch for bundle content...');
    
    // Collect all unique image queries with their source channels
    const imageQueriesWithContext = content.flatMap((channelContent: any) => 
      channelContent.items
        .filter((item: any) => item.imageQuery)
        .map((item: any) => ({
          query: item.imageQuery,
          channel: channelContent.type
        }))
    );
    
    // Get unique queries (preserve order for priority)
    const uniqueQueries = [...new Map(
      imageQueriesWithContext.map(item => [item.query, item])
    ).values()];
    
    console.log(`🔍 Found ${uniqueQueries.length} unique image queries:`, uniqueQueries.map(q => `[${q.channel}] ${q.query}`));
    
    let fetchedImages: any[] = [];
    
    // Fetch images from multiple queries for diversity (up to 5 queries)
    if (uniqueQueries.length > 0) {
      const queriesToFetch = uniqueQueries.slice(0, 5); // Use up to 5 different queries
      const imagesPerQuery = Math.ceil(12 / queriesToFetch.length); // Distribute 12 images
      
      console.log(`📸 Fetching strategy: ${queriesToFetch.length} queries × ~${imagesPerQuery} images each = 12 total`);
      
      // Fetch images from each query in parallel
      const fetchPromises = queriesToFetch.map(async ({ query, channel }) => {
        try {
          console.log(`📸 [${channel.toUpperCase()}] Fetching from: "${query}"`);
          
          const imageResponse = await supabase.functions.invoke('fetch-unsplash-images', {
            body: { 
              query: query,
              maxImages: imagesPerQuery,
              orientation: 'squarish',
              rawQuery: true  // Trust OpenAI's query
            }
          });
          
          if (imageResponse.error) {
            console.error(`❌ [${channel}] Image fetch error:`, imageResponse.error);
            return { images: [], sourceQuery: query, sourceChannel: channel };
          }
          
          if (imageResponse.data?.images) {
            console.log(`✅ [${channel}] Fetched ${imageResponse.data.images.length} images from "${query}"`);
            return {
              images: imageResponse.data.images,
              sourceQuery: query,
              sourceChannel: channel
            };
          }
          
          console.warn(`⚠️ [${channel}] No images returned for "${query}"`);
          return { images: [], sourceQuery: query, sourceChannel: channel };
          
        } catch (imageError) {
          console.error(`❌ [${channel}] Exception fetching images:`, imageError);
          return { images: [], sourceQuery: query, sourceChannel: channel };
        }
      });
      
      // Aggregate all fetched images
      const fetchResults = await Promise.all(fetchPromises);
      
      // Flatten and tag images with source info
      fetchedImages = fetchResults.flatMap(result => 
        result.images.map((img: any) => ({
          ...img,
          _sourceQuery: result.sourceQuery,
          _sourceChannel: result.sourceChannel
        }))
      );
      
      console.log(`✅ Multi-query fetch complete: ${fetchedImages.length} total images from ${queriesToFetch.length} queries`);
      
      // Log diversity stats
      const queryStats = fetchResults.map(r => ({
        channel: r.sourceChannel,
        query: r.sourceQuery,
        count: r.images.length
      }));
      console.log('📊 Image diversity breakdown:', queryStats);
      
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
      unsplashId: img.unsplash_id || img.id,
      sourceQuery: img._sourceQuery,
      sourceChannel: img._sourceChannel
    }));
    
    console.log('🖼️ Multi-query image fetch summary:', {
      uniqueQueriesFound: uniqueQueries.length,
      queriesUsed: Math.min(uniqueQueries.length, 5),
      imagesFetched: fetchedImages.length,
      imagesFormatted: formattedImages.length,
      firstImageUrl: formattedImages[0]?.url || null,
      diversityAchieved: uniqueQueries.length > 1 ? 'Yes' : 'No (single query)',
      sampleQueries: uniqueQueries.slice(0, 3).map(q => q.query)
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
          // CRITICAL: Different formatting rules per channel
          let bodyContent = item.content;
          const originalContent = bodyContent;
          
          if (channelContent.type === 'blog') {
            // ✅ BLOG: Ensure HTML format
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
          } else if (channelContent.type === 'facebook' || channelContent.type === 'instagram') {
            // ✅ SOCIAL MEDIA: Strip ALL HTML and markdown to plain text
            console.log(`🧹 Stripping HTML/markdown for ${channelContent.type} content`);
            const htmlStripped = stripHtmlToPlainText(bodyContent);
            bodyContent = stripMarkdownForSocial(htmlStripped);
            
            // Log if formatting was detected and stripped
            const hasHtml = originalContent.match(/<[^>]+>/);
            const hasMarkdown = originalContent.includes('**') || originalContent.includes('__');
            
            if (hasHtml || hasMarkdown) {
              console.log(`[${channelContent.type.toUpperCase()} FORMATTING FIXED]`);
              if (hasHtml) console.log('  - Removed HTML tags');
              if (hasMarkdown) console.log('  - Removed markdown syntax');
              console.log('  - Original:', originalContent.substring(0, 150));
              console.log('  - Cleaned:', bodyContent.substring(0, 150));
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
