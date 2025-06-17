
import { createContext, useContext, useEffect, useState } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
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
    console.log('🔄 AuthProvider: Setting up auth state listeners');
    
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.log('🔄 AuthProvider: Auth state changed:', event, session?.user?.email);
        
        setSession(session);
        setUser(session?.user ?? null);
        
        // Only set loading to false after we've processed the auth state
        if (event === 'INITIAL_SESSION' || event === 'SIGNED_OUT' || event === 'SIGNED_IN') {
          setLoading(false);
        }
        
        // Defer any additional data fetching to prevent deadlocks
        if (session?.user && event === 'SIGNED_IN') {
          setTimeout(() => {
            console.log('✅ AuthProvider: User signed in successfully:', session.user.email);
          }, 0);
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error) {
        console.error('❌ AuthProvider: Error getting session:', error);
      } else {
        console.log('🔍 AuthProvider: Initial session check:', session?.user?.email || 'No session');
      }
      
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => {
      console.log('🧹 AuthProvider: Cleaning up auth subscription');
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    try {
      console.log('🚪 AuthProvider: Signing out user');
      setLoading(true);
      
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error('❌ AuthProvider: Sign out error:', error);
      } else {
        console.log('✅ AuthProvider: Sign out successful');
      }
    } catch (error) {
      console.error("❌ AuthProvider: Error signing out:", error);
    } finally {
      setLoading(false);
    }
  };

  const value = {
    user,
    session,
    loading,
    signOut,
  };

  console.log('🎯 AuthProvider: Current state - user:', user?.email || 'none', 'loading:', loading);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
