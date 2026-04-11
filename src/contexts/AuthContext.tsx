import * as React from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase, forceLogout } from "@/integrations/supabase/client";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isAuthenticated: boolean;
  authError: string | null;
  isInLimboState: boolean;
  signOut: () => Promise<void>;
  forceReset: () => Promise<void>;
}

const AuthContext = React.createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = React.useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  if (!React || !React.useState) {
    console.error("❌ React or useState is not available!");
    return <div>React Error: Please refresh the page</div>;
  }

  const [user, setUser] = React.useState<User | null>(null);
  const [session, setSession] = React.useState<Session | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [authError, setAuthError] = React.useState<string | null>(null);
  const [isInLimboState, setIsInLimboState] = React.useState(false);

  // Detect limbo state (authenticated but stuck in redirect loops)
  React.useEffect(() => {
    const currentPath = window.location.pathname;
    const isOnPricingPage = currentPath === "/pricing";
    const hasUser = !!user;
    const hasSession = !!session;

    // Limbo state: user exists but on pricing page and not loading
    const limboDetected = hasUser && hasSession && isOnPricingPage && !loading;

    if (limboDetected !== isInLimboState) {
      setIsInLimboState(limboDetected);
    }
  }, [user, session, loading, isInLimboState]);

  React.useEffect(() => {
    let mounted = true;
    // Set up auth state listener FIRST
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;
      // Clear any previous errors on state change
      setAuthError(null);
      setIsInLimboState(false);

      // Update state immediately
      setSession(session);
      setUser(session?.user ?? null);

      // Handle specific events
      if (
        event === "INITIAL_SESSION" ||
        event === "SIGNED_OUT" ||
        event === "SIGNED_IN"
      ) {
        setLoading(false);
      }

      if (event === "SIGNED_OUT") {
        setUser(null);
        setSession(null);
        setAuthError(null);
        setIsInLimboState(false);
      }

      if (event === "TOKEN_REFRESHED") {
        setLoading(false);
      }
    });

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (!mounted) return;

      if (error) {
        console.error("❌ Error getting initial session:", error);
        setAuthError(error.message);
      }

      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    try {
      setLoading(true);
      setAuthError(null);

      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error("❌ Sign out error:", error);
        setAuthError(error.message);
        // Even if signout fails, force logout
        await forceLogout();
      } else {
        // Clear state immediately
        setUser(null);
        setSession(null);
        setIsInLimboState(false);
        // Redirect to auth page
        window.location.href = "/auth";
      }
    } catch (error) {
      console.error("❌ Error signing out:", error);
      setAuthError("Failed to sign out. Forcing logout...");
      await forceLogout();
    } finally {
      setLoading(false);
    }
  };

  const forceReset = async () => {
    try {
      setLoading(true);
      setAuthError(null);
      setIsInLimboState(false);

      // Clear all state immediately
      setUser(null);
      setSession(null);

      // Force logout and redirect
      await forceLogout();
    } catch (error) {
      console.error("❌ Force reset error:", error);
      // Even if force reset fails, try to redirect
      window.location.href = "/auth";
    }
  };

  const value = React.useMemo(
    () => ({
      user,
      session,
      loading,
      isAuthenticated: !!user && !!session,
      authError,
      isInLimboState,
      signOut,
      forceReset,
    }),
    [user, session, loading, authError, isInLimboState],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
