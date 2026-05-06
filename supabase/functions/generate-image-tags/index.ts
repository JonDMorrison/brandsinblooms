import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface TagGenerationRequest {
  contentContext: string;
  contentTitle?: string;
  channel: string;
}

interface GeneratedTag {
  name: string;
  category:
    | "subject"
    | "color"
    | "season"
    | "mood"
    | "style"
    | "activity"
    | "setting";
  confidence: number;
}

interface RawGeneratedTag {
  name?: string;
  category?: string;
  confidence?: number | string;
}

interface TagGenerationResponse {
  tags?: RawGeneratedTag[];
}

const ALLOWED_TAG_CATEGORIES: ReadonlySet<GeneratedTag["category"]> = new Set([
  "subject",
  "color",
  "season",
  "mood",
  "style",
  "activity",
  "setting",
]);
const MIN_TAG_CONFIDENCE = 0.65;

function normalizeTagName(tagName: string) {
  return tagName.trim().toLowerCase().replace(/\s+/g, " ");
}

function normalizeGeneratedTags(rawTags: RawGeneratedTag[]): GeneratedTag[] {
  const tagsByName = new Map<string, GeneratedTag>();

  for (const rawTag of rawTags) {
    const normalizedName = rawTag.name ? normalizeTagName(rawTag.name) : "";
    const normalizedCategory = rawTag.category?.trim().toLowerCase();
    const confidence = Number(rawTag.confidence);

    if (
      !normalizedName ||
      !normalizedCategory ||
      !Number.isFinite(confidence)
    ) {
      continue;
    }

    if (confidence < MIN_TAG_CONFIDENCE || confidence > 1) {
      continue;
    }

    if (
      !ALLOWED_TAG_CATEGORIES.has(
        normalizedCategory as GeneratedTag["category"],
      )
    ) {
      continue;
    }

    const normalizedTag: GeneratedTag = {
      name: normalizedName,
      category: normalizedCategory as GeneratedTag["category"],
      confidence: Number(confidence.toFixed(2)),
    };

    const existingTag = tagsByName.get(normalizedTag.name);
    if (!existingTag || normalizedTag.confidence > existingTag.confidence) {
      tagsByName.set(normalizedTag.name, normalizedTag);
    }
  }

  return Array.from(tagsByName.values());
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // SECURITY: [JWT auth] - Require authenticated user for AI function access
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const { error: authError } = await supabase.auth.getUser();
  if (authError) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY not configured");
    }

    const body: TagGenerationRequest = await req.json();
    const { contentContext, contentTitle = "", channel } = body;

    console.log("🏷️ [Tag Generator] Starting tag generation...", {
      channel,
      contextLength: contentContext.length,
      titleLength: contentTitle?.length || 0,
      timestamp: new Date().toISOString(),
    });

    // Call OpenAI to generate comprehensive tags
    console.log("🤖 [Tag Generator] Calling OpenAI API...");
    const apiStartTime = Date.now();

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `You are an expert image tagging AI for a garden center marketing system.
Generate 10-15 comprehensive, searchable tags based on the content context provided.

Categories (you MUST use these exact category names):
- subject: Main subjects (plants, flowers, tools, garden features)
- color: Dominant colors (vibrant, pastel, green, red, etc.)
- season: Seasonal context (spring, summer, fall, winter)
- mood: Emotional tone (joyful, peaceful, energetic, inspiring)
- style: Visual style (modern, rustic, professional, natural)
- activity: Actions depicted (planting, watering, harvesting, relaxing)
- setting: Location context (outdoor garden, greenhouse, nursery, patio)

Return ONLY a JSON object with this exact structure:
{
  "tags": [
    {"name": "roses", "category": "subject", "confidence": 0.95},
    {"name": "vibrant", "category": "color", "confidence": 0.88}
  ]
}

Each tag must have:
- name: lowercase, descriptive, 1-3 words max
- category: one of the exact categories listed above
- confidence: 0.60 to 1.00 (your confidence this tag applies)

Focus on tags that would help find similar images in future searches.`,
          },
          {
            role: "user",
            content: `Generate tags for an AI-generated image with this context:

Title: "${contentTitle}"
Content: "${contentContext}"
Channel: ${channel}

Provide 10-15 tags that capture the visual elements this image would contain.`,
          },
        ],
        temperature: 0.7,
        response_format: { type: "json_object" },
      }),
    });

    const apiDuration = ((Date.now() - apiStartTime) / 1000).toFixed(2);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(
        `❌ [Tag Generator] OpenAI API error after ${apiDuration}s:`,
        {
          status: response.status,
          error: errorText.substring(0, 500),
        },
      );
      throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
    }

    console.log(`✅ [Tag Generator] OpenAI API responded in ${apiDuration}s`);

    const data = await response.json();
    const content = data.choices[0].message.content;

    console.log("📝 [Tag Generator] Parsing OpenAI response...", {
      contentLength: content?.length,
      hasContent: !!content,
    });

    const parsedResponse = JSON.parse(content) as TagGenerationResponse;

    // Validate and normalize tags
    console.log("🔍 [Tag Generator] Validating and normalizing tags...", {
      rawTagCount: parsedResponse.tags?.length || 0,
    });

    const tags = normalizeGeneratedTags(parsedResponse.tags || []);

    if (tags.length === 0) {
      console.warn("⚠️ [Tag Generator] No tags remained after normalization", {
        channel,
        contentTitle,
      });
    }

    console.log(
      `✅ [Tag Generator] Successfully generated ${tags.length} valid tags`,
      {
        categories: [...new Set(tags.map((t) => t.category))],
        samples: tags.slice(0, 5).map((t) => `${t.name}(${t.category})`),
        avgConfidence: tags.length
          ? (
              tags.reduce((sum, t) => sum + t.confidence, 0) / tags.length
            ).toFixed(2)
          : "0.00",
      },
    );

    return new Response(JSON.stringify({ tags }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    const errorDetails =
      error instanceof Error ? error : new Error(String(error));
    console.error("❌ [Tag Generator] Critical error:", {
      message: errorDetails.message,
      name: errorDetails.name,
      stack: errorDetails.stack?.substring(0, 500),
      timestamp: new Date().toISOString(),
    });
    return new Response(
      JSON.stringify({
        error: errorDetails.message || "Tag generation failed",
        tags: [],
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
