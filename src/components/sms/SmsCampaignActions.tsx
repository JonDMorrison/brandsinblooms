import * as React from "react";
import Button from "@mui/joy/Button";
import DialogActions from "@mui/joy/DialogActions";
import DialogContent from "@mui/joy/DialogContent";
import DialogTitle from "@mui/joy/DialogTitle";
import Modal from "@mui/joy/Modal";
import ModalDialog from "@mui/joy/ModalDialog";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import {
  Download,
  LoaderCircle,
  Pause,
  Play,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  downloadFailedMessages,
  retryFailedMessages,
} from "@/lib/sms/smsRetryService";

interface SmsCampaignActionsProps {
  campaignId: string;
  campaignName?: string;
  status: string;
  failedCount: number;
  resumeStatus?: string;
  onRetryComplete?: () => void;
  onStatusChange?: (nextStatus: string) => void;
  onDeleteComplete?: () => void;
}

const PAUSEABLE_STATUSES = new Set(["queued", "sending", "scheduled"]);

export function SmsCampaignActions({
  campaignId,
  campaignName,
  status,
  failedCount,
  resumeStatus = "queued",
  onRetryComplete,
  onStatusChange,
  onDeleteComplete,
}: SmsCampaignActionsProps) {
  const [isRetrying, setIsRetrying] = React.useState(false);
  const [isDownloading, setIsDownloading] = React.useState(false);
  const [isTogglingStatus, setIsTogglingStatus] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = React.useState(false);

  const canPause = PAUSEABLE_STATUSES.has(status);
  const canResume = status === "paused";

  const handleRetry = React.useCallback(async () => {
    setIsRetrying(true);
    try {
      const result = await retryFailedMessages(campaignId, "all_failed");

      if (!result.success) {
        throw new Error(
          result.error || result.message || "Failed to retry messages",
        );
      }

      if (result.countReset > 0) {
        toast.success(`Retrying ${result.countReset} failed messages`);
        onRetryComplete?.();
        return;
      }

      toast.info("No failed messages were eligible for retry.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to retry messages",
      );
    } finally {
      setIsRetrying(false);
    }
  }, [campaignId, onRetryComplete]);

  const handleDownload = React.useCallback(async () => {
    setIsDownloading(true);
    try {
      await downloadFailedMessages(campaignId);
      toast.success("Failed message export started.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to export CSV",
      );
    } finally {
      setIsDownloading(false);
    }
  }, [campaignId]);

  const handleToggleStatus = React.useCallback(async () => {
    const nextStatus = status === "paused" ? resumeStatus : "paused";
    setIsTogglingStatus(true);
    try {
      const { error } = await supabase
        .from("crm_sms_campaigns")
        .update({
          status: nextStatus,
          updated_at: new Date().toISOString(),
        })
        .eq("id", campaignId);

      if (error) {
        throw error;
      }

      toast.success(
        nextStatus === "paused" ? "Campaign paused" : "Campaign resumed",
      );
      onStatusChange?.(nextStatus);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to update status",
      );
    } finally {
      setIsTogglingStatus(false);
    }
  }, [campaignId, onStatusChange, resumeStatus, status]);

  const handleDelete = React.useCallback(async () => {
    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from("crm_sms_campaigns")
        .delete()
        .eq("id", campaignId);

      if (error) {
        throw error;
      }

      toast.success("Campaign deleted");
      setShowDeleteDialog(false);
      onDeleteComplete?.();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to delete campaign",
      );
    } finally {
      setIsDeleting(false);
    }
  }, [campaignId, onDeleteComplete]);

  return (
    <>
      <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
        {failedCount > 0 ? (
          <Button
            size="sm"
            variant="soft"
            color="warning"
            startDecorator={
              isRetrying ? (
                <LoaderCircle size={14} className="spin" />
              ) : (
                <RefreshCw size={14} />
              )
            }
            loading={isRetrying}
            onClick={() => void handleRetry()}
            sx={{ borderRadius: "12px" }}
          >
            {`Retry failed (${failedCount})`}
          </Button>
        ) : null}

        {failedCount > 0 ? (
          <Button
            size="sm"
            variant="soft"
            color="neutral"
            startDecorator={
              isDownloading ? (
                <LoaderCircle size={14} className="spin" />
              ) : (
                <Download size={14} />
              )
            }
            loading={isDownloading}
            onClick={() => void handleDownload()}
            sx={{ borderRadius: "12px" }}
          >
            Export failed CSV
          </Button>
        ) : null}

        {canPause || canResume ? (
          <Button
            size="sm"
            variant="outlined"
            color={canResume ? "success" : "warning"}
            startDecorator={
              canResume ? <Play size={14} /> : <Pause size={14} />
            }
            loading={isTogglingStatus}
            onClick={() => void handleToggleStatus()}
            sx={{ borderRadius: "12px" }}
          >
            {canResume ? "Resume" : "Pause"}
          </Button>
        ) : null}

        <Button
          size="sm"
          variant="outlined"
          color="danger"
          startDecorator={<Trash2 size={14} />}
          onClick={() => setShowDeleteDialog(true)}
          sx={{ borderRadius: "12px" }}
        >
          Delete
        </Button>
      </Stack>

      <Modal
        open={showDeleteDialog}
        onClose={() => !isDeleting && setShowDeleteDialog(false)}
      >
        <ModalDialog
          variant="outlined"
          role="alertdialog"
          sx={{ borderRadius: "24px", maxWidth: 480 }}
        >
          <DialogTitle>Delete campaign</DialogTitle>
          <DialogContent>
            <Typography level="body-sm" color="neutral">
              {campaignName
                ? `Delete ${campaignName}? This removes the campaign record and cannot be undone.`
                : "Delete this campaign? This removes the campaign record and cannot be undone."}
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button
              variant="plain"
              color="neutral"
              disabled={isDeleting}
              onClick={() => setShowDeleteDialog(false)}
            >
              Cancel
            </Button>
            <Button
              variant="solid"
              color="danger"
              loading={isDeleting}
              onClick={() => void handleDelete()}
            >
              Delete campaign
            </Button>
          </DialogActions>
        </ModalDialog>
      </Modal>
    </>
  );
}
