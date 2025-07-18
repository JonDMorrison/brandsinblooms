
import React, { createContext, useContext, useEffect, useState, useMemo } from "react";
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

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isInLimboState, setIsInLimboState] = useState(false);

  // Detect limbo state (authenticated but stuck in redirect loops)
  useEffect(() => {
    const currentPath = window.location.pathname;
    const isOnPricingPage = currentPath === '/pricing';
    const hasUser = !!user;
    const hasSession = !!session;
    
    // Limbo state: user exists but on pricing page and not loading
    const limboDetected = hasUser && hasSession && isOnPricingPage && !loading;
    
    if (limboDetected !== isInLimboState) {
      console.log('🚨 Limbo state detection:', { 
        limboDetected, 
        hasUser, 
        hasSession, 
        isOnPricingPage, 
        loading 
      });
      setIsInLimboState(limboDetected);
    }
  }, [user, session, loading, isInLimboState]);

  useEffect(() => {
    let mounted = true;
    
    console.log('🔄 AuthProvider: Setting up auth state listeners');
    
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return;
        
        console.log('🔐 Auth state change:', { event, hasSession: !!session, hasUser: !!session?.user });
        
        // Clear any previous errors on state change
        setAuthError(null);
        setIsInLimboState(false);
        
        // Update state immediately
        setSession(session);
        setUser(session?.user ?? null);
        
        // Handle specific events
        if (event === 'INITIAL_SESSION' || event === 'SIGNED_OUT' || event === 'SIGNED_IN') {
          setLoading(false);
        }
        
        if (event === 'SIGNED_OUT') {
          console.log('👋 User signed out, clearing state');
          setUser(null);
          setSession(null);
          setAuthError(null);
          setIsInLimboState(false);
        }
        
        if (event === 'TOKEN_REFRESHED') {
          console.log('🔄 Token refreshed');
        }
        
        if (event === 'SIGNED_IN' && session?.user) {
          console.log('✅ User signed in successfully:', session.user.email);
          
          // Defer any additional data fetching to prevent deadlocks
          setTimeout(() => {
            console.log('📊 Auth state settled, ready for data fetching');
          }, 0);
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (!mounted) return;
      
      if (error) {
        console.error('❌ Error getting initial session:', error);
        setAuthError(error.message);
      } else {
        console.log('📋 Initial session check:', { hasSession: !!session, hasUser: !!session?.user });
      }
      
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => {
      mounted = false;
      console.log('🧹 AuthProvider: Cleaning up auth subscription');
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    try {
      console.log('🚪 AuthContext: Signing out user');
      setLoading(true);
      setAuthError(null);
      
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error('❌ Sign out error:', error);
        setAuthError(error.message);
        // Even if signout fails, force logout
        await forceLogout();
      } else {
        console.log('✅ Sign out successful');
        // Clear state immediately
        setUser(null);
        setSession(null);
        setIsInLimboState(false);
        // Redirect to auth page
        window.location.href = '/auth';
      }
    } catch (error) {
      console.error('❌ Error signing out:', error);
      setAuthError('Failed to sign out. Forcing logout...');
      await forceLogout();
    } finally {
      setLoading(false);
    }
  };

  const forceReset = async () => {
    try {
      console.log('🚨 AuthContext: Force reset triggered');
      setLoading(true);
      setAuthError(null);
      setIsInLimboState(false);
      
      // Clear all state immediately
      setUser(null);
      setSession(null);
      
      // Force logout and redirect
      await forceLogout();
    } catch (error) {
      console.error('❌ Force reset error:', error);
      // Even if force reset fails, try to redirect
      window.location.href = '/auth';
    }
  };

  const value = useMemo(() => ({
    user,
    session,
    loading,
    isAuthenticated: !!user && !!session,
    authError,
    isInLimboState,
    signOut,
    forceReset,
  }), [user, session, loading, authError, isInLimboState]);

  console.log('🔍 AuthProvider render:', { 
    hasUser: !!user, 
    hasSession: !!session, 
    loading, 
    authError,
    isInLimboState,
    currentPath: window.location.pathname 
  });

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
