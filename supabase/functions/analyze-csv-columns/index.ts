import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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

For each CSV header, suggest which database field it should map to. Consider:
- Similar names (e.g., "Email Address" → email)
- Common variations (e.g., "Cell Phone" → phone)
- Content patterns from sample data
- If no good match exists, return null

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
            content: "You are a data mapping expert. Analyze CSV headers and suggest optimal field mappings." 
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
                        enum: ["first_name", "last_name", "email", "phone", "tags", "persona", "sms_opt_in"],
                        description: "Target database field, or null if no good match"
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
      if (m.databaseField && m.databaseField !== 'null') {
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