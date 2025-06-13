
import { supabase } from "@/integrations/supabase/client";
import { generateRequiredTasks } from "@/components/homepage/RequiredTasksGenerator";

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

    // Calculate current week number
    const getCurrentWeekNumber = () => {
      const today = new Date();
      const firstDayOfYear = new Date(today.getFullYear(), 0, 1);
      const pastDaysOfYear = (today.getTime() - firstDayOfYear.getTime()) / 86400000;
      return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
    };

    const currentWeek = getCurrentWeekNumber();

    // Automatically generate 52-week themes starting from current week
    try {
      console.log('🎯 Auto-generating 52-week garden center themes starting from current week...');
      
      const { data: themesData, error: themesError } = await supabase.functions.invoke('generate-weekly-themes', {
        body: { 
          userId: userId,
          startYear: new Date().getFullYear(),
          startFromCurrentWeek: true
        }
      });

      if (themesError) {
        console.error('Error auto-generating themes:', themesError);
        // Don't throw here - profile creation was successful, themes are optional
      } else if (themesData?.themes && Array.isArray(themesData.themes)) {
        
        // Save themes starting from current week
        const campaigns = themesData.themes.map((theme: any, index: number) => {
          const startDate = new Date();
          startDate.setDate(startDate.getDate() + (index * 7));
          
          // Calculate actual week number (wrapping around year if necessary)
          const actualWeekNumber = ((currentWeek - 1 + index) % 52) + 1;
          
          return {
            week_number: actualWeekNumber,
            title: theme.title,
            theme: theme.title,
            description: theme.description,
            start_date: startDate.toISOString().split('T')[0],
            prompt: theme.content_ideas.join(' • '),
            user_id: userId
          };
        });

        const { data: createdCampaigns, error: campaignError } = await supabase
          .from('campaigns')
          .insert(campaigns)
          .select();

        if (campaignError) {
          console.error('Error saving auto-generated campaigns:', campaignError);
        } else {
          console.log(`✅ Successfully auto-generated ${themesData.themes.length} weekly garden center themes starting from week ${currentWeek}`);
          
          // 🚀 NEW: Automatically generate content for the FIRST week to create amazing first impression
          if (createdCampaigns && createdCampaigns.length > 0) {
            const firstWeekCampaign = createdCampaigns[0]; // This is the current week's campaign
            
            console.log('🎯 Auto-generating FIRST WEEK content for immediate wow factor:', firstWeekCampaign.title);
            
            try {
              // Create a dummy callback function for onTaskUpdate since we're in onboarding
              const dummyTaskUpdate = () => {
                console.log('Task update during onboarding');
              };
              
              // Generate all 5 content pieces for the first week
              await generateRequiredTasks(
                firstWeekCampaign.id, 
                createdCampaigns, 
                userId, 
                dummyTaskUpdate
              );
              
              console.log('🎉 FIRST WEEK CONTENT GENERATED! User will see 5 ready posts on dashboard');
              
              // Mark this user as having completed their first onboarding content generation
              const { error: updateError } = await supabase
                .from('company_profiles')
                .update({ 
                  first_content_generated: true,
                  onboarding_completed_at: new Date().toISOString()
                })
                .eq('user_id', userId);
                
              if (updateError) {
                console.error('Error updating first content generated status:', updateError);
              }
                
            } catch (contentError) {
              console.error('Error generating first week content during onboarding:', contentError);
              // Don't throw - profile and themes were successful
            }
          }
        }
      }
    } catch (themeError) {
      console.error('Error in theme auto-generation:', themeError);
      // Continue - profile creation was successful
    }
    
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
