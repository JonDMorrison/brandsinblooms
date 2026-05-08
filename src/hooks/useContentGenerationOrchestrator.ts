/**
 * Investigation Reference: supabase/functions/generate-ai-image/index.ts
 *
 * 1. Entry point:
 *    `serve(async (req) => { ... })`
 *    Reference: the file imports `serve` from std/http/server.ts and ends with
 *    the top-level `serve(async (req) => {` handler.
 *
 * 2. Request parsing:
 *    `const body: GenerateImageRequest = await req.json();`
 *    Reference snippet: `const body: GenerateImageRequest = await req.json();`
 *
 * 3. Request body fields read by the function:
 *    - `contentContext` (declared required in `GenerateImageRequest`; function
 *      falls back when empty via `const contentContext = ... rawContentContext ...`)
 *    - `contentTitle` (optional; destructured with `= ""`)
 *    - `channel` (declared required in the interface union, but effectively
 *      optional at runtime because it is destructured with `= "newsletter"`)
 *    - `uploadToStorage` (optional; destructured with `= true`)
 *    - `storageBucket` (optional; destructured with `= "campaign-images"`)
 *    - `userId` (optional; destructured with `= authenticatedUser.id`)
 *
 * 4. Image generation API:
 *    The function calls the Lovable AI gateway with Gemini image generation.
 *
 * 5. Exact external API call:
 *    `fetch("https://ai.gateway.lovable.dev/v1/chat/completions", { ... })`
 *    Body:
 *    `{
 *       model: "google/gemini-2.5-flash-image-preview",
 *       messages: [{ role: "user", content: prompt }],
 *       modalities: ["image", "text"]
 *     }`
 *    Reference: `generateWithRetry()`.
 *
 * 6. Storage path after generation:
 *    The function extracts base64 image data, uploads it to Supabase Storage
 *    bucket `global-ai-images`, then inserts a row into `global_image_gallery`.
 *    Reference snippets:
 *    - `supabaseAdmin.storage.from("global-ai-images").upload(...)`
 *    - `supabaseAdmin.storage.from("global-ai-images").getPublicUrl(...)`
 *    - `supabaseAdmin.from("global_image_gallery").insert(...)`
 *
 * 7. Exact success response shape:
 *    `return new Response(JSON.stringify(result), { headers: ... })`
 *    where `result` is:
 *    `{
 *       imageUrl: finalImageUrl,
 *       imageId: crypto.randomUUID(),
 *       globalImageId,
 *       metadata: {
 *         generationTime: parseFloat(generationTime),
 *         prompt: contentTitle || "AI Generated",
 *         storagePath,
 *         channel,
 *         tags: generatedTags,
 *       },
 *     }`
 *
 * 8. Exact error response shape:
 *    `return new Response(JSON.stringify({
 *       error: errorDetails.message || "Failed to generate image",
 *       type: isTimeout ? "timeout" : "error",
 *       retryable: true,
 *     }), { status, headers })`
 *
 * 9. Guard conditions / early returns:
 *    - `if (req.method === "OPTIONS") return new Response(null, ...)`
 *    - `if (!authHeader) return 401 { error: "Authorization required" }`
 *    - `if (authError || !authenticatedUser) return 401 { error: "Unauthorized" }`
 *    - `if (!locationResult.isValid) return locationBlockedResponse()`
 *    - duplicate-request guard: `if (activeRequests.has(cacheKey)) return new Response(JSON.stringify(result), ...)`
 *
 * 10. Required dependencies / possible external failures:
 *    - Env vars: `SUPABASE_URL`, `SUPABASE_ANON_KEY`,
 *      `SUPABASE_SERVICE_ROLE_KEY`, `LOVABLE_API_KEY`
 *    - External AI service: `https://ai.gateway.lovable.dev/v1/chat/completions`
 *    - Supabase Storage bucket: `global-ai-images`
 *    - Database tables: `users`, `company_profiles`, `global_image_gallery`,
 *      `global_image_tags`
 *    - Shared helpers: `validateLocationForGeneration`,
 *      `locationBlockedResponse`, climate helpers, master gardener prompt
 *    - Background dependency: Edge Function `generate-image-tags`
 *
 * Manual browser probe executed from the running app on 2026-05-07:
 * - `supabase.auth.getUser()` returned no session in the shared page context.
 * - `supabase.functions.invoke("generate-ai-image", { body: { prompt: ... } })`
 *   still returned a successful payload with a public `imageUrl`.
 * - A full payload using `contentContext`, `contentTitle`, `channel`,
 *   `uploadToStorage`, and `userId: null` also returned a successful payload
 *   with a public `imageUrl`.
 */

