import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { fetchBloomsuiteApps, type BloomsuiteApp } from "@/integrations/bloomsuite/session";

export type BloomsuiteAppsState = { status: "idle" | "loading" | "ready" | "error"; apps: BloomsuiteApp[] };

/**
 * The app switcher's list for a BloomSuite session, loaded the first time the account menu opens and kept for
 * that session. Unlinked sessions never ask.
 */
export function useBloomsuiteApps(enabled: boolean, sessionKey: string | null): BloomsuiteAppsState {
  const [state, setState] = useState<BloomsuiteAppsState>({ status: "idle", apps: [] });
  const requestedFor = useRef<string | null>(null);

  useEffect(() => {
    if (!enabled || !sessionKey || requestedFor.current === sessionKey) return;
    requestedFor.current = sessionKey;
    setState({ status: "loading", apps: [] });
    fetchBloomsuiteApps(supabase)
      .then((apps) => {
        if (requestedFor.current === sessionKey) setState({ status: "ready", apps });
      })
      .catch(() => {
        if (requestedFor.current === sessionKey) setState({ status: "error", apps: [] });
      });
  }, [enabled, sessionKey]);

  return state;
}
