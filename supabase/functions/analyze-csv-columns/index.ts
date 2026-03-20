import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, traceparent, tracestate",
};

interface AnalyzeRequest {
  headers: string[];
  sampleRows?: Record<string, string>[];
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // SECURITY: [E25] - Add JWT authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Authorization required' }), { status: 401, headers: corsHeaders });
    }

    const { headers: csvHeaders, sampleRows }: AnalyzeRequest = await req.json();
    
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY not configured");
    }

    // Build context for AI
    const sampleData = sampleRows && sampleRows.length > 0 
      ? `\n\nSample data rows:\n${JSON.stringify(sampleRows.slice(0, 3), null, 2)}`
      : '';

    const prompt = `Analyze these CSV column headers and map them to our customer database fields.

CSV Headers: ${csvHeaders.join(', ')}${sampleData}

Our database fields:
- first_name: Customer's first name
- last_name: Customer's last name  
- email: Email address (required for most customers)
- phone: Phone number in E.164 format (+15554443333)
- tags: Comma-separated tags/categories
- persona: Customer persona (newbie, struggler, regular, expert)
- sms_opt_in: Whether customer opted into SMS (true/false)
- email_opt_in: Whether customer opted into email marketing (true/false) - use for "Email Subscription Status", "Subscribed", etc.
- date_of_birth: Customer birthday/date of birth (for birthday campaigns)
- first_purchase_date: Date of first purchase/visit
- last_purchase_date: Date of last purchase/visit
- lifetime_value: Total lifetime spend amount
- company_name: Business/company name
- address_line1: Street address line 1
- address_line2: Street address line 2 (apt, suite, etc.)
- city: City name
- state: State/province
- postal_code: ZIP/postal code
- notes: Memo, notes, or comments
- external_id: External system ID (Square Customer ID, Shopify ID, etc.)
- skip: Column should be skipped/not imported

For each CSV header, suggest which database field it should map to. Consider:
- Similar names (e.g., "Email Address" → email, "First Name" → first_name)
- Common variations (e.g., "Cell Phone" → phone, "Birthday" → date_of_birth)
- Square-specific columns (e.g., "Square Customer ID" → external_id, "Lifetime Spend" → lifetime_value)
- Subscription status (e.g., "Email Subscription Status" → email_opt_in, "Subscribed" → email_opt_in)
- Visit dates (e.g., "First Visit" → first_purchase_date, "Last Visit" → last_purchase_date)
- Address components should map to individual fields
- Transaction counts and similar metadata → skip
- Creation Source and similar system metadata → skip

Return your analysis as a mapping object.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { 
            role: "system", 
            content: "You are a data mapping expert. Analyze CSV headers and suggest optimal field mappings. Pay special attention to email subscription status fields which should map to email_opt_in (not sms_opt_in)." 
          },
          { role: "user", content: prompt }
        ],
        tools: [{
          type: "function",
          function: {
            name: "suggest_column_mapping",
            description: "Return suggested mappings from CSV columns to database fields",
            parameters: {
              type: "object",
              properties: {
                mappings: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      csvHeader: { type: "string", description: "Original CSV column name" },
                      databaseField: { 
                        type: "string", 
                        enum: [
                          "first_name", "last_name", "email", "phone", "tags", "persona",
                          "sms_opt_in", "email_opt_in", "date_of_birth", 
                          "first_purchase_date", "last_purchase_date", "lifetime_value",
                          "company_name", "address_line1", "address_line2", 
                          "city", "state", "postal_code", "notes", "external_id", "skip"
                        ],
                        description: "Target database field"
                      },
                      confidence: { 
                        type: "string", 
                        enum: ["high", "medium", "low"],
                        description: "Confidence level of the mapping"
                      },
                      reasoning: { type: "string", description: "Brief explanation of why this mapping was suggested" }
                    },
                    required: ["csvHeader", "databaseField", "confidence", "reasoning"],
                    additionalProperties: false
                  }
                }
              },
              required: ["mappings"],
              additionalProperties: false
            }
          }
        }],
        tool_choice: { type: "function", function: { name: "suggest_column_mapping" } }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI Gateway error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Please add credits to your workspace." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      throw new Error(`AI Gateway returned ${response.status}: ${errorText}`);
    }

    const aiResponse = await response.json();
    console.log("AI response:", JSON.stringify(aiResponse, null, 2));

    // Extract tool call result
    const toolCall = aiResponse.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      throw new Error("No tool call in AI response");
    }

    const mappings = JSON.parse(toolCall.function.arguments);
    console.log("Extracted mappings:", mappings);

    // Convert to simple key-value format for the UI
    const columnMapping: Record<string, string> = {};
    const suggestions: Record<string, { confidence: string; reasoning: string }> = {};
    
    mappings.mappings.forEach((m: any) => {
      if (m.databaseField && m.databaseField !== 'null' && m.databaseField !== 'skip') {
        columnMapping[m.databaseField] = m.csvHeader;
        suggestions[m.databaseField] = {
          confidence: m.confidence,
          reasoning: m.reasoning
        };
      }
    });

    return new Response(
      JSON.stringify({ 
        success: true,
        columnMapping,
        suggestions,
        rawMappings: mappings.mappings
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );

  } catch (error: any) {
    console.error("Error in analyze-csv-columns:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
