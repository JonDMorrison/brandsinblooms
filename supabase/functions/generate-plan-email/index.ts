import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders, handleCorsPrelight, corsJsonResponse } from "../_shared/cors.ts";

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

interface EmailGenerationRequest {
  month: string;
  themes: Array<{
    id: string;
    label: string;
    description?: string;
  }>;
  companyProfile?: {
    company_name?: string;
    brand_voice?: string;
    target_audience?: string;
  };
  constraints?: {
    subjectLength?: number;
    preheaderLength?: number;
    tone?: string;
  };
  emailType?: 'promotional' | 'newsletter' | 'announcement';
}

interface EmailContent {
  subject: string;
  preheader: string;
  body: string;
  cta_primary?: string;
  alt_subjects?: string[];
  notes?: string;
  imageQuery?: string;
}

const serve_handler = async (req: Request): Promise<Response> => {
  const corsResponse = handleCorsPrelight(req);
  if (corsResponse) return corsResponse;

  try {
    const requestId = crypto.randomUUID().substring(0, 8);
    console.log(`[${requestId}] Email generation request started`);

    const {
      month,
      themes,
      companyProfile,
      constraints = {},
      emailType = 'promotional'
    }: EmailGenerationRequest = await req.json();

    console.log(`[${requestId}] Request data:`, { month, themes: themes.map(t => t.label), emailType });

    if (!openAIApiKey) {
      console.error(`[${requestId}] OpenAI API key not configured`);
      return corsJsonResponse({ error: 'OpenAI API key not configured' }, { status: 500 });
    }

    // Build context for the AI
    const themeContext = themes.map(t => `${t.label}${t.description ? `: ${t.description}` : ''}`).join('; ');
    const monthName = new Date(`${month}-01`).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    
    const companyContext = companyProfile?.company_name 
      ? `Company: ${companyProfile.company_name}. Brand voice: ${companyProfile.brand_voice || 'professional'}. Target audience: ${companyProfile.target_audience || 'gardening enthusiasts'}.`
      : 'Target audience: gardening enthusiasts.';

    const systemPrompt = `You are an expert email copywriter specializing in gardening and seasonal marketing. Generate compelling email content that:

1. NEVER uses generic openings like "Welcome to [Month]" or "As we enter [Season]"
2. Focuses on specific benefits and seasonal timing
3. Includes actionable gardening advice
4. Uses clear, benefit-driven language
5. Contains exactly ONE primary call-to-action
6. Avoids mentioning specific "Week" numbers
7. Speaks directly to gardening enthusiasts

${companyContext}

Content specifications:
- Subject line: ${constraints.subjectLength || 50} characters max, compelling and specific
- Preheader: ${constraints.preheaderLength || 90} characters max, complements subject
- Body: 100-150 words MAX, scannable with short paragraphs (2-3 sentences each)
- Tone: ${constraints.tone || 'expert yet approachable'}
- Format: Use HTML tags for structure (<h3> for headings, <p> for paragraphs, <strong> for emphasis)

🎨 IMAGE QUERY GENERATION:
Generate a descriptive Unsplash search query (3-6 words) for the email hero image.
Focus on visually compelling garden center content that matches the email theme.
Be specific with plant names, seasons, and visual elements.

Return structured output with: subject, preheader, body, cta_primary, imageQuery`;

    const userPrompt = `Create ${emailType} email content for ${monthName} focused on: ${themeContext}

Requirements:
- Make it timely and specific to ${monthName} gardening activities
- Include seasonal urgency without being pushy  
- Provide concrete value (tips, timing, plant recommendations)
- End with a clear, specific call-to-action
- No generic seasonal greetings
- Use HTML formatting: <h3> for main heading, <p> for short paragraphs, <strong> for key points
- Keep paragraphs to 2-3 sentences maximum
- Maximum 150 words total
- Structure: Brief intro + 2-3 key points + call to action

Example format:
<h3>Main Benefit/Heading</h3>
<p>Short intro paragraph (2-3 sentences).</p>
<p><strong>Key Point 1:</strong> Brief explanation with benefit.</p>
<p><strong>Key Point 2:</strong> Another brief tip or recommendation.</p>
<p>Closing with urgency and transition to CTA.</p>`;

    console.log(`[${requestId}] Calling OpenAI with themes: ${themeContext}`);

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        max_tokens: 700,
        temperature: 0.8,
        tools: [
          {
            type: "function",
            function: {
              name: "return_email_content",
              description: "Return the generated email content with Unsplash image query",
              parameters: {
                type: "object",
                properties: {
                  subject: { type: "string", description: "Email subject line" },
                  preheader: { type: "string", description: "Email preheader text" },
                  body: { type: "string", description: "HTML email body content" },
                  cta_primary: { type: "string", description: "Primary call-to-action text" },
                  imageQuery: {
                    type: "string",
                    description: "3-5 word Unsplash search query. MUST include 'garden', 'nursery', or 'botanical'. Focus on visual plants and garden scenes."
                  }
                },
                required: ["subject", "preheader", "body", "cta_primary", "imageQuery"],
                additionalProperties: false
              }
            }
          }
        ],
        tool_choice: {
          type: "function",
          function: { name: "return_email_content" }
        }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[${requestId}] OpenAI API error:`, response.status, errorText);
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    
    // Extract structured output from tool call
    const toolCall = data.choices[0].message.tool_calls?.[0];
    let emailContent: EmailContent;
    
    if (toolCall && toolCall.function.arguments) {
      try {
        emailContent = JSON.parse(toolCall.function.arguments);
        console.log(`[${requestId}] Structured output received with imageQuery: "${emailContent.imageQuery}"`);
      } catch (parseError) {
        console.error(`[${requestId}] Failed to parse tool call:`, parseError);
        throw parseError;
      }
    } else {
      console.error(`[${requestId}] No structured output received, using fallback`);
      // Fallback to structured extraction
      emailContent = {
        subject: `${themes[0]?.label || 'Seasonal'} Tips for ${monthName}`,
        preheader: `Expert advice for your ${monthName.toLowerCase()} garden`,
        body: `<h3>Perfect Timing for Your Garden</h3><p>Get the most out of your garden this ${monthName} with expert timing and seasonal recommendations.</p><p><strong>This Month's Focus:</strong> Perfect conditions await for your next gardening success.</p>`,
        cta_primary: 'Get Started Today',
        imageQuery: 'garden center seasonal display'
      };
    }

    // Sanitize content to remove week references
    const sanitizeWeekReferences = (text: string) => {
      return text
        .replace(/\b(Week|week)\s+\d+\b/g, 'this period')
        .replace(/\b(Weekly|weekly)\s+/g, 'regular ')
        .replace(/\bthis week\b/gi, 'right now')
        .replace(/\bnext week\b/gi, 'soon');
    };

    emailContent.subject = sanitizeWeekReferences(emailContent.subject);
    emailContent.preheader = sanitizeWeekReferences(emailContent.preheader);
    emailContent.body = sanitizeWeekReferences(emailContent.body);

    // Add generation metadata
    emailContent.notes = `Generated for ${monthName} | Themes: ${themes.map(t => t.label).join(', ')} | AI Generated`;

    console.log(`[${requestId}] Successfully generated email content`);

    return corsJsonResponse(emailContent);

  } catch (error: any) {
    console.error('Error in generate-plan-email function:', error);
    return corsJsonResponse(
      { error: error.message || 'Failed to generate email content' }, 
      { status: 500 }
    );
  }
};

serve(serve_handler);