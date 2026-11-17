import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface VmxConnectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  onSwitchToCsv: () => void;
}

export const VmxConnectDialog: React.FC<VmxConnectDialogProps> = ({
  open,
  onOpenChange,
  onSuccess,
  onSwitchToCsv,
}) => {
  const [apiKey, setApiKey] = useState("");
  const [apiUrl, setApiUrl] = useState("");
  const [connectionName, setConnectionName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const handleConnect = async () => {
    if (!apiUrl.trim()) {
      setError("Ask VMX for your store-specific API URL.");
      return;
    }
    if (!/^https:\/\/[a-z0-9-]+\.vmxllc\.com\/pos\/api\/?$/i.test(apiUrl.trim())) {
      setError("Enter the HTTPS /pos/api URL VMX supplied for this store.");
      return;
    }
    if (!apiKey.trim()) {
      setError("API key is required");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke(
        "vmx-connect",
        {
          body: {
            api_url: apiUrl.trim(),
            api_key: apiKey.trim(),
            connection_name: connectionName.trim() || "VMX POS",
          },
        },
      );

      if (fnError) {
        setError(fnError.message || "Connection failed");
        return;
      }

      if (data?.error) {
        setError(data.error);
        return;
      }

      // Success — close dialog, notify, trigger initial sync
      onOpenChange(false);
      toast({
        title: "VMX connected",
        description: "Connection saved. Check sync status before relying on imported customers.",
      });
      onSuccess();

      // Fire-and-forget: trigger initial customer sync
      if (data?.connection_id) {
        supabase.functions
          .invoke("vmx-sync-customers", {
            body: { connection_id: data.connection_id, full_sync: true },
          })
          .catch(() => {}); // non-blocking
      }
    } catch (err) {
      setError((err as Error).message || "Unexpected error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Connect VMX POS</DialogTitle>
          <DialogDescription>
            Ask VMX for this garden centre's API URL and API Client ID.
            A regular VMX sign-in link is not an API credential.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="vmx-api-url">Store API URL</Label>
            <Input
              id="vmx-api-url"
              type="url"
              autoComplete="off"
              value={apiUrl}
              onChange={(e) => {
                setApiUrl(e.target.value);
                setError(null);
              }}
              placeholder="https://your-store.vmxllc.com/pos/api"
              disabled={loading}
            />
            <p className="text-xs text-muted-foreground">
              Use the exact API address supplied by VMX for this location.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="vmx-api-key">VMX API Client ID</Label>
            <Input
              id="vmx-api-key"
              type="password"
              autoComplete="new-password"
              value={apiKey}
              onChange={(e) => {
                setApiKey(e.target.value);
                setError(null);
              }}
              placeholder="Enter the VMX-issued API Client ID"
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="vmx-name">
              Connection Name{" "}
              <span className="text-muted-foreground font-normal">
                (optional)
              </span>
            </Label>
            <Input
              id="vmx-name"
              value={connectionName}
              onChange={(e) => setConnectionName(e.target.value)}
              placeholder="VMX POS"
              disabled={loading}
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 rounded-md px-3 py-2">
              {error}
            </p>
          )}

          <Button
            className="w-full"
            onClick={handleConnect}
            disabled={loading || !apiKey.trim() || !apiUrl.trim()}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Connecting...
              </>
            ) : (
              "Connect"
            )}
          </Button>

          <div className="relative my-2">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-background px-2 text-muted-foreground">
                or
              </span>
            </div>
          </div>

          <Button
            variant="ghost"
            size="sm"
            className="w-full text-muted-foreground"
            onClick={() => {
              onOpenChange(false);
              onSwitchToCsv();
            }}
          >
            <Upload className="mr-2 h-4 w-4" />
            Upload a CSV file instead
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
