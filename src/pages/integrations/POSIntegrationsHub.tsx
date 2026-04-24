import React, { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { PROVIDERS } from "@/components/integrations/pos/providers";
import { ProviderCard } from "@/components/integrations/pos/ProviderCard";
import { VmxConnectDialog } from "@/components/integrations/pos/VmxConnectDialog";
import { VMXUploader } from "@/components/crm/pos/VMXUploader";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useUnifiedPOSConnections } from "@/hooks/useUnifiedPOSConnections";

export default function POSIntegrationsHub() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { connections, isLoading, refetch } = useUnifiedPOSConnections();

  const [vmxDialogOpen, setVmxDialogOpen] = useState(false);
  const [csvDialogOpen, setCsvDialogOpen] = useState(false);

  const handleConnect = useCallback(
    async (providerId: string) => {
      switch (providerId) {
        case "square": {
          // Trigger existing Square OAuth flow
          const { data, error } = await supabase.functions.invoke(
            "square-oauth-start",
          );
          if (error) {
            toast({ title: "Error", description: error.message, variant: "destructive" });
            return;
          }
          if (data?.url) window.location.href = data.url;
          break;
        }
        case "lightspeed":
          navigate("/integrations/lightspeed/connect");
          break;
        case "clover": {
          const { data, error } = await supabase.functions.invoke(
            "clover-oauth-start",
          );
          if (error) {
            toast({ title: "Error", description: error.message, variant: "destructive" });
            return;
          }
          if (data?.url) window.location.href = data.url;
          break;
        }
        case "vmx":
          setVmxDialogOpen(true);
          break;
        default:
          break;
      }
    },
    [navigate, toast],
  );

  const handleManage = useCallback(
    (providerId: string) => {
      // Navigate to the existing detail page for each provider
      switch (providerId) {
        case "square":
          navigate("/integrations/square/guide");
          break;
        case "lightspeed":
          navigate("/integrations/lightspeed/connect");
          break;
        case "clover":
          navigate("/integrations/clover/guide");
          break;
        case "vmx":
          // For now, open the connect dialog to see status
          setVmxDialogOpen(true);
          break;
      }
    },
    [navigate],
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">
          POS Integrations
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Connect your point-of-sale system to sync customers, transactions, and
          loyalty data automatically.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {PROVIDERS.map((provider) => (
          <ProviderCard
            key={provider.id}
            provider={provider}
            connection={connections[provider.id]}
            onConnect={handleConnect}
            onManage={handleManage}
          />
        ))}
      </div>

      {/* VMX API Connect Dialog */}
      <VmxConnectDialog
        open={vmxDialogOpen}
        onOpenChange={setVmxDialogOpen}
        onSuccess={refetch}
        onSwitchToCsv={() => setCsvDialogOpen(true)}
      />

      {/* VMX CSV Upload Dialog (fallback) */}
      <Dialog open={csvDialogOpen} onOpenChange={setCsvDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Upload VMX CSV</DialogTitle>
          </DialogHeader>
          <VMXUploader
            onSuccess={() => {
              setCsvDialogOpen(false);
              refetch();
              toast({ title: "Import complete", description: "Customers imported from CSV." });
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
