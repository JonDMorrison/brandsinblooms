import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AnalyzeCSVRequest {
  csvRows: string[][];
  delimiter: string;
  columnCount: number;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { csvRows, delimiter, columnCount }: AnalyzeCSVRequest = await req.json();
    
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    if (!OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY not configured');
    }

    // Build AI prompt
    const systemPrompt = `You are an expert CSV data analyst specializing in customer data imports. Your job is to analyze CSV data samples and provide intelligent column naming and field mapping suggestions.

You have access to the following database fields:
- email: Email address (CRITICAL - this field is required for import)
- first_name: Customer's first name
- last_name: Customer's last name
- phone: Phone number (any format)
- tags: Comma-separated tags or categories
- persona: Customer persona/type (e.g., "VIP", "Regular", "New")
- sms_opt_in: SMS marketing consent (yes/no, true/false, 1/0)
- skip: Don't import this column

Rules for Column Naming:
1. If the first row appears to be a header row, use it (cleaned up)
2. If the first row is data, analyze the data pattern and generate a semantic name
3. If you cannot confidently determine a name, use the format "Column N" where N is the 1-based column number
4. You can combine approaches: "Email (Column 2)" if you're somewhat confident

Rules for Field Mapping:
1. Email detection is CRITICAL - be aggressive in detecting email columns
2. Look for email patterns in data if headers are unclear
3. Use 'skip' for columns that don't match any database field
4. Provide 'low' confidence when unsure rather than forcing a mapping
5. Use reasoning to explain your decisions

Rules for Data Consistency:
1. Check if all rows have the same number of columns
2. Identify rows with all empty values
3. Detect potential delimiter confusion (e.g., commas within quoted fields)
4. Flag rows where data type doesn't match expected pattern`;

    const userPrompt = `Analyze this CSV data sample (first 5 rows):

Delimiter: ${delimiter}
Number of columns detected: ${columnCount}

CSV Data:
${JSON.stringify(csvRows, null, 2)}

Tasks:
1. Determine if row 1 is a header or data
2. For each column, provide a name (use "Column N" format if unsure)
3. Check data consistency across all ${csvRows.length} rows
4. Suggest the best database field mapping for each column
5. Provide confidence levels and reasoning

Remember: Always include the column number in parentheses if there's any uncertainty, like "First Name (Column 2)" or just "Column 3" if you can't determine the content type.`;

    // Call OpenAI with function calling
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        tools: [{
          type: 'function',
          function: {
            name: 'analyze_csv_structure',
            description: 'Analyze CSV data for consistency and suggest field mappings',
            parameters: {
              type: 'object',
              properties: {
                dataConsistency: {
                  type: 'object',
                  properties: {
                    isConsistent: { type: 'boolean' },
                    issues: { 
                      type: 'array', 
                      items: { type: 'string' },
                      description: 'List of specific data consistency problems found'
                    }
                  },
                  required: ['isConsistent', 'issues']
                },
                columns: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      columnIndex: { 
                        type: 'number',
                        description: 'Zero-based column index'
                      },
                      columnName: { 
                        type: 'string',
                        description: 'Meaningful name if detectable, otherwise "Column N" where N is column number (1-based)'
                      },
                      suggestedField: {
                        type: 'string',
                        enum: ['email', 'first_name', 'last_name', 'phone', 'tags', 'persona', 'sms_opt_in', 'skip'],
                        description: 'Database field to map this column to'
                      },
                      confidence: {
                        type: 'string',
                        enum: ['high', 'medium', 'low'],
                        description: 'Confidence level in this mapping suggestion'
                      },
                      reasoning: { 
                        type: 'string',
                        description: 'Brief explanation of why this mapping was chosen'
                      }
                    },
                    required: ['columnIndex', 'columnName', 'suggestedField', 'confidence', 'reasoning']
                  }
                }
              },
              required: ['dataConsistency', 'columns']
            }
          }
        }],
        tool_choice: { type: 'function', function: { name: 'analyze_csv_structure' } }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ 
            success: false,
            error: 'Rate limit exceeded. Please try again in a moment.' 
          }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      if (response.status === 401) {
        return new Response(
          JSON.stringify({ 
            success: false,
            error: 'OpenAI API key is invalid. Please check configuration.' 
          }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      throw new Error(`OpenAI API returned ${response.status}: ${errorText}`);
    }

    const aiResponse = await response.json();
    console.log('OpenAI response:', JSON.stringify(aiResponse, null, 2));

    // Extract tool call result
    const toolCall = aiResponse.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      console.error('No tool call in AI response');
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'AI analysis failed to return structured data' 
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const analysis = JSON.parse(toolCall.function.arguments);
    console.log('Parsed analysis:', analysis);

    // Format response
    const result = {
      success: true,
      analysis: {
        columnNames: analysis.columns.map((c: any) => c.columnName),
        dataConsistency: {
          isConsistent: analysis.dataConsistency.isConsistent,
          issues: analysis.dataConsistency.issues || [],
          rowsAnalyzed: csvRows.length
        },
        suggestedMappings: analysis.columns.map((c: any) => ({
          columnIndex: c.columnIndex,
          columnName: c.columnName,
          suggestedField: c.suggestedField,
          confidence: c.confidence,
          reasoning: c.reasoning
        }))
      }
    };

    return new Response(
      JSON.stringify(result),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error: any) {
    console.error('Error in analyze-csv-intelligent:', error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message || 'Internal server error'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
