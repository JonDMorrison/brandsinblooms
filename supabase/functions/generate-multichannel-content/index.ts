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
for (const channel of channels) {
  const item = await generateForChannel(supabase, user.id, channel, context, input.userIdea?.tone);
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
          return { channel: "newsletter", title: topic, body: content, blocks, media: null };
        }
      } catch (e) {
        console.warn("[generate-multichannel-content] structured newsletter failed, using blocks only", e);
      }
      
      // Use CRM blocks as primary template structure
      return { channel: "newsletter", title: topic, blocks, media: null };
    }
    case "instagram": {
      const content = await callGenerateContent(supabase, {
        postType: "instagram",
        campaignTitle: topic,
        userId,
        weekDescription: context.description,
      });
      return { channel: "instagram", title: topic, caption: content, hashtags: extractHashtags(content), media: null };
    }
    case "facebook": {
      const content = await callGenerateContent(supabase, {
        postType: "facebook",
        campaignTitle: topic,
        userId,
        weekDescription: context.description,
      });
      return { channel: "facebook", title: topic, caption: content, hashtags: extractHashtags(content), media: null };
    }
    case "video": {
      const content = await callGenerateContent(supabase, {
        postType: "video",
        campaignTitle: topic,
        userId,
        weekDescription: context.description,
      });
      return { channel: "video", title: topic, script: content, media: null };
    }
    case "blog": {
      const content = await callGenerateContent(supabase, {
        postType: "blog",
        campaignTitle: topic,
        userId,
        weekDescription: context.description,
      });
      return { channel: "blog", title: topic, markdown: content, media: null };
    }
    default:
      return { channel, title: topic, body: "", media: null } as GeneratedItem;
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
- For blog posts: use markdown formatting
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

REQUIREMENTS:
- NO emojis anywhere in the content
- Use short paragraphs (1-2 sentences each)
- Create 400-600 words in markdown format
- Include headers, bullet points, and actionable tips
- Use SEO-friendly structure`;
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
  // Try to get existing CRM content blocks as templates
  const { data: existingBlocks } = await supabase
    .from('campaign_blocks')
    .select('block_type, content, cta_text, cta_url, image_url')
    .limit(5);

  const now = Date.now();
  const blocks = [
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
      layout: "full-width",
      alignment: "center",
      textAlign: "center",
      padding: "large",
      visible: true,
      collapsed: false,
    }
  ];

  // Generate 4 content blocks using existing CRM blocks as templates if available
  const contentTitles = ["Featured Story", "Main Article", "Seasonal Spotlight", "Call to Action"];
  const defaultContents = [
    `Welcome to this week's newsletter about ${topic}. Our expert team has prepared valuable insights to help you succeed.`,
    `Discover the latest trends and best practices for ${topic}. Learn from our years of experience and proven strategies.`,
    `Seasonal tips and advice specifically tailored for ${topic}. Make the most of the current season with professional guidance.`,
    `Ready to take action? Visit us today to learn more about ${topic} and get personalized recommendations from our experts.`
  ];

  for (let i = 0; i < 4; i++) {
    const existingBlock = existingBlocks && existingBlocks[i % existingBlocks.length];
    const block = {
      id: `content${i + 1}_${now}`,
      type: existingBlock?.block_type || "image-text",
      title: contentTitles[i],
      content: defaultContents[i],
      headline: contentTitles[i],
      body: defaultContents[i],
      imageUrl: existingBlock?.image_url || "",
      ctaText: existingBlock?.cta_text || (i === 3 ? "Learn More" : ""),
      ctaUrl: existingBlock?.cta_url || "#",
      source: "template",
      personaTag: "general",
      layout: "image-left",
      alignment: "left",
      textAlign: "left",
      padding: "medium",
      visible: true,
      collapsed: false,
    };
    blocks.push(block);
  }

  console.log(`[generate-multichannel-content] Generated ${blocks.length} CRM template blocks for "${topic}"`);
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
