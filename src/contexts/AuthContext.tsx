
import React, { createContext, useContext, useEffect, useState, useMemo } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isAuthenticated: boolean;
  signOut: () => Promise<void>;
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

  useEffect(() => {
    // Setting up auth state listeners
    
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        // Auth state changed
        
        setSession(session);
        setUser(session?.user ?? null);
        
        // Only set loading to false after we've processed the auth state
        if (event === 'INITIAL_SESSION' || event === 'SIGNED_OUT' || event === 'SIGNED_IN') {
          setLoading(false);
        }
        
        // Defer any additional data fetching to prevent deadlocks
        if (session?.user && event === 'SIGNED_IN') {
          setTimeout(() => {
            // User signed in successfully
          }, 0);
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error) {
        // Error getting session
      } else {
        // Initial session check
      }
      
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => {
      // Cleaning up auth subscription
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    try {
      // Signing out user
      setLoading(true);
      
      const { error } = await supabase.auth.signOut();
      if (error) {
        // Sign out error
      } else {
        // Sign out successful
      }
    } catch (error) {
      // Error signing out
    } finally {
      setLoading(false);
    }
  };

  const value = useMemo(() => ({
    user,
    session,
    loading,
    isAuthenticated: !!user,
    signOut,
  }), [user, session, loading]);

  // Current auth state

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
