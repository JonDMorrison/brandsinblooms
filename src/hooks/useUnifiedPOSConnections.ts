import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useMemo } from "react";

export interface POSConnectionStatus {
  status: "not_connected" | "connected" | "syncing" | "error" | "paused";
  lastSyncAt: string | null;
  connectionId: string | null;
  connectionName: string | null;
  errorMessage: string | null;
}

type ProviderId = "square" | "lightspeed" | "clover" | "vmx" | "counterpoint";

function mapSyncStatus(
  row: { sync_status?: string; is_active?: boolean; status?: string } | null,
): POSConnectionStatus["status"] {
  if (!row) return "not_connected";
  const active = row.is_active !== false;
  if (!active) return "paused";
  const s = (row.sync_status || row.status || "").toLowerCase();
  if (s === "success" || s === "connected" || s === "active") return "connected";
  if (s === "syncing" || s === "pending") return "syncing";
  if (s === "error") return "error";
  return "connected"; // default for any connected row
}

export function useUnifiedPOSConnections() {
  const { user } = useAuth();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["pos-connections-unified", user?.id],
    queryFn: async () => {
      if (!user) return null;

      const { data: userData } = await supabase
        .from("users")
        .select("tenant_id")
        .eq("id", user.id)
        .maybeSingle();

      if (!userData?.tenant_id) return null;
      const tid = userData.tenant_id;

      // Fetch all connection tables in parallel
      const [squareRes, lightspeedRes, cloverRes, vmxRes] = await Promise.all([
        supabase
          .from("square_connections")
          .select("id, status, last_sync_at, sync_error")
          .eq("tenant_id", tid)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from("lightspeed_connections")
          .select("id, status, last_sync_at")
          .eq("tenant_id", tid)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from("clover_connections")
          .select("id, status, last_sync_at")
          .eq("tenant_id", tid)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from("pos_connections")
          .select("id, sync_status, last_sync_at, sync_error, is_active, name")
          .eq("tenant_id", tid)
          .eq("platform", "vmx")
          .eq("is_active", true)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      return { square: squareRes.data, lightspeed: lightspeedRes.data, clover: cloverRes.data, vmx: vmxRes.data, tenantId: tid };
    },
    enabled: !!user,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });

  const connections = useMemo<Record<ProviderId, POSConnectionStatus>>(() => {
    const empty: POSConnectionStatus = {
      status: "not_connected",
      lastSyncAt: null,
      connectionId: null,
      connectionName: null,
      errorMessage: null,
    };

    if (!data) {
      return {
        square: empty,
        lightspeed: empty,
        clover: empty,
        vmx: empty,
        counterpoint: empty,
      };
    }

    const mapRow = (
      row: any,
      syncStatusField = "status",
    ): POSConnectionStatus => {
      if (!row) return empty;
      return {
        status: mapSyncStatus({ sync_status: row[syncStatusField] || row.sync_status || row.status, is_active: row.is_active }),
        lastSyncAt: row.last_sync_at || null,
        connectionId: row.id || null,
        connectionName: row.name || null,
        errorMessage: row.sync_error || null,
      };
    };

    return {
      square: mapRow(data.square),
      lightspeed: mapRow(data.lightspeed),
      clover: mapRow(data.clover),
      vmx: mapRow(data.vmx, "sync_status"),
      counterpoint: empty,
    };
  }, [data]);

  return { connections, isLoading, refetch };
}
