import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { createClient } from "npm:@supabase/supabase-js@2.58.0";
import { getMasterGardenerSystemRole } from "../_shared/masterGardenerPrompt.ts";

const openAIApiKey = Deno.env.get("OPENAI_API_KEY");

type SanitizedCampaignContext = {
  aspectRatioHint?: string;
  blockLabel?: string;
  blockType?: string;
  campaignName?: string;
  campaignType?: string;
  contentSummary?: string;
};

function sanitizeContextField(value: unknown, maxLength: number) {
  if (typeof value !== "string") {
    return "";
  }

  return value
    .replace(/<[^>]*>/g, " ")
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/[<>{}`$\[\]\\]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function sanitizeCampaignContext(
  payload: unknown,
): SanitizedCampaignContext | null {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return null;
  }

  const record = payload as Record<string, unknown>;
  const sanitizedContext = {
    aspectRatioHint: sanitizeContextField(record.aspectRatioHint, 24),
    blockLabel: sanitizeContextField(record.blockLabel, 80),
    blockType: sanitizeContextField(record.blockType, 48),
    campaignName: sanitizeContextField(record.campaignName, 80),
    campaignType: sanitizeContextField(record.campaignType, 24),
    contentSummary: sanitizeContextField(record.contentSummary, 220),
  } satisfies SanitizedCampaignContext;

  return Object.values(sanitizedContext).some(Boolean)
    ? sanitizedContext
    : null;
}

function buildContextualPromptInstructions(
  campaignContext: SanitizedCampaignContext | null,
) {
  if (!campaignContext) {
    return "";
  }

  const contextLines = [
    campaignContext.campaignName
      ? `- Campaign name: ${campaignContext.campaignName}`
      : null,
    campaignContext.campaignType
      ? `- Campaign type: ${campaignContext.campaignType}`
      : null,
    campaignContext.blockLabel
      ? `- Active block label: ${campaignContext.blockLabel}`
      : null,
    campaignContext.blockType
      ? `- Active block type: ${campaignContext.blockType}`
      : null,
    campaignContext.aspectRatioHint
      ? `- Aspect ratio preference: ${campaignContext.aspectRatioHint}`
      : null,
    campaignContext.contentSummary
      ? `- Visible campaign copy: ${campaignContext.contentSummary}`
      : null,
  ].filter(Boolean);

  if (contextLines.length === 0) {
    return "";
  }

  return `

When the campaign context below is present, align the garden imagery to it while keeping plants, flowers, trees, and natural garden elements as the primary subjects:
${contextLines.join("\n")}
- Use the visible campaign copy as visual guidance, not as literal text to render into the image unless the prompt explicitly asks for it.`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // SECURITY: [E28] - Add JWT authentication
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Authorization required" }), {
        status: 401,
        headers: corsHeaders,
      });
    }

    const token = /^Bearer\s+(\S+)$/i.exec(authHeader)?.[1];
    if (!token) return new Response(JSON.stringify({ error: "Authorization required" }), { status: 401, headers: corsHeaders });
    const supabase = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_ANON_KEY") ?? "", {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) return new Response(JSON.stringify({ error: "Invalid authorization" }), { status: 401, headers: corsHeaders });
    const { campaignContext: rawCampaignContext, prompt } = await req.json();

    if (typeof prompt !== "string" || !prompt.trim() || prompt.length > 4000) {
      return new Response(JSON.stringify({ error: "Prompt must contain 1–4000 characters" }), { status: 400, headers: corsHeaders });
    }

    const campaignContext = sanitizeCampaignContext(rawCampaignContext);

    // Do not log user campaign content.

    const baseSystemPrompt = `${getMasterGardenerSystemRole()}

Your enhanced prompts must focus on GARDENS, PLANTS, FLOWERS, TREES, and NATURAL GARDEN ELEMENTS as the primary subjects.
Transform simple prompts into detailed, vivid descriptions that will generate beautiful, BOTANICALLY ACCURATE garden images.
Focus on: specific plant varieties with correct botanical features, garden settings, seasonal context, natural lighting, colors, composition, and mood.

CRITICAL RULES:
- Primary subjects MUST be gardens, plants, flowers, trees, or garden elements
- NEVER suggest garden center stores, retail buildings, or commercial settings
- Always specify the season and appropriate seasonal plants for that season
- Include natural outdoor garden environments
- Describe specific plant types with ACCURATE botanical features (leaf shapes, petal counts, growth habits)
- Only combine plants that would realistically grow together in similar conditions

Output only the enhanced prompt, nothing else.`;

    const userPrompt = campaignContext
      ? [
          `Enhance this image prompt for the active campaign block: "${prompt}"`,
          campaignContext.contentSummary
            ? `Visible campaign copy: ${campaignContext.contentSummary}`
            : null,
          campaignContext.blockLabel
            ? `Target block: ${campaignContext.blockLabel}`
            : null,
          campaignContext.campaignName
            ? `Campaign name: ${campaignContext.campaignName}`
            : null,
        ]
          .filter(Boolean)
          .join("\n")
      : `Enhance this image prompt: "${prompt}"`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      signal: AbortSignal.timeout(15000),
      headers: {
        Authorization: `Bearer ${openAIApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-6-luna",
        reasoning_effort: "none",
        store: false,
        messages: [
          {
            role: "system",
            content: `${baseSystemPrompt}${buildContextualPromptInstructions(campaignContext)}`,
          },
          {
            role: "user",
            content: userPrompt,
          },
        ],
        max_completion_tokens: 200,
      }),
    });

    if (!response.ok) {
      console.error("OpenAI API error:", response.status);
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const choice = data.choices?.[0];
    if (choice?.finish_reason !== "stop" || choice.message?.refusal || typeof choice.message?.content !== "string" || !choice.message.content.trim()) {
      throw new Error("Image prompt enhancement unavailable");
    }
    const enhancedPrompt = choice.message.content.trim();

    return new Response(JSON.stringify({ enhancedPrompt }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Image prompt enhancement failed");
    return new Response(
      JSON.stringify({
        error: "Image prompt enhancement unavailable",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
