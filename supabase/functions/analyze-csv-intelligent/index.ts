import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, traceparent, tracestate',
};

interface AnalyzeCSVRequest {
  csvRows: string[][];
  delimiter: string;
  columnCount: number;
}

// Valid field keys from shared schema (must match src/lib/crm/customerImportSchema.ts)
const VALID_FIELD_KEYS = [
  'email',
  'first_name',
  'last_name',
  'lifetime_value',
  'first_purchase_date',
  'last_purchase_date',
  'email_opt_in',
  'date_of_birth',
  'company_name',
  'address_line1',
  'address_line2',
  'city',
  'state',
  'postal_code',
  'reference_id',
  'square_customer_id',
  'creation_source',
  'transaction_count',
  'memo',
  'instant_profile',
  // Additional fields used by import but not in core schema
  'phone',
  'sms_opt_in',
  'tags',
  'persona',
  'notes',
  'external_id',
  'skip'
] as const;

type ValidFieldKey = typeof VALID_FIELD_KEYS[number];

// Known header mappings from Square/Mailchimp exports
const KNOWN_HEADER_MAPPINGS: Record<string, ValidFieldKey> = {
  // Email variations
  'email': 'email',
  'email address': 'email',
  'e-mail': 'email',
  'emailaddress': 'email',
  
  // Name fields
  'first name': 'first_name',
  'firstname': 'first_name',
  'first': 'first_name',
  'given name': 'first_name',
  'last name': 'last_name',
  'lastname': 'last_name',
  'last': 'last_name',
  'surname': 'last_name',
  'family name': 'last_name',
  
  // Financial fields
  'lifetime spend': 'lifetime_value',
  'lifetime value': 'lifetime_value',
  'total spent': 'lifetime_value',
  'total spend': 'lifetime_value',
  'ltv': 'lifetime_value',
  
  // Date fields
  'first visit': 'first_purchase_date',
  'first purchase': 'first_purchase_date',
  'first purchase date': 'first_purchase_date',
  'first order date': 'first_purchase_date',
  'last visit': 'last_purchase_date',
  'last purchase': 'last_purchase_date',
  'last purchase date': 'last_purchase_date',
  'last order date': 'last_purchase_date',
  
  // Marketing consent
  'email subscription status': 'email_opt_in',
  'email opt-in': 'email_opt_in',
  'email optin': 'email_opt_in',
  'subscribed': 'email_opt_in',
  'sms opt-in': 'sms_opt_in',
  'sms optin': 'sms_opt_in',
  
  // Personal info
  'birthday': 'date_of_birth',
  'date of birth': 'date_of_birth',
  'dob': 'date_of_birth',
  'birth date': 'date_of_birth',
  'company': 'company_name',
  'company name': 'company_name',
  'organization': 'company_name',
  
  // Address fields
  'street address': 'address_line1',
  'street address 1': 'address_line1',
  'address': 'address_line1',
  'address 1': 'address_line1',
  'address line 1': 'address_line1',
  'street address 2': 'address_line2',
  'address 2': 'address_line2',
  'address line 2': 'address_line2',
  'apt': 'address_line2',
  'suite': 'address_line2',
  'city': 'city',
  'state': 'state',
  'province': 'state',
  'state/province': 'state',
  'zip': 'postal_code',
  'zip code': 'postal_code',
  'postal code': 'postal_code',
  'postcode': 'postal_code',
  
  // Square-specific fields
  'reference id': 'reference_id',
  'customer id': 'external_id',
  'square customer id': 'square_customer_id',
  'creation source': 'creation_source',
  'transaction count': 'transaction_count',
  'memo': 'memo',
  'notes': 'notes',
  'instant profile': 'instant_profile',
  
  // Skip fields
  'nickname': 'skip',
  'phone': 'phone',
  'phone number': 'phone',
  'mobile': 'phone',
  'cell': 'phone',
  'tags': 'tags',
  'persona': 'persona',
};

function normalizeHeader(header: string): string {
  return header.toLowerCase().trim().replace(/[_-]/g, ' ');
}

function getKnownMapping(header: string): ValidFieldKey | null {
  const normalized = normalizeHeader(header);
  return KNOWN_HEADER_MAPPINGS[normalized] || null;
}

