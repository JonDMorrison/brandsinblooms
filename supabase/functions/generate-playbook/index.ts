import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const openAIApiKey = Deno.env.get("OPENAI_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

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
    { global: { headers: { Authorization: authHeader } } }
  );

  const { error: authError } = await supabase.auth.getUser();
  if (authError) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const {
      job_type,
      audience = "Both",
      trade_name = "",
      tenant_id,
    } = await req.json();

    if (!job_type) {
      return new Response(
        JSON.stringify({ error: "job_type is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!openAIApiKey) {
      return new Response(
        JSON.stringify({ error: "OpenAI API key not configured" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Build context parts
    const audienceContext =
      audience !== "Both" ? ` The audience is ${audience}.` : "";
    const tradeContext = trade_name
      ? ` Focus on the ${trade_name} trade.`
      : "";

    const systemPrompt =
      "You are a senior construction project manager with 20 years of experience across residential, commercial, and industrial projects. You generate detailed, realistic playbooks that reflect how real contractors run jobs. Be specific with task names, realistic hour estimates, and actual trade/role names.";

    const userPrompt = `Generate a detailed, realistic playbook for a "${job_type}" project.${audienceContext}${tradeContext}

Return a complete JSON object with this exact schema:
{
  "name": "string - descriptive playbook name",
  "job_type": "${job_type}",
  "description": "string - 1-2 sentence description of this playbook",
  "confidence_score": 0,
  "data_quality_note": "Generated from industry best practices",
  "projects_analyzed": 0,
  "total_hours_band": { "low": number, "high": number },
  "phases": [
    {
      "name": "string - phase name",
      "description": "string - what happens in this phase",
      "sequence_order": number,
      "tasks": [
        {
          "title": "string - specific task name",
          "description": "string - what this task involves",
          "estimated_hours": number,
          "baseline_role_type": "string - trade or role name",
          "sequence_order": number
        }
      ]
    }
  ]
}

Include 4-7 phases with 3-6 tasks each. Be specific — real task names, realistic hour estimates, actual trade names. This should reflect how real contractors run this type of job.`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openAIApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.7,
        max_tokens: 4000,
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      const errBody = await response.text();
      console.error("OpenAI API error:", response.status, errBody);
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices[0].message.content;

    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch (parseErr) {
      console.error("Failed to parse OpenAI response:", parseErr, content);
      throw new Error("Failed to parse AI response");
    }

    // Validate structure
    if (!parsed.name || !Array.isArray(parsed.phases) || parsed.phases.length === 0) {
      console.error("Invalid playbook structure:", parsed);
      throw new Error("AI returned invalid playbook structure");
    }

    // Ensure all fields exist
    const result = {
      name: parsed.name,
      job_type: parsed.job_type || job_type,
      description: parsed.description || "",
      confidence_score: parsed.confidence_score ?? 0,
      data_quality_note:
        parsed.data_quality_note || "Generated from industry best practices",
      projects_analyzed: parsed.projects_analyzed ?? 0,
      total_hours_band: parsed.total_hours_band || { low: 0, high: 0 },
      phases: parsed.phases.map((phase: any, pi: number) => ({
        name: phase.name,
        description: phase.description || "",
        sequence_order: phase.sequence_order ?? pi,
        tasks: Array.isArray(phase.tasks)
          ? phase.tasks.map((task: any, ti: number) => ({
              title: task.title,
              description: task.description || "",
              estimated_hours: task.estimated_hours ?? 0,
              baseline_role_type: task.baseline_role_type || "General",
              sequence_order: task.sequence_order ?? ti,
            }))
          : [],
      })),
    };

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in generate-playbook:", error);
    return new Response(
      JSON.stringify({ error: (error as Error).message || "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
