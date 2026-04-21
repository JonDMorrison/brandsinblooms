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
  const [connectionName, setConnectionName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const handleConnect = async () => {
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
        description: "Initial sync starting. Customers will appear in a few minutes.",
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
            Enter your VMX API key. Your IT team or VMX contact can provide
            this.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="vmx-api-key">API Key</Label>
            <Input
              id="vmx-api-key"
              value={apiKey}
              onChange={(e) => {
                setApiKey(e.target.value);
                setError(null);
              }}
              placeholder="e.g. 71f1206d6c223bec13a3af984019cf0d"
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
            disabled={loading || !apiKey.trim()}
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
