import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect } from "@/components/ui/NativeSelect";
import { Loader2 } from "lucide-react";
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
      // Update subscription via direct query on the subscriptions table
      // Join through auth.users → public.users → tenants to find the right subscription
      const { data: userData, error: userError } = await supabase
        .from("users")
        .select("id")
        .eq("tenant_id", tenantId)
        .limit(1)
        .single();

      if (userError || !userData) {
        toast.error("Could not find user for this tenant");
        setSaving(false);
        return;
      }

      const { error: subError } = await supabase
        .from("subscriptions")
        .update({
          plan,
          tier: plan,
          end_date: endDate,
          crm_enabled: plan !== "free_trial" && plan !== "expired",
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", userData.id);

      if (subError) {
        toast.error(subError.message || "Failed to update subscription");
        setSaving(false);
        return;
      }

      // Log to admin_audit_log
      const { data: sessionData } = await supabase.auth.getUser();
      if (sessionData?.user) {
        await supabase.from("admin_audit_log").insert({
          admin_user_id: sessionData.user.id,
          target_tenant_id: tenantId,
          action_type: "change_plan",
          action_details: {
            previous_plan: currentPlan,
            new_plan: plan,
            end_date: endDate,
            reason: reason.trim(),
            tenant_name: tenantName,
            contact_email: contactEmail,
          },
        });
      }

      toast.success(`Plan changed to ${plan} for ${tenantName}`);
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Failed to change plan");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Change Plan</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{tenantName}</span>
            <br />
            {contactEmail}
          </div>

          <div>
            <Label htmlFor="plan">Plan</Label>
            <NativeSelect
              value={plan}
              onChange={(e) => setPlan(e.target.value)}
              options={PLANS}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Current: <span className="font-medium capitalize">{currentPlan}</span>
            </p>
          </div>

          <div>
            <Label htmlFor="endDate">End Date</Label>
            <Input
              id="endDate"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Default is 10 years from now (permanent). Adjust for time-limited overrides.
            </p>
          </div>

          <div>
            <Label htmlFor="reason">Reason *</Label>
            <Textarea
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Gifted account, invoiced externally, founding customer..."
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              "Save Plan Change"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