function isValidFieldKey(key: string): key is ValidFieldKey {
  return VALID_FIELD_KEYS.includes(key as ValidFieldKey);
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

    // Build the allowed fields list for the AI prompt
    const allowedFieldsDescription = `
ALLOWED FIELD KEYS (use ONLY these values for suggestedField):
- email: Email address (REQUIRED for import)
- first_name: Customer's first name
- last_name: Customer's last name
- phone: Phone number
- lifetime_value: Lifetime spend/value (currency amounts)
- first_purchase_date: First visit or purchase date
- last_purchase_date: Last visit or purchase date
- email_opt_in: Email subscription status (subscribed/unsubscribed, yes/no)
- sms_opt_in: SMS marketing consent
- date_of_birth: Birthday
- company_name: Company or business name
- address_line1: Street address line 1
- address_line2: Street address line 2 (apt, suite)
- city: City name
- state: State/province
- postal_code: ZIP or postal code
- reference_id: Reference ID from external system
- square_customer_id: Square Customer ID
- creation_source: Source of customer creation
- transaction_count: Number of transactions
- memo: Memo or notes
- instant_profile: Instant Profile data
- notes: General notes
- external_id: External customer ID
- tags: Comma-separated tags
- persona: Customer persona/type
- skip: Don't import this column (use for unrecognized columns)`;

    const knownMappingsDescription = `
KNOWN HEADER MAPPINGS (use these exact mappings when you see these headers):
- "Email Address" → email
- "First Name" → first_name
- "Last Name" → last_name
- "Lifetime Spend" → lifetime_value
- "First Visit" → first_purchase_date
- "Last Visit" → last_purchase_date
- "Email Subscription Status" → email_opt_in
- "Birthday" → date_of_birth
- "Company Name" → company_name
- "Street Address 1" → address_line1
- "Street Address 2" → address_line2
- "City" → city
- "State" → state
- "Postal Code" → postal_code
- "Reference ID" → reference_id
- "Square Customer ID" → square_customer_id
- "Creation Source" → creation_source
- "Transaction Count" → transaction_count
- "Memo" → memo
- "Instant Profile" → instant_profile
- "Nickname" → skip`;

    const systemPrompt = `You are an expert CSV data analyst specializing in customer data imports for CRM systems.

${allowedFieldsDescription}

${knownMappingsDescription}

CRITICAL RULES:
1. You MUST ONLY use field keys from the ALLOWED FIELD KEYS list above.
2. NEVER invent new field keys.
3. If a column doesn't match any field, use "skip".
4. "Email Subscription Status" MUST map to "email_opt_in", not "sms_opt_in".
5. Email detection is CRITICAL - look for @ symbol patterns in data.
6. Provide confidence levels honestly - use 'low' if uncertain.

Rules for Column Naming:
1. If the first row appears to be a header row, use it (cleaned up)
2. If the first row is data, analyze the pattern and generate a semantic name
3. If uncertain, use "Column N" format where N is 1-based column number`;

    const userPrompt = `Analyze this CSV data sample (first 5 rows):

Delimiter: ${delimiter}
Number of columns detected: ${columnCount}

CSV Data:
${JSON.stringify(csvRows, null, 2)}

Tasks:
1. Determine if row 1 is a header or data
2. For each column, provide a name (use "Column N" format if unsure)
3. Check data consistency across all ${csvRows.length} rows
4. Suggest the best database field mapping for each column using ONLY the allowed field keys
5. Provide confidence levels and reasoning

IMPORTANT: Only use field keys from the allowed list. Use "skip" for any column that doesn't match.`;

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
            description: 'Analyze CSV data for consistency and suggest field mappings using only allowed field keys',
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
                        enum: [...VALID_FIELD_KEYS],
                        description: 'Database field key to map this column to (must be from allowed list)'
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
    console.log('OpenAI response received');

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
    console.log('Parsed analysis columns:', analysis.columns?.length);

    // Validate and sanitize AI response - force invalid field keys to "skip"
    const validatedColumns = analysis.columns.map((col: any) => {
      let suggestedField = col.suggestedField;
      
      // First, check if we have a known mapping for this header
      const knownMapping = getKnownMapping(col.columnName);
      if (knownMapping) {
        console.log(`Using known mapping for "${col.columnName}": ${knownMapping}`);
        suggestedField = knownMapping;
      }
      
      // Validate the field key
      if (!isValidFieldKey(suggestedField)) {
        console.warn(`Invalid field key "${suggestedField}" for column "${col.columnName}", forcing to "skip"`);
        suggestedField = 'skip';
      }
      
      return {
        ...col,
        suggestedField
      };
    });

    // Format response
    const result = {
      success: true,
      analysis: {
        columnNames: validatedColumns.map((c: any) => c.columnName),
        dataConsistency: {
          isConsistent: analysis.dataConsistency.isConsistent,
          issues: analysis.dataConsistency.issues || [],
          rowsAnalyzed: csvRows.length
        },
        suggestedMappings: validatedColumns.map((c: any) => ({
          columnIndex: c.columnIndex,
          columnName: c.columnName,
          suggestedField: c.suggestedField,
          confidence: c.confidence,
          reasoning: c.reasoning
        }))
      }
    };

    console.log('Returning validated analysis with', validatedColumns.length, 'columns');

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
