import 'https://deno.land/x/xhr@0.1.0/mod.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!openAIApiKey) {
      throw new Error('OPENAI_API_KEY not configured');
    }

    const { jobId } = await req.json();

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Missing Authorization header');

    // Create admin client with service role key
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabase = createClient(
      supabaseUrl,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Extract JWT token from Authorization header
    const token = authHeader.replace('Bearer ', '');
    
    // Verify user authentication using the token
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      console.error('[migration-ai-suggest] User auth error:', userError);
      throw new Error('Unauthorized');
    }

    console.log('[migration-ai-suggest] Authenticated user:', user.id);

    const { data: userRecord, error: tenantError } = await supabase
      .from('users')
      .select('tenant_id')
      .eq('id', user.id)
      .single();

    if (tenantError || !userRecord?.tenant_id) {
      console.error('[migration-ai-suggest] Tenant lookup error:', tenantError);
      throw new Error('Tenant not found');
    }

    const tenantId = userRecord.tenant_id;
    console.log('[migration-ai-suggest] Tenant ID:', tenantId);

    // Get provider artifacts for this job
    const { data: artifacts, error: artifactsError } = await supabase
      .from('provider_artifacts')
      .select('*')
      .eq('import_job_id', jobId)
      .eq('tenant_id', tenantId);

    if (artifactsError) {
      console.error('[migration-ai-suggest] Error fetching artifacts:', artifactsError);
      throw new Error('Failed to fetch artifacts');
    }

    if (!artifacts || artifacts.length === 0) {
      console.log('[migration-ai-suggest] No artifacts found for job:', jobId);
      throw new Error('No artifacts found for this job. Please run the embed step first.');
    }

    // Transform artifacts to extract sample_data from data jsonb column
    const processedArtifacts = artifacts.map(artifact => ({
      ...artifact,
      sample_data: artifact.data?.sample_data || [],
      description: artifact.data?.description,
      metadata: artifact.data
    }));

    console.log(`[migration-ai-suggest] Found ${processedArtifacts.length} artifacts to analyze`);

    // Get existing segments and personas
    const { data: existingSegments } = await supabase
      .from('segments')
      .select('id, name, description')
      .eq('tenant_id', tenantId);

    const { data: existingPersonas } = await supabase
      .from('crm_personas')
      .select('id, name, description')
      .eq('tenant_id', tenantId);

    // Helper function to validate and convert UUID strings
    function validateUUID(value: string | null | undefined): string | null {
      if (!value) return null;
      
      // UUID format: 8-4-4-4-12 hexadecimal characters
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      
      if (typeof value === 'string' && uuidRegex.test(value)) {
        return value;
      }
      
      console.warn(`Invalid UUID format: ${value}`);
      return null;
    }

    const suggestions = [];

    for (const artifact of processedArtifacts) {
      try {
        // Build context for GPT
        const context = {
          artifact: {
            type: artifact.artifact_type,
            name: artifact.name,
            count: artifact.member_count,
            samples: artifact.sample_data?.slice(0, 5)
          },
          existing: {
            segments: existingSegments?.map(s => ({ name: s.name, description: s.description })) || [],
            personas: existingPersonas?.map(p => ({ name: p.name, description: p.description })) || []
          }
        };

        const prompt = `You are an AI assistant helping migrate email marketing data from ${artifact.provider || 'email provider'} to BloomSuite.

ARTIFACT TO ANALYZE:
- Type: ${artifact.artifact_type} (List or Segment)
- Name: "${artifact.name}"
- Member count: ${artifact.member_count || 0}
- Sample contacts: ${JSON.stringify(artifact.sample_data?.slice(0, 3) || [])}

EXISTING BLOOMSUITE DATA:
Segments (${context.existing.segments.length}):
${context.existing.segments.map(s => `  - "${s.name}": ${s.description || 'No description'}`).join('\n') || '  (none)'}

Personas (${context.existing.personas.length}):
${context.existing.personas.map(p => `  - "${p.name}": ${p.description || 'No description'}`).join('\n') || '  (none)'}

DECISION CRITERIA:
1. **map_to_segment**: If this artifact closely matches an existing Segment (similar name/purpose)
   - Provide the exact segment ID in target_id
   - Confidence should be high (>0.7)

2. **create_segment**: If this should become a NEW Segment (doesn't match existing ones well)
   - Leave target_id as null
   - Provide a clear name in target_name

3. **map_to_persona**: If this represents a customer type (e.g., "VIP Customers", "Frequent Buyers")
   - Provide the exact persona ID in target_id if mapping to existing
   - Confidence should be high (>0.7)

4. **create_persona**: If this should become a NEW Persona
   - Leave target_id as null
   - Provide a clear name in target_name

5. **skip**: If this artifact has too few members (<10) or is test/junk data

IMPORTANT:
- When mapping to existing (map_to_*), ALWAYS provide valid target_id UUID
- When creating new (create_*), ALWAYS provide target_name, leave target_id as null
- Confidence score: 0.8-1.0 for obvious matches, 0.5-0.8 for likely matches, <0.5 for uncertain

Respond with JSON only.`;

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${openAIApiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [
              { role: 'system', content: 'You are a helpful assistant that analyzes email marketing data and returns JSON.' },
              { role: 'user', content: prompt }
            ],
            tools: [{
              type: 'function',
              function: {
                name: 'suggest_mapping',
                description: 'Suggest how to map a provider artifact to BloomSuite',
                parameters: {
                  type: 'object',
                  properties: {
                    action: {
                      type: 'string',
                      enum: ['create_segment', 'map_to_segment', 'create_persona', 'map_to_persona', 'skip']
                    },
                    suggested_type: {
                      type: 'string',
                      enum: ['segment', 'persona', 'none']
                    },
                    target_id: {
                      type: 'string',
                      description: 'ID of existing segment/persona if mapping, null if creating'
                    },
                    target_name: {
                      type: 'string',
                      description: 'Name for new segment/persona or name of existing one'
                    },
                    confidence: {
                      type: 'number',
                      minimum: 0,
                      maximum: 1
                    },
                    rationale: {
                      type: 'string',
                      description: 'Explanation of the recommendation'
                    }
                  },
                  required: ['action', 'suggested_type', 'confidence', 'rationale'],
                  additionalProperties: false
                }
              }
            }],
            tool_choice: { type: 'function', function: { name: 'suggest_mapping' } }
          })
        });

        const responseData = await response.json();
        
        if (!response.ok) {
          console.error('[migration-ai-suggest] OpenAI API error:', responseData);
          throw new Error(responseData.error?.message || 'AI suggestion failed');
        }

        // Validate AI response structure
        const toolCall = responseData.choices[0]?.message?.tool_calls?.[0];
        if (!toolCall) {
          console.error('[migration-ai-suggest] No tool call in response:', responseData);
          throw new Error('AI did not provide a valid suggestion');
        }

        const suggestion = JSON.parse(toolCall.function.arguments);

        // Validate required fields
        if (!suggestion.action || !suggestion.confidence || !suggestion.rationale) {
          console.error('[migration-ai-suggest] Invalid suggestion structure:', suggestion);
          throw new Error('AI suggestion missing required fields');
        }

        // Validate action-specific requirements
        if (['map_to_segment', 'map_to_persona'].includes(suggestion.action)) {
          if (!suggestion.target_id) {
            console.warn(`[migration-ai-suggest] Mapping action without target_id, treating as create instead`);
            suggestion.action = suggestion.action.replace('map_to_', 'create_');
          }
        }

        if (['create_segment', 'create_persona'].includes(suggestion.action)) {
          if (!suggestion.target_name) {
            console.warn(`[migration-ai-suggest] Create action without target_name, using artifact name`);
            suggestion.target_name = artifact.name;
          }
        }

        console.log('[migration-ai-suggest] AI suggestion:', {
          action: suggestion.action,
          target_id: suggestion.target_id,
          target_name: suggestion.target_name,
          confidence: suggestion.confidence
        });

        // Prepare database fields based on action type
        let insertData: any = {
          import_job_id: jobId,
          tenant_id: tenantId,
          artifact_id: artifact.id,
          suggested_action: suggestion.action,
          confidence_score: suggestion.confidence || 0.75,
          rationale: suggestion.rationale || 'No rationale provided',
          suggestion_data: suggestion
        };

        // Map fields based on specific action
        switch (suggestion.action) {
          case 'map_to_segment':
            insertData.target_segment_id = validateUUID(suggestion.target_id);
            if (!insertData.target_segment_id) {
              throw new Error(`Invalid segment UUID for mapping: ${suggestion.target_id}`);
            }
            insertData.target_persona_id = null;
            insertData.new_segment_name = null;
            insertData.new_persona_name = null;
            break;
            
          case 'create_segment':
            insertData.new_segment_name = suggestion.target_name || artifact.name;
            insertData.target_segment_id = null;
            insertData.target_persona_id = null;
            insertData.new_persona_name = null;
            break;
            
          case 'map_to_persona':
            insertData.target_persona_id = validateUUID(suggestion.target_id);
            if (!insertData.target_persona_id) {
              throw new Error(`Invalid persona UUID for mapping: ${suggestion.target_id}`);
            }
            insertData.target_segment_id = null;
            insertData.new_segment_name = null;
            insertData.new_persona_name = null;
            break;
            
          case 'create_persona':
            insertData.new_persona_name = suggestion.target_name || artifact.name;
            insertData.target_persona_id = null;
            insertData.target_segment_id = null;
            insertData.new_segment_name = null;
            break;
            
          case 'skip':
            // No additional fields needed
            insertData.target_segment_id = null;
            insertData.target_persona_id = null;
            insertData.new_segment_name = null;
            insertData.new_persona_name = null;
            break;
            
          default:
            console.warn(`[migration-ai-suggest] Unknown action: ${suggestion.action}`);
            insertData.target_segment_id = null;
            insertData.target_persona_id = null;
            insertData.new_segment_name = null;
            insertData.new_persona_name = null;
        }

        // Insert with error handling
        const { data: insertedSuggestion, error: insertError } = await supabase
          .from('ai_mapping_suggestions')
          .insert(insertData)
          .select()
          .single();

        if (insertError) {
          console.error('[migration-ai-suggest] Insert error:', insertError);
          throw new Error(`Failed to store suggestion: ${insertError.message}`);
        }

        console.log('[migration-ai-suggest] Stored suggestion:', insertedSuggestion.id);

        suggestions.push({
          artifact_id: artifact.id,
          artifact_name: artifact.name,
          ...suggestion
        });

        console.log(`[migration-ai-suggest] Generated suggestion for ${artifact.name}`);

      } catch (artifactError) {
        console.error(`[migration-ai-suggest] Error processing artifact ${artifact.id}:`, artifactError);
        
        // Store error suggestion so UI can show failures
        await supabase.from('ai_mapping_suggestions').insert({
          import_job_id: jobId,
          tenant_id: tenantId,
          artifact_id: artifact.id,
          suggested_action: 'skip',
          confidence_score: 0,
          rationale: `Error during analysis: ${artifactError.message}`,
          suggestion_data: { error: true, message: artifactError.message },
          target_segment_id: null,
          target_persona_id: null,
          new_segment_name: null,
          new_persona_name: null
        }).catch(e => console.error('[migration-ai-suggest] Failed to store error suggestion:', e));
        
        suggestions.push({
          artifact_id: artifact.id,
          artifact_name: artifact.name,
          error: artifactError.message
        });
      }
    }

    return new Response(
      JSON.stringify({ suggestions }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[migration-ai-suggest] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  }
});
