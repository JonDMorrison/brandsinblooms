import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './AuthContext';

const STORAGE_KEY = 'admin_support_session';

export interface SupportSession {
  sessionId: string;
  tenantId: string;
  tenantName: string;
  reason: string;
  startedAt: string;
}

interface SupportSessionContextType {
  supportSession: SupportSession | null;
  isInSupportSession: boolean;
  isLoading: boolean;
  startSession: (tenantId: string, tenantName: string, reason: string) => Promise<void>;
  endSession: () => Promise<void>;
}

const SupportSessionContext = createContext<SupportSessionContextType | undefined>(undefined);

function readStoredSession(): SupportSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as SupportSession) : null;
  } catch {
    return null;
  }
}

function writeStoredSession(session: SupportSession | null): void {
  if (session) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } else {
    localStorage.removeItem(STORAGE_KEY);
  }
}

export const SupportSessionProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { user } = useAuth();
  const [supportSession, setSupportSession] = useState<SupportSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const initialised = useRef(false);

  // On mount (or when the user changes), restore the active session from the DB.
  // Fall back to localStorage so the UI is instantly consistent on reload.
  useEffect(() => {
    if (!user) {
      setSupportSession(null);
      writeStoredSession(null);
      setIsLoading(false);
      initialised.current = false;
      return;
    }

    // Show the locally-cached session immediately while we verify with the DB.
    const cached = readStoredSession();
    if (cached) setSupportSession(cached);

    let cancelled = false;

    async function restore() {
      setIsLoading(true);
      try {
        const { data, error } = await (supabase as any).rpc(
          'admin_get_active_support_session',
        );

        if (cancelled) return;

        if (error) {
          // User is likely not a master admin — clear any stale cached session.
          setSupportSession(null);
          writeStoredSession(null);
          return;
        }

        const row = Array.isArray(data) ? data[0] : null;
        if (row) {
          const session: SupportSession = {
            sessionId: row.session_id,
            tenantId: row.tenant_id,
            tenantName: row.tenant_name,
            reason: row.reason,
            startedAt: row.started_at,
          };
          setSupportSession(session);
          writeStoredSession(session);
        } else {
          setSupportSession(null);
          writeStoredSession(null);
        }
      } catch {
        // Not a master admin or network error — clear stale cache silently.
        if (!cancelled) {
          setSupportSession(null);
          writeStoredSession(null);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
      initialised.current = true;
    }

    void restore();

    return () => {
      cancelled = true;
    };
  }, [user]);

  const startSession = useCallback(
    async (tenantId: string, tenantName: string, reason: string) => {
      const { data: sessionId, error } = await (supabase as any).rpc(
        'admin_start_support_session',
        {
          p_tenant_id: tenantId,
          p_tenant_name: tenantName,
          p_reason: reason,
        },
      );

      if (error) throw new Error(error.message);

      const session: SupportSession = {
        sessionId: sessionId as string,
        tenantId,
        tenantName,
        reason,
        startedAt: new Date().toISOString(),
      };

      setSupportSession(session);
      writeStoredSession(session);
    },
    [],
  );

  const endSession = useCallback(async () => {
    if (!supportSession) return;

    const { error } = await (supabase as any).rpc('admin_end_support_session', {
      p_session_id: supportSession.sessionId,
    });

    if (error) throw new Error(error.message);

    setSupportSession(null);
    writeStoredSession(null);
  }, [supportSession]);

  return (
    <SupportSessionContext.Provider
      value={{
        supportSession,
        isInSupportSession: !!supportSession,
        isLoading,
        startSession,
        endSession,
      }}
    >
      {children}
    </SupportSessionContext.Provider>
  );
};

export const useSupportSession = (): SupportSessionContextType => {
  const context = useContext(SupportSessionContext);
  if (!context) {
    throw new Error('useSupportSession must be used within a SupportSessionProvider');
  }
  return context;
};
