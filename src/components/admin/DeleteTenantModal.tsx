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
import { AlertTriangle, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { AdminTenant } from "./TenantTable";

interface DeleteTenantModalProps {
  open: boolean;
  onClose: () => void;
  tenant: AdminTenant;
  onSuccess: () => void;
}

export const DeleteTenantModal = ({
  open,
  onClose,
  tenant,
  onSuccess,
}: DeleteTenantModalProps) => {
  const [confirmName, setConfirmName] = useState("");
  const [deleting, setDeleting] = useState(false);

  const companyName = tenant.company_name || "Unnamed Company";
  const isConfirmed = confirmName === companyName;

  const handleDelete = async () => {
    if (!isConfirmed) return;
    if (!tenant.primary_contact_user_id) {
      toast.error("Cannot delete: no user account found for this tenant");
      return;
    }

    setDeleting(true);
    try {
      // Get current admin user for audit log
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError || !authData?.user) {
        throw new Error("Failed to verify admin authentication");
      }

      // Log deletion to admin_audit_log before executing
      const { error: logError } = await supabase.from("admin_audit_log").insert({
        admin_user_id: authData.user.id,
        target_tenant_id: tenant.tenant_id,
        target_user_id: tenant.primary_contact_user_id,
        action_type: "tenant_deleted",
        action_details: {
          company_name: companyName,
          primary_contact_email: tenant.primary_contact_email,
          plan: tenant.plan,
          deleted_by_email: authData.user.email,
          deleted_at: new Date().toISOString(),
        },
      });

      if (logError) {
        console.error("Failed to write audit log:", logError);
        // Non-fatal — continue with deletion but warn
        toast.warning(`Audit log entry failed (${logError.message}), proceeding with deletion`);
      }

      // Call admin_delete_user RPC
      const { error: deleteError } = await supabase.rpc("admin_delete_user", {
        target_user_id: tenant.primary_contact_user_id,
      });

      if (deleteError) {
        console.error("admin_delete_user RPC failed:", deleteError);
        if (deleteError.message.includes("Access denied")) {
          throw new Error("Access denied. Only super administrators can delete tenants.");
        }
        throw new Error(deleteError.message || "Failed to delete tenant");
      }

      toast.success(`Tenant "${companyName}" has been permanently deleted`);
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error("DeleteTenantModal handleDelete threw:", err);
      toast.error(err.message || "Failed to delete tenant");
    } finally {
      setDeleting(false);
    }
  };

  const handleClose = () => {
    if (!deleting) {
      setConfirmName("");
      onClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Permanently Delete Client
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
            <p className="font-medium">This action cannot be undone.</p>
            <p className="mt-1 text-destructive/80">
              Permanently deletes the auth account, tenant record, all CRM data,
              campaigns, and subscriptions for{" "}
              <span className="font-semibold">{companyName}</span>.
            </p>
          </div>

          <div className="space-y-1">
            <Label htmlFor="confirm-name">
              Type{" "}
              <span className="font-semibold text-foreground">{companyName}</span>{" "}
              to confirm
            </Label>
            <Input
              id="confirm-name"
              value={confirmName}
              onChange={(e) => setConfirmName(e.target.value)}
              placeholder={companyName}
              disabled={deleting}
              autoComplete="off"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={deleting}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={!isConfirmed || deleting}
          >
            {deleting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Deleting...
              </>
            ) : (
              "Delete Permanently"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
