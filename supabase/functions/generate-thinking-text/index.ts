import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  corsHeaders,
  handleCorsPrelight,
  corsJsonResponse,
} from "../_shared/cors.ts";

const openAIApiKey = Deno.env.get("OPENAI_API_KEY");

type SanitizedCampaignContext = {
  blockLabel?: string;
  blockType?: string;
  campaignName?: string;
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
    blockLabel: sanitizeContextField(record.blockLabel, 80),
    blockType: sanitizeContextField(record.blockType, 48),
    campaignName: sanitizeContextField(record.campaignName, 80),
    contentSummary: sanitizeContextField(record.contentSummary, 220),
  } satisfies SanitizedCampaignContext;

  return Object.values(sanitizedContext).some(Boolean)
    ? sanitizedContext
    : null;
}

function buildThinkingContextInstructions(
  campaignContext: SanitizedCampaignContext | null,
) {
  if (!campaignContext) {
    return "";
  }

  const contextLines = [
    campaignContext.campaignName
      ? `Campaign name: ${campaignContext.campaignName}`
      : null,
    campaignContext.blockLabel
      ? `Active block label: ${campaignContext.blockLabel}`
      : null,
    campaignContext.blockType
      ? `Active block type: ${campaignContext.blockType}`
      : null,
    campaignContext.contentSummary
      ? `Visible campaign copy: ${campaignContext.contentSummary}`
      : null,
  ].filter(Boolean);

  if (contextLines.length === 0) {
    return "";
  }

  return `\nWhen campaign context is provided, mention the active block label once and keep the reasoning aligned with the campaign details below without referring to internal tools or metadata:\n${contextLines.join("\n")}`;
}

serve(async (req) => {
  // Handle CORS preflight
  const preflightResponse = handleCorsPrelight(req);
  if (preflightResponse) {
    return preflightResponse;
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
    const { campaignContext: rawCampaignContext, prompt } = await req.json();

    if (!prompt) {
      throw new Error("Prompt is required");
    }

    const campaignContext = sanitizeCampaignContext(rawCampaignContext);

    if (!openAIApiKey) {
      throw new Error("OPENAI_API_KEY is not configured");
    }

    console.log("🤔 Generating thinking text for prompt:", prompt);

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openAIApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `You are an AI assistant explaining your thought process for generating garden images.
When a user gives you a prompt, explain in 5-11 conversational lines what you understand from their request.
Break down what they want, what visual elements you'll focus on, colors, lighting, composition, mood, and seasonal context.
Be detailed but natural and conversational. Write as a continuous narrative.
Focus on garden and nature photography aesthetics. Keep each thought flowing naturally.
Start with phrases like "Hmm," or "Let me think about this..." to make it feel natural.${buildThinkingContextInstructions(campaignContext)}`,
          },
          {
            role: "user",
            content: campaignContext
              ? `User prompt: "${prompt}"\nCampaign name: ${campaignContext.campaignName || "Unknown"}\nActive block label: ${campaignContext.blockLabel || "Unknown"}\nVisible campaign copy: ${campaignContext.contentSummary || "None"}\n\nExplain your thinking process for creating this image in 5-11 detailed lines:`
              : `User prompt: "${prompt}"\n\nExplain your thinking process for creating this image in 5-11 detailed lines:`,
          },
        ],
        max_tokens: 300,
        stream: false,
      }),
    });

    console.log("📡 Response status:", response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("❌ OpenAI API error:", response.status, errorText);

      if (response.status === 429) {
        return corsJsonResponse(
          { error: "Rate limit exceeded. Please try again later." },
          { status: 429 },
        );
      }

      if (response.status === 402) {
        return corsJsonResponse(
          { error: "Payment required. Please add credits to your workspace." },
          { status: 402 },
        );
      }

      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const thinkingText = data.choices?.[0]?.message?.content || "";

    console.log("✅ Thinking text generated successfully");

    return corsJsonResponse({ thinkingText });
  } catch (error) {
    console.error("❌ Error in generate-thinking-text:", error);
    return corsJsonResponse(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
});
