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
      try {
        const content = await callGenerateStructuredNewsletter(supabase, {
          campaignTitle: topic,
          userId,
          weekDescription: context.description,
          toneNote: tone,
          weekNumber: 0,
        });
        if (content) {
          return { channel: "newsletter", title: topic, body: content, media: null };
        }
      } catch (e) {
        console.warn("[generate-multichannel-content] structured newsletter failed, falling back", e);
      }
      const blocks = generateNewsletterBlocksServer(topic);
      const body = (blocks || [])
        .map((b: any) => b?.title || b?.headline || b?.content || b?.body)
        .filter((s: string) => !!s)
        .join("\n\n");
      return { channel: "newsletter", title: topic, body, blocks, media: null };
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
  const { data, error } = await supabase.functions.invoke("generate-content", {
    body: {
      postType: args.postType,
      campaignTitle: args.campaignTitle,
      userId: args.userId,
      weekDescription: args.weekDescription,
      enforceCompanyName: true,
    },
  });
  if (error) throw error;
  return (data as any)?.content as string;
}

async function callGenerateStructuredNewsletter(
  supabase: any,
  args: { campaignTitle: string; userId: string; weekDescription?: string; toneNote?: string; weekNumber?: number; campaignId?: string }
) {
  const { data, error } = await supabase.functions.invoke("generate-structured-newsletter", {
    body: {
      campaignId: args.campaignId || crypto.randomUUID(),
      campaignTitle: args.campaignTitle,
      weekNumber: args.weekNumber ?? 0,
      userId: args.userId,
      weekDescription: args.weekDescription,
      promoItems: [],
      toneNote: args.toneNote,
    },
  });
  if (error) throw error;
  return (data as any)?.content as string;
}

function generateNewsletterBlocksServer(topic: string) {
  // Mirrors src/services/newsletterBlockGenerator.ts (block-builder variant)
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
      layout: "full-width",
      alignment: "center",
      textAlign: "center",
      padding: "large",
      visible: true,
      collapsed: false,
    },
    {
      id: `content1_${now}`,
      type: "image-text",
      title: "Featured Story",
      content: "Welcome to this week's newsletter featuring the latest updates and insights.",
      headline: "Featured Story",
      body: "Welcome to this week's newsletter featuring the latest updates and insights.",
      imageUrl: "",
      ctaText: "",
      ctaUrl: "",
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
      id: `content2_${now}`,
      type: "image-text",
      title: "Main Article",
      content: "This is your main content area. Share your expertise, tips, or latest news here.",
      headline: "Main Article",
      body: "This is your main content area. Share your expertise, tips, or latest news here.",
      imageUrl: "",
      ctaText: "",
      ctaUrl: "",
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
