import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

interface GenerateInput {
  mode: "seasonal" | "holiday" | "custom";
  sourceId?: string;
  userIdea?: {
    title: string;
    goal?: "traffic" | "sales" | "awareness";
    tone?: string;
    notes?: string;
  };
  // Optional explicit topic coming from client (e.g., selected seasonal idea)
  topicTitle?: string;
  topicDescription?: string;
  channels: Array<"newsletter" | "instagram" | "facebook" | "video" | "blog">; // required: only generate these
  workspaceId: string;
}

interface GeneratedItem {
  channel: "newsletter" | "instagram" | "facebook" | "video" | "blog";
  title?: string;
  // Social
  caption?: string;
  hashtags?: string[];
  // Video
  script?: string;
  beats?: string[];
  // Blog
  markdown?: string;
  outline?: string[];
  // Legacy/body (kept for backward compatibility)
  body?: string;
  summary?: string;
  // Media
  media?: { url?: string; alt?: string } | null;
  // Newsletter blocks for Block Builder
  blocks?: any[];
  // MediaSelector integration flags
  requiresMediaSelector?: boolean;
  autoSelectImage?: boolean;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

serve(async (req) => {
  try {
    if (req.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    if (!OPENAI_API_KEY) {
      return new Response(JSON.stringify({ error: "OPENAI_API_KEY is not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const input = (await req.json()) as GenerateInput;

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: {
        headers: { Authorization: req.headers.get("Authorization") || "" },
      },
    });

    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Basic tenant/workspace guard
    const { data: me, error: meErr } = await supabase
      .from("users")
      .select("tenant_id")
      .eq("id", user.id)
      .single();

    if (meErr || !me || me.tenant_id !== input.workspaceId) {
      return new Response(JSON.stringify({ error: "Forbidden (workspace)" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Resolve context
    const context = await resolveContext(supabase, input);

// Channels to generate (required)
const channels: Array<GeneratedItem["channel"]> = (input.channels || []) as any;
const items: GeneratedItem[] = [];

  // Enhanced content generation for better MediaSelector integration
  for (const channel of channels) {
    const item = await generateForChannel(supabase, user.id, channel, context, input.userIdea?.tone);
    
    // Add MediaSelector trigger flag for all content types
    if (item) {
      item.requiresMediaSelector = true;
      item.autoSelectImage = true; // Automatically trigger MediaSelector
      
      // For Instagram and Facebook, ensure hashtags are properly formatted
      if ((channel === 'instagram' || channel === 'facebook') && item.caption) {
        const hashtags = extractHashtags(item.caption);
        item.hashtags = hashtags;
        
        // Clean caption by removing inline hashtags if they exist at the end
        item.caption = item.caption.replace(/(#\w+\s*)+$/, '').trim();
      }
    }
    
    items.push(item);
  }

    // Recommended images via existing function
    const queryForImages = buildImageQuery(context);
    const { data: imgData } = await supabase.functions.invoke("fetch-unsplash-images", {
      body: { query: queryForImages, maxImages: 6, orientation: "landscape" },
    });
    const recommendedImages = (imgData?.images || []).map((img: any) => ({
      url: img.download_url,
      alt: img.alt || queryForImages,
    }));

    const bundleId = crypto.randomUUID();
    const bundle = {
      id: bundleId,
      items,
      recommendedImages,
      meta: { mode: input.mode, sourceId: input.sourceId },
    };

    // Generate thumbnail for the bundle
    console.log(`[generate-multichannel-content] Generating thumbnail for bundle ${bundleId}`);
    try {
      const { data: thumbnailData, error: thumbnailError } = await supabase.functions.invoke('generate-content-thumbnail', {
        body: {
          bundleId,
          content: bundle,
          mode: input.mode,
          title: context.title || context.description
        }
      });

      if (thumbnailError) {
        console.warn(`[generate-multichannel-content] Thumbnail generation failed:`, thumbnailError);
      } else if (thumbnailData?.thumbnailUrl) {
        bundle.thumbnail = thumbnailData.thumbnailUrl;
        console.log(`[generate-multichannel-content] Thumbnail generated: ${thumbnailData.thumbnailUrl}`);
      }
    } catch (thumbnailErr) {
      console.warn(`[generate-multichannel-content] Thumbnail generation error:`, thumbnailErr);
      // Continue without thumbnail - non-blocking
    }

    // Persist bundle into draft_snapshots
    const { data: inserted, error: insErr } = await supabase
      .from("draft_snapshots" as any)
      .insert({
        tenant_id: input.workspaceId,
        user_id: user.id,
        doc_type: "content_bundle",
        doc_id: bundleId,
        version: 1,
        content: bundle,
      })
      .select()
      .single();

    if (insErr) {
      console.error("Insert draft_snapshots error", insErr);
      return new Response(JSON.stringify({ error: insErr.message || "Insert failed", bundle }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({ ...bundle, snapshotId: inserted.id }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("[generate-multichannel-content] error", err);
    return new Response(JSON.stringify({ error: err?.message || "Unexpected error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function buildImageQuery(context: any) {
  return (
    context?.title ||
    context?.theme ||
    context?.description ||
    context?.notes ||
    "garden retail marketing"
  );
}

async function resolveContext(supabase: any, input: GenerateInput) {
  // Client-specified topic takes priority (e.g., "Summer Care")
  if (input.topicTitle) {
    return {
      title: input.topicTitle,
      description: input.topicDescription,
      goal: input.userIdea?.goal,
      tone: input.userIdea?.tone,
    };
  }

  if (input.mode === "custom") {
    return {
      title: input.userIdea?.title,
      description: input.userIdea?.notes,
      goal: input.userIdea?.goal,
      tone: input.userIdea?.tone,
    };
  }

  if (input.mode === "holiday" && input.sourceId) {
    const { data } = await supabase
      .from("seasonal_holidays")
      .select("id,holiday_name,description,garden_relevance")
      .eq("id", input.sourceId)
      .limit(1)
      .maybeSingle();
    if (data) {
      return {
        id: data.id,
        title: data.holiday_name,
        description: data.garden_relevance || data.description,
      };
    }
  }

  if (input.mode === "seasonal" && input.sourceId) {
    // Try master campaign templates first
    const { data: mct } = await supabase
      .from("master_campaign_templates")
      .select("id,title,theme,content_ideas")
      .eq("id", input.sourceId)
      .limit(1)
      .maybeSingle();
    if (mct) {
      return {
        id: mct.id,
        title: mct.title,
        theme: mct.theme,
        description: mct.content_ideas,
      };
    }
  }

  // Fallback minimal
  return {
    title: input.userIdea?.title || "Seasonal Promotion",
    description: input.userIdea?.notes || "Engage customers with timely content",
  };
}

// Enhanced MediaSelector integration - auto-trigger image selection
async function generateForChannel(
  supabase: any,
  userId: string,
  channel: GeneratedItem["channel"],
  context: any,
  tone?: string,
): Promise<GeneratedItem> {
  const topic = context.title || context.theme || "Garden Center Update";

  switch (channel) {
    case "newsletter": {
      // Always use proper CRM block templates for newsletters
      const blocks = await generateNewsletterWithCRMBlocks(supabase, userId, topic, context);
      
      try {
        const content = await callGenerateStructuredNewsletter(supabase, {
          campaignTitle: topic,
          userId,
          weekDescription: context.description,
          toneNote: tone,
          weekNumber: 0,
        });
        if (content) {
          return { 
            channel: "newsletter", 
            title: topic, 
            body: content, 
            blocks, 
            media: null,
            requiresMediaSelector: true,
            autoSelectImage: true
          };
        }
      } catch (e) {
        console.warn("[generate-multichannel-content] structured newsletter failed, using blocks only", e);
      }
      
      // Use CRM blocks as primary template structure
      return { 
        channel: "newsletter", 
        title: topic, 
        blocks, 
        media: null,
        requiresMediaSelector: true,
        autoSelectImage: true
      };
    }
    case "instagram": {
      const content = await callGenerateContent(supabase, {
        postType: "instagram",
        campaignTitle: topic,
        userId,
        weekDescription: context.description,
      });
      return { 
        channel: "instagram", 
        title: topic, 
        caption: content, 
        hashtags: extractHashtags(content), 
        media: null,
        requiresMediaSelector: true,
        autoSelectImage: true
      };
    }
    case "facebook": {
      const content = await callGenerateContent(supabase, {
        postType: "facebook",
        campaignTitle: topic,
        userId,
        weekDescription: context.description,
      });
      return { 
        channel: "facebook", 
        title: topic, 
        caption: content, 
        hashtags: extractHashtags(content), 
        media: null,
        requiresMediaSelector: true,
        autoSelectImage: true
      };
    }
    case "video": {
      const content = await callGenerateContent(supabase, {
        postType: "video",
        campaignTitle: topic,
        userId,
        weekDescription: context.description,
      });
      return { 
        channel: "video", 
        title: topic, 
        script: content, 
        media: null,
        requiresMediaSelector: true,
        autoSelectImage: true
      };
    }
    case 'blog': {
      const content = await callGenerateContent(supabase, {
        postType: "blog",
        campaignTitle: topic,
        userId,
        weekDescription: context.description,
      });
      return { 
        channel: "blog", 
        title: topic, 
        body: content,  // Changed from markdown to body for HTML content
        media: null,
        requiresMediaSelector: true,
        autoSelectImage: true
      };
    }
    default:
      return { 
        channel, 
        title: topic, 
        body: "", 
        media: null,
        requiresMediaSelector: true,
        autoSelectImage: true
      } as GeneratedItem;
  }
}

async function callGenerateContent(supabase: any, args: { postType: string; campaignTitle: string; userId: string; weekDescription?: string }) {
  // Get company profile for personalization
  const { data: profile } = await supabase
    .from('company_profiles')
    .select('company_name, description, keywords')
    .eq('user_id', args.userId)
    .single();

  const companyName = profile?.company_name || 'Your Garden Center';
  const description = args.weekDescription || `Content about ${args.campaignTitle}`;
  
  // Direct OpenAI call instead of problematic edge function
  const systemPrompt = `You are an expert content creator for garden centers and nurseries. Create engaging, professional content that drives customer engagement and sales.

Company: ${companyName}
Focus: ${args.campaignTitle}
Description: ${description}

CRITICAL CONTENT RULES:
- NO EMOJIS ANYWHERE in the content - this is absolutely mandatory
- Use SHORT PARAGRAPHS (1-2 sentences maximum per paragraph)
- Write in a helpful, knowledgeable tone
- Include actionable advice
- Mention ${companyName} naturally
- Keep content appropriate for ${args.postType} format
- For social posts: include relevant hashtags
- For blog posts: use proper HTML semantic tags (<h2>, <p>, <ul>, <li>) - NO MARKDOWN
- For video: write a conversational script`;

  let userPrompt = '';
  switch (args.postType) {
    case 'instagram':
      userPrompt = `Create an engaging Instagram post about ${args.campaignTitle}. 

REQUIREMENTS:
- NO emojis anywhere in the content
- Use very short paragraphs (1-2 sentences each)
- Write 150-200 words total for the caption
- Include 5-8 relevant hashtags at the end
- Focus on visual storytelling and customer benefits
- Include actionable advice
- End with a clear call-to-action`;
      break;
    case 'facebook':
      userPrompt = `Create a Facebook post about ${args.campaignTitle}. 

REQUIREMENTS:
- NO emojis anywhere in the content
- Use very short paragraphs (1-2 sentences each)
- Write 200-300 words that encourage engagement
- Include a call-to-action
- Focus on community interaction`;
      break;
    case 'video':
      userPrompt = `Write a simple video script monologue about ${args.campaignTitle}. 

REQUIREMENTS:
- NO emojis anywhere in the content
- Create a 60-90 second conversational script
- Write as one continuous speaking piece - no scenes, no instructions, no stage directions
- Just write what the speaker should say directly to the camera
- Use natural, engaging language`;
      break;
    case 'blog':
      userPrompt = `Write a blog post about ${args.campaignTitle}. 

CRITICAL REQUIREMENTS - CONTENT WILL BE REJECTED IF NOT FOLLOWED:
- NO emojis anywhere in the content
- MANDATORY: Use HTML format with semantic tags - NO MARKDOWN ALLOWED
- Use <h2> for section headers (never ## or #)
- Use <p> for paragraphs (never plain text)
- Use <ul><li> for lists (never - or *)  
- Use <strong> for emphasis (never **)
- Create 400-600 words using proper HTML structure
- Include 3-4 sections with descriptive <h2> headings
- Use short paragraphs with proper <p> tags
- Include actionable gardening tips

HTML STRUCTURE EXAMPLE:
<h2>Section Title</h2>
<p>Paragraph content goes here.</p>

<h2>Another Section</h2>
<ul>
  <li>List item one</li>
  <li>List item two</li>
</ul>

OUTPUT MUST BE VALID HTML - NO MARKDOWN SYNTAX ALLOWED`;
      break;
    default:
      userPrompt = `Create content about ${args.campaignTitle} for ${args.postType} format. NO emojis and use short paragraphs.`;
  }

  return await openAIChat(systemPrompt, userPrompt);
}

async function callGenerateStructuredNewsletter(
  supabase: any,
  args: { campaignTitle: string; userId: string; weekDescription?: string; toneNote?: string; weekNumber?: number; campaignId?: string }
) {
  // Get company profile for personalization
  const { data: profile } = await supabase
    .from('company_profiles')
    .select('company_name, description, keywords')
    .eq('user_id', args.userId)
    .single();

  const companyName = profile?.company_name || 'Your Garden Center';
  const description = args.weekDescription || `Newsletter content about ${args.campaignTitle}`;
  const tone = args.toneNote || 'professional and helpful';

  const systemPrompt = `You are an expert newsletter content creator for garden centers and nurseries. Create professional, engaging newsletter content in YAML format.

Company: ${companyName}
Topic: ${args.campaignTitle}
Description: ${description}
Tone: ${tone}

Guidelines:
- Write in a ${tone} tone
- Include actionable gardening advice
- Mention ${companyName} naturally
- Create 4 distinct content blocks
- Each block should have title, body, and CTA`;

  const userPrompt = `Create a newsletter about ${args.campaignTitle}. Format as YAML with:

newsletter_md: |
  # ${args.campaignTitle} Newsletter
  *Expert gardening insights for ${args.campaignTitle.toLowerCase()} success*
  
  [Create 4 sections with helpful content]

blocks:
  - title: "[First section title]"
    body: "[Engaging content with gardening advice]"
    cta: "[Call to action]"
    link: "#"
  [Continue with 3 more blocks]

meta:
  reading_time: "≈3 min"
  theme: "${args.campaignTitle}"
  week_focus: "[Brief focus description]"`;

  return await openAIChat(systemPrompt, userPrompt);
}

// Generate newsletter blocks using CRM block templates
async function generateNewsletterWithCRMBlocks(supabase: any, userId: string, topic: string, context: any) {
  console.log(`[generateNewsletterWithCRMBlocks] Generating CRM blocks for topic: ${topic}`);
  
  // Get user's workspace ID
  const { data: userData } = await supabase
    .from('users')
    .select('tenant_id')
    .eq('id', userId)
    .single();
  
  const workspaceId = userData?.tenant_id || userId;
  
  // Try to get existing CRM content blocks as templates from user's workspace
  const { data: existingBlocks, error: blocksError } = await supabase
    .from('campaign_blocks')
    .select('block_type, content, headline, cta_text, cta_url, image_url, layout_settings')
    .eq('tenant_id', workspaceId)
    .order('created_at', { ascending: false })
    .limit(10);
    
  if (blocksError) {
    console.warn(`[generateNewsletterWithCRMBlocks] Error fetching CRM blocks:`, blocksError);
  }
  
  console.log(`[generateNewsletterWithCRMBlocks] Found ${existingBlocks?.length || 0} existing CRM blocks to use as templates`);

  const now = Date.now();
  
  // Always start with a header block using proper CRM structure
  const blocks = [
    {
      id: `header_${now}`,
      type: "newsletter-header",
      title: topic,
      headline: topic,
      subheadline: `Expert insights and guidance for ${topic.toLowerCase()}`,
      content: `Your trusted source for ${topic.toLowerCase()} information and advice`,
      body: "",
      imageUrl: "", // MediaSelector will handle this
      source: "crm_template",
      personaTag: "general",
      layout: "full-width", 
      alignment: "center",
      textAlign: "center",
      padding: "large",
      backgroundColor: "#ffffff",
      textColor: "#333333",
      visible: true,
      collapsed: false,
      requiresMediaSelector: true, // Flag to trigger MediaSelector
    }
  ];

  // Generate content blocks using CRM templates with enhanced structure
  const blockTypes = ["image-text", "text", "image-text", "cta-button"];
  const contentTemplates = [
    {
      title: "Welcome & Featured Content",
      content: `Welcome to this week's newsletter focusing on ${topic}. Our expert team has curated the most valuable insights to help you achieve success with your gardening goals.`,
      type: "image-text",
      ctaText: "Read More",
    },
    {
      title: "Expert Insights",
      content: `Our experienced team shares proven strategies and best practices for ${topic}. Learn from years of professional expertise and customer success stories.`,
      type: "text",
      ctaText: "",
    },
    {
      title: "Seasonal Focus",
      content: `Current seasonal considerations for ${topic}. Make the most of this time of year with our professional recommendations and timely advice.`,
      type: "image-text", 
      ctaText: "Get Advice",
    },
    {
      title: "Take Action Today",
      content: `Ready to get started with ${topic}? Visit us for personalized recommendations, expert guidance, and everything you need for success.`,
      type: "cta-button",
      ctaText: "Visit Us Today",
    }
  ];

  for (let i = 0; i < contentTemplates.length; i++) {
    const template = contentTemplates[i];
    
    // Use existing CRM block as template if available
    const existingTemplate = existingBlocks && existingBlocks[i % existingBlocks.length];
    
    const block = {
      id: `${template.type}_${i + 1}_${now}`,
      type: existingTemplate?.block_type || template.type,
      title: template.title,
      headline: template.title,
      content: template.content,
      body: template.content,
      imageUrl: existingTemplate?.image_url || "", // Will be set by MediaSelector
      ctaText: existingTemplate?.cta_text || template.ctaText,
      ctaUrl: existingTemplate?.cta_url || "#",
      source: "crm_template",
      personaTag: "general",
      layout: existingTemplate?.layout_settings?.layout || (template.type === "image-text" ? "image-left" : "full-width"),
      alignment: "left",
      textAlign: "left", 
      padding: "medium",
      backgroundColor: "#ffffff",
      textColor: "#333333",
      visible: true,
      collapsed: false,
      requiresMediaSelector: template.type.includes("image"), // Flag blocks that need images
      // Copy any additional settings from existing templates
      ...(existingTemplate?.layout_settings || {}),
    };
    
    blocks.push(block);
  }

  console.log(`[generate-multichannel-content] Generated ${blocks.length} CRM template blocks for "${topic}" using ${existingBlocks?.length || 0} existing templates`);
  
  return blocks;
}

function generateNewsletterBlocksServer(topic: string) {
  // Fallback function - should not be used anymore
  const now = Date.now();
  return [
    {
      id: `header_${now}`,
      type: "header",
      title: topic,
      headline: topic,
      content: "",
      body: "",
      imageUrl: "",
      source: "template",
      personaTag: "general",
      layout: "image-left",
      alignment: "left",
      textAlign: "left",
      padding: "medium",
      visible: true,
      collapsed: false,
    },
    {
      id: `content3_${now}`,
      type: "image-text",
      title: "Secondary Feature",
      content: "Add a secondary story or feature that complements your main content.",
      headline: "Secondary Feature",
      body: "Add a secondary story or feature that complements your main content.",
      imageUrl: "",
      ctaText: "Learn More",
      ctaUrl: "#",
      source: "template",
      personaTag: "general",
      layout: "image-left",
      alignment: "left",
      textAlign: "left",
      padding: "medium",
      visible: true,
      collapsed: false,
    },
  ];
}

function extractHashtags(text: string): string[] {
  const matches = text.match(/#[A-Za-z0-9_]+/g) || [];
  // Ensure uniqueness and cap to 10
  return Array.from(new Set(matches)).slice(0, 10);
}

function buildCtas(channel: string): string[] {
  switch (channel) {
    case "newsletter":
      return ["Shop New Arrivals", "Book a Garden Consult", "Join Our Loyalty Program"];
    case "facebook":
    case "instagram":
      return ["Visit Us This Week", "See What’s Blooming", "Message Us for Details"];
    case "video":
      return ["Follow for More Tips", "Visit In-Store", "Check Our Weekly Specials"];
    case "blog":
      return ["Explore Our Guides", "Subscribe to Newsletter", "Plan Your Visit"];
    default:
      return [];
  }
}

async function openAIChat(system: string, user: string): Promise<string> {
  const resp = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      temperature: 0.7,
    }),
  });
  if (!resp.ok) {
    const txt = await resp.text();
    throw new Error(`OpenAI error: ${resp.status} ${txt}`);
  }
  const data = await resp.json();
  return data.choices?.[0]?.message?.content?.trim() || "";
}
