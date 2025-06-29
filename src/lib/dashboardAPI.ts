
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface ScheduleDraftParams {
  taskId: string;
  publishAt: string;
  platform: string;
}

export interface ScheduleDraftResult {
  scheduledPost: any;
  updatedTask: any;
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
  console.log('🚀 Scheduling draft with params:', params);
  
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      console.error('❌ No authenticated user');
      toast.error('Authentication required');
      return null;
    }

    // First, get the content task to get the content
    const { data: task, error: taskError } = await supabase
      .from('content_tasks')
      .select('*')
      .eq('id', params.taskId)
      .single();

    if (taskError || !task) {
      console.error('❌ Failed to fetch task:', taskError);
      toast.error('Failed to fetch task details');
      return null;
    }

    console.log('📋 Task fetched:', task);

    // Map platform to the correct enum value
    const platformEnum = mapPlatformToEnum(params.platform);

    // Create scheduled post entry - use content_id to match the expected column name
    const { data: scheduledPost, error: scheduleError } = await supabase
      .from('scheduled_posts')
      .insert({
        content_id: params.taskId,
        user_id: user.id,
        platform: platformEnum,
        publish_at: params.publishAt,
        status: 'QUEUED'
      })
      .select()
      .single();

    if (scheduleError) {
      console.error('❌ Failed to create scheduled post:', scheduleError);
      toast.error('Failed to schedule post');
      return null;
    }

    console.log('📅 Scheduled post created:', scheduledPost);

    // Update content task status to scheduled
    const { data: updatedTask, error: updateError } = await supabase
      .from('content_tasks')
      .update({ 
        status: 'scheduled',
        scheduled_date: params.publishAt
      })
      .eq('id', params.taskId)
      .select()
      .single();

    if (updateError) {
      console.error('❌ Failed to update task status:', updateError);
      toast.error('Failed to update task status');
      return null;
    }

    console.log('✅ Task updated to scheduled:', updatedTask);

    toast.success(`Post scheduled for ${new Date(params.publishAt).toLocaleString()}`);

    return {
      scheduledPost,
      updatedTask
    };

  } catch (error) {
    console.error('❌ Schedule draft error:', error);
    toast.error('Failed to schedule post');
    return null;
  }
};
