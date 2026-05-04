import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { hasPersistedAuthState } from "@/integrations/supabase/client";

interface RecoveryRouteProps {
  children: React.ReactNode;
}

const AUTH_REHYDRATION_GRACE_MS = 5000;

export const RecoveryRoute = ({ children }: RecoveryRouteProps) => {
  const { user, loading, isRecoveryMode } = useAuth();
  const [isAwaitingRehydration, setIsAwaitingRehydration] = useState(false);
  const hasPersistedSession = !user && hasPersistedAuthState();

  useEffect(() => {
    if (!user && hasPersistedSession) {
      setIsAwaitingRehydration(true);

      const timerId = window.setTimeout(() => {
        setIsAwaitingRehydration(false);
      }, AUTH_REHYDRATION_GRACE_MS);

      return () => window.clearTimeout(timerId);
    }

    setIsAwaitingRehydration(false);
  }, [user, hasPersistedSession]);

  if (loading || isAwaitingRehydration) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-garden-background">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-primary font-medium">Loading...</p>
        </div>
      </div>
    );
  }

  if (user && !isRecoveryMode) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};
