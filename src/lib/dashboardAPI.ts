
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { isBloomEligible } from './subscriptionHelpers';
import { areConnectionsValid } from './socialHelpers';

export interface ScheduleDraftParams {
  taskId: string;
  publishAt: string;
  platform: string;
}

export interface ScheduleDraftResult {
  scheduledPost: any;
  updatedTask: any;
  mode: 'AUTO' | 'MANUAL';
}

// Map platform strings to the enum values expected by the database
const mapPlatformToEnum = (platform: string): "FB" | "IG_FEED" | "IG_REEL" => {
  const platformMap: { [key: string]: "FB" | "IG_FEED" | "IG_REEL" } = {
    'facebook': 'FB',
    'FACEBOOK': 'FB',
    'instagram': 'IG_FEED',
    'INSTAGRAM': 'IG_FEED',
    'instagram_feed': 'IG_FEED',
    'instagram_reel': 'IG_REEL',
    'IG_FEED': 'IG_FEED',
    'IG_REEL': 'IG_REEL',
    'FB': 'FB'
  };
  return platformMap[platform] || 'FB';
};

export const scheduleDraft = async (params: ScheduleDraftParams): Promise<ScheduleDraftResult | null> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error('Authentication required');
      return null;
    }

    // First, get the content task to verify it exists and get the content
    const { data: task, error: taskError } = await supabase
      .from('content_tasks')
      .select('*')
      .eq('id', params.taskId)
      .single();

    if (taskError || !task) {
      console.error('Failed to fetch task:', taskError);
      toast.error('Task not found or access denied');
      return null;
    }

    // Verify the user has access to this task
    const hasAccess = task.user_id === user.id || task.created_by_user_id === user.id;
    if (!hasAccess) {
      console.error('User does not have access to this task');
      toast.error('Access denied to this task');
      return null;
    }

    // Create a generated_content record first
    const { data: generatedContent, error: contentError } = await supabase
      .from('generated_content')
      .insert({
        user_id: user.id,
        caption: task.ai_output || '',
        status: 'SCHEDULED'
      })
      .select()
      .single();

    if (contentError) {
      console.error('Failed to create generated content:', contentError);
      toast.error('Failed to prepare content for scheduling');
      return null;
    }

    // Determine if this should be AUTO or MANUAL mode
    const [eligible, connectionsValid] = await Promise.all([
      isBloomEligible(user.id),
      areConnectionsValid(user.id)
    ]);

    const mode = eligible && connectionsValid ? 'AUTO' : 'MANUAL';
    
    // Map platform to the correct enum value
    const platformEnum = mapPlatformToEnum(params.platform);

    // Create scheduled post entry referencing the generated_content
    const { data: scheduledPost, error: scheduleError } = await supabase
      .from('scheduled_posts')
      .insert({
        content_id: generatedContent.id,
        user_id: user.id,
        platform: platformEnum,
        publish_at: params.publishAt,
        status: 'QUEUED',
        mode: mode
      })
      .select()
      .single();

    if (scheduleError) {
      console.error('Failed to create scheduled post:', scheduleError);
      
      // Clean up the generated content if scheduling failed
      await supabase
        .from('generated_content')
        .delete()
        .eq('id', generatedContent.id);
      
      toast.error(`Failed to schedule post: ${scheduleError.message}`);
      return null;
    }

    // Update content task status to posted
    const { data: updatedTask, error: updateError } = await supabase
      .from('content_tasks')
      .update({ 
        status: 'posted',
        scheduled_date: params.publishAt
      })
      .eq('id', params.taskId)
      .select()
      .single();

    if (updateError) {
      console.error('Failed to update task status:', updateError);
      
      // Try to rollback the scheduled post and generated content creation
      await supabase
        .from('scheduled_posts')
        .delete()
        .eq('id', scheduledPost.id);
      
      await supabase
        .from('generated_content')
        .delete()
        .eq('id', generatedContent.id);
      
      toast.error('Failed to update task status');
      return null;
    }

    return {
      scheduledPost,
      updatedTask,
      mode
    };

  } catch (error) {
    console.error('Schedule draft error:', error);
    toast.error(`Failed to schedule post: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return null;
  }
};