import { useCallback, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type {
  GeneratedBundle,
  GeneratedBundleItem,
} from "@/hooks/useGeneratedBundle";
import { useImageGenerationTracker } from "@/hooks/useImageGenerationTracker";
import {
  generateImageForChannel,
  type GenerateImageForChannelResult,
} from "@/utils/generateImageForChannel";

export type ContentGenerationPhase =
  | "idle"
  | "content"
  | "images"
  | "complete"
  | "failed";

export type ContentGenerationStatus =
  | "idle"
  | "generating"
  | "completed"
  | "failed";
export type ImageGenerationStatus =
  | "waiting"
  | "generating"
  | "completed"
  | "failed"
  | "skipped";

export interface ImageTaskState {
  status: ImageGenerationStatus;
  imageQuery: string;
  imageUrl: string | null;
  thumbnailUrl: string | null;
  error: string | null;
  globalImageId?: string;
}

export interface GenerationParams {
  mode: "seasonal" | "holiday" | "custom";
  sourceId?: string;
  topicTitle: string;
  topicDescription: string;
  channels: string[];
  workspaceId: string;
  userId: string;
  userIdea?: {
    title: string;
    goal?: "traffic" | "sales" | "awareness";
    tone?: string;
    notes?: string;
  };
  generationContext?: {
    selectedChannels: string[];
    hasMixedCarousel: boolean;
    carouselPlatform: "instagram" | "facebook" | null;
  };
}

interface UseContentGenerationOrchestratorReturn {
  isGenerating: boolean;
  phase: ContentGenerationPhase;
  contentStatus: ContentGenerationStatus;
  imageStatuses: Record<string, ImageGenerationStatus>;
  imageTasks: Record<string, ImageTaskState>;
  bundleId: string | null;
  bundleItems: GeneratedBundleItem[] | null;
  snapshotId: string | null;
  overallProgress: { completed: number; total: number };
  error: string | null;
  startGeneration: (params: GenerationParams) => Promise<void>;
  retry: () => Promise<void>;
  reset: () => void;
}

type AutoImageChannel = Extract<
  GeneratedBundleItem["channel"],
  "newsletter" | "blog" | "instagram" | "facebook"
>;

interface GenerateContentResponse {
  accepted?: boolean;
  id?: string;
  snapshotId?: string;
  content?: unknown;
  error?: string;
}

interface DraftSnapshotRecord {
  id: string;
  version: number;
  content: GeneratedBundle;
}

interface ImageGenerationCandidate {
  channel: AutoImageChannel;
  contentTitle: string;
  imageQuery: string;
}

const CONTENT_GENERATION_TIMEOUT_MS = 120000;
const READY_POLL_INTERVAL_MS = 3000;
const READY_POLL_TIMEOUT_MS = 180000;
const AUTO_IMAGE_CHANNELS: ReadonlySet<string> = new Set([
  "newsletter",
  "blog",
  "instagram",
  "facebook",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object";
}

function isAutoImageChannel(channel: string): channel is AutoImageChannel {
  return AUTO_IMAGE_CHANNELS.has(channel);
}

function normalizeChannels(channels: string[]) {
  return Array.from(new Set(channels.filter(Boolean)));
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function normalizeBundleContent(content: unknown): GeneratedBundle | null {
  if (!isRecord(content) || !Array.isArray(content.items)) {
    return null;
  }

  return content as unknown as GeneratedBundle;
}

function sleep(milliseconds: number) {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

function buildInitialImageStatuses(channels: string[]) {
  return channels.reduce<Record<string, ImageGenerationStatus>>(
    (statuses, channel) => ({ ...statuses, [channel]: "waiting" }),
    {},
  );
}

function buildInitialImageTasks(channels: string[]) {
  return channels.reduce<Record<string, ImageTaskState>>(
    (tasks, channel) => ({
      ...tasks,
      [channel]: {
        status: "waiting",
        imageQuery: "",
        imageUrl: null,
        thumbnailUrl: null,
        error: null,
      },
    }),
    {},
  );
}

function buildContentGenerationPayload(params: GenerationParams) {
  return {
    mode: params.mode,
    sourceId: params.sourceId,
    workspaceId: params.workspaceId,
    userId: params.userId,
    channels: params.channels,
    topicTitle: params.topicTitle,
    topicDescription: params.topicDescription,
    userIdea: params.userIdea,
    generationContext: params.generationContext,
  };
}

function getItemForChannel(
  items: GeneratedBundleItem[],
  channel: string,
): GeneratedBundleItem | null {
  return items.find((item) => item.channel === channel) || null;
}

function resolveImagePrompt(
  item: GeneratedBundleItem | null,
  topicTitle: string,
): string {
  return (
    item?.imageQuery?.trim() ||
    item?.title?.trim() ||
    topicTitle.trim() ||
    "Garden center marketing image"
  );
}

function mapTasksToStatuses(tasks: Record<string, ImageTaskState>) {
  return Object.entries(tasks).reduce<Record<string, ImageGenerationStatus>>(
    (statuses, [channel, task]) => ({
      ...statuses,
      [channel]: task.status,
    }),
    {},
  );
}

function isRenderableImageUrl(imageUrl: string | null | undefined) {
  return Boolean(imageUrl && imageUrl.trim().startsWith("http"));
}

async function invokeWithTimeout<T>(
  operation: Promise<T>,
  timeoutMs: number,
  message: string,
) {
  let timeoutId: number | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = window.setTimeout(() => reject(new Error(message)), timeoutMs);
  });

  try {
    return await Promise.race([operation, timeout]);
  } finally {
    if (timeoutId !== undefined) {
      window.clearTimeout(timeoutId);
    }
  }
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
): Promise<DraftSnapshotRecord> {
  const startedAt = Date.now();

  while (Date.now() - startedAt < READY_POLL_TIMEOUT_MS) {
    const snapshot = await loadLatestBundle(bundleId);
    const content = snapshot?.content;

    if (content?.generationStatus === "failed") {
      throw new Error(
        content.generationError ||
          "Content generation failed before images started",
      );
    }

    if (snapshot && Array.isArray(content?.items) && content.items.length > 0) {
      return snapshot;
    }

    await sleep(READY_POLL_INTERVAL_MS);
  }

  throw new Error("Timed out waiting for generated content to finish");
}

async function patchBundleImage(params: {
  bundleId: string;
  channel: AutoImageChannel;
  imageUrl: string;
  contentTitle: string;
  globalImageId?: string;
  tags?: string[];
}) {
  const snapshot = await loadLatestBundle(params.bundleId);
  if (!snapshot) {
    throw new Error("Unable to load latest bundle before image patching");
  }

  const targetItem = snapshot.content.items.find(
    (item) => item.channel === params.channel,
  );

  if (!targetItem) {
    throw new Error(`No ${params.channel} item found in bundle`);
  }

  const existingImageUrl = targetItem.media?.url?.trim();
  if (existingImageUrl && existingImageUrl !== params.imageUrl) {
    return;
  }

  const nextContent: GeneratedBundle = {
    ...snapshot.content,
    items: snapshot.content.items.map((item) =>
      item.channel === params.channel
        ? {
            ...item,
            media: {
              ...(item.media || {}),
              alt: item.media?.alt || item.title || params.contentTitle,
              globalImageId: params.globalImageId,
              source: "ai-generated",
              tags: params.tags,
              url: params.imageUrl,
            },
          }
        : item,
    ),
    thumbnail: snapshot.content.thumbnail || params.imageUrl,
  };

  const { error } = await supabase
    .from("draft_snapshots")
    .update({
      content: nextContent,
      updated_at: new Date().toISOString(),
    })
    .eq("id", snapshot.id);

  if (error) {
    throw error;
  }
}

export function useContentGenerationOrchestrator(): UseContentGenerationOrchestratorReturn {
  const [isGenerating, setIsGenerating] = useState(false);
  const [phase, setPhase] = useState<ContentGenerationPhase>("idle");
  const [contentStatus, setContentStatus] =
    useState<ContentGenerationStatus>("idle");
  const [imageStatuses, setImageStatuses] = useState<
    Record<string, ImageGenerationStatus>
  >({});
  const [imageTasks, setImageTasks] = useState<Record<string, ImageTaskState>>(
    {},
  );
  const [bundleId, setBundleId] = useState<string | null>(null);
  const [bundleItems, setBundleItems] = useState<GeneratedBundleItem[] | null>(
    null,
  );
  const [snapshotId, setSnapshotId] = useState<string | null>(null);
  const [channels, setChannels] = useState<string[]>([]);
  const [imageTaskChannels, setImageTaskChannels] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const lastParamsRef = useRef<GenerationParams | null>(null);
  const runIdRef = useRef(0);

  const setImageStatus = useCallback(
    (channel: string, status: ImageGenerationStatus) => {
      setImageStatuses((currentStatuses) => ({
        ...currentStatuses,
        [channel]: status,
      }));
      setImageTasks((currentTasks) => {
        const currentTask = currentTasks[channel];
        if (!currentTask) {
          return currentTasks;
        }

        return {
          ...currentTasks,
          [channel]: {
            ...currentTask,
            status,
          },
        };
      });
    },
    [],
  );

  const updateImageTask = useCallback(
    (channel: string, patch: Partial<ImageTaskState>) => {
      setImageTasks((currentTasks) => {
        const currentTask = currentTasks[channel] || {
          status: "waiting",
          imageQuery: "",
          imageUrl: null,
          thumbnailUrl: null,
          error: null,
        };

        const nextTasks = {
          ...currentTasks,
          [channel]: {
            ...currentTask,
            ...patch,
          },
        };

        setImageStatuses(mapTasksToStatuses(nextTasks));
        return nextTasks;
      });
    },
    [],
  );

  const overallProgress = useMemo(() => {
    if (phase === "content" || phase === "idle" || contentStatus === "failed") {
      return {
        completed: contentStatus === "completed" ? channels.length : 0,
        total: channels.length,
      };
    }

    const completedImageTasks = imageTaskChannels.filter((channel) => {
      const status = imageTasks[channel]?.status;
      return status === "completed";
    }).length;

    return {
      completed: completedImageTasks,
      total: imageTaskChannels.length,
    };
  }, [channels, contentStatus, imageTaskChannels, imageTasks, phase]);

  const startGeneration = useCallback(
    async (params: GenerationParams) => {
      const normalizedChannels = normalizeChannels(params.channels);
      const nextImageTaskChannels =
        normalizedChannels.filter(isAutoImageChannel);
      const runId = runIdRef.current + 1;
      runIdRef.current = runId;
      lastParamsRef.current = params;

      setIsGenerating(true);
      setPhase("content");
      setContentStatus("generating");
      setImageStatuses(buildInitialImageStatuses(normalizedChannels));
      setImageTasks(buildInitialImageTasks(normalizedChannels));
      setBundleId(null);
      setBundleItems(null);
      setSnapshotId(null);
      setChannels(normalizedChannels);
      setImageTaskChannels(nextImageTaskChannels);
      setError(null);

      if (normalizedChannels.length === 0) {
        setPhase("failed");
        setContentStatus("failed");
        setError("At least one content channel is required");
        setIsGenerating(false);
        return;
      }

      try {
        const generation = supabase.functions.invoke<GenerateContentResponse>(
          "generate-multichannel-content",
          { body: buildContentGenerationPayload(params) },
        );
        const result = await invokeWithTimeout(
          generation,
          CONTENT_GENERATION_TIMEOUT_MS,
          "Generation timed out before the request was accepted",
        );

        if (result.error) {
          throw result.error;
        }

        if (!result.data?.id || !result.data.snapshotId) {
          throw new Error("Content generator did not return bundle IDs");
        }

        if (runIdRef.current !== runId) {
          return;
        }

        setBundleId(result.data.id);
        setSnapshotId(result.data.snapshotId);
        useImageGenerationTracker.getState().clearBundle(result.data.id);

        const readySnapshot = await waitForReadyBundle(result.data.id);
        if (runIdRef.current !== runId) {
          return;
        }

        setBundleItems(readySnapshot.content.items);
        setContentStatus("completed");

        const nextTasks = normalizedChannels.reduce<
          Record<string, ImageTaskState>
        >((tasks, channel) => {
          const item = getItemForChannel(readySnapshot.content.items, channel);

          if (!isAutoImageChannel(channel)) {
            return {
              ...tasks,
              [channel]: {
                status: "skipped",
                imageQuery: "",
                imageUrl: null,
                thumbnailUrl: null,
                error: null,
              },
            };
          }

          if (!item) {
            return {
              ...tasks,
              [channel]: {
                status: "failed",
                imageQuery: "",
                imageUrl: null,
                thumbnailUrl: null,
                error: "No content item found for this channel.",
              },
            };
          }

          const existingImageUrl = item.media?.url?.trim() || null;
          const imageQuery = resolveImagePrompt(item, params.topicTitle);

          return {
            ...tasks,
            [channel]: {
              status: existingImageUrl ? "completed" : "generating",
              imageQuery,
              imageUrl: existingImageUrl,
              thumbnailUrl: existingImageUrl,
              error: null,
              globalImageId: item.media?.globalImageId,
            },
          };
        }, {});

        setImageTasks(nextTasks);
        setImageStatuses(mapTasksToStatuses(nextTasks));

        const imageCandidates = nextImageTaskChannels
          .map((channel) => {
            const item = getItemForChannel(
              readySnapshot.content.items,
              channel,
            );
            if (!item || item.media?.url?.trim()) {
              return null;
            }

            return {
              channel,
              contentTitle: item.title?.trim() || params.topicTitle,
              imageQuery: resolveImagePrompt(item, params.topicTitle),
            } satisfies ImageGenerationCandidate;
          })
          .filter(
            (candidate): candidate is ImageGenerationCandidate =>
              candidate !== null,
          );

        if (imageCandidates.length === 0) {
          setPhase("complete");
          setIsGenerating(false);
          return;
        }

        setPhase("images");

        const tracker = useImageGenerationTracker.getState();
        let patchQueue = Promise.resolve();
        const enqueuePatch = (
          imageChannel: AutoImageChannel,
          imageResult: GenerateImageForChannelResult,
          contentTitle: string,
        ) => {
          patchQueue = patchQueue
            .catch(() => undefined)
            .then(() =>
              patchBundleImage({
                bundleId: result.data.id!,
                channel: imageChannel,
                contentTitle,
                imageUrl: imageResult.imageUrl!,
                globalImageId: imageResult.globalImageId,
                tags: Array.isArray(imageResult.metadata?.tags)
                  ? imageResult.metadata?.tags
                      .map((tag) => {
                        if (typeof tag === "string") {
                          return tag;
                        }

                        if (
                          tag &&
                          typeof tag === "object" &&
                          "name" in tag &&
                          typeof (tag as { name?: unknown }).name === "string"
                        ) {
                          return (tag as { name: string }).name;
                        }

                        return null;
                      })
                      .filter((tag): tag is string => Boolean(tag))
                  : undefined,
              }),
            );

          return patchQueue;
        };

        const imageResults = await Promise.allSettled(
          imageCandidates.map(async (candidate) => {
            tracker.startJob(
              result.data.id!,
              candidate.channel,
              candidate.imageQuery,
            );
            updateImageTask(candidate.channel, {
              error: null,
              imageQuery: candidate.imageQuery,
              status: "generating",
            });

            try {
              const generatedImage = await generateImageForChannel({
                prompt: candidate.imageQuery,
                userId: params.userId,
                channel: candidate.channel,
                contentTitle: candidate.contentTitle,
              });

              if (!generatedImage.imageUrl) {
                const errorMessage =
                  generatedImage.error || "No image URL was returned.";
                tracker.failJob(
                  result.data.id!,
                  candidate.channel,
                  errorMessage,
                );
                updateImageTask(candidate.channel, {
                  error: errorMessage,
                  imageUrl: null,
                  thumbnailUrl: null,
                  status: "failed",
                });
                return { channel: candidate.channel, success: false };
              }

              await enqueuePatch(
                candidate.channel,
                generatedImage,
                candidate.contentTitle,
              );

              tracker.completeJob(
                result.data.id!,
                candidate.channel,
                generatedImage.imageUrl,
                {
                  globalImageId: generatedImage.globalImageId,
                  tags: Array.isArray(generatedImage.metadata?.tags)
                    ? generatedImage.metadata.tags
                        .map((tag) => {
                          if (typeof tag === "string") {
                            return tag;
                          }

                          if (
                            tag &&
                            typeof tag === "object" &&
                            "name" in tag &&
                            typeof (tag as { name?: unknown }).name === "string"
                          ) {
                            return (tag as { name: string }).name;
                          }

                          return null;
                        })
                        .filter((tag): tag is string => Boolean(tag))
                    : undefined,
                },
              );

              updateImageTask(candidate.channel, {
                error: null,
                globalImageId: generatedImage.globalImageId,
                imageUrl: generatedImage.imageUrl,
                thumbnailUrl: generatedImage.imageUrl,
                status: "completed",
              });

              return {
                channel: candidate.channel,
                imageUrl: generatedImage.imageUrl,
                success: true,
              };
            } catch (imageError) {
              const errorMessage = getErrorMessage(
                imageError,
                "Image generation failed.",
              );
              console.error(
                `[ContentGenerationOrchestrator] Image generation failed for ${candidate.channel}`,
                imageError,
              );
              tracker.failJob(result.data.id!, candidate.channel, errorMessage);
              updateImageTask(candidate.channel, {
                error: errorMessage,
                imageUrl: null,
                thumbnailUrl: null,
                status: "failed",
              });

              return { channel: candidate.channel, success: false };
            }
          }),
        );

        await patchQueue;

        if (runIdRef.current !== runId) {
          return;
        }

        imageResults.forEach((settledResult) => {
          if (settledResult.status === "rejected") {
            console.error(
              "[ContentGenerationOrchestrator] Unexpected image task rejection",
              settledResult.reason,
            );
          }
        });

        setPhase("complete");
      } catch (generationError) {
        if (runIdRef.current !== runId) {
          return;
        }

        console.error(
          "[ContentGenerationOrchestrator] Content generation failed",
          generationError,
        );
        setPhase("failed");
        setContentStatus("failed");
        setError(getErrorMessage(generationError, "Content generation failed"));
        setImageStatuses(buildInitialImageStatuses(normalizedChannels));
        setImageTasks(buildInitialImageTasks(normalizedChannels));
      } finally {
        if (runIdRef.current === runId) {
          setIsGenerating(false);
        }
      }
    },
    [updateImageTask],
  );

  const retry = useCallback(async () => {
    if (!lastParamsRef.current) {
      return;
    }

    await startGeneration(lastParamsRef.current);
  }, [startGeneration]);

  const reset = useCallback(() => {
    runIdRef.current += 1;
    lastParamsRef.current = null;
    setIsGenerating(false);
    setPhase("idle");
    setContentStatus("idle");
    setImageStatuses({});
    setImageTasks({});
    setBundleId(null);
    setBundleItems(null);
    setSnapshotId(null);
    setChannels([]);
    setImageTaskChannels([]);
    setError(null);
  }, []);

  return {
    isGenerating,
    phase,
    contentStatus,
    imageStatuses,
    imageTasks,
    bundleId,
    bundleItems,
    snapshotId,
    overallProgress,
    error,
    startGeneration,
    retry,
    reset,
  };
}
