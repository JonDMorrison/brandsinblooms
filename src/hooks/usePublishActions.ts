// src/hooks/usePublishActions.ts
import { supabase } from "@/integrations/supabase/client";
import type { PublishNowInput, ScheduleInput } from "@/types/publish";

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
    if (error) throw error;
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
    if (error) throw error;
    return data as { scheduledFor: string };
  }

  return { publishNow, schedule };
}