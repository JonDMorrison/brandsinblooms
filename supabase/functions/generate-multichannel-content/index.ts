import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'npm:@supabase/supabase-js@2';

interface GenerateInput {
  mode: "seasonal" | "holiday" | "custom";
  sourceId?: string;
  userIdea?: {
    title: string;
    goal?: "traffic" | "sales" | "awareness";
    tone?: string;
    notes?: string;
  };
  topicTitle?: string;
  topicDescription?: string;
  channels: Array<"newsletter" | "instagram" | "facebook" | "video" | "blog">;
  workspaceId: string;
}

interface GeneratedItem {
  channel: "newsletter" | "instagram" | "facebook" | "video" | "blog";
  title?: string;
  caption?: string;
  hashtags?: string[];
  script?: string;
  beats?: string[];
  markdown?: string;
  outline?: string[];
  body?: string;
  summary?: string;
  media?: { url?: string; alt?: string } | null;
  blocks?: any[];
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

    const context = await resolveContext(supabase, input);
    const channels = input.channels || [];
    const items: GeneratedItem[] = [];

    for (const channel of channels) {
      const item = await generateForChannel(supabase, user.id, channel, context, input.userIdea?.tone);
      
      if (item) {
        item.requiresMediaSelector = true;
        item.autoSelectImage = true;
        
        if ((channel === 'instagram' || channel === 'facebook') && item.caption) {
          const hashtags = extractHashtags(item.caption);
          item.hashtags = hashtags;
          item.caption = item.caption.replace(/(#\w+\s*)+$/, '').trim();
        }
      }
      
      items.push(item);
    }

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

    try {
      const { data: thumbnailData, error: thumbnailError } = await supabase.functions.invoke('generate-content-thumbnail', {
        body: {
          bundleId,
          content: bundle,
          mode: input.mode,
          title: context.title || context.description
        }
      });

      if (!thumbnailError && thumbnailData?.thumbnailUrl) {
        bundle.thumbnail = thumbnailData.thumbnailUrl;
      }
    } catch (thumbnailErr) {
      console.warn(`Thumbnail generation error:`, thumbnailErr);
    }

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
    console.error("Error:", err);
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

  return {
    title: input.userIdea?.title || "Seasonal Promotion",
    description: input.userIdea?.notes || "Engage customers with timely content",
  };
}

function createUniqueTitle(channel: string, baseTitle: string): string {
  const cleanTitle = baseTitle.replace(/^Week\s+\d+:?\s*/i, '').trim();
  
  switch (channel) {
    case 'instagram':
      return `Transform Your ${cleanTitle}`;
    case 'facebook':
      return `${cleanTitle} Community Tips`;
    case 'newsletter':
      return `Complete ${cleanTitle} Guide`;
    case 'blog':
      return `${cleanTitle} Expert Resource`;
    case 'video':
      return `${cleanTitle} Pro Methods`;
    default:
      return cleanTitle;
  }
}

async function generateForChannel(
  supabase: any,
  userId: string,
  channel: string,
  context: any,
  tone?: string,
): Promise<GeneratedItem> {
  const baseTopic = context.title || context.theme || "Garden Center Update";
  const uniqueTitle = createUniqueTitle(channel, baseTopic);

  switch (channel) {
    case "newsletter": {
      const blocks = await generateNewsletterBlocks(supabase, userId, uniqueTitle, context);
      return { 
        channel: "newsletter", 
        title: uniqueTitle, 
        blocks, 
        media: null,
        requiresMediaSelector: true,
        autoSelectImage: true
      };
    }
    case "instagram": {
      const content = await generateContent(userId, "instagram", uniqueTitle, context.description);
      return { 
        channel: "instagram", 
        title: uniqueTitle, 
        caption: content, 
        hashtags: extractHashtags(content), 
        media: null,
        requiresMediaSelector: true,
        autoSelectImage: true
      };
    }
    case "facebook": {
      const content = await generateContent(userId, "facebook", uniqueTitle, context.description);
      return { 
        channel: "facebook", 
        title: uniqueTitle, 
        caption: content, 
        hashtags: extractHashtags(content), 
        media: null,
        requiresMediaSelector: true,
        autoSelectImage: true
      };
    }
    case "video": {
      const content = await generateContent(userId, "video", uniqueTitle, context.description);
      return { 
        channel: "video", 
        title: uniqueTitle, 
        script: content, 
        media: null,
        requiresMediaSelector: true,
        autoSelectImage: true
      };
    }
    case 'blog': {
      const content = await generateContent(userId, "blog", uniqueTitle, context.description);
      return { 
        channel: "blog", 
        title: uniqueTitle, 
        body: content,
        media: null,
        requiresMediaSelector: true,
        autoSelectImage: true
      };
    }
    default:
      return { 
        channel: channel as any, 
        title: uniqueTitle, 
        body: "", 
        media: null,
        requiresMediaSelector: true,
        autoSelectImage: true
      };
  }
}

async function generateContent(userId: string, postType: string, campaignTitle: string, weekDescription?: string) {
  const description = weekDescription || `Content about ${campaignTitle}`;
  
  const systemPrompt = `You are an expert content creator for garden centers. Create engaging, professional content that drives customer engagement.

Focus: ${campaignTitle}
Description: ${description}

RULES:
- NO EMOJIS ANYWHERE
- Use SHORT PARAGRAPHS (1-2 sentences)
- Write in helpful, knowledgeable tone
- Include actionable advice
- Keep content appropriate for ${postType} format`;

  let userPrompt = '';
  switch (postType) {
    case 'instagram':
      userPrompt = `Create an Instagram post about ${campaignTitle}. 150-200 words with 5-8 hashtags.`;
      break;
    case 'facebook':
      userPrompt = `Create a Facebook post about ${campaignTitle}. 200-300 words, conversational tone.`;
      break;
    case 'video':
      userPrompt = `Write a 60-90 second video script about ${campaignTitle}. Natural speaking tone.`;
      break;
    case 'blog':
      userPrompt = `Write a blog post about ${campaignTitle}. Use HTML format with <h2>, <p>, <ul>, <li> tags. 400-600 words.`;
      break;
    default:
      userPrompt = `Create content about ${campaignTitle} for ${postType}.`;
  }

  return await callOpenAI(systemPrompt, userPrompt);
}

async function generateNewsletterBlocks(supabase: any, userId: string, topic: string, context: any) {
  const now = Date.now();
  
  return [
    {
      id: `header_${now}`,
      type: "newsletter-header",
      title: topic,
      headline: topic,
      content: `Expert insights and guidance for ${topic.toLowerCase()}`,
      body: "",
      imageUrl: "",
      source: "template",
      personaTag: "general",
      layout: "full-width", 
      alignment: "center",
      textAlign: "center",
      padding: "large",
      backgroundColor: "#ffffff",
      textColor: "#333333",
      visible: true,
      collapsed: false,
      requiresMediaSelector: true,
    },
    {
      id: `content_${now}`,
      type: "image-text",
      title: "Featured Content",
      headline: "Featured Content",
      content: `Welcome to this week's newsletter focusing on ${topic}. Our expert team has curated valuable insights to help you succeed.`,
      body: `Welcome to this week's newsletter focusing on ${topic}. Our expert team has curated valuable insights to help you succeed.`,
      imageUrl: "",
      ctaText: "Learn More",
      ctaUrl: "#",
      source: "template",
      personaTag: "general",
      layout: "image-left",
      alignment: "left",
      textAlign: "left",
      padding: "medium",
      backgroundColor: "#ffffff",
      textColor: "#333333",
      visible: true,
      collapsed: false,
      requiresMediaSelector: true,
    }
  ];
}

function extractHashtags(text: string): string[] {
  const matches = text.match(/#[A-Za-z0-9_]+/g) || [];
  return Array.from(new Set(matches)).slice(0, 10);
}

async function callOpenAI(system: string, user: string): Promise<string> {
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