import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

interface GenerateInput {
  mode: "event" | "seasonal" | "custom";
  sourceId?: string;
  userIdea?: {
    title: string;
    goal?: "traffic" | "sales" | "awareness";
    tone?: string;
    channels?: Array<"newsletter" | "instagram" | "facebook" | "video" | "blog">;
    notes?: string;
  };
  workspaceId: string;
}

interface GeneratedItem {
  channel: "newsletter" | "instagram" | "facebook" | "video" | "blog";
  title?: string;
  body?: string;
  summary?: string;
  hashtags?: string[];
  ctaSuggestions?: string[];
  media?: { url?: string; alt?: string } | null;
  blocks?: any[]; // For newsletter: structured blocks compatible with Block Builder
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

    // Channels to generate
    const channels: Array<GeneratedItem["channel"]> = (
      input.userIdea?.channels || ["newsletter", "instagram", "facebook", "video", "blog"]
    ) as any;

    const items: GeneratedItem[] = [];
    for (const channel of channels) {
      const item = await generateForChannel(channel, context, input.userIdea?.tone);
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
  if (input.mode === "custom") {
    return {
      title: input.userIdea?.title,
      description: input.userIdea?.notes,
      goal: input.userIdea?.goal,
      tone: input.userIdea?.tone,
    };
  }

  if (input.mode === "event" && input.sourceId) {
    const { data } = await supabase
      .from("campaigns")
      .select("id,title,theme,description")
      .eq("id", input.sourceId)
      .limit(1)
      .maybeSingle();
    if (data) return data;
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
  channel: GeneratedItem["channel"],
  context: any,
  tone?: string,
): Promise<GeneratedItem> {
  const sys = `You are an expert garden retail marketer. Write in a helpful, concise style${
    tone ? ` with tone: ${tone}` : ""
  }. Avoid emojis and placeholders.`;

  const prompts: Record<string, string> = {
    newsletter: `Write a short newsletter (220-300 words) titled based on: "${
      context.title || context.theme || "Garden Center Update"
    }". Include: intro, 2-3 highlights, a clear CTA, and sign-off. Keep it on-brand for a local garden center.`,
    instagram: `Write an Instagram caption (80-150 words) about: "${
      context.title || context.theme || "Garden Tip"
    }" with 5-8 relevant hashtags at the end.`,
    facebook: `Write a Facebook post (120-220 words) about: "${
      context.title || context.theme || "Garden Tip"
    }". Friendly tone, 1-2 paragraphs, plus a CTA. Add 3-5 hashtags.`,
    video: `Write a short 45-second vertical video script outline about: "${
      context.title || context.theme || "Garden Tip"
    }". Use bullets: Hook, 3 key points, CTA line.`,
    blog: `Write a 400-600 word blog post about: "${
      context.title || context.theme || "Seasonal Garden Focus"
    }" with H2 sections and a conclusion with a CTA to visit the store.`,
  };

  const body = await openAIChat(sys, prompts[channel]);
  const item: GeneratedItem = {
    channel,
    title: context.title,
    body,
    hashtags: channel === "instagram" || channel === "facebook" ? extractHashtags(body) : undefined,
    ctaSuggestions: buildCtas(channel),
    media: null,
  };
  return item;
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
