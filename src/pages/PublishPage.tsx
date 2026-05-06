// AUDIT: Rebuilt PublishPage using new component structure
// - Uses PostCard components for rendering individual posts
// - Integrates ComposerDrawer for editing, publishing, and scheduling
// - Wires to publish-task via usePublishActions hook
// - Maps useDashboardData tasks to PublishItem format
// - Functional "Publish Now" and "Schedule" buttons via drawer

import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
} from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardTitle,
} from "@/components/ui-legacy/card";
import { Button } from "@/components/ui-legacy/button";
import { Input } from "@/components/ui-legacy/input";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui-legacy/tabs";
import { Search, Send, Filter, Plus } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useDashboardData } from "@/hooks/useDashboardData";
import { useTenant } from "@/hooks/useTenant";
import { usePublishActions } from "@/hooks/usePublishActions";
import { validatePostForPlatform } from "@/utils/validatePost";
import { supabase } from "@/integrations/supabase/client";
import type { Database, Json } from "@/integrations/supabase/types";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import PostCard from "@/components/publish/PostCard";
import ComposerDrawer, {
  ComposerMode,
} from "@/components/publish/ComposerDrawer";
import { useNavigate, useSearchParams } from "react-router-dom";
import { cn } from "@/lib/utils";
import type {
  Platform,
  PublishItem,
  PublishNowInput,
  ScheduleInput,
  PublishSourceBundle,
} from "@/types/publish";
import { findPostTemplate } from "@/lib/social/postTemplates";
import { isWithinRecencyWindow } from "@/lib/social/publishItemRecency";

type BundleFilterState = {
  bundleId: string;
  approvedChannels: Platform[];
  previewTitle?: string | null;
};

type ContentTaskRow = Database["public"]["Tables"]["content_tasks"]["Row"];
type ContentTaskInsert =
  Database["public"]["Tables"]["content_tasks"]["Insert"];
type ContentTaskUpdate =
  Database["public"]["Tables"]["content_tasks"]["Update"];
type JsonRecord = { [key: string]: Json | undefined };
type ExistingBundleTask = Pick<
  ContentTaskRow,
  "id" | "post_type" | "status" | "image_metadata"
>;

type BundleContentItem = Record<string, unknown> & {
  media?: {
    url?: unknown;
    alt?: unknown;
  } | null;
};

type BundleSnapshotRow = {
  id: string;
  version: number;
  content: {
    sourceLabel?: string;
    previewTitle?: string;
    recommendedImages?: Array<{ url?: string; alt?: string }>;
    items?: BundleContentItem[];
  } | null;
};

type BundlePublishDraft = {
  channel: Platform;
  caption: string;
  imageUrl: string | null;
  imageAlt: string | null;
  attachments: JsonRecord | null;
  hashtags: string | null;
};

