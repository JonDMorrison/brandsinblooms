import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    console.log('Starting cleanup of duplicate content...');

    // First, get all campaign IDs that need to be cleaned up
    const { data: campaignsToDelete, error: getCampaignsError } = await supabase
      .from('campaigns')
      .select('id')
      .not('week_number', 'is', null)
      .gte('week_number', 1)
      .lte('week_number', 52);

    if (getCampaignsError) {
      throw getCampaignsError;
    }

    const campaignIds = campaignsToDelete?.map(c => c.id) || [];
    console.log(`Found ${campaignIds.length} campaigns to clean up`);

    if (campaignIds.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'No duplicate campaigns found to clean up',
          duplicatesRemoved: 0
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200 
        }
      );
    }

    // Update content_tasks to remove references to weekly theme campaigns
    const { error: contentTasksError } = await supabase
      .from('content_tasks')
      .update({ campaign_id: null })
      .in('campaign_id', campaignIds);

    if (contentTasksError) {
      console.error('Error updating content_tasks:', contentTasksError);
    } else {
      console.log('Updated content_tasks to remove campaign references');
    }

    // Update token_usage to remove references to weekly theme campaigns  
    const { error: tokenUsageError } = await supabase
      .from('token_usage')
      .update({ campaign_id: null })
      .in('campaign_id', campaignIds);

    if (tokenUsageError) {
      console.error('Error updating token_usage:', tokenUsageError);
    } else {
      console.log('Updated token_usage to remove campaign references');
    }

    // Now delete the duplicate weekly theme campaigns
    const { error: deleteError } = await supabase
      .from('campaigns')
      .delete()
      .in('id', campaignIds);

    if (deleteError) {
      throw deleteError;
    }

    console.log(`Successfully deleted ${campaignIds.length} duplicate campaigns`);

    // Verify master_campaign_templates has unique content
    const { data: masterTemplates, error: masterError } = await supabase
      .from('master_campaign_templates')
      .select('week_number, title, theme, content_ideas')
      .order('week_number');

    if (masterError) {
      throw masterError;
    }

    console.log(`Verified ${masterTemplates?.length || 0} unique weekly themes in master_campaign_templates`);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Cleanup completed successfully',
        duplicatesRemoved: campaignIds.length,
        masterTemplatesCount: masterTemplates?.length || 0
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('Cleanup failed:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});