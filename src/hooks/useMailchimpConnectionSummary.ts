import { useQuery } from "@tanstack/react-query";

import { useAuth } from "@/contexts/AuthContext";
import { useTenant } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";

type MailchimpConnectionStateTone =
  | "success"
  | "neutral"
  | "warning"
  | "danger";

type MailchimpConnectionSummary = {
  accountId: string | null;
  accountName: string | null;
  connectedAt: string | null;
  connectionLabel: string;
  connectionStatus: string;
  hasConnection: boolean;
  isImportRunning: boolean;
  lastActivityAt: string | null;
  tone: MailchimpConnectionStateTone;
};

function asObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

function getMetadataText(metadata: unknown, keys: string[]) {
  const source = asObject(metadata);

  if (!source) {
    return null;
  }

  for (const key of keys) {
    const value = source[key];

    if (typeof value === "string" && value.trim().length > 0) {
      return value;
    }

    if (typeof value === "number" && Number.isFinite(value)) {
      return String(value);
    }
  }

  return null;
}

function getMailchimpConnectionPresentation(status?: string | null) {
  switch (status?.trim().toLowerCase()) {
    case "connected":
      return {
        label: "Connected",
        tone: "success" as const,
      };
    case "expired":
      return {
        label: "Expired",
        tone: "danger" as const,
      };
    case "revoked":
      return {
        label: "Revoked",
        tone: "warning" as const,
      };
    case "error":
      return {
        label: "Error",
        tone: "danger" as const,
      };
    case "pending":
      return {
        label: "Pending",
        tone: "neutral" as const,
      };
    default:
      return {
        label: "Not Connected",
        tone: "neutral" as const,
      };
  }
}

const DEFAULT_SUMMARY: MailchimpConnectionSummary = {
  accountId: null,
  accountName: null,
  connectedAt: null,
  connectionLabel: "Not Connected",
  connectionStatus: "not-connected",
  hasConnection: false,
  isImportRunning: false,
  lastActivityAt: null,
  tone: "neutral",
};

export function useMailchimpConnectionSummary() {
  const { user } = useAuth();
  const { tenant } = useTenant();

  const query = useQuery({
    queryKey: [
      "mailchimp-connection-summary",
      tenant?.id ?? null,
      user?.id ?? null,
    ],
    enabled: Boolean(tenant?.id && user?.id),
    queryFn: async (): Promise<MailchimpConnectionSummary> => {
      if (!tenant?.id || !user?.id) {
        return DEFAULT_SUMMARY;
      }

      const [connectionResponse, runningImportResponse] = await Promise.all([
        supabase
          .from("provider_connections")
          .select(
            "status, connected_at, updated_at, metadata, provider_account_id, provider_account_name",
          )
          .eq("tenant_id", tenant.id)
          .eq("provider", "mailchimp")
          .order("updated_at", { ascending: false })
          .order("connected_at", { ascending: false })
          .limit(1),
        supabase
          .from("import_jobs")
          .select("id, created_at, updated_at")
          .eq("tenant_id", tenant.id)
          .eq("provider", "mailchimp")
          .eq("status", "running")
          .order("updated_at", { ascending: false })
          .limit(1),
      ]);

      if (connectionResponse.error) {
        throw connectionResponse.error;
      }

      if (runningImportResponse.error) {
        throw runningImportResponse.error;
      }

      const connection = connectionResponse.data?.[0] ?? null;
      const runningImport = runningImportResponse.data?.[0] ?? null;
      const presentation = getMailchimpConnectionPresentation(
        connection?.status ?? null,
      );

      return {
        accountId:
          getMetadataText(connection?.metadata, ["account_id", "id"]) ??
          connection?.provider_account_id ??
          null,
        accountName:
          getMetadataText(connection?.metadata, [
            "accountname",
            "name",
            "organization_name",
          ]) ??
          connection?.provider_account_name ??
          null,
        connectedAt: connection?.connected_at ?? null,
        connectionLabel: presentation.label,
        connectionStatus: connection?.status ?? "not-connected",
        hasConnection: Boolean(connection),
        isImportRunning: Boolean(runningImport),
        lastActivityAt:
          runningImport?.updated_at ??
          runningImport?.created_at ??
          connection?.updated_at ??
          connection?.connected_at ??
          null,
        tone: presentation.tone,
      };
    },
  });

  return {
    data: query.data ?? DEFAULT_SUMMARY,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
  };
}
