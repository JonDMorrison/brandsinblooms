
import { useState, useEffect } from 'react';
import { getSeasonalGreeting, getWelcomeMessage } from './SeasonalContent';
import { EditableBusinessName } from '@/components/EditableBusinessName';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

interface WelcomeSectionProps {
  onboardingData: any;
  onBusinessNameChange: (newName: string) => void;
  onGetStarted?: () => void;
}

export const WelcomeSection = ({ onboardingData, onBusinessNameChange, onGetStarted }: WelcomeSectionProps) => {
  const { user } = useAuth();
  const [businessName, setBusinessName] = useState("Your Garden Center");
  const seasonal = getSeasonalGreeting();

  // Fetch business name from company profile (authoritative source)
  useEffect(() => {
    const fetchBusinessName = async () => {
      if (!user) return;

      try {
        const { data: profile, error } = await supabase
          .from('company_profiles')
          .select('company_name')
          .eq('user_id', user.id)
          .maybeSingle();

        if (error) {
          console.error('Error fetching company profile:', error);
          return;
        }

        if (profile?.company_name) {
          setBusinessName(profile.company_name);
        } else {
          // Fallback to extracting from onboarding data if no company profile exists
          if (onboardingData?.aboutBusiness) {
            const aboutText = onboardingData.aboutBusiness;
            const firstSentence = aboutText.split('.')[0];
            
            const nameMatch = firstSentence.match(/^([^,]+?)(?:\s+(?:has been|is|provides|offers|specializes))/);
            if (nameMatch) {
              const extractedName = nameMatch[1].trim();
              setBusinessName(extractedName);
              
              // Save to company profile for future consistency
              await supabase
                .from('company_profiles')
                .upsert({
                  user_id: user.id,
                  company_name: extractedName
                }, {
                  onConflict: 'user_id'
                });
            } else if (firstSentence.length < 50) {
              const extractedName = firstSentence.trim();
              setBusinessName(extractedName);
              
              // Save to company profile
              await supabase
                .from('company_profiles')
                .upsert({
                  user_id: user.id,
                  company_name: extractedName
                }, {
                  onConflict: 'user_id'
                });
            }
          }
        }
      } catch (error) {
        console.error('Error in fetchBusinessName:', error);
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

  return (
    <div className="space-y-6">
      {/* Main Welcome */}
      <div className="text-center">
        <div className="flex items-center justify-center gap-3 mb-4">
          <span className="seasonal-emoji text-3xl">{welcomeMessage.emoji || seasonal.emoji}</span>
          <h1 className="text-4xl font-bold text-black">
            {welcomeMessage.text}
          </h1>
        </div>
        <p className="text-lg text-gray-700 mb-6">
          Your AI-powered gardening assistant is ready to help you create engaging content that grows{' '}
          <EditableBusinessName 
            businessName={businessName}
            onBusinessNameChange={handleBusinessNameChange}
          />{' '}
          and cultivates customer relationships.
        </p>
      </div>
    </div>
  );
};
