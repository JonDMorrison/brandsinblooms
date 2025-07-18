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
    // Remove scene headers and formatting
    .replace(/\*\*\[Scene \d+:.*?\]\*\*/g, '')
    .replace(/\[Scene \d+:.*?\]/g, '')
    .replace(/\*\*\[.*?\]\*\*/g, '')
    .replace(/\[.*?\]/g, '')
    // Remove visual and audio cues
    .replace(/\*Visual:.*?\*/g, '')
    .replace(/\*Background Music:.*?\*/g, '')
    .replace(/\*.*?music.*?\*/gi, '')
    // Remove narrator and host labels
    .replace(/\*\*Narrator \(Voiceover\):\*\*/g, '')
    .replace(/Narrator \(Voiceover\):/g, '')
    .replace(/\*\*Host:\*\*/g, '')
    .replace(/Host:/g, '')
    .replace(/\*\*Host \(.*?\):\*\*/g, '')
    // Remove video title formatting
    .replace(/\*\*Video Title:.*?\*\*/g, '')
    .replace(/\*\*Title:.*?\*\*/g, '')
    // Clean up separators and extra formatting
    .replace(/---+/g, '')
    .replace(/\*\*\[End.*?\]\*\*/g, '')
    .replace(/\[End.*?\]/g, '')
    // Clean up extra whitespace
    .replace(/\n\s*\n\s*\n/g, '\n\n')
    .trim();
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { campaign_title } = await req.json();
    
    console.log('🧹 Starting content cleanup for campaign:', campaign_title);
    
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get campaign ID
    const { data: campaigns } = await supabase
      .from('campaigns')
      .select('id')
      .eq('title', campaign_title);

    if (!campaigns || campaigns.length === 0) {
      throw new Error('Campaign not found');
    }

    const campaignId = campaigns[0].id;

    // Get all content tasks for this campaign
    const { data: allTasks } = await supabase
      .from('content_tasks')
      .select('*')
      .eq('campaign_id', campaignId)
      .order('post_type')
      .order('created_at', { ascending: false });

    if (!allTasks) {
      throw new Error('No tasks found');
    }

    // Group by post_type and identify duplicates
    const tasksByType: { [key: string]: any[] } = {};
    allTasks.forEach(task => {
      if (!tasksByType[task.post_type]) {
        tasksByType[task.post_type] = [];
      }
      tasksByType[task.post_type].push(task);
    });

    let deletedCount = 0;
    let cleanedCount = 0;

    // Process each content type
    for (const [postType, tasks] of Object.entries(tasksByType)) {
      if (tasks.length > 1) {
        console.log(`🔍 Found ${tasks.length} ${postType} tasks, keeping most recent`);
        
        // Keep the most recent task (first in our descending order)
        const keepTask = tasks[0];
        const tasksToDelete = tasks.slice(1);

        // Delete duplicates
        for (const task of tasksToDelete) {
          const { error } = await supabase
            .from('content_tasks')
            .delete()
            .eq('id', task.id);
          
          if (!error) {
            deletedCount++;
            console.log(`🗑️ Deleted duplicate ${postType} task: ${task.id}`);
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
            }
          }
        }
      }
    }

    console.log(`✅ Cleanup complete: ${deletedCount} duplicates deleted, ${cleanedCount} tasks cleaned`);

    return new Response(JSON.stringify({
      success: true,
      deletedCount,
      cleanedCount,
      message: `Cleanup complete: ${deletedCount} duplicates deleted, ${cleanedCount} tasks cleaned`
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('❌ Error in cleanup function:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
