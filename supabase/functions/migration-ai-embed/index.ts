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

    // Create client with service role to verify JWT and access all data
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    // Verify the JWT token
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) {
      console.error('[migration-ai-embed] Auth error:', authError);
      throw new Error('Unauthorized');
    }

    // Get tenant_id
    const { data: userData } = await supabaseAdmin
      .from('users')
      .select('tenant_id')
      .eq('id', user.id)
      .single();

    if (!userData?.tenant_id) {
      throw new Error('No tenant found for user');
    }

    // Get job to fetch artifacts from provider
    const { data: job } = await supabaseAdmin
      .from('import_jobs')
      .select('provider, config')
      .eq('id', jobId)
      .eq('user_id', user.id)
      .single();

    if (!job) throw new Error('Job not found');

    // Get provider connection
    const { data: connection } = await supabaseAdmin
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
          sample_data: []
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
          sample_data: []
        });
      }
    }

    const results = [];

    for (const artifact of artifacts) {
      try {
        // Create embedding text from artifact data
        const embeddingText = [
          artifact.name,
          artifact.description || '',
          artifact.sample_data?.slice(0, 5).map((s: any) => `${s.email} ${s.tags?.join(' ') || ''}`).join(' ')
        ].filter(Boolean).join(' ');

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
        const { data: stored, error } = await supabaseAdmin
          .from('provider_artifacts')
          .insert({
            import_job_id: jobId,
            tenant_id: userData.tenant_id,
            artifact_type: artifact.artifact_type,
            external_id: artifact.external_id,
            name: artifact.name,
            member_count: artifact.member_count,
            data: artifact.sample_data,
            embedding: JSON.stringify(embedding)
          })
          .select()
          .single();

        if (error) throw error;

        results.push({
          id: stored.id,
          name: artifact.name,
          success: true
        });

        console.log(`[migration-ai-embed] Created embedding for ${artifact.name}`);

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
      JSON.stringify({ results }),
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
