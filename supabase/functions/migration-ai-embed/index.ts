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

    const { artifacts } = await req.json();

    const authHeader = req.headers.get('Authorization')!;
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Unauthorized');

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
        const { data: stored, error } = await supabase
          .from('provider_artifacts')
          .insert({
            job_id: artifact.job_id,
            artifact_type: artifact.artifact_type,
            external_id: artifact.external_id,
            name: artifact.name,
            slug: artifact.slug,
            member_count: artifact.member_count,
            sample_data: artifact.sample_data,
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
