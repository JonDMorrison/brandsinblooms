// AUDIT: Updated ComposerDrawer to match new PublishItem contract and integrate MediaSelector + validation
// - Added props for PublishItem and callbacks for onSaveDraft, onPublishNow, onSchedule
// - Integrated ImageSelectButton for media selection with DB persistence
// - Added validation using validatePostForPlatform utility
// - Added caption/firstComment editing with real-time preview
// - Mode switching between edit/publish/schedule

import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui-legacy/dialog";
import { Button } from "@/components/ui-legacy/button";
import { Badge } from "@/components/ui-legacy/badge";
import { Textarea } from "@/components/ui-legacy/textarea";
import { Input } from "@/components/ui-legacy/input";
import { Label } from "@/components/ui-legacy/label";
import { Switch } from "@/components/ui-legacy/switch";
import { NativeSelect } from "@/components/ui-legacy/NativeSelect";
import { Calendar } from "@/components/ui-legacy/calendar";
import {
  Facebook,
  Instagram,
  Clock,
  Send,
  Save,
  AlertTriangle,
  Info,
  Eye,
} from "lucide-react";
import { SocialPostPreviewModal } from "./preview/SocialPostPreviewModal";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { format, addHours, startOfDay } from "date-fns";
import { ImageSelectButton } from "@/components/image";
import { validatePostForPlatform } from "@/utils/validatePost";
import type {
  PublishItem,
  PublishNowInput,
  ScheduleInput,
  ValidationResult,
} from "@/types/publish";

export type ComposerMode = "edit" | "schedule";

export type ComposerDrawerProps = {
  open: boolean;
  mode: ComposerMode; // initial intent; can be changed inside
  item: PublishItem | null; // selected card
  accounts: Array<{
    // available linked accounts for tenant
    platform: "facebook" | "instagram";
    accountId: string; // Page ID or IG Business ID
    accountName: string;
  }>;

  // Callbacks provided by parent (PublishPage)
  onClose: () => void;

  // Persist edits to the source task (caption, mediaUrl, firstComment, platform).
  // Return the updated item for optimistic UI.
  onSaveDraft: (
    taskId: string,
    partial: {
      caption?: string | null;
      mediaUrl?: string | null;
      firstComment?: string | null;
      accountId?: string | null;
      platform?: "facebook" | "instagram";
    },
  ) => Promise<PublishItem>;

  // Optional: called when the user clicks Cancel on a draft they never
  // modified. PublishPage uses this to soft-delete fresh template/blank
  // prefills (which insert a content_tasks row up front) so cancelled
  // drafts don't pile up in the Ready queue.
  onCancelUntouched?: (taskId: string) => void;

  // Final actions: call the hook that invokes 'publish-task'
  onPublishNow: (taskId: string, input: PublishNowInput) => Promise<void>;
  onSchedule: (taskId: string, input: ScheduleInput) => Promise<void>;

  // Optional validation override (else use default validatePostForPlatform)
  validate?: (
    platform: "facebook" | "instagram",
    input: PublishNowInput,
  ) => ValidationResult;
};

