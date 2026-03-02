import React, { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Send,
  Save,
  Eye,
  Loader2,
  CalendarIcon,
  Pause,
  Play,
  Square,
} from "lucide-react";
import { SenderStatusIndicator } from "./campaigns/SenderStatusIndicator";
import { SaveIndicator } from "./SaveIndicator";
import { ShortenAllBlocksButton } from "./ShortenAllBlocksButton";
import { ScheduleSelector, ScheduleOption } from "./ScheduleSelector";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import type { SenderConfig } from "@/hooks/useSenderConfiguration";
import type { ContentBlock } from "@/types/emailBuilder";

interface CampaignActionBarProps {
  // Campaign identity & runtime status (optional for new drafts)
  campaignId?: string | null;
  campaignStatus?: string;

  // Campaign status
  campaignName: string;
  subjectLine: string;
  blocks: ContentBlock[];
  selectedSegments: unknown[];

  // Sender info
  senderConfig?: SenderConfig;
  loadingSenderConfig: boolean;

  // Save status
  lastSaved?: Date;
  isAutoSaving: boolean;
  saveError: boolean;

  // Loading states
  sending: boolean;
  loading: boolean;
  hasGeneratingImages?: boolean; // Track if any blocks are generating images

  // Schedule
  schedule?: ScheduleOption;
  onScheduleChange?: (schedule: ScheduleOption) => void;

  // Actions
  onSend: () => void;
  onSave: () => void;
  onPreview: () => void;
  onAudience: () => void;
  onAIWriter: () => void;
  onBlockUpdate?: (blockId: string, updatedBlock: ContentBlock) => void;

  // Breadcrumb
  isEditMode?: boolean;

  className?: string;
}

export const CampaignActionBar: React.FC<CampaignActionBarProps> = ({
  campaignId = null,
  campaignStatus,
  campaignName,
  subjectLine,
  blocks,
  selectedSegments,
  senderConfig,
  loadingSenderConfig,
  lastSaved,
  isAutoSaving,
  saveError,
  sending,
  loading,
  hasGeneratingImages = false,
  schedule = { type: "now" },
  onScheduleChange,
  onSend,
  onSave,
  onPreview,
  onAudience,
  onAIWriter,
  onBlockUpdate,
  isEditMode = false,
  className = "",
}) => {
  const [isSticky, setIsSticky] = useState(false);
  const stickyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsSticky(!entry.isIntersecting);
      },
      { threshold: 1 },
    );

    const node = stickyRef.current;
    if (node) observer.observe(node);

    return () => {
      if (node) observer.unobserve(node);
    };
  }, []);

  // Calculate readiness (audience defaults to All Contacts)
  const isReady = Boolean(
    campaignName?.trim() && subjectLine?.trim() && blocks.length > 0,
  );

  // Count blocks currently generating images
  const generatingImageCount = blocks.filter((b) => b.isGeneratingImage).length;

  // Pause/Unpause/Stop controls are shown in the campaign progress banner instead.

  return (
    <>
      <div ref={stickyRef} className="h-0" />
      <div
        className={`sticky top-0 z-50 ${isSticky ? "flex justify-start" : "w-full"} ${className}`}
      >
        <div
          className={`${isSticky ? "inline-flex px-4 py-2 backdrop-blur-sm rounded-md shadow-sm" : "w-full -mx-8 px-6 py-4 backdrop-blur-sm border-b"}`}
          style={{ backgroundColor: "#fbf9f4" }}
        >
          <div
            className={`flex items-center ${isSticky ? "" : "justify-between"}`}
          >
            {/* Left side - Breadcrumb */}
            {!isSticky && (
              <div className="flex items-center space-x-4 animate-fade-in">
                <Breadcrumb>
                  <BreadcrumbList>
                    <BreadcrumbItem>
                      <BreadcrumbLink href="/crm">CRM</BreadcrumbLink>
                    </BreadcrumbItem>
                    <BreadcrumbSeparator />
                    <BreadcrumbItem>
                      <BreadcrumbLink href="/crm/campaigns">
                        Campaigns
                      </BreadcrumbLink>
                    </BreadcrumbItem>
                    <BreadcrumbSeparator />
                    <BreadcrumbItem>
                      <BreadcrumbPage>
                        {isEditMode ? "Edit Campaign" : "New Campaign"}
                      </BreadcrumbPage>
                    </BreadcrumbItem>
                  </BreadcrumbList>
                </Breadcrumb>
              </div>
            )}

            {/* Right side - Actions */}
            <div
              className={`flex items-center ${isSticky ? "space-x-0" : "space-x-3"}`}
            >
              {/* Secondary actions - hidden when sticky */}
              {!isSticky && (
                <div className="flex items-center space-x-3 animate-fade-in">
                  {onBlockUpdate && (
                    <ShortenAllBlocksButton
                      blocks={blocks}
                      campaignName={campaignName}
                      onUpdate={onBlockUpdate}
                    />
                  )}

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onPreview}
                    disabled={loading || hasGeneratingImages}
                    title={
                      hasGeneratingImages
                        ? "Waiting for images to generate..."
                        : undefined
                    }
                    className="flex items-center space-x-2"
                  >
                    {hasGeneratingImages ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Generating...</span>
                      </>
                    ) : (
                      <>
                        <Eye className="h-4 w-4" />
                        <span>Preview</span>
                      </>
                    )}
                  </Button>
                </div>
              )}

              {/* Schedule Selector - always visible, compact in sticky mode */}
              {onScheduleChange && (
                <ScheduleSelector
                  schedule={schedule}
                  onScheduleChange={onScheduleChange}
                  disabled={loading || sending}
                  compact={isSticky}
                  commitOnSelect={isSticky}
                  onCommit={onSend}
                />
              )}

              {/* Save button - always visible */}
              <Button
                variant="outline"
                size="sm"
                onClick={onSave}
                disabled={loading || isAutoSaving}
                className={`flex items-center space-x-2 transition-all duration-300 ${isSticky ? "animate-scale-in" : ""}`}
              >
                <Save className="h-4 w-4" />
                <span>Save</span>
              </Button>

              {/* Pause/Unpause/Stop controls intentionally removed from the action header. */}

              {/* Send/Schedule button - hidden when sticky */}
              {!isSticky && (
                <Button
                  onClick={onSend}
                  disabled={
                    !isReady ||
                    sending ||
                    loading ||
                    loadingSenderConfig ||
                    hasGeneratingImages
                  }
                  title={
                    hasGeneratingImages
                      ? "Waiting for images to generate..."
                      : undefined
                  }
                  size="sm"
                  className="flex items-center space-x-2 animate-fade-in"
                >
                  {sending ? (
                    <>
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                      <span>
                        {schedule.type === "scheduled"
                          ? "Scheduling..."
                          : "Sending..."}
                      </span>
                    </>
                  ) : hasGeneratingImages ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Generating...</span>
                    </>
                  ) : schedule.type === "scheduled" ? (
                    <>
                      <CalendarIcon className="h-4 w-4" />
                      <span>Schedule</span>
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4" />
                      <span>Send Campaign</span>
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};
