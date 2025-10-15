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

    // Create client for user authentication
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    
    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: { Authorization: authHeader }
      },
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // Verify the user
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      console.error('[migration-ai-suggest] Auth error:', authError);
      throw new Error('Unauthorized');
    }

    // Create admin client for database operations
    const supabaseAdmin = createClient(
      supabaseUrl,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    // Get user's tenant
    const { data: userRecord } = await supabaseAdmin
      .from('users')
      .select('tenant_id')
      .eq('id', user.id)
      .single();

    const tenantId = userRecord?.tenant_id;
    if (!tenantId) throw new Error('Tenant not found');

    // Get provider artifacts for this job
    const { data: artifacts } = await supabaseAdmin
      .from('provider_artifacts')
      .select('*')
      .eq('import_job_id', jobId);

    if (!artifacts || artifacts.length === 0) {
      throw new Error('No artifacts found for this job');
    }

    // Get existing segments and personas
    const { data: existingSegments } = await supabaseAdmin
      .from('segments')
      .select('id, name, description')
      .eq('tenant_id', tenantId);

    const { data: existingPersonas } = await supabaseAdmin
      .from('crm_personas')
      .select('id, name, description')
      .eq('tenant_id', tenantId);

    const suggestions = [];

    for (const artifact of artifacts) {
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

        const prompt = `You are an AI assistant helping migrate email marketing data. 
        
Analyze this ${artifact.artifact_type} from the provider:
Name: "${artifact.name}"
Member count: ${artifact.member_count}
Sample contacts: ${JSON.stringify(artifact.sample_data?.slice(0, 3))}

Existing BloomSuite setup:
- Segments: ${JSON.stringify(context.existing.segments)}
- Personas: ${JSON.stringify(context.existing.personas)}

Decide:
1. Should this become a new Segment, map to an existing Segment, become a new Persona, map to an existing Persona, or be skipped?
2. Provide a confidence score (0-1)
3. Explain why

Return JSON only.`;

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
          console.error('OpenAI API error:', responseData);
          throw new Error(responseData.error?.message || 'AI suggestion failed');
        }

        const toolCall = responseData.choices[0].message.tool_calls?.[0];
        const suggestion = JSON.parse(toolCall.function.arguments);

        // Store suggestion
        await supabaseAdmin.from('ai_mapping_suggestions').insert({
          import_job_id: jobId,
          tenant_id: tenantId,
          artifact_id: artifact.id,
          suggested_action: suggestion.action,
          target_segment_id: suggestion.action.includes('segment') ? suggestion.target_id : null,
          target_persona_id: suggestion.action.includes('persona') ? suggestion.target_id : null,
          confidence_score: suggestion.confidence,
          rationale: suggestion.rationale,
          suggestion_data: suggestion
        });

        suggestions.push({
          artifact_id: artifact.id,
          artifact_name: artifact.name,
          ...suggestion
        });

        console.log(`[migration-ai-suggest] Generated suggestion for ${artifact.name}`);

      } catch (error) {
        console.error(`[migration-ai-suggest] Error processing ${artifact.name}:`, error);
        suggestions.push({
          artifact_id: artifact.id,
          artifact_name: artifact.name,
          error: error.message
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
