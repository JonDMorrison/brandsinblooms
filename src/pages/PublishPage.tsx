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
import { Search, Send, Filter } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useDashboardData } from "@/hooks/useDashboardData";
import { useTenant } from "@/hooks/useTenant";
import { usePublishActions } from "@/hooks/usePublishActions";
import { validatePostForPlatform } from "@/utils/validatePost";
import { supabase } from "@/integrations/supabase/client";
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

type BundleFilterState = {
  bundleId: string;
  approvedChannels: Platform[];
  previewTitle?: string | null;
};

type BundleSnapshotRow = {
  id: string;
  version: number;
  content: {
    sourceLabel?: string;
    previewTitle?: string;
    recommendedImages?: Array<{ url?: string; alt?: string }>;
    items?: Array<Record<string, any>>;
  } | null;
};

type BundlePublishDraft = {
  channel: Platform;
  caption: string;
  imageUrl: string | null;
  imageAlt: string | null;
  attachments: Record<string, any> | null;
  hashtags: string | null;
};

const FINALIZED_TASK_STATUSES = new Set(["scheduled", "published"]);

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

function extractBundleContent(item: Record<string, any>) {
  const candidates = [
    item.body,
    item.markdown,
    item.script,
    item.caption,
    item.text,
    item.content,
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

  const sourceBundle = (value as Record<string, any>).sourceBundle;
  if (!sourceBundle || typeof sourceBundle !== "object") {
    return null;
  }

  const bundleId =
    typeof sourceBundle.bundleId === "string" ? sourceBundle.bundleId : null;
  const channel = normalizePlatform(sourceBundle.channel);

  if (!bundleId || !channel) {
    return null;
  }

  return {
    bundleId,
    channel,
    snapshotId:
      typeof sourceBundle.snapshotId === "string"
        ? sourceBundle.snapshotId
        : null,
    snapshotVersion:
      typeof sourceBundle.snapshotVersion === "number"
        ? sourceBundle.snapshotVersion
        : null,
    previewTitle:
      typeof sourceBundle.previewTitle === "string"
        ? sourceBundle.previewTitle
        : null,
  };
}

function buildBundleImageMetadata(
  existingMetadata: unknown,
  sourceBundle: PublishSourceBundle,
) {
  const baseMetadata =
    existingMetadata &&
    typeof existingMetadata === "object" &&
    !Array.isArray(existingMetadata)
      ? (existingMetadata as Record<string, unknown>)
      : {};

  return {
    ...baseMetadata,
    sourceBundle,
  };
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
          firstComment: (task as any).first_comment || null,
          mediaUrl:
            task.image_url || (task.attachments as any)?.image?.url || null,
          scheduledFor: scheduledPost?.publish_at || null,
          status: task.status.toLowerCase() as PublishItem["status"],
          attachments: task.attachments,
          sourceBundle: parseSourceBundle((task as any).image_metadata),
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
            firstComment: (task as any).first_comment || null,
            mediaUrl:
              task.image_url || (task.attachments as any)?.image?.url || null,
            scheduledFor: null,
            status: "published" as const,
            attachments: task.attachments,
            publishedAt: scheduledPost?.publish_at || task.created_at,
            sourceBundle: parseSourceBundle((task as any).image_metadata),
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

  // Filter ready items by search term
  const filteredReadyItems = useMemo(() => {
    if (!searchTerm) return bundleScopedReadyItems;
    const term = searchTerm.toLowerCase();
    return bundleScopedReadyItems.filter(
      (item) =>
        item.caption?.toLowerCase().includes(term) ||
        item.platform.toLowerCase().includes(term) ||
        item.accountName?.toLowerCase().includes(term),
    );
  }, [bundleScopedReadyItems, searchTerm]);

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
          .from("draft_snapshots" as any)
          .select("id, version, content")
          .eq("doc_type", "content_bundle")
          .eq("doc_id", requestedBundleId)
          .order("version", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (cancelled) {
          return;
        }

        const bundleData = data as BundleSnapshotRow | null;

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

        const existingOpenTasksByChannel = new Map<Platform, any>();
        for (const task of existingTasks || []) {
          const sourceBundle = parseSourceBundle((task as any).image_metadata);
          const platform = normalizePlatform((task as any).post_type);
          const status = String((task as any).status || "").toLowerCase();

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
          const taskPayload: Record<string, any> = {
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
            const sourceBundle = parseSourceBundle(
              (task as any).image_metadata,
            );
            const channel =
              sourceBundle?.channel ||
              normalizePlatform((task as any).post_type);
            const status = String((task as any).status || "").toLowerCase();

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

  // Save draft handler
  const handleSaveDraft = useCallback(
    async (
      taskId: string,
      partial: {
        caption?: string | null;
        mediaUrl?: string | null;
        firstComment?: string | null;
        accountId?: string | null;
      },
    ) => {
      const updateData: any = {};
      if (partial.caption !== undefined) updateData.ai_output = partial.caption;
      if (partial.mediaUrl !== undefined)
        updateData.image_url = partial.mediaUrl;
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

      // Update local state optimistically
      const updated: PublishItem = {
        ...(selectedItem as PublishItem),
        caption: data.ai_output || null,
        mediaUrl: data.image_url || null,
        firstComment: (data as any).first_comment || null,
        accountId: (data as any).account_id || null,
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

  // Delete handler
  const handleDelete = useCallback(
    async (item: PublishItem) => {
      if (
        !confirm(
          "Are you sure you want to delete this content? This action cannot be undone.",
        )
      ) {
        return;
      }

      try {
        const { error } = await supabase
          .from("content_tasks")
          .delete()
          .eq("id", item.taskId);

        if (error) throw error;

        toast({
          title: "Content deleted",
          description: "The content has been successfully deleted.",
        });

        // Refresh data to remove the deleted item
        refetch?.();
      } catch (error: any) {
        console.error("Delete error:", error);
        toast({
          title: "Error",
          description: error.message || "Failed to delete content",
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
        <div className="flex gap-4">
          <div className="relative flex-1">
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
              <Card className="col-span-full">
                <CardContent className="text-center py-12">
                  <Send className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <CardTitle className="mb-2">
                    {publishItems.length === 0
                      ? "No content ready to publish"
                      : "No matching content"}
                  </CardTitle>
                  <CardDescription>
                    {publishItems.length === 0
                      ? "Approved content from the Create Flow will appear here ready for publishing."
                      : "Try adjusting your search terms to find content."}
                  </CardDescription>
                </CardContent>
              </Card>
            ) : (
              filteredReadyItems.map((item) => (
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
                    onDelete={handleDelete}
                  />
                </div>
              ))
            )}
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
                    onDelete={handleDelete}
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
      />
    </div>
  );
};

export default PublishPage;
