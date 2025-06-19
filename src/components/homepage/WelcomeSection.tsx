
import { useState, useEffect } from 'react';
import { getSeasonalGreeting, getWelcomeMessage } from './SeasonalContent';
import { EditableBusinessName } from '@/components/EditableBusinessName';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { DisplayMedium, BodyLarge } from '@/components/ui/typography';
import { extractCompanyName } from '@/utils/companyNameUtils';
import { isSuperAdmin } from '@/utils/adminUtils';

interface WelcomeSectionProps {
  onboardingData: any;
  onBusinessNameChange: (newName: string) => void;
  onGetStarted?: () => void;
}

export const WelcomeSection = ({ onboardingData, onBusinessNameChange, onGetStarted }: WelcomeSectionProps) => {
  const { user } = useAuth();
  const [businessName, setBusinessName] = useState("Your Garden Center");
  const seasonal = getSeasonalGreeting();

  useEffect(() => {
    const fetchBusinessName = async () => {
      if (!user) return;

      // Check if current user is a super admin
      if (isSuperAdmin(user.email)) {
        console.log('WelcomeSection: User is super admin, setting admin-specific business name');
        setBusinessName("Admin Dashboard");
        return;
      }

      try {
        console.log('WelcomeSection: Fetching business name for user:', user.id);
        
        const { data: profile, error } = await supabase
          .from('company_profiles')
          .select('company_name')
          .eq('user_id', user.id)
          .maybeSingle();

        if (error) {
          console.error('WelcomeSection: Error fetching company profile:', error);
          console.error('WelcomeSection: Error details:', {
            code: error.code,
            message: error.message,
            details: error.details,
            hint: error.hint
          });
          
          // Continue with fallback logic instead of returning
        } else if (profile?.company_name) {
          console.log('WelcomeSection: Found company name in profile:', profile.company_name);
          setBusinessName(profile.company_name);
          return; // Exit early if we found the name
        } else {
          console.log('WelcomeSection: No company name in profile, trying onboarding data fallback');
        }

        // Fallback to extracting from onboarding data if no company profile exists or error occurred
        if (onboardingData?.aboutBusiness) {
          console.log('WelcomeSection: Extracting business name from onboarding data');
          const aboutText = onboardingData.aboutBusiness;
          
          // Use the new utility function for extraction
          const extractedName = extractCompanyName(aboutText);
          
          if (extractedName) {
            console.log('WelcomeSection: Extracted business name:', extractedName);
            setBusinessName(extractedName);
            
            // Try to save to company profile for future consistency
            try {
              await supabase
                .from('company_profiles')
                .upsert({
                  user_id: user.id,
                  company_name: extractedName
                }, {
                  onConflict: 'user_id'
                });
              console.log('WelcomeSection: Successfully saved extracted name to profile');
            } catch (saveError) {
              console.warn('WelcomeSection: Could not save extracted name to profile:', saveError);
              // Continue anyway - the name is still set locally
            }
          } else {
            console.log('WelcomeSection: Could not extract clean company name from onboarding data');
          }
        }
      } catch (error) {
        console.error('WelcomeSection: Unexpected error in fetchBusinessName:', error);
        // Keep default business name if everything fails
      }
    };

    fetchBusinessName();
  }, [user, onboardingData]);

  // Extract first name from user email and capitalize it properly
  const extractedName = user?.email?.split('@')[0]?.split('.')[0] || user?.email?.split('@')[0] || "there";
  const firstName = extractedName.charAt(0).toUpperCase() + extractedName.slice(1).toLowerCase();

  // Get the dynamic welcome message for today
  const welcomeMessage = getWelcomeMessage(businessName, firstName);

  const handleBusinessNameChange = (newName: string) => {
    setBusinessName(newName);
    onBusinessNameChange(newName);
  };

  // Don't show EditableBusinessName for super admins
  const isCurrentUserSuperAdmin = user?.email && isSuperAdmin(user.email);

  return (
    <div className="space-y-6 apple-fade-in">
      {/* Main Welcome */}
      <div className="text-center">
        <div className="flex items-center justify-center gap-3 mb-4 apple-slide-up">
          <span className="seasonal-emoji text-3xl apple-hover-subtle">{welcomeMessage.emoji || seasonal.emoji}</span>
          <DisplayMedium className="text-text-primary apple-text-glow">
            {welcomeMessage.text}
          </DisplayMedium>
        </div>
        <BodyLarge className="text-text-secondary mb-6 max-w-4xl mx-auto leading-relaxed apple-slide-up apple-stagger-1">
          {isCurrentUserSuperAdmin ? (
            <>
              Your super admin dashboard for managing the BloomSuite platform and all user accounts.
            </>
          ) : (
            <>
              Your AI-powered gardening assistant is ready to help you create engaging content that grows{' '}
              <EditableBusinessName 
                businessName={businessName}
                onBusinessNameChange={handleBusinessNameChange}
              />{' '}
              and cultivates customer relationships.
            </>
          )}
        </BodyLarge>
      </div>
    </div>
  );
};
