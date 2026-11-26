import * as React from "react";
import Alert from "@mui/joy/Alert";
import Sheet from "@mui/joy/Sheet";
import Stack from "@mui/joy/Stack";
import Switch from "@mui/joy/Switch";
import Typography from "@mui/joy/Typography";
import { ShieldCheck } from "lucide-react";
import { useCampaignApprovalSetting } from "@/hooks/useCampaignApproval";

/** One switch: do emails need approval before they are scheduled or sent? Off unless turned on. */
export function CampaignApprovalSetting() {
  const { setting, isLoading, error, setRequired } = useCampaignApprovalSetting();
  const [notice, setNotice] = React.useState<string | null>(null);

  if (isLoading || error || !setting || !setting.canManage) return null;

  const change = async (required: boolean) => {
    setNotice(null);
    try {
      const waiting = await setRequired.mutateAsync(required);
      setNotice(
        required
          ? waiting > 0
            ? `Approval is on. ${waiting} scheduled ${waiting === 1 ? "email is" : "emails are"} now waiting for approval and will not send until approved.`
            : "Approval is on. Emails must be approved before they are scheduled or sent."
          : "Approval is off. Anyone who can send emails can send without approval.",
      );
    } catch (caught) {
      setNotice(caught instanceof Error ? caught.message : "That did not save. Please try again.");
    }
  };

  return (
    <Sheet variant="outlined" sx={{ p: 2.5, borderRadius: "lg" }} data-testid="campaign-approval-setting">
      <Stack spacing={1.5}>
        <Stack direction="row" spacing={1.25} alignItems="center">
          <ShieldCheck size={18} aria-hidden="true" />
          <Typography level="title-md">Email approval</Typography>
        </Stack>
        <Typography level="body-sm" sx={{ color: "text.secondary", maxWidth: 760 }}>
          When this is on, an email must be approved before it can be scheduled or sent. Owners, admins and
          marketing leads can approve. If an approved email is changed, it needs approval again. Leave this off
          if one person writes and sends your emails.
        </Typography>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <Switch
            checked={setting.required}
            disabled={setRequired.isPending}
            onChange={(event) => void change(event.target.checked)}
            slotProps={{ input: { "aria-label": "Emails need approval before sending" } }}
          />
          <Typography level="body-md">Emails need approval before sending</Typography>
        </Stack>
        {setting.required && setting.waiting > 0 && (
          <Typography level="body-sm">
            {setting.waiting} {setting.waiting === 1 ? "email is" : "emails are"} waiting for approval.
          </Typography>
        )}
        {notice && <Alert color="neutral" variant="soft" role="status">{notice}</Alert>}
      </Stack>
    </Sheet>
  );
}
