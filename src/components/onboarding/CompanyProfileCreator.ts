
import { supabase } from "@/integrations/supabase/client";

export const createCompanyProfileFromOnboarding = async (onboardingData: any, userId: string) => {
  try {
    console.log('Creating company profile from onboarding data:', onboardingData);
    
    // Generate company profile using the existing edge function
    const { data: profileResponse, error: profileError } = await supabase.functions.invoke('generate-company-profile', {
      body: {
        aboutBusiness: onboardingData.aboutBusiness,
        toneSamples: onboardingData.toneSamples,
        annualEvents: onboardingData.annualEvents
      }
    });

    if (profileError) {
      console.error('Error generating company profile:', profileError);
      throw new Error('Failed to generate company profile');
    }

    const profileData = profileResponse.profileData;
    
    // Save the generated profile to the database
    const { data: savedProfile, error: saveError } = await supabase
      .from('company_profiles')
      .upsert({
        user_id: userId,
        ...profileData
      })
      .select()
      .single();

    if (saveError) {
      console.error('Error saving company profile:', saveError);
      throw new Error('Failed to save company profile');
    }

    console.log('Company profile created successfully:', savedProfile);
    return savedProfile;
  } catch (error) {
    console.error('Error creating company profile:', error);
    throw error;
  }
};

export const saveOnboardingResponse = async (onboardingData: any, userId: string) => {
  try {
    const { data, error } = await supabase
      .from('onboarding_responses')
      .upsert({
        user_id: userId,
        about_business: onboardingData.aboutBusiness,
        tone_samples: onboardingData.toneSamples,
        annual_events: onboardingData.annualEvents
      })
      .select()
      .single();

    if (error) {
      console.error('Error saving onboarding response:', error);
      throw error;
    }

    return data;
  } catch (error) {
    console.error('Error saving onboarding response:', error);
    throw error;
  }
};
