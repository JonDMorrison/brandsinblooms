// src/hooks/usePublishActions.ts
import { supabase } from "@/integrations/supabase/client";
import type { PublishNowInput, ScheduleInput } from "@/types/publish";

export function usePublishActions() {
  async function publishNow(taskId: string, input: PublishNowInput) {
    const { data, error } = await supabase.functions.invoke("publish-task", {
      body: {
        taskId,
        platform: input.platform,
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
    const { data, error } = await supabase.functions.invoke("publish-task", {
      body: {
        taskId,
        platform: input.platform,
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