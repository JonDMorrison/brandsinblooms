import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles, CheckCircle, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useTenant } from "@/hooks/useTenant";

interface FirstTimeUserWelcomeProps {
  onGetStarted: () => void;
  tasksCount: number;
}

export const FirstTimeUserWelcome = ({ onGetStarted, tasksCount }: FirstTimeUserWelcomeProps) => {
  const { user } = useAuth();
  const { tenant } = useTenant();
  const [isFirstTime, setIsFirstTime] = useState(false);
  const [companyName, setCompanyName] = useState("");

  useEffect(() => {
    const checkFirstTimeUser = async () => {
      if (!user) return;

      try {
        console.log('FirstTimeUserWelcome: Checking first time user status for user:', user.id, 'tenant:', tenant?.id || 'none');

        // Query company profile with tenant awareness
        let profileQuery = supabase
          .from('company_profiles')
          .select('first_content_generated, company_name, onboarding_completed_at, first_welcome_dismissed');

        if (tenant?.id) {
          // In tenant model, we might need to look for tenant-level settings
          // For now, we'll still check the user who created the tenant
          profileQuery = profileQuery.eq('user_id', user.id);
          console.log('FirstTimeUserWelcome: Using tenant-aware query for tenant:', tenant.id);
        } else {
          // User-based query
          profileQuery = profileQuery.eq('user_id', user.id);
          console.log('FirstTimeUserWelcome: Using user-based query for user:', user.id);
        }

        const { data: profile, error } = await profileQuery.maybeSingle();

        if (error) {
          console.error('Error checking first time user status:', error);
          return;
        }

        if (profile) {
          setCompanyName(profile.company_name || "Your Garden Center");
          
          // Show welcome if:
          // 1. They have content (tasksCount >= 5) AND
          // 2. They haven't dismissed the welcome AND
          // 3. Either they have first_content_generated OR completed onboarding recently
          const hasRecentOnboarding = profile.onboarding_completed_at && 
                                    new Date(profile.onboarding_completed_at) > new Date(Date.now() - 60 * 60 * 1000); // Within last hour
          
          const shouldShowWelcome = tasksCount >= 5 && 
                                  !profile.first_welcome_dismissed && 
                                  (profile.first_content_generated || hasRecentOnboarding);
          
          console.log('Welcome check:', {
            tasksCount,
            first_welcome_dismissed: profile.first_welcome_dismissed,
            first_content_generated: profile.first_content_generated,
            hasRecentOnboarding,
            shouldShowWelcome,
            tenant: tenant?.id || 'none'
          });
          
          setIsFirstTime(shouldShowWelcome);
        } else {
          // No profile found, check if we have content anyway (fallback)
          if (tasksCount >= 5) {
            setCompanyName("Your Garden Center");
            setIsFirstTime(true);
          }
        }
      } catch (error) {
        console.error('Error checking first time user status:', error);
      }
    };

    checkFirstTimeUser();
  }, [user, tenant, tasksCount]);

  const handleDismiss = async () => {
    setIsFirstTime(false);
    // Mark that they've seen the welcome
    if (user) {
      const { error } = await supabase
        .from('company_profiles')
        .update({ first_welcome_dismissed: true })
        .eq('user_id', user.id);
        
      if (error) {
        console.error('Error updating welcome dismissed status:', error);
      }
    }
  };

  if (!isFirstTime) return null;

  return (
    <Card className="mb-6 bg-white border-green-200 shadow-lg">
      <CardHeader className="pb-4 bg-white">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-12 h-12 bg-green-100 rounded-full">
            <Sparkles className="w-6 h-6 text-green-600" />
          </div>
          <div>
            <CardTitle className="text-2xl font-bold text-green-800 flex items-center gap-2">
              🌱 Welcome to BloomSuite, {companyName}!
            </CardTitle>
            <p className="text-green-700 mt-1">Your seasonal garden center content is ready to engage customers...</p>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4 bg-white">
        <div className="bg-white rounded-lg p-4 border border-green-200">
          <div className="flex items-center gap-3 mb-3">
            <CheckCircle className="w-6 h-6 text-green-600" />
            <h3 className="font-semibold text-gray-800">Your Seasonal Garden Center Content is Ready!</h3>
          </div>
          
          <p className="text-gray-600 mb-4">
            We've created {tasksCount} pieces of professional garden center marketing content featuring 
            seasonal plant care advice, gardening tips, and expert horticultural guidance tailored for your customers.
          </p>
          
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-4">
            {['Newsletter', 'Instagram', 'Facebook', 'Email', 'Video'].map((type) => (
              <div key={type} className="flex items-center gap-2 text-sm">
                <CheckCircle className="w-4 h-4 text-green-500" />
                <span className="text-gray-700">{type}</span>
              </div>
            ))}
          </div>
          
          <div className="bg-green-50 rounded-lg p-3 border border-green-200 mt-3">
            <p className="text-sm text-green-800 font-medium">
              🌿 Each piece includes seasonal gardening advice, plant care expertise, and content designed 
              to position your garden center as the trusted local gardening resource!
            </p>
          </div>
        </div>

        <div className="flex justify-center">
          <Button 
            onClick={onGetStarted}
            className="bg-green-600 hover:bg-green-700 text-white flex items-center gap-2 px-8 py-3 text-lg"
          >
            Review Your Garden Center Content
            <ArrowRight className="w-5 h-5" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
