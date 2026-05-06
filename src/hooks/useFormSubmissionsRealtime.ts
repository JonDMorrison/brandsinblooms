import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { FormSubmission } from "@/types/formBuilder";

type ConnectionState = "connecting" | "live" | "offline";

type SubmissionFilterOptions = Pick<
  UseFormSubmissionsRealtimeOptions,
  "formId" | "tenantId"
>;

interface UseFormSubmissionsRealtimeOptions {
  enabled?: boolean;
  formId?: string;
  tenantId?: string;
  channelName: string;
  onSubmission?: (
    submission: FormSubmission,
    options: { animate: boolean },
  ) => void;
}

interface UseFormSubmissionsRealtimeResult {
  connectionState: ConnectionState;
  isLive: boolean;
  reconnect: () => void;
}

function buildFilter({ formId, tenantId }: SubmissionFilterOptions): string {
  return [`tenant_id=eq.${tenantId}`, `form_id=eq.${formId}`].join(",");
}

function toFormSubmission(row: Record<string, unknown>): FormSubmission {
  return {
    id: String(row.id),
    tenant_id: String(row.tenant_id),
    form_id: String(row.form_id),
    customer_id:
      typeof row.customer_id === "string" ? row.customer_id : undefined,
    data: (row.data as FormSubmission["data"]) || {},
    metadata:
      (row.metadata as FormSubmission["metadata"]) ||
      ({} as FormSubmission["metadata"]),
    ip_hash: typeof row.ip_hash === "string" ? row.ip_hash : undefined,
    result: row.result as FormSubmission["result"],
    reason: typeof row.reason === "string" ? row.reason : undefined,
    submitted_at: String(row.submitted_at),
  };
}

export function useFormSubmissionsRealtime({
  enabled = true,
  formId,
  tenantId,
  channelName,
  onSubmission,
}: UseFormSubmissionsRealtimeOptions): UseFormSubmissionsRealtimeResult {
  const [connectionState, setConnectionState] = useState<ConnectionState>(
    enabled ? "connecting" : "offline",
  );
  const [reconnectNonce, setReconnectNonce] = useState(0);
  const queuedSubmissionsRef = useRef<FormSubmission[]>([]);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const onSubmissionRef = useRef(onSubmission);

  useEffect(() => {
    onSubmissionRef.current = onSubmission;
  }, [onSubmission]);

  const reconnect = useCallback(() => {
    setConnectionState("connecting");
    setReconnectNonce((current) => current + 1);
  }, []);

  const filter = useMemo(() => {
    if (!enabled || !formId || !tenantId) {
      return null;
    }

    return buildFilter({
      formId,
      tenantId,
    });
  }, [enabled, formId, tenantId]);

  useEffect(() => {
    if (!enabled || !formId || !tenantId || !filter) {
      setConnectionState("offline");
      return;
    }

    let isMounted = true;

    const flushQueuedSubmissions = () => {
      const handleSubmission = onSubmissionRef.current;
      if (!queuedSubmissionsRef.current.length || !handleSubmission) {
        return;
      }

      const queuedSubmissions = [...queuedSubmissionsRef.current];
      queuedSubmissionsRef.current = [];
      queuedSubmissions.forEach((submission) =>
        handleSubmission(submission, { animate: false }),
      );
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        flushQueuedSubmissions();
      }
    };

    const createChannel = async () => {
      if (channelRef.current) {
        await supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }

      setConnectionState("connecting");

      const channel = supabase
        .channel(channelName)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "form_submissions",
            filter,
          } as never,
          (payload) => {
            const submission = toFormSubmission(
              payload.new as Record<string, unknown>,
            );

            if (document.visibilityState !== "visible") {
              queuedSubmissionsRef.current.push(submission);
              return;
            }

            onSubmissionRef.current?.(submission, { animate: true });
          },
        )
        .subscribe((status) => {
          if (!isMounted) {
            return;
          }

          if (status === "SUBSCRIBED") {
            setConnectionState("live");
            flushQueuedSubmissions();
            return;
          }

          if (
            status === "CHANNEL_ERROR" ||
            status === "TIMED_OUT" ||
            status === "CLOSED"
          ) {
            setConnectionState("offline");
          }
        });

      channelRef.current = channel;
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    void createChannel();

    return () => {
      isMounted = false;
      document.removeEventListener("visibilitychange", handleVisibilityChange);

      if (channelRef.current) {
        void supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }

      queuedSubmissionsRef.current = [];
    };
  }, [channelName, enabled, filter, formId, reconnectNonce, tenantId]);

  return {
    connectionState,
    isLive: connectionState === "live",
    reconnect,
  };
}
