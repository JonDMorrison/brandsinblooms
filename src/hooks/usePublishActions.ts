// src/hooks/usePublishActions.ts
import { supabase } from "@/integrations/supabase/client";
import type { PublishNowInput, ScheduleInput } from "@/types/publish";
import { validatePostForPlatform } from "@/utils/validatePost";
import { reportSoftFail } from "@/lib/softFail";

function assertPublishInputIsValid(
  action: "publishing" | "scheduling",
  input: PublishNowInput,
) {
  const validation = validatePostForPlatform(input.platform, input);

  if (!validation.ok) {
    const message =
      validation.errors.join(". ") || `Post validation failed before ${action}`;
    throw new Error(message);
  }
}

export function usePublishActions() {
  async function publishNow(taskId: string, input: PublishNowInput) {
    // Reuse the shared validation contract so the drawer and mutation layer
    // reject the same missing-account and missing-content states.
    assertPublishInputIsValid("publishing", input);

    // First, auto-approve and persist the content to database
    const updateData: any = {
      status: "approved",
      ai_output: input.caption ?? "",
      image_url: input.mediaUrl ?? null,
    };

    // Add attachments if media is provided
    if (input.mediaUrl) {
      updateData.attachments = {
        image: {
          url: input.mediaUrl,
          alt: "Content image",
          thumb: input.mediaUrl,
        },
      };
    }

    const { error: updateError } = await supabase
      .from("content_tasks")
      .update(updateData)
      .eq("id", taskId);

    if (updateError) {
      throw new Error(`Failed to prepare content: ${updateError.message}`);
    }

    // Create generated_content record first
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) {
      throw new Error("User not authenticated");
    }

    const { data: generatedContent, error: contentError } = await supabase
      .from("generated_content")
      .insert({
        user_id: user.user.id,
        caption: input.caption ?? "",
        media_url: input.mediaUrl ?? null,
        status: "DRAFT",
      })
      .select()
      .single();

    if (contentError) {
      throw new Error(
        `Failed to create content record: ${contentError.message}`,
      );
    }

    // Now call the publish-task function with contentId
    const { data, error } = await supabase.functions.invoke("publish-task", {
      body: {
        taskId,
        contentId: generatedContent.id,
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
      reportSoftFail("edge_function_returned_not_ok", {
        fn: "publish-task",
        taskId,
        error: data?.message,
      });
      throw new Error(`Publishing failed: ${data?.message || "Unknown error"}`);
    }

    return data as { providerPostId?: string; publishedAt?: string };
  }

  async function schedule(taskId: string, input: ScheduleInput) {
    // Reuse the shared validation contract so publish and schedule accept the
    // same content rules before mutating task state.
    assertPublishInputIsValid("scheduling", input);

    // First, auto-approve and persist the content to database
    const updateData: any = {
      status: "approved",
      ai_output: input.caption ?? "",
      image_url: input.mediaUrl ?? null,
    };

    // Add attachments if media is provided
    if (input.mediaUrl) {
      updateData.attachments = {
        image: {
          url: input.mediaUrl,
          alt: "Content image",
          thumb: input.mediaUrl,
        },
      };
    }

    const { error: updateError } = await supabase
      .from("content_tasks")
      .update(updateData)
      .eq("id", taskId);

    if (updateError) {
      throw new Error(`Failed to prepare content: ${updateError.message}`);
    }

    // Create generated_content record first
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) {
      throw new Error("User not authenticated");
    }

    const { data: generatedContent, error: contentError } = await supabase
      .from("generated_content")
      .insert({
        user_id: user.user.id,
        caption: input.caption ?? "",
        media_url: input.mediaUrl ?? null,
        status: "DRAFT",
      })
      .select()
      .single();

    if (contentError) {
      throw new Error(
        `Failed to create content record: ${contentError.message}`,
      );
    }

    // Now call the publish-task function with contentId
    const { data, error } = await supabase.functions.invoke("publish-task", {
      body: {
        taskId,
        contentId: generatedContent.id,
        platforms: [input.platform], // Convert single platform to array
        accountId: input.accountId,
        caption: input.caption ?? "",
        imageUrl: input.mediaUrl ?? undefined,
        firstComment: input.firstComment ?? undefined,
        publishAt: input.publishAt, // UTC ISO string
        timezone: input.timezone, // optional
      },
    });

    if (error) {
      throw new Error(`Scheduling failed: ${error.message}`);
    }

    if (!data?.success) {
      reportSoftFail("edge_function_returned_not_ok", {
        fn: "publish-task",
        taskId,
        mode: "schedule",
        error: data?.message,
      });
      throw new Error(`Scheduling failed: ${data?.message || "Unknown error"}`);
    }

    return data as { scheduledFor: string };
  }

  return { publishNow, schedule };
}
