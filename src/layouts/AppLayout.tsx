
import { ReactNode, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { SetupWizardModal } from "@/components/setup/SetupWizardModal";
import { ErrorBoundary } from "@/components/ErrorBoundary";

interface AppLayoutProps {
  children: ReactNode;
}

interface CompanyProfile {
  id: string;
  user_id: string;
  company_name: string | null;
  website_url: string | null;
  onboarding_completed_at: string | null;
  first_content_generated: boolean;
}

const fetchCompanyProfile = async (userId: string): Promise<CompanyProfile | null> => {
  const { data, error } = await supabase
    .from('company_profiles')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (error && error.code !== 'PGRST116') {
    throw error;
  }

  return data;
};

export const AppLayout = ({ children }: AppLayoutProps) => {
  const { user, loading: authLoading } = useAuth();

  const { 
    data: profile, 
    isLoading: profileLoading, 
    refetch: refetchProfile 
  } = useQuery({
    queryKey: ['company_profile', user?.id],
    queryFn: () => fetchCompanyProfile(user!.id),
    enabled: !!user?.id,
    refetchOnWindowFocus: false,
    staleTime: 60_000,
    retry: 1,
  });

  // If auth is still loading, show a simple loading state
  if (authLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const isOnboardingCompleted = profile?.onboarding_completed_at !== null;
  const shouldShowWizard = !profileLoading && !isOnboardingCompleted;

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-background">
        {/* Always render the main content immediately */}
        {children}
        
        {/* Show setup wizard modal if onboarding not completed */}
        {shouldShowWizard && (
          <SetupWizardModal 
            open={true} 
            onClose={() => {
              // Only allow close after completion
            }}
            onFinished={() => {
              refetchProfile();
            }}
          />
        )}
        
        {/* Show progress indicator in top-right if not completed */}
        {!profileLoading && !isOnboardingCompleted && (
          <div className="fixed top-4 right-4 z-40">
            <div className="bg-muted/80 backdrop-blur-sm text-sm px-3 py-1 rounded-full border">
              Setup in progress...
            </div>
          </div>
        )}
        
        {/* Show content import banner if analysis is running */}
        {!profileLoading && isOnboardingCompleted && profile?.website_url && !profile?.first_content_generated && (
          <div className="fixed top-0 left-0 right-0 z-30 bg-blue-50 border-b border-blue-200 px-4 py-2">
            <div className="text-center text-sm text-blue-800">
              🔄 We're importing content from your website... This won't slow you down!
            </div>
          </div>
        )}
      </div>
    </ErrorBoundary>
  );
};