export default function ComposerDrawer({
  open,
  mode: initialMode,
  item,
  accounts,
  onClose,
  onSaveDraft,
  onPublishNow,
  onSchedule,
  onCancelUntouched,
  validate = validatePostForPlatform,
}: ComposerDrawerProps) {
  const { toast } = useToast();
  const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  // Local state
  const [mode, setMode] = useState<ComposerMode>(initialMode);
  const [localCaption, setLocalCaption] = useState("");
  const [localMediaUrl, setLocalMediaUrl] = useState<string | null>(null);
  const [localFirstComment, setLocalFirstComment] = useState("");
  const [selectedAccountId, setSelectedAccountId] = useState<string>("");
  const [localPlatform, setLocalPlatform] = useState<"facebook" | "instagram">(
    "instagram",
  );
  const [selectedDate, setSelectedDate] = useState<Date>(
    addHours(new Date(), 1),
  );
  const [selectedTime, setSelectedTime] = useState<Date>(
    addHours(new Date(), 1),
  );
  const [isLoading, setIsLoading] = useState(false);
  const [validation, setValidation] = useState<ValidationResult>({
    ok: true,
    warnings: [],
    errors: [],
  });
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewPlatform, setPreviewPlatform] = useState<
    "instagram" | "facebook"
  >("instagram");

  // Initialize local state when item changes
  useEffect(() => {
    if (item) {
      setLocalCaption(item.caption || "");
      setLocalMediaUrl(item.mediaUrl || null);
      setLocalFirstComment(item.firstComment || "");
      setSelectedAccountId(item.accountId || "");
      setLocalPlatform(item.platform);
      setMode(initialMode);
      setPreviewPlatform(item.platform);

      // Load scheduled date/time if post is already scheduled
      if (item.scheduledFor) {
        const scheduledDateTime = new Date(item.scheduledFor);
        setSelectedDate(scheduledDateTime);
        setSelectedTime(scheduledDateTime);
      } else {
        // Default to 1 hour from now for new schedules
        const defaultDateTime = addHours(new Date(), 1);
        setSelectedDate(defaultDateTime);
        setSelectedTime(defaultDateTime);
      }

      // Auto-select first available account for platform if none selected
      if (!item.accountId) {
        const matchingAccounts = accounts.filter(
          (acc) => acc.platform === item.platform,
        );
        if (matchingAccounts.length > 0) {
          setSelectedAccountId(matchingAccounts[0].accountId);
        }
      }
    }
  }, [item, initialMode, accounts]);

  // Run validation when inputs change
  useEffect(() => {
    if (item && selectedAccountId) {
      const input: PublishNowInput = {
        platform: localPlatform,
        accountId: selectedAccountId,
        caption: localCaption,
        mediaUrl: localMediaUrl,
        firstComment: localFirstComment,
      };
      setValidation(validate(localPlatform, input));
    }
  }, [
    item,
    localPlatform,
    localCaption,
    localMediaUrl,
    localFirstComment,
    selectedAccountId,
    validate,
  ]);

  if (!item) return null;

  const PlatformIcon = localPlatform === "facebook" ? Facebook : Instagram;
  const platformAccounts = accounts.filter(
    (acc) => acc.platform === localPlatform,
  );

  const hasChanges =
    localCaption !== (item.caption || "") ||
    localMediaUrl !== (item.mediaUrl || null) ||
    localFirstComment !== (item.firstComment || "") ||
    selectedAccountId !== (item.accountId || "") ||
    localPlatform !== item.platform;

  const scheduledPreview = (() => {
    const publishAt = new Date(selectedDate);
    publishAt.setHours(selectedTime.getHours());
    publishAt.setMinutes(selectedTime.getMinutes());
    publishAt.setSeconds(0);
    publishAt.setMilliseconds(0);
    return publishAt;
  })();

  const scheduleIsValid =
    mode !== "schedule" || scheduledPreview.getTime() > Date.now();

  const handleSave = async () => {
    if (!hasChanges) return;

    setIsLoading(true);
    try {
      await onSaveDraft(item.taskId, {
        caption: localCaption,
        mediaUrl: localMediaUrl,
        firstComment: localFirstComment,
        accountId: selectedAccountId,
        platform: localPlatform,
      });

      toast({
        title: "Saved",
        description: "Draft saved successfully",
      });
    } catch (error: any) {
      console.error("Save error:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to save draft",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handlePublishNow = async () => {
    if (!validation.ok) return;

    setIsLoading(true);
    try {
      // Save any unsaved changes first
      if (hasChanges) {
        await onSaveDraft(item.taskId, {
          caption: localCaption,
          mediaUrl: localMediaUrl,
          firstComment: localFirstComment,
          accountId: selectedAccountId,
          platform: localPlatform,
        });
      }

      await onPublishNow(item.taskId, {
        platform: localPlatform,
        accountId: selectedAccountId,
        caption: localCaption,
        mediaUrl: localMediaUrl,
        firstComment: localFirstComment,
      });

      toast({
        title: "Success!",
        description: "Published successfully",
      });

      // Don't close here - let parent handle closing after data refresh
    } catch (error: any) {
      console.error("Publish error:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to publish",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSchedule = async () => {
    if (!validation.ok || !scheduleIsValid) return;

    setIsLoading(true);
    try {
      // Save any unsaved changes first
      if (hasChanges) {
        await onSaveDraft(item.taskId, {
          caption: localCaption,
          mediaUrl: localMediaUrl,
          firstComment: localFirstComment,
          accountId: selectedAccountId,
          platform: localPlatform,
        });
      }

      // Combine date and time
      const publishAt = scheduledPreview;

      await onSchedule(item.taskId, {
        platform: localPlatform,
        accountId: selectedAccountId,
        caption: localCaption,
        mediaUrl: localMediaUrl,
        firstComment: localFirstComment,
        publishAt: publishAt.toISOString(),
      });

      toast({
        title: "Scheduled!",
        description: `Scheduled for ${format(publishAt, "MMM d, h:mm a")}`,
      });

      // Don't close here - let parent handle closing after data refresh
    } catch (error: any) {
      console.error("Schedule error:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to schedule",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-2xl max-h-[90vh] overflow-y-auto bg-white z-50 sm:w-full">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PlatformIcon
              className={cn(
                "w-5 h-5",
                localPlatform === "facebook"
                  ? "text-blue-600"
                  : "text-pink-500",
              )}
            />
            {mode === "edit" ? "Edit Post" : "Schedule Post"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Mode Switcher */}
          <div className="flex gap-2">
            <Button
              variant={mode === "edit" ? "default" : "outline"}
              size="sm"
              onClick={() => setMode("edit")}
            >
              Edit Post
            </Button>
            <Button
              variant={mode === "schedule" ? "default" : "outline"}
              size="sm"
              onClick={() => setMode("schedule")}
            >
              Schedule Post
            </Button>
          </div>

          {/* Platform Selection. Always rendered so users with FB+IG connected
              can switch the post's target. Disabled buttons mean "no active
              connection for that platform" — points users at the connect flow. */}
          <div className="space-y-2">
            <Label>Platform</Label>
            <div className="flex gap-2">
              {(["instagram", "facebook"] as const).map((p) => {
                const hasConn = accounts.some((a) => a.platform === p);
                const isActive = localPlatform === p;
                const Icon = p === "facebook" ? Facebook : Instagram;
                return (
                  <Button
                    key={p}
                    type="button"
                    variant={isActive ? "default" : "outline"}
                    size="sm"
                    disabled={!hasConn}
                    onClick={() => {
                      if (!hasConn) return;
                      setLocalPlatform(p);
                      const firstAccount = accounts.find(
                        (a) => a.platform === p,
                      );
                      setSelectedAccountId(firstAccount?.accountId ?? "");
                    }}
                    aria-pressed={isActive}
                    title={
                      hasConn
                        ? `Post to ${p}`
                        : `No connected ${p} account — connect one in Settings`
                    }
                  >
                    <Icon className="w-4 h-4 mr-1.5" />
                    {p === "facebook" ? "Facebook" : "Instagram"}
                  </Button>
                );
              })}
            </div>
          </div>

          {/* Account Selection — only relevant when the chosen platform has
              multiple connected pages/accounts (e.g., agency tenants with
              several IG Business accounts). */}
          {platformAccounts.length > 1 && (
            <div className="space-y-2">
              <Label>Account</Label>
              <NativeSelect
                value={selectedAccountId}
                onChange={(e) => setSelectedAccountId(e.target.value)}
                options={platformAccounts.map((acc) => ({
                  value: acc.accountId,
                  label: acc.accountName,
                }))}
              />
            </div>
          )}

          {/* Media Selection */}
          <div className="space-y-2">
            <Label>Image</Label>
            <ImageSelectButton
              selectedImageUrl={localMediaUrl || undefined}
              onImageSelect={async (url) => {
                setLocalMediaUrl(url);
                // Auto-save media selection
                try {
                  await onSaveDraft(item.taskId, { mediaUrl: url });
                } catch (error) {
                  console.error("Failed to save media:", error);
                }
              }}
              contentContext={localCaption || item.caption || ""}
              buttonText="Select Image"
              mode="modal"
            />
          </div>

          {/* Caption Editor */}
          <div className="space-y-2">
            <Label>Caption</Label>
            <Textarea
              value={localCaption}
              onChange={(e) => setLocalCaption(e.target.value)}
              placeholder="Write your caption..."
              className="min-h-[120px]"
              maxLength={localPlatform === "instagram" ? 2200 : 63206}
            />
            <div className="text-sm text-gray-500 text-right">
              {localCaption.length} /{" "}
              {localPlatform === "instagram" ? "2,200" : "63,206"} characters
            </div>
          </div>

          {/* First Comment (Instagram only) */}
          {localPlatform === "instagram" && (
            <div className="space-y-2">
              <Label>First Comment (Optional)</Label>
              <Input
                value={localFirstComment}
                onChange={(e) => setLocalFirstComment(e.target.value)}
                placeholder="Add a first comment..."
              />
            </div>
          )}

          {/* Schedule Settings */}
          {mode === "schedule" && (
            <div className="space-y-4">
              <div className="rounded-xl border bg-muted/10 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <Label>Schedule</Label>
                    <p className="text-sm text-muted-foreground">
                      Select a date and time for this post. Times are in{" "}
                      {userTimezone}.
                    </p>
                  </div>
                  <div className="rounded-lg border bg-background/70 px-3 py-2 text-xs text-muted-foreground flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    <span>{format(scheduledPreview, "MMM d, h:mm a")}</span>
                  </div>
                </div>

                <div className="mt-4 grid gap-4 lg:grid-cols-2">
                  <div className="rounded-xl border bg-background p-3">
                    <Calendar
                      mode="single"
                      selected={selectedDate}
                      onSelect={(date) => {
                        if (!date) return;
                        const normalized = new Date(date);
                        normalized.setHours(12, 0, 0, 0);
                        setSelectedDate(normalized);
                      }}
                      disabled={(date) =>
                        startOfDay(date) < startOfDay(new Date())
                      }
                      // Constrain the year dropdown to "now through 5 years out"
                      // so users can't accidentally schedule for 1927. Calendar
                      // default is 100yr-back / 10yr-forward (right for DOB
                      // pickers but wrong for forward-only scheduling).
                      fromYear={new Date().getFullYear()}
                      toYear={new Date().getFullYear() + 5}
                      initialFocus
                    />
                  </div>

                  <div className="space-y-4 min-w-0">
                    <div className="rounded-xl border bg-background p-4 space-y-3">
                      <div className="space-y-2">
                        <Label className="text-xs text-muted-foreground">
                          Time
                        </Label>
                        <div className="relative">
                          <Clock className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <input
                            type="time"
                            value={format(selectedTime, "HH:mm")}
                            onChange={(e) => {
                              const [hours, minutes] = e.target.value
                                .split(":")
                                .map(Number);
                              if (Number.isNaN(hours) || Number.isNaN(minutes))
                                return;
                              const next = new Date(selectedTime);
                              next.setHours(hours, minutes, 0, 0);
                              setSelectedTime(next);
                            }}
                            className="h-10 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm font-medium shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                            aria-label="Scheduled time"
                          />
                        </div>
                      </div>

                      <div className="rounded-lg border bg-muted/10 px-4 py-3">
                        <p className="text-xs text-muted-foreground">
                          Will publish
                        </p>
                        <p className="text-sm font-semibold">
                          {format(scheduledPreview, "EEEE, MMM d • h:mm a")}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {userTimezone}
                        </p>
                      </div>

                      {!scheduleIsValid && (
                        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                          Scheduled time must be in the future.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Validation Messages */}
          {(validation.errors.length > 0 || validation.warnings.length > 0) && (
            <div className="space-y-2">
              {validation.errors.map((error, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 text-red-600 text-sm"
                >
                  <AlertTriangle className="w-4 h-4" />
                  {error}
                </div>
              ))}
              {validation.warnings.map((warning, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 text-yellow-600 text-sm"
                >
                  <Info className="w-4 h-4" />
                  {warning}
                </div>
              ))}
            </div>
          )}

          {/* Action Buttons. flex-wrap so small screens (≤375px) can stack the
              row without clipping Publish Now off the right edge. */}
          <div className="flex flex-wrap gap-2 pt-4 border-t">
            {hasChanges && (
              <Button
                variant="outline"
                onClick={handleSave}
                disabled={isLoading}
              >
                <Save className="w-4 h-4 mr-1" />
                Save Draft
              </Button>
            )}

            <Button
              variant="outline"
              onClick={() => setPreviewOpen(true)}
              disabled={!localMediaUrl && !localCaption}
            >
              <Eye className="w-4 h-4 mr-1" />
              Preview
            </Button>

            <Button
              variant="outline"
              onClick={() => {
                if (!hasChanges && item) onCancelUntouched?.(item.taskId);
                onClose();
              }}
            >
              Cancel
            </Button>

            {/* Right side buttons. flex-1 basis on mobile so the primary action
                stretches to a tappable size; ml-auto restores right alignment
                on sm+ screens where the row fits on a single line. */}
            <div className="flex flex-wrap gap-2 sm:ml-auto">
              {mode === "schedule" && (
                <Button
                  onClick={handleSchedule}
                  disabled={!validation.ok || isLoading || !scheduleIsValid}
                >
                  <Clock className="w-4 h-4 mr-1" />
                  Schedule Post
                </Button>
              )}

              <Button
                onClick={handlePublishNow}
                disabled={!validation.ok || isLoading}
              >
                <Send className="w-4 h-4 mr-1" />
                Publish Now
              </Button>
            </div>
          </div>

          {/* Preview Modal */}
          {item && (
            <SocialPostPreviewModal
              open={previewOpen}
              onClose={() => setPreviewOpen(false)}
              platform={previewPlatform}
              onPlatformChange={setPreviewPlatform}
              accountName={
                platformAccounts.find(
                  (acc) => acc.accountId === selectedAccountId,
                )?.accountName || "Account"
              }
              caption={localCaption || ""}
              mediaUrl={localMediaUrl || ""}
              scheduledFor={
                mode === "schedule"
                  ? (() => {
                      const publishAt = new Date(selectedDate);
                      publishAt.setHours(selectedTime.getHours());
                      publishAt.setMinutes(selectedTime.getMinutes());
                      return publishAt.toISOString();
                    })()
                  : null
              }
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
