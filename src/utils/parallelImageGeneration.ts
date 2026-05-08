import { supabase } from "@/integrations/supabase/client";
import type {
  GeneratedBundle,
  GeneratedBundleItem,
} from "@/hooks/useGeneratedBundle";
import {
  useImageGenerationTracker,
  type ImageGenerationJobStatus,
} from "@/hooks/useImageGenerationTracker";

type AutoImageChannel = Extract<
  GeneratedBundleItem["channel"],
  "newsletter" | "blog" | "instagram" | "facebook"
>;

interface GeneratedImageResponse {
  imageUrl?: string | null;
  imageId?: string;
  globalImageId?: string;
  metadata?: {
    generationTime?: number;
    prompt?: string;
    storagePath?: string;
    channel?: string;
    tags?: unknown;
  };
}

interface DraftSnapshotRecord {
  id: string;
  version: number;
  content: GeneratedBundle;
}

interface GeneratedMedia {
  url: string;
  alt: string;
  source: "ai-generated";
  globalImageId?: string;
  tags?: string[];
}

interface GenerateBundleImagesParams {
  bundleId: string;
  snapshotId?: string;
  items?: GeneratedBundleItem[];
  userId: string;
  onJobStatusChange?: (
    channel: AutoImageChannel,
    status: ImageGenerationJobStatus,
  ) => void;
}

interface RetryBundleImageGenerationParams {
  bundleId: string;
  channel: string;
  userId?: string;
}

interface RunImageJobParams {
  bundleId: string;
  item: GeneratedBundleItem;
  userId: string;
  onJobStatusChange?: (
    channel: AutoImageChannel,
    status: ImageGenerationJobStatus,
  ) => void;
}

const AUTO_IMAGE_CHANNELS: ReadonlySet<GeneratedBundleItem["channel"]> =
  new Set(["newsletter", "blog", "instagram", "facebook"]);
const BUNDLE_READY_POLL_INTERVAL_MS = 3000;
const BUNDLE_READY_TIMEOUT_MS = 180000;
const patchChains = new Map<string, Promise<void>>();

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object";
}

function isAutoImageChannel(
  channel: GeneratedBundleItem["channel"],
): channel is AutoImageChannel {
  return AUTO_IMAGE_CHANNELS.has(channel);
}

function getChannelLabel(channel: GeneratedBundleItem["channel"]) {
  switch (channel) {
    case "instagram":
      return "Instagram";
    case "facebook":
      return "Facebook";
    case "blog":
      return "Blog";
    case "newsletter":
      return "Newsletter";
    case "video":
      return "Video";
    default:
      return "Content";
  }
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function normalizeTags(rawTags: unknown): string[] {
  if (!Array.isArray(rawTags)) {
    return [];
  }

  return rawTags
    .map((tag) => {
      if (typeof tag === "string") {
        return tag;
      }

      if (isObject(tag) && typeof tag.name === "string") {
        return tag.name;
      }

      return null;
    })
    .filter((tag): tag is string => Boolean(tag));
}

function normalizeBundleContent(content: unknown): GeneratedBundle | null {
  if (!isObject(content) || !Array.isArray(content.items)) {
    return null;
  }

  return content as GeneratedBundle;
}

function getEligibleItems(items: GeneratedBundleItem[]) {
  return items.filter((item) => {
    const imageQuery = item.imageQuery?.trim();
    return Boolean(imageQuery) && isAutoImageChannel(item.channel);
  });
}

async function getCurrentUserId() {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("No authenticated user found");
  }

  return user.id;
}

