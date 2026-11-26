import * as React from "react";
import Alert from "@mui/joy/Alert";
import Box from "@mui/joy/Box";
import Button from "@mui/joy/Button";
import Chip from "@mui/joy/Chip";
import FormControl from "@mui/joy/FormControl";
import FormLabel from "@mui/joy/FormLabel";
import Sheet from "@mui/joy/Sheet";
import Stack from "@mui/joy/Stack";
import Textarea from "@mui/joy/Textarea";
import Typography from "@mui/joy/Typography";
import { ShieldCheck } from "lucide-react";
import { useCampaignApproval } from "@/hooks/useCampaignApproval";
import {
  APPROVAL_EVENT_LABEL,
  APPROVAL_STATE_LABEL,
  approvalStateMessage,
  type CampaignApprovalState,
} from "@/lib/crm/campaignApproval";

const CHIP_COLOR: Record<CampaignApprovalState, "neutral" | "warning" | "success" | "danger"> = {
  not_required: "neutral",
  draft: "neutral",
  pending: "warning",
  changes_requested: "danger",
  approved: "success",
  changed: "warning",
};

const when = (iso: string | null) => {
  if (!iso) return "";
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? ""
    : new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
};

/**
 * Shows where an email stands with approval and offers the next step.
 * Renders nothing for organisations that have not turned approval on.
 * The database enforces the rule; this panel explains it.
 */
export function CampaignApprovalPanel({
  campaignId,
  enabled = true,
}: {
  campaignId: string | null | undefined;
  enabled?: boolean;
}) {
  const { approval, isLoading, error, submit, decide } = useCampaignApproval(campaignId, enabled);
  const [note, setNote] = React.useState("");
  const [message, setMessage] = React.useState<string | null>(null);

  if (!campaignId || isLoading || !approval || !approval.required) {
    return error ? (
      <Alert color="warning" data-testid="campaign-approval-error">
        We could not check whether this email is approved. It cannot be sent until we can.
      </Alert>
    ) : null;
  }

  const busy = submit.isPending || decide.isPending;
  const canSubmitNow =
    approval.canSubmit && ["draft", "changes_requested", "changed"].includes(approval.state);
  const canDecideNow = approval.canApprove && approval.state === "pending";

  const run = async (action: () => Promise<string | null>) => {
    setMessage(null);
    try {
      setMessage(await action());
      setNote("");
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "That did not work. Please try again.");
    }
  };

  return (
    <Sheet
      variant="outlined"
      data-testid="campaign-approval-panel"
      sx={{ p: 2, borderRadius: "md", bgcolor: "background.surface" }}
    >
      <Stack spacing={1.5}>
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
          <ShieldCheck size={18} aria-hidden="true" />
          <Typography level="title-sm">Approval</Typography>
          <Chip size="sm" variant="soft" color={CHIP_COLOR[approval.state]} data-testid="campaign-approval-state">
            {APPROVAL_STATE_LABEL[approval.state]}
          </Chip>
        </Stack>
        <Typography level="body-sm">{approvalStateMessage(approval)}</Typography>

        {approval.review?.submitNote && approval.state === "pending" && (
          <Typography level="body-sm">
            <strong>Note from {approval.review.submittedBy ?? "the sender"}:</strong> {approval.review.submitNote}
          </Typography>
        )}
        {approval.review?.decisionNote && approval.state === "changes_requested" && (
          <Alert color="danger" variant="soft">
            <Box>
              <Typography level="title-sm">What to change</Typography>
              <Typography level="body-sm" sx={{ whiteSpace: "pre-wrap" }}>{approval.review.decisionNote}</Typography>
            </Box>
          </Alert>
        )}

        {(canSubmitNow || canDecideNow) && (
          <FormControl>
            <FormLabel>
              {canDecideNow ? "Note for the sender (needed when you ask for changes)" : "Note for the approver (optional)"}
            </FormLabel>
            <Textarea
              minRows={2}
              maxRows={6}
              value={note}
              disabled={busy}
              onChange={(event) => setNote(event.target.value)}
              slotProps={{ textarea: { maxLength: 2000, "aria-label": canDecideNow ? "Note for the sender" : "Note for the approver" } }}
            />
          </FormControl>
        )}

        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          {canSubmitNow && (
            <Button
              loading={submit.isPending}
              disabled={busy}
              onClick={() => void run(async () => { await submit.mutateAsync(note); return "Sent for approval."; })}
            >
              {approval.state === "draft" ? "Send for approval" : "Send for approval again"}
            </Button>
          )}
          {canDecideNow && (
            <>
              <Button
                color="success"
                loading={decide.isPending}
                disabled={busy}
                onClick={() => void run(async () => {
                  const result = await decide.mutateAsync({ decision: "approve", reviewedFingerprint: approval.fingerprint, note });
                  return result.ok ? "Approved." : "This email changed while you were reviewing it. Look at it again before you decide.";
                })}
              >
                Approve this version
              </Button>
              <Button
                variant="outlined"
                color="neutral"
                disabled={busy || !note.trim()}
                onClick={() => void run(async () => {
                  const result = await decide.mutateAsync({ decision: "request_changes", reviewedFingerprint: approval.fingerprint, note });
                  return result.ok ? "Changes requested." : "This email changed while you were reviewing it. Look at it again before you decide.";
                })}
              >
                Ask for changes
              </Button>
            </>
          )}
        </Stack>
        {approval.state === "pending" && !approval.canApprove && (
          <Typography level="body-xs">An owner, admin or marketing lead can approve it.</Typography>
        )}
        {message && (
          <Typography level="body-sm" role="status" data-testid="campaign-approval-message">{message}</Typography>
        )}

        {approval.history.length > 0 && (
          <Box component="details">
            <Box component="summary" sx={{ cursor: "pointer", fontSize: "sm" }}>History</Box>
            <Stack component="ul" spacing={0.5} sx={{ pl: 2.5, mt: 1, mb: 0 }}>
              {approval.history.map((entry, index) => (
                <Typography component="li" level="body-xs" key={`${entry.at}-${index}`}>
                  {APPROVAL_EVENT_LABEL[entry.event] ?? entry.event}
                  {entry.by ? ` by ${entry.by}` : ""} · {when(entry.at)}
                  {entry.note ? `: ${entry.note}` : ""}
                </Typography>
              ))}
            </Stack>
          </Box>
        )}
      </Stack>
    </Sheet>
  );
}
