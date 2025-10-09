import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');

async function generateChannelContent(
  channel: string,
  topicTitle: string,
  topicDescription: string,
  companyContext: string
): Promise<any> {
  const systemPrompt = `You are an expert marketing content creator. Generate engaging ${channel} content that is authentic, informative, and valuable to the audience.`;
  
  const userPrompt = `Create ${channel} content for: "${topicTitle}"
Description: ${topicDescription}
Company Context: ${companyContext}

Generate compelling content that:
- Speaks directly to the audience's interests
- Provides genuine value and insights
- Uses an engaging, conversational tone
- Includes relevant hashtags (for social media)
- Suggests an appropriate image search query

Return JSON in this format:
{
  "title": "Engaging title",
  "content": "Main content (500-800 chars for social, 1500-2000 for blog/newsletter)",
  "caption": "Short compelling hook (100-150 chars)",
  "hashtags": ["#relevant", "#tags"],
  "imageQuery": "descriptive image search query",
  "cta": "Call to action"
}`;

  console.log(`🤖 Generating ${channel} content for: ${topicTitle}`);
  
  const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${LOVABLE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'google/gemini-2.5-flash',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.8,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`❌ AI API error for ${channel}:`, response.status, errorText);
    throw new Error(`AI API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  const aiContent = data.choices[0].message.content;
  
  // Clean up markdown code blocks if present
  const cleanedContent = aiContent.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
  
  try {
    return JSON.parse(cleanedContent);
  } catch (e) {
    console.error('❌ Failed to parse AI response:', cleanedContent);
    // Return fallback structure
    return {
      title: topicTitle,
      content: cleanedContent,
      caption: topicTitle,
      hashtags: [],
      imageQuery: topicTitle,
      cta: 'Learn more'
    };
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Force redeployment - v2.0.0 with userId auth fix
  const FUNCTION_VERSION = '2.0.0';
  console.log(`🚀 Edge function started - v${FUNCTION_VERSION}`);
  console.log(`📋 Configuration check:`, {
    hasLovableApiKey: !!Deno.env.get('LOVABLE_API_KEY'),
    hasSupabaseUrl: !!Deno.env.get('SUPABASE_URL'),
    timestamp: new Date().toISOString()
  });

  // ✅ Phase 1: Declare variables at function scope with default values
  let mode: string = 'unknown';
  let sourceId: string = 'unknown';
  let topicTitle: string = 'Unknown Topic';
  let topicDescription: string = '';
  let channels: string[] = [];
  let workspaceId: string = '';
  let userId: string = '';

  try {
    const body = await req.json();
    console.log('📨 Request body:', JSON.stringify(body, null, 2));

    // ✅ Assign the actual values from request body
    ({ mode, sourceId, workspaceId, channels, topicTitle, topicDescription, userId } = body);

    // ✅ Phase 2: Validate required fields
    if (!userId) {
      throw new Error('userId is required in request body');
    }
    if (!workspaceId) {
      throw new Error('workspaceId is required in request body');
    }

    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get company context from workspace
    const { data: companyProfile } = await supabase
      .from('company_profiles')
      .select('company_name, about_business, brand_voice')
      .eq('user_id', workspaceId)
      .single();

    const companyContext = companyProfile 
      ? `${companyProfile.company_name || ''} - ${companyProfile.about_business || ''}`
      : 'Garden center business';

    console.log(`🎯 Generating content for ${channels.length} channels`);

    // Generate content for each channel in parallel
    const contentPromises = channels.map(async (channel: string) => {
      try {
        const generatedContent = await generateChannelContent(
          channel,
          topicTitle,
          topicDescription,
          companyContext
        );

        return {
          type: channel,
          items: [{
            week: 1,
            title: generatedContent.title,
            content: generatedContent.content,
            caption: generatedContent.caption,
            hashtags: generatedContent.hashtags || [],
            imageQuery: generatedContent.imageQuery,
            cta: generatedContent.cta,
            themeId: sourceId,
            themeName: topicTitle,
            dayOfWeek: 1
          }]
        };
      } catch (error) {
        console.error(`❌ Failed to generate ${channel} content:`, error);
        throw error;
      }
    });

    const content = await Promise.all(contentPromises);
    
    console.log(`✅ Generated ${content.length} pieces of content`);

    // Generate bundle ID and save to database
    const bundleId = crypto.randomUUID();
    
    // Transform content into GeneratedBundle format
    const bundleContent = {
      id: bundleId,
      mode: mode || 'event',                    // ✅ Root level for view compatibility
      sourceId: sourceId || '',
      sourceLabel: topicTitle || 'Untitled Content',  // ✅ Root level for view
      channels: channels || [],                 // ✅ Root level for view
      items: content.flatMap((channelContent: any) => 
        channelContent.items.map((item: any) => ({
          channel: channelContent.type,
          title: item.title,
          body: item.content,
          caption: item.caption,
          summary: item.caption,
          hashtags: item.hashtags || [],
          ctaSuggestions: [item.cta],
          media: item.imageQuery ? { 
            alt: item.imageQuery,
            url: null 
          } : null,
          _approved: false
        }))
      ),
      recommendedImages: [],
      meta: {
        mode: mode as 'event' | 'seasonal' | 'custom',
        sourceId: sourceId,
        sourceLabel: topicTitle,
        topicDescription: topicDescription
      }
    };

    // ✅ Phase 3: Validate bundle structure before saving
    console.log('🔍 Validating bundle structure:', {
      hasId: !!bundleContent.id,
      hasMode: !!bundleContent.mode,
      hasSourceLabel: !!bundleContent.sourceLabel,
      hasChannels: Array.isArray(bundleContent.channels) && bundleContent.channels.length > 0,
      hasItems: Array.isArray(bundleContent.items) && bundleContent.items.length > 0
    });

    if (!bundleContent.mode || !bundleContent.sourceLabel || !Array.isArray(bundleContent.channels)) {
      console.error('❌ Invalid bundle structure:', bundleContent);
      throw new Error('Bundle missing required metadata fields');
    }

    console.log(`📦 Saving bundle to database: ${bundleId}`);

    // ✅ Phase 2: Use the provided userId directly (no auth.getUser() needed)
    console.log(`🔐 Using provided user ID: ${userId}`);

    const { data: userTenant, error: tenantError } = await supabase
      .from('users')
      .select('tenant_id')
      .eq('id', userId)
      .single();

    if (tenantError || !userTenant?.tenant_id) {
      console.error('❌ Tenant lookup error:', tenantError);
      throw new Error(`User tenant not found for user ${userId}: ${tenantError?.message || 'Unknown'}`);
    }

    const tenantId = userTenant.tenant_id;
    console.log(`✅ User authenticated: ${userId}, Tenant: ${tenantId}`);

    // Insert directly into draft_snapshots
    const { data: newSnapshot, error: insertError } = await supabase
      .from('draft_snapshots')
      .insert({
        user_id: userId,  // ✅ Use the provided userId
        tenant_id: tenantId,
        doc_type: 'content_bundle',
        doc_id: bundleId,
        version: 1,
        content: bundleContent
      })
      .select('id')
      .single();

    if (insertError || !newSnapshot) {
      console.error('❌ Failed to save bundle to database:', insertError);
      throw new Error(`Database save failed: ${insertError?.message || 'Unknown error'}`);
    }

    const snapshotId = newSnapshot.id;
    console.log(`✅ Bundle saved successfully: ${bundleId}, snapshot: ${snapshotId}`);

    // Return proper response with id, snapshotId, and content
    return new Response(
      JSON.stringify({ 
        id: bundleId,
        snapshotId: snapshotId,
        content: bundleContent
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('❌ Generation error:', {
      message: error.message,
      stack: error.stack,
      name: error.name,
      mode,
      sourceId,
      topicTitle,
      channels
    });
    
    // Return detailed error for debugging
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Failed to generate content',
        details: {
          step: error.step || 'unknown',
          mode,
          topicTitle
        }
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