const FINALIZED_TASK_STATUSES = new Set(["scheduled", "published"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value : "";
}

function optionalString(value: unknown) {
  const text = stringValue(value);
  return text || null;
}

function getRecordString(record: unknown, key: string) {
  return isRecord(record) ? optionalString(record[key]) : null;
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function toJsonRecord(value: unknown): JsonRecord | null {
  return isRecord(value) ? (value as JsonRecord) : null;
}

function getAttachmentImageUrl(attachments: Json | null) {
  const attachmentRecord = toJsonRecord(attachments);
  const image = attachmentRecord?.image;
  return getRecordString(image, "url");
}

function getTaskExtraString(task: unknown, key: string) {
  return getRecordString(task, key);
}

function normalizePlatform(value: string | null | undefined): Platform | null {
  if (value === "facebook" || value === "instagram") {
    return value;
  }

  return null;
}

function parseApprovedChannelsParam(value: string | null): Platform[] {
  if (!value) {
    return [];
  }

  const platforms = value
    .split(",")
    .map((entry) => normalizePlatform(entry.trim()))
    .filter((entry): entry is Platform => entry !== null);

  return Array.from(new Set(platforms));
}

function extractBundleContent(item: BundleContentItem) {
  const candidates = [
    stringValue(item.body),
    stringValue(item.markdown),
    stringValue(item.script),
    stringValue(item.caption),
    stringValue(item.text),
    stringValue(item.content),
  ].filter(Boolean);

  return (
    candidates.sort(
      (left, right) => (right?.length || 0) - (left?.length || 0),
    )[0] || ""
  );
}

function parseSourceBundle(value: unknown): PublishSourceBundle | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const sourceBundle = value.sourceBundle;
  if (!isRecord(sourceBundle)) {
    return null;
  }

  const bundleId = optionalString(sourceBundle.bundleId);
  const channel = normalizePlatform(optionalString(sourceBundle.channel));

  if (!bundleId || !channel) {
    return null;
  }

  return {
    bundleId,
    channel,
    snapshotId:
      optionalString(sourceBundle.snapshotId),
    snapshotVersion:
      typeof sourceBundle.snapshotVersion === "number"
        ? sourceBundle.snapshotVersion
        : null,
    previewTitle: optionalString(sourceBundle.previewTitle),
  };
}

function buildBundleImageMetadata(
  existingMetadata: unknown,
  sourceBundle: PublishSourceBundle,
) {
  const baseMetadata = toJsonRecord(existingMetadata) ?? {};

  return {
    ...baseMetadata,
    sourceBundle: {
      bundleId: sourceBundle.bundleId,
      channel: sourceBundle.channel,
      snapshotId: sourceBundle.snapshotId ?? null,
      snapshotVersion: sourceBundle.snapshotVersion ?? null,
      previewTitle: sourceBundle.previewTitle ?? null,
    },
  } satisfies JsonRecord;
}

function extractApprovedBundleDrafts(
  snapshot: BundleSnapshotRow["content"],
  requestedApprovedChannels: Platform[],
  requestedChannel: Platform | null,
) {
  const allowedChannels = new Set<Platform>(
    requestedApprovedChannels.length > 0
      ? requestedApprovedChannels
      : requestedChannel
        ? [requestedChannel]
        : ["facebook", "instagram"],
  );

  const draftsByChannel = new Map<Platform, BundlePublishDraft>();

  for (const item of snapshot?.items || []) {
    const channel = normalizePlatform(item.channel);
    if (!channel || !item._approved || !allowedChannels.has(channel)) {
      continue;
    }

    const fallbackImageUrl = snapshot?.recommendedImages?.[0]?.url || null;
    const imageUrl = item.media?.url || fallbackImageUrl;
    const imageAlt = item.media?.alt || item.alt || item.title || null;

    draftsByChannel.set(channel, {
      channel,
      caption:
        extractBundleContent(item).trim() || "Content generated from campaign",
      imageUrl,
      imageAlt,
      attachments: imageUrl
        ? {
            image: {
              url: imageUrl,
              alt: imageAlt || "Campaign image",
              thumb: imageUrl,
            },
          }
        : null,
      hashtags:
        Array.isArray(item.hashtags) && item.hashtags.length > 0
          ? item.hashtags.join(" ")
          : null,
    });
  }

  return Array.from(draftsByChannel.values());
}

const PublishPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { tenant, loading: tenantLoading } = useTenant();
  const { data: dashboardData, isLoading, refetch } = useDashboardData();
  const { publishNow, schedule } = usePublishActions();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const requestedBundleId = searchParams.get("bundleId");
  const requestedChannel = normalizePlatform(searchParams.get("channel"));
  const requestedApprovedChannels = useMemo(
    () => parseApprovedChannelsParam(searchParams.get("approved")),
    [searchParams],
  );
  const highlightedTaskId = searchParams.get("highlight");
  const highlightedTab =
    searchParams.get("tab") === "published" ? "published" : "ready";
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const [loading, setLoading] = useState(true);
  const [prefillDone, setPrefillDone] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState<"ready" | "published">(
    highlightedTab,
  );
  const [activeHighlightTaskId, setActiveHighlightTaskId] = useState<
    string | null
  >(highlightedTaskId);
  const [bundleFilter, setBundleFilter] = useState<BundleFilterState | null>(
    requestedBundleId
      ? {
          bundleId: requestedBundleId,
          approvedChannels: requestedApprovedChannels,
          previewTitle: null,
        }
      : null,
  );

  // Drawer state
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState<ComposerMode>("edit");
  const [selectedItem, setSelectedItem] = useState<PublishItem | null>(null);

  // Track task IDs that were just inserted by a template or blank-compose
  // prefill but haven't been touched by the user. If the user clicks Cancel
  // without editing, we soft-delete the row to prevent orphan drafts piling
  // up in the Ready queue (the original Maple Park bug pattern).
  const freshPrefillTaskIdsRef = useRef<Set<string>>(new Set());

  // Convert dashboard data to PublishItem format (ready to post)
  const publishItems: PublishItem[] = useMemo(() => {
    const tasks = dashboardData?.tasks || [];
    const socialConnections = dashboardData?.socialConnections || [];
    const scheduledPosts = dashboardData?.scheduledPosts || [];

    return tasks
      .filter(
        (task) =>
          ["facebook", "instagram"].includes(task.post_type) &&
          task.status.toLowerCase() !== "published",
      )
      .map((task) => {
        const connection = socialConnections.find(
          (conn) => conn.platform === task.post_type && conn.is_active,
        );

        // Find matching scheduled post to get publish_at timestamp
        const scheduledPost = scheduledPosts.find(
          (sp) => sp.task_id === task.id,
        );

        return {
          taskId: task.id,
          tenantId: task.tenant_id,
          platform: task.post_type as "facebook" | "instagram",
          accountId: connection?.platform_account_id || null,
          accountName: connection?.platform_account_name || null,
          caption: task.ai_output?.trim() || null,
          firstComment: getTaskExtraString(task, "first_comment"),
          mediaUrl:
            task.image_url || getAttachmentImageUrl(task.attachments) || null,
          scheduledFor: scheduledPost?.publish_at || null,
          status: task.status.toLowerCase() as PublishItem["status"],
          createdAt: task.created_at ?? null,
          attachments: task.attachments,
          sourceBundle: parseSourceBundle(task.image_metadata),
        };
      });
  }, [dashboardData]);

  // Convert published tasks to published items format
  const publishedItems: (PublishItem & { publishedAt: string })[] =
    useMemo(() => {
      const publishedTasks = dashboardData?.publishedTasks || [];
      const scheduledPosts = dashboardData?.scheduledPosts || [];
      const socialConnections = dashboardData?.socialConnections || [];

      return publishedTasks
        .filter((task) => ["facebook", "instagram"].includes(task.post_type))
        .map((task) => {
          const connection = socialConnections.find(
            (conn) => conn.platform === task.post_type && conn.is_active,
          );

          // Find corresponding scheduled post for publish timestamp
          const scheduledPost = scheduledPosts.find(
            (post) =>
              post.content_id === task.id && post.status === "PUBLISHED",
          );

          return {
            taskId: task.id,
            tenantId: task.tenant_id,
            platform: task.post_type as "facebook" | "instagram",
            accountId: connection?.platform_account_id || null,
            accountName: connection?.platform_account_name || null,
            caption: task.ai_output?.trim() || null,
            firstComment: getTaskExtraString(task, "first_comment"),
            mediaUrl:
              task.image_url || getAttachmentImageUrl(task.attachments) || null,
            scheduledFor: null,
            status: "published" as const,
            createdAt: task.created_at ?? null,
            attachments: task.attachments,
            publishedAt: scheduledPost?.publish_at || task.created_at,
            sourceBundle: parseSourceBundle(task.image_metadata),
          };
        })
        .sort(
          (a, b) =>
            new Date(b.publishedAt).getTime() -
            new Date(a.publishedAt).getTime(),
        );
    }, [dashboardData]);

  const bundleScopedReadyItems = useMemo(() => {
    if (!bundleFilter) {
      return publishItems;
    }

    return publishItems.filter((item) => {
      if (item.sourceBundle?.bundleId !== bundleFilter.bundleId) {
        return false;
      }

      if (bundleFilter.approvedChannels.length === 0) {
        return true;
      }

      return bundleFilter.approvedChannels.includes(item.sourceBundle.channel);
    });
  }, [bundleFilter, publishItems]);

  const bundleScopedPublishedItems = useMemo(() => {
    if (!bundleFilter) {
      return publishedItems;
    }

    return publishedItems.filter((item) => {
      if (item.sourceBundle?.bundleId !== bundleFilter.bundleId) {
        return false;
      }

      if (bundleFilter.approvedChannels.length === 0) {
        return true;
      }

      return bundleFilter.approvedChannels.includes(item.sourceBundle.channel);
    });
  }, [bundleFilter, publishedItems]);

  // Available accounts for ComposerDrawer
  const availableAccounts = useMemo(() => {
    const connections = dashboardData?.socialConnections || [];
    return connections
      .filter((conn) => conn.is_active)
      .map((conn) => ({
        platform: conn.platform as "facebook" | "instagram",
        accountId: conn.platform_account_id,
        accountName:
          conn.platform_account_name ||
          conn.username ||
          `${conn.platform} account`,
      }));
  }, [dashboardData]);

  // Older-than-30-days items are hidden by default and surfaced behind a
  // toggle. content_tasks accumulate without lifecycle (Maple Park had a
  // queue of 6-month-stale Halloween content visible by default), so we
  // filter the visual default to "last 30 days" without throwing away the
  // older items entirely. Boundary logic lives in
  // src/lib/social/publishItemRecency.ts and is unit-tested there.
  const [showOlderReady, setShowOlderReady] = useState(false);

  // Filter ready items by search term
  const searchFilteredReadyItems = useMemo(() => {
    if (!searchTerm) return bundleScopedReadyItems;
    const term = searchTerm.toLowerCase();
    return bundleScopedReadyItems.filter(
      (item) =>
        item.caption?.toLowerCase().includes(term) ||
        item.platform.toLowerCase().includes(term) ||
        item.accountName?.toLowerCase().includes(term),
    );
  }, [bundleScopedReadyItems, searchTerm]);

  // Split into recent (≤30d) vs older (>30d). Default view shows only recent;
  // user can expand "Older" to see the rest.
  const recentReadyItems = useMemo(
    () =>
      searchFilteredReadyItems.filter((item) =>
        isWithinRecencyWindow(item.createdAt),
      ),
    [searchFilteredReadyItems],
  );
  const olderReadyItems = useMemo(
    () =>
      searchFilteredReadyItems.filter(
        (item) => !isWithinRecencyWindow(item.createdAt),
      ),
    [searchFilteredReadyItems],
  );

  const filteredReadyItems = showOlderReady
    ? searchFilteredReadyItems
    : recentReadyItems;

  // Filter published items by search term
  const filteredPublishedItems = useMemo(() => {
    if (!searchTerm) return bundleScopedPublishedItems;
    const term = searchTerm.toLowerCase();
    return bundleScopedPublishedItems.filter(
      (item) =>
        item.caption?.toLowerCase().includes(term) ||
        item.platform.toLowerCase().includes(term) ||
        item.accountName?.toLowerCase().includes(term),
    );
  }, [bundleScopedPublishedItems, searchTerm]);

  useEffect(() => {
    setPrefillDone(false);

    if (!requestedBundleId) {
      return;
    }

    setBundleFilter({
      bundleId: requestedBundleId,
      approvedChannels: requestedApprovedChannels,
      previewTitle: null,
    });
    setActiveTab("ready");
  }, [requestedApprovedChannels, requestedBundleId]);

  useEffect(() => {
    setActiveTab(highlightedTab);
  }, [highlightedTab]);

  useEffect(() => {
    if (!highlightedTaskId) {
      return;
    }

    setActiveHighlightTaskId(highlightedTaskId);

    const timeoutId = window.setTimeout(() => {
      setActiveHighlightTaskId((currentValue) =>
        currentValue === highlightedTaskId ? null : currentValue,
      );
    }, 3200);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [highlightedTaskId]);

  useEffect(() => {
    if (!highlightedTaskId) {
      return;
    }

    const animationFrame = window.requestAnimationFrame(() => {
      cardRefs.current[highlightedTaskId]?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    });

    return () => {
      window.cancelAnimationFrame(animationFrame);
    };
  }, [
    activeTab,
    filteredPublishedItems,
    filteredReadyItems,
    highlightedTaskId,
  ]);

  useEffect(() => {
    if (
      !requestedBundleId ||
      prefillDone ||
      !user ||
      !tenant ||
      tenantLoading
    ) {
      return;
    }

    let cancelled = false;

    const cleanUrl = () => {
      const url = new URL(window.location.href);
      url.searchParams.delete("bundleId");
      url.searchParams.delete("channel");
      url.searchParams.delete("approved");
      const qs = url.searchParams.toString();
      window.history.replaceState({}, "", url.pathname + (qs ? `?${qs}` : ""));
    };

    (async () => {
      try {
        const { data, error } = await supabase
          .from("draft_snapshots")
          .select("id, version, content")
          .eq("doc_type", "content_bundle")
          .eq("doc_id", requestedBundleId)
          .order("version", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (cancelled) {
          return;
        }

        const bundleData = data
          ? ({
              id: data.id,
              version: data.version,
              content: data.content as BundleSnapshotRow["content"],
            } satisfies BundleSnapshotRow)
          : null;

        if (error || !bundleData?.content) {
          cleanUrl();
          setPrefillDone(true);
          return;
        }

        const approvedDrafts = extractApprovedBundleDrafts(
          bundleData.content,
          requestedApprovedChannels,
          requestedChannel,
        );

        const previewTitle =
          bundleData.content.sourceLabel ||
          bundleData.content.previewTitle ||
          approvedDrafts[0]?.caption ||
          null;

        const approvedChannels = approvedDrafts.map((draft) => draft.channel);
        setBundleFilter({
          bundleId: requestedBundleId,
          approvedChannels,
          previewTitle,
        });

        if (approvedDrafts.length === 0) {
          cleanUrl();
          setPrefillDone(true);
          toast({
            title: "No approved social content",
            description:
              "Approve at least one Facebook or Instagram item before publishing.",
            variant: "destructive",
          });
          navigate(`/content/library?doc_id=${requestedBundleId}`, {
            replace: true,
          });
          return;
        }

        const { data: existingTasks, error: existingTasksError } =
          await supabase
            .from("content_tasks")
            .select("id, post_type, status, image_metadata")
            .eq("tenant_id", tenant.id)
            .is("deleted_at", null)
            .contains("image_metadata", {
              sourceBundle: { bundleId: requestedBundleId },
            });

        if (existingTasksError) {
          throw existingTasksError;
        }

        const existingOpenTasksByChannel = new Map<
          Platform,
          ExistingBundleTask
        >();
        for (const task of existingTasks || []) {
          const sourceBundle = parseSourceBundle(task.image_metadata);
          const platform = normalizePlatform(task.post_type);
          const status = task.status.toLowerCase();

          if (
            !sourceBundle ||
            sourceBundle.bundleId !== requestedBundleId ||
            !platform ||
            FINALIZED_TASK_STATUSES.has(status)
          ) {
            continue;
          }

          existingOpenTasksByChannel.set(
            sourceBundle.channel || platform,
            task,
          );
        }

        const touchedTaskIds: string[] = [];
        for (const draft of approvedDrafts) {
          const sourceBundle: PublishSourceBundle = {
            bundleId: requestedBundleId,
            channel: draft.channel,
            snapshotId: bundleData.id,
            snapshotVersion: bundleData.version,
            previewTitle,
          };
          const taskPayload: ContentTaskInsert = {
            user_id: user.id,
            tenant_id: tenant.id,
            post_type: draft.channel,
            ai_output: draft.caption,
            image_url: draft.imageUrl,
            attachments: draft.attachments,
            hashtags: draft.hashtags,
            status: "review",
          };

          const existingTask = existingOpenTasksByChannel.get(draft.channel);
          const payloadWithMetadata = {
            ...taskPayload,
            image_metadata: buildBundleImageMetadata(
              existingTask?.image_metadata,
              sourceBundle,
            ),
          };

          if (existingTask) {
            const { data: updatedTask, error: updateError } = await supabase
              .from("content_tasks")
              .update(payloadWithMetadata)
              .eq("id", existingTask.id)
              .select("id")
              .single();

            if (updateError) {
              throw updateError;
            }

            touchedTaskIds.push(updatedTask.id);
          } else {
            const { data: insertedTask, error: insertError } = await supabase
              .from("content_tasks")
              .insert(payloadWithMetadata)
              .select("id")
              .single();

            if (insertError) {
              throw insertError;
            }

            touchedTaskIds.push(insertedTask.id);
          }
        }

        const staleTaskIds = (existingTasks || [])
          .filter((task) => {
            const sourceBundle = parseSourceBundle(task.image_metadata);
            const channel =
              sourceBundle?.channel || normalizePlatform(task.post_type);
            const status = task.status.toLowerCase();

            return (
              sourceBundle?.bundleId === requestedBundleId &&
              !!channel &&
              !approvedChannels.includes(channel) &&
              !FINALIZED_TASK_STATUSES.has(status)
            );
          })
          .map((task) => task.id);

        if (staleTaskIds.length > 0) {
          const { error: deleteError } = await supabase
            .from("content_tasks")
            .delete()
            .in("id", staleTaskIds);

          if (deleteError) {
            throw deleteError;
          }
        }

        // Invalidate dashboard data to refresh UI immediately
        await queryClient.invalidateQueries({ queryKey: ["dashboard-data"] });
        await refetch?.();

        setActiveTab("ready");
        setActiveHighlightTaskId(touchedTaskIds[0] || null);
        cleanUrl();
        setPrefillDone(true);
      } catch (error) {
        console.error("Failed prefilling publish content from bundle", error);
        cleanUrl();
        setPrefillDone(true);
        toast({
          title: "Publish handoff failed",
          description:
            "We couldn't prepare the approved bundle items for publishing.",
          variant: "destructive",
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    navigate,
    prefillDone,
    queryClient,
    refetch,
    requestedApprovedChannels,
    requestedBundleId,
    requestedChannel,
    tenant,
    tenantLoading,
    toast,
    user,
  ]);

  // Set loading state
  useEffect(() => {
    if (user && !isLoading) {
      setLoading(false);
    }
  }, [user, isLoading]);

  // Template-prefill: when the URL has ?template=<id>, look up the template
  // (defined in src/lib/social/postTemplates.ts), insert a new content_tasks
  // row with the template content, and auto-open the composer drawer pointed
  // at it. Marks "done" in localStorage so a refresh doesn't double-insert,
  // and strips ?template= from the URL after processing.
  const [templatePrefillDone, setTemplatePrefillDone] = useState(false);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const templateId = params.get("template");
    if (
      !templateId ||
      templatePrefillDone ||
      !user ||
      !tenant ||
      tenantLoading
    ) {
      return;
    }

    const template = findPostTemplate(templateId);
    if (!template) {
      // Unknown template id — clean the URL and do nothing.
      const url = new URL(window.location.href);
      url.searchParams.delete("template");
      const qs = url.searchParams.toString();
      window.history.replaceState({}, "", url.pathname + (qs ? `?${qs}` : ""));
      setTemplatePrefillDone(true);
      return;
    }

    const prefillKey = `publish-prefill:template:${templateId}:${tenant.id}`;
    const cleanUrl = () => {
      const url = new URL(window.location.href);
      url.searchParams.delete("template");
      const qs = url.searchParams.toString();
      window.history.replaceState({}, "", url.pathname + (qs ? `?${qs}` : ""));
    };

    if (localStorage.getItem(prefillKey) === "done") {
      cleanUrl();
      setTemplatePrefillDone(true);
      return;
    }

    (async () => {
      try {
        const insertPayload: ContentTaskInsert = {
          user_id: user.id,
          tenant_id: tenant.id,
          // Default to instagram (most common single-image social platform);
          // user can switch via the composer drawer's account picker.
          post_type: "instagram",
          ai_output: template.content,
          status: "review",
        };

        const { data: inserted, error: insertError } = await supabase
          .from("content_tasks")
          .insert(insertPayload)
          .select("*")
          .single();

        if (insertError || !inserted) {
          console.error(
            "Template prefill: content_tasks insert failed",
            insertError,
          );
          cleanUrl();
          setTemplatePrefillDone(true);
          return;
        }

        localStorage.setItem(prefillKey, "done");
        cleanUrl();
        setTemplatePrefillDone(true);

        // Refresh the dashboard data so the new task appears in the list.
        queryClient.invalidateQueries({ queryKey: ["dashboard-data"] });
        await refetch?.();

        // Auto-open the drawer on the freshly inserted task. Mark it as a
        // fresh prefill so onCancelUntouched can soft-delete if the user
        // backs out without editing.
        const newItem: PublishItem = {
          taskId: inserted.id,
          tenantId: tenant.id,
          platform: "instagram",
          accountId: null,
          accountName: null,
          caption: template.content,
          firstComment: null,
          mediaUrl: null,
          scheduledFor: null,
          status: "review",
          attachments: null,
        };
        freshPrefillTaskIdsRef.current.add(newItem.taskId);
        setSelectedItem(newItem);
        setDrawerMode("edit");
        setDrawerOpen(true);
      } catch (e) {
        console.error("Template prefill error:", e);
        cleanUrl();
        setTemplatePrefillDone(true);
      }
    })();
  }, [
    templatePrefillDone,
    user,
    tenant,
    tenantLoading,
    queryClient,
    refetch,
  ]);

  // Blank-composer entry: inserts an empty content_tasks row and opens the
  // composer drawer pointed at it. Called from (a) the ?compose=blank URL
  // handler below, when the user clicks "Start blank" on the dashboard
  // PostComposerModal, and (b) the "New Post" button on this page so direct
  // visitors to /publish have a discoverable entry point. The orphan-on-Cancel
  // case is handled separately by the freshPrefillTaskIdRef logic.
  const openBlankComposer = useCallback(async () => {
    if (!user || !tenant) return;
    try {
      const insertPayload: ContentTaskInsert = {
        user_id: user.id,
        tenant_id: tenant.id,
        post_type: "instagram",
        ai_output: "",
        status: "review",
      };
      const { data: inserted, error: insertError } = await supabase
        .from("content_tasks")
        .insert(insertPayload)
        .select("*")
        .single();
      if (insertError || !inserted) {
        console.error("Blank composer: insert failed", insertError);
        toast({
          title: "Couldn't start a new post",
          description: "Try again in a moment.",
          variant: "destructive",
        });
        return;
      }
      queryClient.invalidateQueries({ queryKey: ["dashboard-data"] });
      await refetch?.();
      const newItem: PublishItem = {
        taskId: inserted.id,
        tenantId: tenant.id,
        platform: "instagram",
        accountId: null,
        accountName: null,
        caption: "",
        firstComment: null,
        mediaUrl: null,
        scheduledFor: null,
        status: "review",
        attachments: null,
      };
      // Track for cancel-without-edit cleanup (parallel to template flow).
      freshPrefillTaskIdsRef.current.add(newItem.taskId);
      setSelectedItem(newItem);
      setDrawerMode("edit");
      setDrawerOpen(true);
    } catch (e) {
      console.error("Blank composer error:", e);
    }
  }, [user, tenant, queryClient, refetch, toast]);

  // ?compose=blank URL handler — opens an empty composer when the user clicks
  // "Start blank" on PostComposerModal. Strips the param after consuming so a
  // refresh doesn't reopen the dialog.
  const [blankComposeDone, setBlankComposeDone] = useState(false);
  useEffect(() => {
    if (blankComposeDone || !user || !tenant || tenantLoading) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("compose") !== "blank") return;
    setBlankComposeDone(true);
    const url = new URL(window.location.href);
    url.searchParams.delete("compose");
    const qs = url.searchParams.toString();
    window.history.replaceState({}, "", url.pathname + (qs ? `?${qs}` : ""));
    void openBlankComposer();
  }, [blankComposeDone, user, tenant, tenantLoading, openBlankComposer]);

  // Drawer handlers
  const handleOpenDrawer = (item: PublishItem, mode: ComposerMode) => {
    setSelectedItem(item);
    setDrawerMode(mode);
    setDrawerOpen(true);
  };

  const handleCloseDrawer = () => {
    setDrawerOpen(false);
    setSelectedItem(null);
  };

  // Soft-delete the row if the user opened a fresh template/blank prefill,
  // didn't edit anything, and clicked Cancel. This complements the strict
  // unique index added in Fix C: instead of leaving cancelled drafts in the
  // queue (the Maple Park pattern), they vanish from view immediately. Still
  // recoverable server-side via deleted_at = <timestamp>.
  const handleCancelUntouched = useCallback(
    async (taskId: string) => {
      if (!freshPrefillTaskIdsRef.current.has(taskId)) return;
      freshPrefillTaskIdsRef.current.delete(taskId);
      try {
        await supabase
          .from("content_tasks")
          .update({ deleted_at: new Date().toISOString() })
          .eq("id", taskId);
        queryClient.invalidateQueries({ queryKey: ["dashboard-data"] });
        await refetch?.();
      } catch (e) {
        console.error("Cancel-untouched soft-delete failed:", e);
      }
    },
    [queryClient, refetch],
  );

  // Save draft handler
  const handleSaveDraft = useCallback(
    async (
      taskId: string,
      partial: {
        caption?: string | null;
        mediaUrl?: string | null;
        firstComment?: string | null;
        accountId?: string | null;
        platform?: "facebook" | "instagram";
      },
    ) => {
      const updateData: ContentTaskUpdate = {};
      if (partial.caption !== undefined) updateData.ai_output = partial.caption;
      if (partial.mediaUrl !== undefined)
        updateData.image_url = partial.mediaUrl;
      if (partial.platform !== undefined)
        updateData.post_type = partial.platform;
      // Note: firstComment is Instagram-specific and not stored in content_tasks
      // Note: accountId is not stored in content_tasks - it's passed to publish functions

      if (partial.mediaUrl) {
        updateData.attachments = {
          image: {
            url: partial.mediaUrl,
            alt: "Content image",
            thumb: partial.mediaUrl,
          },
        };
      }

      const { data, error } = await supabase
        .from("content_tasks")
        .update(updateData)
        .eq("id", taskId)
        .select()
        .single();

      if (error) throw error;

      // Once a fresh prefill has been edited and saved, it's no longer a
      // candidate for cancel-without-edit cleanup.
      freshPrefillTaskIdsRef.current.delete(taskId);

      // Update local state optimistically
      const updated: PublishItem = {
        ...(selectedItem as PublishItem),
        caption: data.ai_output || null,
        mediaUrl: data.image_url || null,
        firstComment: getTaskExtraString(data, "first_comment"),
        accountId: getTaskExtraString(data, "account_id"),
        platform: (data.post_type ?? selectedItem?.platform ?? "instagram") as
          | "facebook"
          | "instagram",
      };
      setSelectedItem(updated);

      // Refresh dashboard data
      refetch?.();

      return updated;
    },
    [selectedItem, refetch],
  );

  // Publish now handler
  const handlePublishNow = useCallback(
    async (taskId: string, input: PublishNowInput) => {
      await publishNow(taskId, input);

      // Close the drawer since publishing was successful
      setDrawerOpen(false);
      setSelectedItem(null);

      // Force refresh to show updated status and scheduled time
      queryClient.invalidateQueries({ queryKey: ["dashboard-data"] });
      await refetch?.();
    },
    [publishNow, refetch, queryClient],
  );

  // Schedule handler
  const handleSchedule = useCallback(
    async (taskId: string, input: ScheduleInput) => {
      await schedule(taskId, input);

      // Close the drawer since scheduling was successful
      setDrawerOpen(false);
      setSelectedItem(null);

      // Force refresh to show updated status and scheduled time
      queryClient.invalidateQueries({ queryKey: ["dashboard-data"] });
      await refetch?.();
    },
    [schedule, refetch, queryClient],
  );

  // Archive (soft-delete) handler with 5-second undo.
  //
  // Sets content_tasks.deleted_at = now() so the row stops appearing in
  // useDashboardData's query (which filters deleted_at IS NULL). The user
  // gets a toast with an Undo action that clears deleted_at if clicked
  // within 5 seconds. After the toast dismisses, the soft-delete is
  // effectively permanent for the UI but the row is still recoverable
  // server-side.
  //
  // Optimistic UX: we issue the DB update immediately, then surface the
  // undo. If the DB update fails we surface an error toast and refetch to
  // restore the original state.
  const archivedItemsRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map(),
  );
  const handleArchive = useCallback(
    async (item: PublishItem) => {
      const taskId = item.taskId;
      const archivedAt = new Date().toISOString();

      try {
        const { error } = await supabase
          .from("content_tasks")
          .update({ deleted_at: archivedAt })
          .eq("id", taskId);

        if (error) throw error;

        // Refresh data to remove the archived item from the list
        await refetch?.();

        toast({
          title: "Item archived",
          description: "Click Undo to restore.",
          action: (
            <button
              type="button"
              onClick={async () => {
                const pending = archivedItemsRef.current.get(taskId);
                if (pending) {
                  clearTimeout(pending);
                  archivedItemsRef.current.delete(taskId);
                }

                try {
                  const { error: undoError } = await supabase
                    .from("content_tasks")
                    .update({ deleted_at: null })
                    .eq("id", taskId);

                  if (undoError) throw undoError;

                  await refetch?.();
                  toast({
                    title: "Item restored",
                  });
                } catch (undoError) {
                  console.error("Archive undo error:", undoError);
                  toast({
                    title: "Couldn't restore item",
                    description:
                      getErrorMessage(
                        undoError,
                        "Please refresh and try again.",
                      ),
                    variant: "destructive",
                  });
                }
              }}
              className="text-sm font-semibold underline-offset-2 hover:underline"
            >
              Undo
            </button>
          ),
          duration: 5000,
        });

        // Track the timeout so a second click on Undo can cancel it. The
        // archive itself is already persisted; this timer just clears the
        // tracking map entry once the undo window closes.
        const timeout = setTimeout(() => {
          archivedItemsRef.current.delete(taskId);
        }, 5000);
        archivedItemsRef.current.set(taskId, timeout);
      } catch (error) {
        console.error("Archive error:", error);
        toast({
          title: "Error",
          description: getErrorMessage(error, "Failed to archive content"),
          variant: "destructive",
        });
      }
    },
    [toast, refetch],
  );

  if (loading || isLoading || tenantLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading publish portal...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="space-y-4">
        <div className="space-y-2">
          <h1 className="text-4xl font-bold text-gray-900 flex items-center gap-3">
            <Send className="w-10 h-10 text-primary" />
            Publish Portal
          </h1>
          <p className="text-lg text-gray-600 font-medium">
            Direct social publishing with smart scheduling and analytics
          </p>
        </div>

        {/* Search Bar */}
        <div className="flex flex-wrap gap-3 sm:gap-4">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder="Search posts by caption, platform, or account..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Button
            variant="outline"
            size="icon"
            aria-label="Filter publish items"
          >
            <Filter className="w-4 h-4" />
          </Button>
          <Button onClick={() => void openBlankComposer()}>
            <Plus className="w-4 h-4 mr-1.5" />
            New Post
          </Button>
        </div>
      </div>

      {bundleFilter ? (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="flex flex-col gap-4 py-5 md:flex-row md:items-center md:justify-between">
            <div className="space-y-1">
              <CardTitle>Approved bundle handoff</CardTitle>
              <CardDescription>
                {bundleFilter.previewTitle
                  ? `Showing the approved social items from ${bundleFilter.previewTitle}.`
                  : "Showing only the approved social items from this content bundle."}
              </CardDescription>
            </div>
            <Button variant="outline" onClick={() => setBundleFilter(null)}>
              View all publish content
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {/* Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={(value) => setActiveTab(value as "ready" | "published")}
        className="w-full"
      >
        <TabsList className="grid w-full grid-cols-2 h-12 bg-gray-100 p-1 rounded-lg">
          <TabsTrigger
            value="ready"
            className="h-10 data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-sm data-[state=active]:font-semibold data-[state=inactive]:text-gray-600 data-[state=inactive]:hover:text-gray-900 transition-all duration-200"
          >
            Ready to Post
          </TabsTrigger>
          <TabsTrigger
            value="published"
            className="h-10 data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-sm data-[state=active]:font-semibold data-[state=inactive]:text-gray-600 data-[state=inactive]:hover:text-gray-900 transition-all duration-200"
          >
            Published
          </TabsTrigger>
        </TabsList>

        <TabsContent value="ready" className="space-y-6">
          {/* Ready to Post Content List */}
          <div className="space-y-4">
            {filteredReadyItems.length === 0 ? (
              // Three distinct empty states:
              //   1. searchTerm active → "No matching content"
              //   2. all items are >30 days old → "No recent content" + the
              //      olderReadyItems toggle (rendered outside this branch
              //      below). This is Maple Park's case — without the toggle
              //      surfacing, their 12 stale rows were unreachable.
              //   3. tenant truly has no content → first-touch empty state
              <Card className="col-span-full">
                <CardContent className="text-center py-12">
                  <Send className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <CardTitle className="mb-2">
                    {searchTerm
                      ? "No matching content"
                      : olderReadyItems.length > 0
                        ? "No recent content"
                        : "No content ready to publish"}
                  </CardTitle>
                  <CardDescription>
                    {searchTerm
                      ? "Try adjusting your search terms to find content."
                      : olderReadyItems.length > 0
                        ? `All your content is more than 30 days old. Show older items below to review or archive.`
                        : "Approved content from the Create Flow will appear here ready for publishing."}
                  </CardDescription>
                </CardContent>
              </Card>
            ) : (
              <>
                {filteredReadyItems.map((item) => (
                  <div
                    key={`ready-${item.taskId}-${filteredReadyItems.length}`}
                    ref={(element) => {
                      cardRefs.current[item.taskId] = element;
                    }}
                    className={cn(
                      "transition-all duration-300 rounded-[28px]",
                      activeHighlightTaskId === item.taskId &&
                        "ring-2 ring-primary ring-offset-2 shadow-lg",
                    )}
                  >
                    <PostCard
                      item={item}
                      onEdit={(item) => handleOpenDrawer(item, "edit")}
                      onPublishNow={(item) => handleOpenDrawer(item, "edit")}
                      onSchedule={(item) => handleOpenDrawer(item, "schedule")}
                      onDelete={handleArchive}
                    />
                  </div>
                ))}
              </>
            )}
            {/* Older-items toggle is rendered OUTSIDE the empty/non-empty
                ternary so it stays accessible even when recentReadyItems is
                empty (the Maple Park case). Hidden when there are zero older
                items or a search term is active (search applies to all items
                already). */}
            {olderReadyItems.length > 0 && !searchTerm ? (
              <div className="pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowOlderReady((current) => !current)}
                >
                  {showOlderReady
                    ? `Hide older items (${olderReadyItems.length})`
                    : `Show older items (${olderReadyItems.length})`}
                </Button>
              </div>
            ) : null}
          </div>
        </TabsContent>

        <TabsContent value="published" className="space-y-6">
          {/* Published Content List */}
          <div className="space-y-4">
            {filteredPublishedItems.length === 0 ? (
              <Card className="col-span-full">
                <CardContent className="text-center py-12">
                  <Send className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <CardTitle className="mb-2">
                    {publishedItems.length === 0
                      ? "No published posts"
                      : "No matching published posts"}
                  </CardTitle>
                  <CardDescription>
                    {publishedItems.length === 0
                      ? "Published posts will appear here with their publication dates."
                      : "Try adjusting your search terms to find published posts."}
                  </CardDescription>
                </CardContent>
              </Card>
            ) : (
              filteredPublishedItems.map((item) => (
                <div
                  key={`published-${item.taskId}-${filteredPublishedItems.length}`}
                  ref={(element) => {
                    cardRefs.current[item.taskId] = element;
                  }}
                  className={cn(
                    "transition-all duration-300 rounded-[28px]",
                    activeHighlightTaskId === item.taskId &&
                      "ring-2 ring-primary ring-offset-2 shadow-lg",
                  )}
                >
                  <PostCard
                    item={item}
                    publishedAt={item.publishedAt}
                    onEdit={(item) => handleOpenDrawer(item, "edit")}
                    onPublishNow={(item) => handleOpenDrawer(item, "edit")}
                    onSchedule={(item) => handleOpenDrawer(item, "schedule")}
                    onDelete={handleArchive}
                  />
                </div>
              ))
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Composer Drawer */}
      <ComposerDrawer
        open={drawerOpen}
        mode={drawerMode}
        item={selectedItem}
        accounts={availableAccounts}
        onClose={handleCloseDrawer}
        validate={validatePostForPlatform}
        onSaveDraft={handleSaveDraft}
        onPublishNow={handlePublishNow}
        onSchedule={handleSchedule}
        onCancelUntouched={handleCancelUntouched}
      />
    </div>
  );
};

export default PublishPage;
