
import { supabase } from '@/integrations/supabase/client';

export interface SchedulePostRequest {
  contentId: string;
  caption: string;
  mediaUrl?: string;
  platforms: string[];
  publishAt: string;
}

export interface PublishNowRequest {
  contentId: string;
  caption: string;
  mediaUrl?: string;
  platforms: string[];
}

export interface RescheduleRequest {
  scheduledId: string;
  publishAt: string;
}

export class PublishAPI {
  private static async callFunction(functionName: string, body?: any) {
    const { data, error } = await supabase.functions.invoke(functionName, {
      body: body ? JSON.stringify(body) : undefined,
      headers: {
        'Content-Type': 'application/json',
      }
    });

    if (error) throw error;
    return data;
  }

  static async schedulePost(request: SchedulePostRequest) {
    return this.callFunction('publish-schedule', request);
  }

  static async publishNow(request: PublishNowRequest) {
    return this.callFunction('publish-now', request);
  }

  static async reschedulePost(request: RescheduleRequest) {
    return this.callFunction('publish-reschedule', request);
  }

  static async deletePost(id: string) {
    return this.callFunction('publish-delete', { id });
  }

  static async getGeneratedContent() {
    const { data, error } = await supabase
      .from('generated_content' as any)
      .select('*')
      .neq('status', 'ARCHIVED')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  }

  static async getScheduledPosts() {
    const { data, error } = await supabase
      .from('scheduled_posts' as any)
      .select(`
        *,
        generated_content (
          caption,
          media_url
        ),
        post_metrics (
          impressions,
          reach,
          likes,
          comments
        )
      `)
      .neq('status', 'ARCHIVED')
      .order('publish_at', { ascending: true });

    if (error) throw error;
    return data;
  }

  static async createGeneratedContent(caption: string, mediaUrl?: string) {
    const { data, error } = await supabase
      .from('generated_content' as any)
      .insert({
        caption,
        media_url: mediaUrl,
        status: 'DRAFT'
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  static async updateGeneratedContent(id: string, updates: Partial<{ caption: string; media_url: string; status: string }>) {
    const { data, error } = await supabase
      .from('generated_content' as any)
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }
}
