import { useState } from "react";
import Sheet from "@mui/joy/Sheet";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { JoyButton } from "@/components/joy/JoyButton";
import {
  JoyDialog,
  JoyDialogActions,
  JoyDialogContent,
} from "@/components/joy/JoyDialog";
import { JoyInput as Input } from "@/components/joy/JoyInput";
import { JoySelect } from "@/components/joy/JoySelect";
import { JoyTextarea as Textarea } from "@/components/joy/JoyTextarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, addYears } from "date-fns";

const PLANS = [
  { value: "free_trial", label: "Free Trial" },
  { value: "seed", label: "Seed ($199/mo)" },
  { value: "sprout", label: "Sprout ($349/mo)" },
  { value: "bloom", label: "Bloom ($699/mo)" },
  { value: "thrive", label: "Thrive ($1,199/mo)" },
  { value: "expired", label: "Expired" },
];

interface ChangePlanModalProps {
  open: boolean;
  onClose: () => void;
  tenantId: string;
  tenantName: string;
  contactEmail: string;
  currentPlan: string;
  onSuccess: () => void;
}

export const ChangePlanModal = ({
  open,
  onClose,
  tenantId,
  tenantName,
  contactEmail,
  currentPlan,
  onSuccess,
}: ChangePlanModalProps) => {
  const defaultEndDate = format(addYears(new Date(), 10), "yyyy-MM-dd");

  const [plan, setPlan] = useState(currentPlan || "bloom");
  const [endDate, setEndDate] = useState(defaultEndDate);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!reason.trim()) {
      toast.error("Please provide a reason for the plan change");
      return;
    }

    setSaving(true);
    try {
      // Call the admin_change_tenant_plan RPC. Direct client-side UPDATEs on
      // public.subscriptions are blocked by RLS (an admin cannot see another
      // user's subscription row, so UPDATE silently affects 0 rows with no
      // error). The RPC runs SECURITY DEFINER, validates the caller against
      // app_admin_emails, updates every subscription for every user in the
      // tenant, and inserts the admin_audit_log row server-side.
      const { data, error } = await supabase.rpc("admin_change_tenant_plan", {
        p_tenant_id: tenantId,
        p_plan: plan,
        p_end_date: endDate,
        p_reason: reason.trim(),
      });

      if (error) {
        console.error("admin_change_tenant_plan RPC failed:", {
          error,
          code: error.code,
          details: error.details,
          hint: error.hint,
          message: error.message,
          tenantId,
          plan,
          endDate,
        });
        toast.error(error.message || "Failed to change plan");
        setSaving(false);
        return;
      }

      console.log("admin_change_tenant_plan RPC result:", data);

      toast.success(`Plan changed to ${plan} for ${tenantName}`);
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error("ChangePlanModal handleSave threw:", err);
      toast.error(err.message || "Failed to change plan");
    } finally {
      setSaving(false);
    }
  };

  return (
    <JoyDialog
      open={open}
      onClose={() => onClose()}
      size="md"
      title="Change Plan"
    >
      <JoyDialogContent>
        <Stack spacing={2}>
          <Sheet
            variant="soft"
            color="neutral"
            sx={{ p: 2, borderRadius: "var(--joy-radius-md)" }}
          >
            <Stack spacing={0.25}>
              <Typography level="body-sm" fontWeight="lg">
                {tenantName}
              </Typography>
              <Typography level="body-sm" color="neutral">
                {contactEmail}
              </Typography>
            </Stack>
          </Sheet>

          <Stack spacing={0.5}>
            <JoySelect
              label="Plan"
              value={plan}
              onValueChange={setPlan}
              options={PLANS}
            />
            <Typography level="body-xs" color="neutral">
              Current:{" "}
              <strong style={{ textTransform: "capitalize" }}>
                {currentPlan}
              </strong>
            </Typography>
          </Stack>

          <Input
            id="endDate"
            label="End Date"
            helperText="Default is 10 years from now (permanent). Adjust for time-limited overrides."
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />

          <Textarea
            id="reason"
            label="Reason *"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Gifted account, invoiced externally, founding customer..."
            rows={2}
          />
        </Stack>
      </JoyDialogContent>

      <JoyDialogActions>
        <JoyButton bloomVariant="outline" onClick={onClose} disabled={saving}>
          Cancel
        </JoyButton>
        <JoyButton
          onClick={handleSave}
          disabled={saving}
          loading={saving}
          loadingPosition="start"
        >
          {saving ? "Saving..." : "Save Plan Change"}
        </JoyButton>
      </JoyDialogActions>
    </JoyDialog>
  );
};