async function loadLatestBundle(
  bundleId: string,
): Promise<DraftSnapshotRecord | null> {
  const { data, error } = await supabase
    .from("draft_snapshots")
    .select("id, version, content")
    .eq("doc_type", "content_bundle")
    .eq("doc_id", bundleId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  const content = normalizeBundleContent(data?.content);
  if (!data || !content) {
    return null;
  }

  return {
    id: data.id,
    version: data.version ?? 0,
    content,
  };
}

async function waitForReadyBundle(
  bundleId: string,
): Promise<DraftSnapshotRecord | null> {
  const startedAt = Date.now();

  while (Date.now() - startedAt < BUNDLE_READY_TIMEOUT_MS) {
    const snapshot = await loadLatestBundle(bundleId);
    const content = snapshot?.content;

    if (
      snapshot &&
      Array.isArray(content?.items) &&
      content.items.length > 0 &&
      content.generationStatus !== "failed"
    ) {
      return snapshot;
    }

    if (content?.generationStatus === "failed") {
      throw new Error(
        content.generationError ||
          "Content generation failed before images started",
      );
    }

    await new Promise((resolve) =>
      window.setTimeout(resolve, BUNDLE_READY_POLL_INTERVAL_MS),
    );
  }

  throw new Error("Timed out waiting for generated bundle content");
}

function buildContentContext(item: GeneratedBundleItem) {
  const imageQuery = item.imageQuery?.trim();
  if (imageQuery) {
    return imageQuery;
  }

  const channelLabel = getChannelLabel(item.channel);
  const title = item.title?.trim();
  return title
    ? `${channelLabel} post about ${title}`
    : `${channelLabel} image`;
}

function buildGeneratedMedia(
  item: GeneratedBundleItem,
  response: GeneratedImageResponse,
): GeneratedMedia {
  const tags = normalizeTags(response.metadata?.tags);

  return {
    url: response.imageUrl || "",
    alt: item.title || `${getChannelLabel(item.channel)} generated image`,
    source: "ai-generated",
    globalImageId: response.globalImageId,
    tags: tags.length > 0 ? tags : undefined,
  };
}

async function patchBundleImage(params: {
  bundleId: string;
  channel: AutoImageChannel;
  media: GeneratedMedia;
}) {
  const snapshot = await loadLatestBundle(params.bundleId);
  if (!snapshot) {
    throw new Error("Unable to load latest bundle before image patch");
  }

  const itemIndex = snapshot.content.items.findIndex(
    (item) => item.channel === params.channel,
  );

  if (itemIndex < 0) {
    throw new Error(`No ${params.channel} item found in generated bundle`);
  }

  const currentItem = snapshot.content.items[itemIndex];
  if (currentItem.media?.url && currentItem.media.url !== params.media.url) {
    console.info(
      `[parallelImageGeneration] Preserving manually selected ${params.channel} image; auto image was generated but not written to media.`,
    );
    return;
  }

  const nextItems = snapshot.content.items.map((item, index) =>
    index === itemIndex
      ? {
          ...item,
          media: params.media,
        }
      : item,
  );
  const nextContent: GeneratedBundle = {
    ...snapshot.content,
    items: nextItems,
    thumbnail: snapshot.content.thumbnail || params.media.url,
  };

  const { data, error } = await supabase.functions.invoke("draft-merge", {
    body: {
      doc_type: "content_bundle",
      doc_id: params.bundleId,
      base_version: snapshot.version,
      new_content: nextContent,
    },
  });

  if (error) {
    throw error;
  }

  if (!isObject(data) || data.ok !== true) {
    throw new Error("Image patch did not return a successful merge response");
  }
}

function queuePatchBundleImage(params: {
  bundleId: string;
  channel: AutoImageChannel;
  media: GeneratedMedia;
}) {
  const previousPatch = patchChains.get(params.bundleId) ?? Promise.resolve();
  const nextPatch = previousPatch
    .catch(() => undefined)
    .then(() => patchBundleImage(params));

  patchChains.set(
    params.bundleId,
    nextPatch.finally(() => {
      if (patchChains.get(params.bundleId) === nextPatch) {
        patchChains.delete(params.bundleId);
      }
    }),
  );

  return nextPatch;
}

async function runImageJob(params: RunImageJobParams) {
  const tracker = useImageGenerationTracker.getState();
  const channel = params.item.channel;
  const imageQuery = params.item.imageQuery?.trim();

  if (!imageQuery || !isAutoImageChannel(channel)) {
    return;
  }

  params.onJobStatusChange?.(channel, "generating");

  try {
    const { data, error } =
      await supabase.functions.invoke<GeneratedImageResponse>(
        "generate-ai-image",
        {
          body: {
            contentContext: buildContentContext(params.item),
            contentTitle: params.item.title?.trim() || getChannelLabel(channel),
            channel,
            storageBucket: "global-ai-images",
            uploadToStorage: true,
            userId: params.userId,
          },
        },
      );

    if (error) {
      throw error;
    }

    if (!data?.imageUrl) {
      throw new Error("Generation completed but no image was returned");
    }

    const media = buildGeneratedMedia(params.item, data);
    await queuePatchBundleImage({
      bundleId: params.bundleId,
      channel,
      media,
    });

    tracker.completeJob(params.bundleId, channel, data.imageUrl, {
      globalImageId: data.globalImageId,
      tags: media.tags,
    });
    params.onJobStatusChange?.(channel, "completed");
  } catch (error) {
    const message = getErrorMessage(error, "Failed to generate image");
    console.error(
      `[parallelImageGeneration] ${channel} image generation failed:`,
      error,
    );
    tracker.failJob(params.bundleId, channel, message);
    params.onJobStatusChange?.(channel, "failed");
  }
}

export async function generateBundleImages({
  bundleId,
  items,
  userId,
  onJobStatusChange,
}: GenerateBundleImagesParams) {
  const tracker = useImageGenerationTracker.getState();
  const sourceItems = items?.length
    ? items
    : (await waitForReadyBundle(bundleId))?.content.items || [];
  const eligibleItems = getEligibleItems(sourceItems);

  if (eligibleItems.length === 0) {
    return;
  }

  eligibleItems.forEach((item) => {
    tracker.startJob(bundleId, item.channel, item.imageQuery?.trim() || "");
  });

  const results = await Promise.allSettled(
    eligibleItems.map((item) =>
      runImageJob({ bundleId, item, userId, onJobStatusChange }),
    ),
  );

  results.forEach((result, index) => {
    if (result.status === "rejected") {
      const item = eligibleItems[index];
      console.error(
        `[parallelImageGeneration] ${item.channel} image task rejected:`,
        result.reason,
      );
      tracker.failJob(
        bundleId,
        item.channel,
        getErrorMessage(result.reason, "Image generation task failed"),
      );
    }
  });
}

export async function retryBundleImageGeneration({
  bundleId,
  channel,
  userId,
}: RetryBundleImageGenerationParams) {
  const tracker = useImageGenerationTracker.getState();
  const currentJob = tracker.getJobForChannel(bundleId, channel);

  if (!currentJob) {
    return;
  }

  const retryJob = tracker.retryJob(bundleId, channel);
  if (!retryJob) {
    return;
  }

  const resolvedUserId = userId || (await getCurrentUserId());
  const snapshot = await loadLatestBundle(bundleId);
  const existingItem = snapshot?.content.items.find(
    (item) => item.channel === channel,
  );

  if (!existingItem) {
    tracker.failJob(bundleId, channel, "No matching content item found");
    return;
  }

  await runImageJob({
    bundleId,
    item: {
      ...existingItem,
      imageQuery: existingItem.imageQuery?.trim() || currentJob.imageQuery,
    },
    userId: resolvedUserId,
  });
}
