import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function stripEmojis(content: string): string {
  return content.replace(/[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu, '');
}

function cleanVideoScript(content: string): string {
  return content
    .replace(/\*\*\[Scene \d+:.*?\]\*\*/g, '')
    .replace(/\[Scene \d+:.*?\]/g, '')
    .replace(/\*\*\[.*?\]\*\*/g, '')
    .replace(/\[.*?\]/g, '')
    .replace(/\*Visual:.*?\*/g, '')
    .replace(/\*Background Music:.*?\*/g, '')
    .replace(/\*.*?music.*?\*/gi, '')
    .replace(/\*\*Narrator \(Voiceover\):\*\*/g, '')
    .replace(/Narrator \(Voiceover\):/g, '')
    .replace(/\*\*Host:\*\*/g, '')
    .replace(/Host:/g, '')
    .replace(/\*\*Host \(.*?\):\*\*/g, '')
    .replace(/\*\*Video Title:.*?\*\*/g, '')
    .replace(/\*\*Title:.*?\*\*/g, '')
    .replace(/---+/g, '')
    .replace(/\*\*\[End.*?\]\*\*/g, '')
    .replace(/\[End.*?\]/g, '')
    .replace(/\n\s*\n\s*\n/g, '\n\n')
    .trim();
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { campaign_title } = await req.json();
    
    console.log('🧹 Starting comprehensive content cleanup for campaign:', campaign_title);
    
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get ALL campaigns with this title (not just the first one)
    const { data: campaigns, error: campaignError } = await supabase
      .from('campaigns')
      .select('id, title, created_at, user_id')
      .eq('title', campaign_title)
      .order('created_at', { ascending: false });

    if (campaignError) {
      throw new Error(`Failed to fetch campaigns: ${campaignError.message}`);
    }

    if (!campaigns || campaigns.length === 0) {
      throw new Error('No campaigns found with this title');
    }

    console.log(`🔍 Found ${campaigns.length} campaigns with title "${campaign_title}"`);

    // Get all campaign IDs
    const campaignIds = campaigns.map(c => c.id);

    // Get ALL content tasks for ALL campaigns with this title
    const { data: allTasks, error: tasksError } = await supabase
      .from('content_tasks')
      .select('*')
      .in('campaign_id', campaignIds)
      .order('post_type')
      .order('created_at', { ascending: false });

    if (tasksError) {
      throw new Error(`Failed to fetch tasks: ${tasksError.message}`);
    }

    if (!allTasks || allTasks.length === 0) {
      console.log('ℹ️ No tasks found for these campaigns');
      return new Response(JSON.stringify({
        success: true,
        deletedCount: 0,
        cleanedCount: 0,
        campaignsConsolidated: 0,
        message: 'No tasks found to clean up'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`📊 Processing ${allTasks.length} total tasks across ${campaigns.length} campaigns`);

    // Group by post_type and identify duplicates across ALL campaigns
    const tasksByType: { [key: string]: any[] } = {};
    allTasks.forEach(task => {
      const type = task.post_type || 'general';
      if (!tasksByType[type]) tasksByType[type] = [];
      tasksByType[type].push(task);
    });

    let deletedCount = 0;
    let cleanedCount = 0;

    // Process each content type across ALL campaigns
    for (const [postType, tasks] of Object.entries(tasksByType)) {
      console.log(`🔄 Processing ${tasks.length} ${postType} tasks`);
      
      if (tasks.length > 1) {
        // Keep the most recent task (first in our descending order)
        const keepTask = tasks[0];
        const tasksToDelete = tasks.slice(1);

        console.log(`🎯 Keeping most recent ${postType} task: ${keepTask.id} (from campaign ${keepTask.campaign_id})`);
        console.log(`🗑️ Deleting ${tasksToDelete.length} duplicate ${postType} tasks`);

        // Delete duplicates
        for (const task of tasksToDelete) {
          const { error } = await supabase
            .from('content_tasks')
            .delete()
            .eq('id', task.id);
          
          if (!error) {
            deletedCount++;
            console.log(`✅ Deleted duplicate ${postType} task: ${task.id}`);
          } else {
            console.error(`❌ Failed to delete task ${task.id}:`, error);
          }
        }

        // Clean the remaining task
        if (keepTask.ai_output) {
          let cleanedContent = stripEmojis(keepTask.ai_output);
          
          if (postType === 'video') {
            cleanedContent = cleanVideoScript(cleanedContent);
          }

          if (cleanedContent !== keepTask.ai_output) {
            const { error } = await supabase
              .from('content_tasks')
              .update({ ai_output: cleanedContent })
              .eq('id', keepTask.id);

            if (!error) {
              cleanedCount++;
              console.log(`✨ Cleaned ${postType} content: ${keepTask.id}`);
            } else {
              console.error(`❌ Failed to clean task ${keepTask.id}:`, error);
            }
          }
        }
      } else if (tasks.length === 1) {
        // Clean the single task
        const task = tasks[0];
        if (task.ai_output) {
          let cleanedContent = stripEmojis(task.ai_output);
          
          if (postType === 'video') {
            cleanedContent = cleanVideoScript(cleanedContent);
          }

          if (cleanedContent !== task.ai_output) {
            const { error } = await supabase
              .from('content_tasks')
              .update({ ai_output: cleanedContent })
              .eq('id', task.id);

            if (!error) {
              cleanedCount++;
              console.log(`✨ Cleaned ${postType} content: ${task.id}`);
            } else {
              console.error(`❌ Failed to clean task ${task.id}:`, error);
            }
          }
        }
      }
    }

    // Consolidate duplicate campaigns - keep the most recent one
    let campaignsConsolidated = 0;
    if (campaigns.length > 1) {
      const keepCampaign = campaigns[0]; // Most recent
      const campaignsToDelete = campaigns.slice(1);

      console.log(`🎯 Keeping most recent campaign: ${keepCampaign.id} (${keepCampaign.created_at})`);
      console.log(`🗑️ Consolidating ${campaignsToDelete.length} duplicate campaigns`);

      // Update any remaining content tasks to point to the kept campaign
      const { data: remainingTasks } = await supabase
        .from('content_tasks')
        .select('id, campaign_id')
        .in('campaign_id', campaignIds);

      if (remainingTasks && remainingTasks.length > 0) {
        for (const task of remainingTasks) {
          if (task.campaign_id !== keepCampaign.id) {
            await supabase
              .from('content_tasks')
              .update({ campaign_id: keepCampaign.id })
              .eq('id', task.id);
          }
        }
      }

      // Delete duplicate campaigns
      for (const campaign of campaignsToDelete) {
        const { error } = await supabase
          .from('campaigns')
          .delete()
          .eq('id', campaign.id);

        if (!error) {
          campaignsConsolidated++;
          console.log(`✅ Deleted duplicate campaign: ${campaign.id}`);
        } else {
          console.error(`❌ Failed to delete campaign ${campaign.id}:`, error);
        }
      }
    }

    console.log(`✅ Comprehensive cleanup complete: ${deletedCount} duplicate tasks deleted, ${cleanedCount} tasks cleaned, ${campaignsConsolidated} duplicate campaigns consolidated`);

    return new Response(JSON.stringify({
      success: true,
      deletedCount,
      cleanedCount,
      campaignsConsolidated,
      campaignsProcessed: campaigns.length,
      message: `Comprehensive cleanup complete: ${deletedCount} duplicate tasks deleted, ${cleanedCount} tasks cleaned, ${campaignsConsolidated} duplicate campaigns consolidated`
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('❌ Error in comprehensive cleanup function:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
