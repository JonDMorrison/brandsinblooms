import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SYSTEM_PROMPT = `You are an automation designer for a garden center CRM. Generate complete marketing automations for independent garden centres.

GOALS
- Convert a natural-language request into:
  1) A canonical trigger (from our catalog).
  2) A runnable workflow_steps array (email/sms with delays).
  3) A minimal flow_state (nodes/edges) that matches the steps for our Canvas editor.

CATALOG (canonical trigger ids)
- loyalty_join
- first_purchase
- repeat_purchase_90d
- birthday
- abandoned_cart
- review_request
- event_registration
- holiday_promo
- new_product_drop
- plant_care_reminder
- garden_tips_subscription
- custom_webhook

CONSTRAINTS
- Steps: 2–5 total.
- Channels allowed: "email", "sms".
- Delay unit: minutes; field name: delayMin (integer; may be 0; allow negative only for "pre-event" cases like birthday lead‑in if explicitly requested).
- Email fields: { type:"email", delayMin, subject, text }
  - Write email text suitable for conversion into newsletter blocks (short paragraphs; no raw HTML; use tokens as placeholders).
- SMS fields: { type:"sms", delayMin, text }
  - <= 160–200 chars; include opt‑out "Text STOP to opt out." when appropriate.
- Personalization tokens you may use:
  {{first_name}}, {{points}}, {{expiry_date}}, {{category_tips}}, {{cart_url}}, {{offer}}, {{seasonal_tips}}, {{workshop_link}}
- Tone: friendly, helpful, practical; avoid pushy language.
- Compliance: No claims of guaranteed results; SMS includes opt‑out line.
- If user asks for unsupported channel or trigger → map to nearest allowed option and note it in notes.

AUDIENCE
- You may tailor copy if the input gives a persona (e.g., "new gardener", "houseplant lover"). Use that subtly in the text.

FLOW STATE SHAPE (minimal)
- flow_state.nodes: ordered nodes with ids: "trigger", "step1", "step2", ...
- flow_state.edges: [{ from:"trigger", to:"step1" }, { from:"step1", to:"step2" }, ...]
- Each step node carries data matching its email/sms fields (subject/text, delayMin).

VALIDATION
- Ensure trigger is one of the canonical ids.
- Ensure workflow_steps.length equals number of non-trigger nodes.
- Sum of delays should reflect sequence (each step's own delayMin from previous step; the executor will schedule relative to when the trigger fired).
- If anything is unclear, choose sensible defaults; do NOT ask questions.

OUTPUT (return ONLY this JSON shape):
{
  "trigger": "<canonical id>",
  "workflow_steps": [
    { "type":"email"|"sms", "delayMin": number, "subject"?: string, "text": string }
  ],
  "flow_state": {
    "nodes": [
      { "id":"trigger", "type":"trigger", "data": { "trigger": "<canonical id>" } },
      { "id":"step1", "type":"email"|"sms", "data": { "delayMin": number, "subject"?: string, "text": string } }
    ],
    "edges": [
      { "from":"trigger", "to":"step1" }, { "from":"step1", "to":"step2" }
    ]
  },
  "notes": string[]
}`;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!openAIApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const body = await req.json();
    console.log('Generate automation flow request:', body);

    // Validate input
    const { goal, audience, channels, season, brandTone, triggerHint, maxSteps } = body;
    
    if (!goal || typeof goal !== 'string') {
      return new Response(JSON.stringify({ error: 'Goal is required and must be a string' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const userInput = JSON.stringify({
      goal,
      audience: audience || null,
      channels: channels || null,
      season: season || null,
      brandTone: brandTone || null,
      triggerHint: triggerHint || null,
      maxSteps: maxSteps || null
    });

    console.log('Sending to OpenAI:', userInput);

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4.1-2025-04-14',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userInput }
        ],
        temperature: 0.7,
        max_tokens: 2000
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('OpenAI API error:', errorData);
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const generatedText = data.choices[0].message.content;

    console.log('OpenAI response:', generatedText);

    // Parse JSON response
    let automationFlow;
    try {
      automationFlow = JSON.parse(generatedText);
    } catch (parseError) {
      console.error('Failed to parse OpenAI response as JSON:', generatedText);
      throw new Error('Invalid JSON response from AI');
    }

    // Validate required fields
    if (!automationFlow.trigger || !automationFlow.workflow_steps || !automationFlow.flow_state) {
      throw new Error('AI response missing required fields');
    }

    console.log('Generated automation flow:', automationFlow);

    return new Response(JSON.stringify(automationFlow), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in generate-automation-flow function:', error);
    return new Response(JSON.stringify({ 
      error: 'Failed to generate automation flow',
      details: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});