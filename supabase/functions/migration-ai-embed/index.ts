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
      console.error('[migration-ai-embed] User auth error:', userError);
      throw new Error('Unauthorized');
    }

    console.log('[migration-ai-embed] Authenticated user:', user.id);

    const { data: userData, error: tenantError } = await supabase
      .from('users')
      .select('tenant_id')
      .eq('id', user.id)
      .single();

    if (tenantError || !userData?.tenant_id) {
      console.error('[migration-ai-embed] Tenant lookup error:', tenantError);
      throw new Error('No tenant found for user');
    }

    // Get job to fetch artifacts from provider
    const { data: job } = await supabase
      .from('import_jobs')
      .select('provider, config')
      .eq('id', jobId)
      .eq('user_id', user.id)
      .single();

    if (!job) throw new Error('Job not found');

    // Get provider connection
    const { data: connection } = await supabase
      .from('provider_connections')
      .select('*')
      .eq('tenant_id', userData.tenant_id)
      .eq('provider', job.provider)
      .eq('status', 'connected')
      .single();

    if (!connection) throw new Error('Provider not connected');

    // Build artifacts from job config (simplified - in production would fetch from provider API)
    const artifacts = [];
    const config = job.config as any;
    
    if (config.listIds) {
      for (const listId of config.listIds) {
        artifacts.push({
          artifact_type: 'list',
          external_id: listId,
          name: `List ${listId}`,
          member_count: 0,
          sample_data: [],
          description: `Mailchimp list imported from ${connection.provider_account_name || 'provider'}`,
          provider_metadata: {
            list_id: listId,
            connection_id: connection.id
          }
        });
      }
    }

    if (config.segmentIds) {
      for (const segmentId of config.segmentIds) {
        const [listId, segId] = segmentId.split(':');
        artifacts.push({
          artifact_type: 'segment',
          external_id: segmentId,
          name: `Segment ${segId}`,
          member_count: 0,
          sample_data: [],
          description: `Mailchimp segment from list ${listId}`,
          provider_metadata: {
            segment_id: segId,
            list_id: listId,
            connection_id: connection.id
          }
        });
      }
    }

    const results = [];

    for (const artifact of artifacts) {
      try {
        // Create embedding text from artifact data
        const embeddingText = [
          `Type: ${artifact.artifact_type}`,
          `Name: ${artifact.name}`,
          artifact.description ? `Description: ${artifact.description}` : '',
          artifact.member_count ? `Members: ${artifact.member_count}` : '',
          artifact.sample_data?.length > 0 
            ? `Sample contacts: ${artifact.sample_data.slice(0, 3).map((s: any) => 
                `${s.email || ''} ${s.tags?.join(' ') || ''}`.trim()
              ).join(', ')}`
            : '',
          artifact.provider_metadata 
            ? `Source: ${artifact.provider_metadata.list_id || artifact.provider_metadata.segment_id}`
            : ''
        ].filter(Boolean).join(' | ');

        console.log(`[migration-ai-embed] Embedding text for ${artifact.name}:`, embeddingText.substring(0, 100) + '...');

        // Get embedding from OpenAI
        const embeddingRes = await fetch('https://api.openai.com/v1/embeddings', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${openAIApiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: 'text-embedding-3-small',
            input: embeddingText
          })
        });

        const embeddingData = await embeddingRes.json();
        
        if (!embeddingRes.ok) {
          console.error('OpenAI embedding error:', embeddingData);
          throw new Error(embeddingData.error?.message || 'Embedding failed');
        }

        const embedding = embeddingData.data[0].embedding;

        // Store artifact with embedding
        const { data: stored, error } = await supabase
          .from('provider_artifacts')
          .insert({
            import_job_id: jobId,
            tenant_id: userData.tenant_id,
            provider: job.provider,
            artifact_type: artifact.artifact_type,
            external_id: artifact.external_id,
            name: artifact.name,
            member_count: artifact.member_count,
            data: {
              sample_data: artifact.sample_data || [],
              user_id: user.id,
              description: artifact.description,
              provider_metadata: artifact.provider_metadata,
              raw_metadata: artifact
            },
            embedding: JSON.stringify(embedding)
          })
          .select()
          .single();

        if (error) {
          console.error(`[migration-ai-embed] Database error for ${artifact.name}:`, {
            error: error,
            code: error.code,
            message: error.message,
            details: error.details,
            hint: error.hint
          });
          throw new Error(`Failed to store artifact: ${error.message}`);
        }

        console.log(`[migration-ai-embed] ✓ Created embedding for ${artifact.name} (ID: ${stored.id})`);

        results.push({
          id: stored.id,
          name: artifact.name,
          artifact_type: artifact.artifact_type,
          member_count: artifact.member_count,
          success: true
        });

      } catch (error) {
        console.error(`[migration-ai-embed] Error processing ${artifact.name}:`, error);
        results.push({
          name: artifact.name,
          success: false,
          error: error.message
        });
      }
    }

    return new Response(
      JSON.stringify({ 
        results,
        summary: {
          total: artifacts.length,
          successful: results.filter(r => r.success).length,
          failed: results.filter(r => !r.success).length
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[migration-ai-embed] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  }
});
