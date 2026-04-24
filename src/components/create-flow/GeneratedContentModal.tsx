import { useMemo, useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui-legacy/dialog";
import { Button } from "@/components/ui-legacy/button";
import { Input } from "@/components/ui-legacy/input";
import { Label } from "@/components/ui-legacy/label";
import { RichTextEditor } from "@/components/ui-legacy/rich-text-editor";
import { useCreateFlow } from "@/state/useCreateFlow";
import { useGeneratedBundle } from "@/hooks/useGeneratedBundle";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { Loader2, ImageIcon, Camera } from "lucide-react";
import { EmailPreview } from "@/components/crm/EmailPreview";
import { EditableNewsletterPreview } from "./EditableNewsletterPreview";
import { convertNewsletterToCRM_Direct } from "@/utils/newsletterToCrmSync";
import { buildEmailHtmlFromNewsletter } from "@/utils/newsletterToCrmConverter";
import { sanitizeWeekNumbers } from "@/utils/weekNumberSanitizer";
import { supabase } from "@/integrations/supabase/client";
import { AIImageLoadingCard } from "@/components/image/AIImageLoadingCard";

interface GeneratedContentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function GeneratedContentModal({
  open,
  onOpenChange,
}: GeneratedContentModalProps) {
  const { bundleId, snapshotId, setBundleIds } = useCreateFlow();
  const { query, update } = useGeneratedBundle(bundleId || undefined);
  const { toast } = useToast();
  const navigate = useNavigate();

  // EMERGENCY DEBUGGING - Log modal state
  console.error("🚨 MODAL DEBUG: Modal rendered with open =", open);
  console.error("🚨 MODAL DEBUG: bundleId =", bundleId);
  console.error("🚨 MODAL DEBUG: snapshotId =", snapshotId);

  // Saved items from server
  const items = useMemo(() => {
    const itemsData = query.data?.content.items || [];
    console.error("🚨 MODAL DEBUG: Items loaded =", itemsData.length);
    console.error(
      "🚨 MODAL DEBUG: Items data =",
      JSON.stringify(itemsData, null, 2),
    );
    return itemsData;
  }, [query.data]);

  // Local draft state and dirty tracking
  const [draftItems, setDraftItems] = useState<any[]>([]);
  const [dirty, setDirty] = useState<Set<number>>(new Set());

  // AI Image Generation State
  const [isGeneratingImages, setIsGeneratingImages] = useState(false);
  const [imageGenerationProgress, setImageGenerationProgress] = useState({
    completed: 0,
    total: 0,
  });

  useEffect(() => {
    setDraftItems(items);
    setDirty(new Set());
  }, [items]);

  /**
   * Generate AI images for all content items in the bundle
   * Stores images in global_image_gallery with proper tagging
   */
  const handleGenerateImages = async () => {
    const itemsNeedingImages = draftItems.filter(
      (item) =>
        ["instagram", "facebook", "blog", "email", "newsletter"].includes(
          item.channel,
        ) && !item.media?.url,
    );

    if (itemsNeedingImages.length === 0) {
      return;
    }

    setIsGeneratingImages(true);
    setImageGenerationProgress({
      completed: 0,
      total: itemsNeedingImages.length,
    });
    try {
      // Generate images in batches (6 at a time)
      const BATCH_SIZE = 6;
      const batches: (typeof itemsNeedingImages)[] = [];

      for (let i = 0; i < itemsNeedingImages.length; i += BATCH_SIZE) {
        batches.push(itemsNeedingImages.slice(i, i + BATCH_SIZE));
      }

      let completedCount = 0;

      for (const batch of batches) {
        const batchPromises = batch.map(async (item) => {
          try {
            const contentContext =
              item.body ||
              item.caption ||
              item.script ||
              item.title ||
              "seasonal garden content";
            const contentTitle = item.title || "";

            // Map channel types
            const channelMap: Record<string, string> = {
              instagram: "instagram",
              facebook: "facebook",
              blog: "blog",
              email: "newsletter",
              newsletter: "newsletter",
            };
            const channel = channelMap[item.channel] || "instagram";
            const { data, error } = await supabase.functions.invoke(
              "generate-ai-image",
              {
                body: {
                  contentContext,
                  contentTitle,
                  channel,
                  uploadToStorage: true,
                  storageBucket: "global-ai-images",
                },
              },
            );

            if (error || !data?.imageUrl) {
              console.error(`[AI-Image] Failed for ${item.channel}:`, error);
              return { success: false, item };
            }

            return {
              success: true,
              item,
              imageUrl: data.imageUrl,
              globalImageId: data.globalImageId,
              tags: data.metadata?.tags || [],
            };
          } catch (err) {
            console.error(`[AI-Image] Exception for ${item.channel}:`, err);
            return { success: false, item };
          }
        });

        const batchResults = await Promise.all(batchPromises);

        // Update items with generated images
        batchResults.forEach((result) => {
          if (result.success) {
            const itemIndex = draftItems.findIndex(
              (dItem) => dItem === result.item,
            );

            if (itemIndex !== -1) {
              editItem(itemIndex, {
                media: {
                  url: result.imageUrl,
                  alt: draftItems[itemIndex].title || "AI-generated image",
                  source: "ai_generated",
                  globalImageId: result.globalImageId,
                  tags: result.tags,
                },
              });
            }

            completedCount++;
            setImageGenerationProgress({
              completed: completedCount,
              total: itemsNeedingImages.length,
            });
          }
        });
      }

      if (completedCount > 0) {
        toast({
          title: "Images Generated",
          description: `Successfully generated ${completedCount}/${itemsNeedingImages.length} AI images`,
        });

        // Auto-save after image generation
        if (query.data && snapshotId) {
          const next = { ...query.data.content } as any;
          next.items = draftItems;
          await update.mutateAsync({ snapshotId, content: next });
        }
      } else {
        toast({
          title: "Generation Failed",
          description: "Failed to generate images. Please try again.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error(
        "[GeneratedContentModal] Error generating AI images:",
        error,
      );
      toast({
        title: "Error",
        description:
          "Image generation failed. You can regenerate them manually.",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingImages(false);
      setImageGenerationProgress({ completed: 0, total: 0 });
    }
  };

  // Auto-generate AI images when modal opens with content
  useEffect(() => {
    if (open && draftItems.length > 0 && !isGeneratingImages) {
      // Check if items need AI-generated images (regenerate Unsplash images too)
      const itemsWithoutImages = draftItems.filter(
        (item) =>
          ["instagram", "facebook", "blog", "email", "newsletter"].includes(
            item.channel,
          ) && item.media?.source !== "ai_generated", // ✅ Only skip if already AI-generated
      );

      if (itemsWithoutImages.length > 0) {
        // Small delay to allow modal animation to complete
        setTimeout(() => {
          handleGenerateImages();
        }, 300);
      }
    }
  }, [open, draftItems.length]);

  // Local edit only
  const editItem = (index: number, patch: any) => {
    setDraftItems((prev) => {
      const next = [...prev];
      next[index] = { ...(next[index] || {}), ...patch };
      return next;
    });
    setDirty((prev) => {
      const n = new Set(prev);
      n.add(index);
      return n;
    });
  };

  // Persist a single item
  const handleSaveItem = async (index: number) => {
    if (!query.data || !snapshotId) {
      console.error("❌ SAVE ITEM: Missing query.data or snapshotId");
      console.error("❌ SAVE ITEM: query.data =", query.data);
      console.error("❌ SAVE ITEM: snapshotId =", snapshotId);
      return;
    }

    const next = { ...query.data.content } as any;
    next.items = [...next.items];
    next.items[index] = draftItems[index];

    try {
      await update.mutateAsync({ snapshotId, content: next });

      setDirty((prev) => {
        const n = new Set(prev);
        n.delete(index);
        return n;
      });
      toast({ title: "Saved", description: "Changes saved successfully" });
    } catch (e: any) {
      console.error("❌ SAVE ITEM: Save failed with error =", e);
      console.error("❌ SAVE ITEM: Error details =", {
        message: e?.message,
        code: e?.code,
        details: e?.details,
        hint: e?.hint,
        fullError: e,
      });
      toast({
        title: "Error",
        description: e?.message || "Failed to save",
        variant: "destructive",
      });
    }
  };

  const handleCancelItem = (index: number) => {
    setDraftItems((prev) => {
      const next = [...prev];
      next[index] = items[index];
      return next;
    });
    setDirty((prev) => {
      const n = new Set(prev);
      n.delete(index);
      return n;
    });
  };

  const handleSaveAll = async () => {
    if (!query.data || !snapshotId || dirty.size === 0) return;
    const next = { ...query.data.content } as any;
    next.items = draftItems;
    try {
      await update.mutateAsync({ snapshotId, content: next });
      setDirty(new Set());
      toast({ title: "All changes saved" });
    } catch (e: any) {
      toast({
        title: "Error",
        description: e?.message || "Failed to save all",
        variant: "destructive",
      });
    }
  };

  const handleApproveItem = async (index: number) => {
    if (!query.data || !snapshotId) return;
    const next = { ...query.data.content } as any;
    next.items = [...draftItems];
    next.items[index] = { ...next.items[index], _approved: true };
    try {
      await update.mutateAsync({ snapshotId, content: next });
      setDirty((prev) => {
        const n = new Set(prev);
        n.delete(index);
        return n;
      });
      toast({ title: "Approved", description: "Item approved" });
    } catch (e: any) {
      toast({
        title: "Error",
        description: e?.message || "Failed to approve",
        variant: "destructive",
      });
    }
  };

  const handleApproveAll = async () => {
    if (!query.data || !snapshotId) return;
    const confirmed = window.confirm(
      "Approve all items? This will mark every item as approved.",
    );
    if (!confirmed) return;
    try {
      const allApproved = (draftItems || []).map((it: any) => ({
        ...it,
        _approved: true,
      }));
      await update.mutateAsync({
        snapshotId,
        content: { ...query.data.content, items: allApproved },
      });
      setDirty(new Set());
      toast({ title: "Approved", description: "All items marked as approved" });
    } catch (e: any) {
      toast({
        title: "Error",
        description: e?.message || "Failed to approve all",
        variant: "destructive",
      });
    }
  };

  const handleClose = () => {
    setBundleIds(null, null);
    onOpenChange(false);
  };

  const handoffPublish = (channel: "instagram" | "facebook") => {
    handleClose();
    toast({
      title: "Sent to Publish Portal",
      description: `Opening ${channel}`,
    });
    navigate(`/publish?bundleId=${bundleId}&channel=${channel}`);
  };

  const handoffNewsletter = (newsletterItem: any) => {
    localStorage.setItem(
      "newsletter-handoff-debug",
      JSON.stringify({
        timestamp: new Date().toISOString(),
        action: "button_clicked",
        item: newsletterItem,
        bundleId,
      }),
    );

    try {
      const newsletterData = {
        title: newsletterItem.title || "Newsletter",
        content: newsletterItem.body || "",
        featuredImage: newsletterItem.media?.url || "",
        bundleId,
      };

      const params = new URLSearchParams({
        type: "newsletter",
        bundleId: bundleId || "",
        prefillData: JSON.stringify(newsletterData),
      });

      const targetUrl = `/crm/campaigns/new?${params.toString()}`;

      localStorage.setItem(
        "newsletter-navigation-debug",
        JSON.stringify({
          timestamp: new Date().toISOString(),
          targetUrl,
          queryParams: params.toString(),
          newsletterData,
        }),
      );

      toast({
        title: "Opening Block Builder",
        description: "Transferring newsletter content...",
      });

      navigate(targetUrl);
    } catch (error: any) {
      console.error("❌ Error in handoffNewsletter:", error);

      localStorage.setItem(
        "newsletter-error-debug",
        JSON.stringify({
          timestamp: new Date().toISOString(),
          error: error?.message,
          stack: error?.stack,
        }),
      );
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden flex flex-col text-gray-900 bg-white">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="text-gray-900">
            Review & Approve Content
          </DialogTitle>
          <DialogDescription className="text-gray-900">
            Edit copy, AI-generated images will be created automatically, then
            approve for publishing.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto pr-2">
          {query.isLoading ? (
            <div className="py-12 text-center text-sm text-gray-500">
              Loading generated content…
            </div>
          ) : (draftItems?.length || 0) === 0 ? (
            <div className="py-12 text-center text-sm text-gray-500">
              No generated items yet.
            </div>
          ) : (
            <div className="space-y-6">
              {draftItems.map((item: any, idx: number) => (
                <div
                  key={idx}
                  className="rounded-lg border p-6 bg-card text-gray-900"
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="font-semibold capitalize text-lg text-gray-900">
                        {item.channel}
                      </div>
                      <span
                        className={`text-xs px-2 py-1 rounded-full ${item._approved ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}`}
                      >
                        {item._approved ? "Approved" : "Draft"}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {dirty.has(idx) && (
                        <>
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => handleSaveItem(idx)}
                            disabled={update.isPending}
                          >
                            {update.isPending ? (
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : null}
                            Save
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleCancelItem(idx)}
                            disabled={update.isPending}
                          >
                            Cancel
                          </Button>
                        </>
                      )}
                      {!item._approved ? (
                        <Button
                          size="sm"
                          onClick={() => handleApproveItem(idx)}
                          disabled={update.isPending}
                        >
                          {update.isPending ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : null}
                          Approve
                        </Button>
                      ) : item.channel === "instagram" ||
                        item.channel === "facebook" ? (
                        <Button
                          size="sm"
                          onClick={() =>
                            handoffPublish(
                              item.channel as "instagram" | "facebook",
                            )
                          }
                        >
                          → Publish Portal
                        </Button>
                      ) : item.channel === "newsletter" ? (
                        <div className="flex items-center gap-2">
                          {/* Reference div for debugging */}
                          <div className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded">
                            Newsletter Ready
                          </div>
                          <Button
                            size="sm"
                            onClick={() => {
                              // Call function with additional debugging
                              try {
                                handoffNewsletter(item);
                              } catch (error) {
                                console.error(
                                  "🚨 EMERGENCY DEBUG: Error calling handoffNewsletter:",
                                  error,
                                );
                              }
                            }}
                            className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
                            data-testid="send-to-block-builder"
                          >
                            Send to Block builder
                          </Button>
                        </div>
                      ) : item.channel === "blog" ? (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled
                          title="Send to Website – Coming Soon"
                        >
                          → Send to Website (Coming Soon)
                        </Button>
                      ) : item.channel === "video" ? (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled
                          title="Video publishing coming soon"
                        >
                          → Video Publisher (Coming Soon)
                        </Button>
                      ) : null}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2 space-y-4">
                      <div>
                        <Label className="text-sm font-medium mb-2 block text-gray-900">
                          Title
                        </Label>
                        <Input
                          value={sanitizeWeekNumbers(item.title || "")}
                          onChange={(e) =>
                            editItem(idx, { title: e.target.value })
                          }
                          placeholder="Enter title (optional)"
                          className="w-full text-gray-900"
                        />
                      </div>

                      <div>
                        <Label className="text-sm font-medium mb-2 block text-gray-900">
                          Content
                        </Label>
                        {item.channel === "instagram" ||
                        item.channel === "facebook" ? (
                          <textarea
                            className="w-full min-h-[200px] rounded-md border p-3 text-sm leading-relaxed resize-y text-gray-900"
                            value={sanitizeWeekNumbers(
                              // Extract the longest content from all possible fields (same logic as PublishPage)
                              [
                                item.body,
                                item.markdown,
                                item.script,
                                item.caption,
                                item.text,
                                item.content,
                              ]
                                .filter(Boolean)
                                .sort(
                                  (a, b) => (b?.length || 0) - (a?.length || 0),
                                )[0] || "",
                            )}
                            onChange={(e) => {
                              // Update the primary field that has content, or caption as fallback
                              const currentContent = [
                                { field: "body", value: item.body },
                                { field: "markdown", value: item.markdown },
                                { field: "script", value: item.script },
                                { field: "caption", value: item.caption },
                                { field: "text", value: item.text },
                                { field: "content", value: item.content },
                              ]
                                .filter((f) => f.value)
                                .sort(
                                  (a, b) =>
                                    (b.value?.length || 0) -
                                    (a.value?.length || 0),
                                )[0];

                              const fieldToUpdate =
                                currentContent?.field || "caption";
                              editItem(idx, {
                                [fieldToUpdate]: e.target.value,
                              });
                            }}
                            placeholder="Write your social media caption..."
                          />
                        ) : item.channel === "video" ? (
                          <textarea
                            className="w-full min-h-[200px] rounded-md border p-3 text-sm leading-relaxed resize-y text-gray-900"
                            value={sanitizeWeekNumbers(item.script || "")}
                            onChange={(e) =>
                              editItem(idx, { script: e.target.value })
                            }
                            placeholder="Write your video script..."
                          />
                        ) : item.channel === "blog" ? (
                          <div className="w-full">
                            <RichTextEditor
                              content={sanitizeWeekNumbers(
                                item.body || item.markdown || "",
                              )}
                              onChange={(html) => editItem(idx, { body: html })}
                              placeholder="Write and format your blog content..."
                              className="w-full min-h-[200px]"
                            />
                          </div>
                        ) : item.channel === "newsletter" ? (
                          <div className="space-y-2">
                            <p className="text-xs text-gray-500">
                              Newsletter will use CRM block templates when
                              approved
                            </p>
                            <EditableNewsletterPreview
                              content={sanitizeWeekNumbers(item.body || "")}
                              title={item.title || "Newsletter"}
                              onChange={(content) => {
                                editItem(idx, { body: content });
                              }}
                              onSave={() => {
                                handleSaveItem(idx);
                              }}
                              className="w-full"
                            />
                          </div>
                        ) : (
                          <textarea
                            className="w-full min-h-[200px] rounded-md border p-3 text-sm leading-relaxed resize-y text-gray-900"
                            value={sanitizeWeekNumbers(item.body || "")}
                            onChange={(e) =>
                              editItem(idx, { body: e.target.value })
                            }
                            placeholder="Write content..."
                          />
                        )}
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <Label className="text-sm font-medium mb-2 block text-gray-900">
                          Featured Image
                        </Label>
                        {item.media?.url ? (
                          <div className="relative aspect-video rounded-lg border overflow-hidden">
                            <img
                              src={item.media.url}
                              alt={item.media.alt || item.title}
                              className="w-full h-full object-cover"
                            />
                            {item.media.source === "ai_generated" && (
                              <div className="absolute top-2 right-2 bg-primary/90 text-primary-foreground text-xs px-2 py-1 rounded">
                                AI Generated
                              </div>
                            )}
                          </div>
                        ) : isGeneratingImages ? (
                          <div className="aspect-video rounded-lg border bg-muted animate-pulse flex items-center justify-center">
                            <div className="text-center">
                              <Loader2 className="w-8 h-8 mx-auto mb-2 text-muted-foreground animate-spin" />
                              <p className="text-sm font-medium text-muted-foreground">
                                Generating Image
                              </p>
                              <p className="text-xs text-muted-foreground mt-1">
                                This may take 8-12 seconds
                              </p>
                            </div>
                          </div>
                        ) : (
                          <div className="aspect-video rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 flex items-center justify-center">
                            <div className="text-center">
                              <ImageIcon className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                              <p className="text-sm text-gray-600">
                                Image will be generated
                              </p>
                            </div>
                          </div>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          className="w-full mt-2"
                          onClick={() => handleGenerateImages()}
                          disabled={isGeneratingImages}
                        >
                          {isGeneratingImages ? (
                            <>
                              <Loader2 className="w-3 h-3 mr-2 animate-spin" />{" "}
                              Generating...
                            </>
                          ) : (
                            <>
                              <Camera className="w-3 h-3 mr-2" /> Regenerate
                              Image
                            </>
                          )}
                        </Button>
                        <p className="text-xs text-gray-500 mt-2">
                          AI-generated images are automatically created and
                          stored in the central gallery
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex-shrink-0 flex items-center justify-between mt-6 pt-4 border-t">
          <Button variant="outline" onClick={handleClose}>
            Close
          </Button>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              onClick={handleSaveAll}
              disabled={dirty.size === 0 || update.isPending}
            >
              {update.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Save All Changes
            </Button>
            <Button onClick={handleApproveAll} disabled={update.isPending}>
              {update.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Approve All Content
            </Button>
          </div>
        </div>

        {/* AI Image Generation Progress Overlay */}
        {isGeneratingImages && (
          <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-[70] flex items-center justify-center">
            <AIImageLoadingCard
              progress={imageGenerationProgress}
              message="Generating Images"
              subtitle="This may take 8-12 seconds per image"
            />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
