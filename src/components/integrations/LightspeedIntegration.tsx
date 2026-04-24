/** @deprecated — No longer route-connected. Superseded by the IntegrationDetailPage and detailPrimitives-based surfaces (INT-UI-006). */
import { Card } from "@/components/ui-legacy/card";
import { Button } from "@/components/ui-legacy/button";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Loader2,
  CheckCircle,
  XCircle,
  Plug,
  ExternalLink,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";
import { getUserFacingIntegrationError } from "@/components/integrations/integrationDetailModel";

export const LightspeedIntegration = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: connection, isLoading } = useQuery({
    queryKey: ["lightspeed-connection"],
    queryFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Not authenticated");

      const { data: user } = await supabase
        .from("users")
        .select("tenant_id")
        .eq("id", userData.user.id)
        .single();

      if (!user?.tenant_id) return null;

      const { data, error } = await supabase
        .from("lightspeed_connections")
        .select("*")
        .eq("tenant_id", user.tenant_id)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: async () => {
      if (!connection) throw new Error("No connection found");
      const { error } = await supabase
        .from("lightspeed_connections")
        .delete()
        .eq("id", connection.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lightspeed-connection"] });
      toast({ title: "Lightspeed disconnected" });
    },
    onError: (error: Error) => {
      toast({
        title: "Disconnect failed",
        description: getUserFacingIntegrationError(
          error,
          "Lightspeed could not be disconnected.",
        ),
        variant: "destructive",
      });
    },
  });

  const syncMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke(
        "lightspeed-full-sync",
      );
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["lightspeed-connection"] });
      toast({
        title: "Sync completed",
        description: `Synced ${data?.results?.customers?.customersSynced || 0} customers and ${data?.results?.sales?.salesSynced || 0} sales`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Sync failed",
        description: getUserFacingIntegrationError(
          error,
          "Lightspeed sync could not be started.",
        ),
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return (
      <Card className="p-6">
        <Loader2 className="h-6 w-6 animate-spin" />
      </Card>
    );
  }

  const isConnected =
    connection && connection.encrypted_access_token !== "pending";

  return (
    <Card className="p-6">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <Plug className="h-8 w-8 text-primary" />
          <div>
            <h3 className="text-lg font-semibold">Lightspeed X-Series</h3>
            <p className="text-sm text-muted-foreground">POS Integration</p>
          </div>
        </div>
        {isConnected ? (
          <CheckCircle className="h-6 w-6 text-green-600" />
        ) : (
          <XCircle className="h-6 w-6 text-muted-foreground" />
        )}
      </div>

      {isConnected ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Domain</p>
              <p className="font-medium">
                {connection.domain_prefix}.retail.lightspeed.app
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Status</p>
              <p className="font-medium text-green-600">✓ Connected</p>
            </div>
            {connection.last_synced_at && (
              <div>
                <p className="text-muted-foreground">Last Synced</p>
                <p className="font-medium">
                  {formatDistanceToNow(new Date(connection.last_synced_at), {
                    addSuffix: true,
                  })}
                </p>
              </div>
            )}
          </div>

          <div className="flex gap-2 flex-wrap">
            <Button
              onClick={() => syncMutation.mutate()}
              disabled={syncMutation.isPending}
              size="sm"
            >
              {syncMutation.isPending && (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              )}
              Sync Now
            </Button>
            <Button
              onClick={() => disconnectMutation.mutate()}
              disabled={disconnectMutation.isPending}
              size="sm"
              variant="outline"
            >
              Disconnect
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Connect your Lightspeed X-Series POS to sync customers, sales, and
            products.
          </p>
          <Button asChild className="w-full">
            <a
              href="/integrations/lightspeed/connect"
              className="inline-flex items-center gap-2"
            >
              <ExternalLink className="h-4 w-4" />
              Connect Lightspeed
            </a>
          </Button>
        </div>
      )}
    </Card>
  );
};
