// src/hooks/usePublishActions.ts
import { supabase } from "@/integrations/supabase/client";
import type { PublishNowInput, ScheduleInput } from "@/types/publish";
import { reportSoftFail } from '@/lib/softFail';

export function usePublishActions() {
  async function publishNow(taskId: string, input: PublishNowInput) {
    // First, auto-approve and persist the content to database
    const updateData: any = {
      status: 'approved',
      ai_output: input.caption ?? '',
      image_url: input.mediaUrl ?? null,
    };

    // Add attachments if media is provided
    if (input.mediaUrl) {
      updateData.attachments = {
        image: {
          url: input.mediaUrl,
          alt: 'Content image',
          thumb: input.mediaUrl
        }
      };
    }

    const { error: updateError } = await supabase
      .from('content_tasks')
      .update(updateData)
      .eq('id', taskId);

    if (updateError) {
      throw new Error(`Failed to prepare content: ${updateError.message}`);
    }

    // Validate required fields before publishing
    if (!input.caption?.trim() || !input.mediaUrl) {
      reportSoftFail('publish_blocked_missing_media', { 
        taskId, 
        platform: input.platform,
        hasCaption: !!input.caption?.trim(),
        hasMediaUrl: !!input.mediaUrl
      });
      throw new Error('Both caption and media are required for publishing');
    }

    // Now call the publish-task function
    const { data, error } = await supabase.functions.invoke("publish-task", {
      body: {
        taskId,
        platforms: [input.platform], // Convert single platform to array
        accountId: input.accountId,
        caption: input.caption ?? "",
        imageUrl: input.mediaUrl ?? undefined,
        firstComment: input.firstComment ?? undefined,
      },
    });
    
    if (error) {
      throw new Error(`Publishing failed: ${error.message}`);
    }

    if (!data?.success) {
      reportSoftFail('edge_function_returned_not_ok', { 
        fn: 'publish-task',
        taskId,
        error: data?.message
      });
      throw new Error(`Publishing failed: ${data?.message || 'Unknown error'}`);
    }
    
    return data as { providerPostId?: string; publishedAt?: string };
  }

  async function schedule(taskId: string, input: ScheduleInput) {
    // First, auto-approve and persist the content to database
    const updateData: any = {
      status: 'approved',
      ai_output: input.caption ?? '',
      image_url: input.mediaUrl ?? null,
    };

    // Add attachments if media is provided
    if (input.mediaUrl) {
      updateData.attachments = {
        image: {
          url: input.mediaUrl,
          alt: 'Content image',
          thumb: input.mediaUrl
        }
      };
    }

    const { error: updateError } = await supabase
      .from('content_tasks')
      .update(updateData)
      .eq('id', taskId);

    if (updateError) {
      throw new Error(`Failed to prepare content: ${updateError.message}`);
    }

    // Validate required fields before scheduling
    if (!input.caption?.trim() || !input.mediaUrl) {
      reportSoftFail('publish_blocked_missing_media', { 
        taskId, 
        platform: input.platform,
        hasCaption: !!input.caption?.trim(),
        hasMediaUrl: !!input.mediaUrl,
        mode: 'schedule'
      });
      throw new Error('Both caption and media are required for scheduling');
    }

    // Now call the publish-task function
    const { data, error } = await supabase.functions.invoke("publish-task", {
      body: {
        taskId,
        platforms: [input.platform], // Convert single platform to array
        accountId: input.accountId,
        caption: input.caption ?? "",
        imageUrl: input.mediaUrl ?? undefined,
        firstComment: input.firstComment ?? undefined,
        publishAt: input.publishAt, // UTC ISO string
        timezone: input.timezone,   // optional
      },
    });
    
    if (error) {
      throw new Error(`Scheduling failed: ${error.message}`);
    }

    if (!data?.success) {
      reportSoftFail('edge_function_returned_not_ok', { 
        fn: 'publish-task',
        taskId,
        mode: 'schedule',
        error: data?.message
      });
      throw new Error(`Scheduling failed: ${data?.message || 'Unknown error'}`);
    }
    
    return data as { scheduledFor: string };
  }

  return { publishNow, schedule };
}