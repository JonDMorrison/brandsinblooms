
import { supabase } from "@/integrations/supabase/client";
import { generateRequiredTasks } from "@/components/homepage/RequiredTasksGenerator";

export const createCompanyProfileFromOnboarding = async (onboardingData: any, userId: string) => {
  console.log('🚀 Starting enhanced onboarding process for user:', userId);
  console.log('📋 Onboarding data received:', onboardingData);
  
  try {
    // STEP 1: Get or create tenant for the user
    console.log('🔧 STEP 1: Getting or creating tenant...');
    let tenant;
    
    try {
      const { data: existingUser, error: userError } = await supabase
        .from('users')
        .select('tenant_id, tenants(*)')
        .eq('id', userId)
        .maybeSingle();

      if (userError && userError.code !== 'PGRST116') {
        console.error('❌ Error fetching existing user:', userError);
        throw new Error(`Failed to check existing user: ${userError.message}`);
      }

      if (existingUser?.tenant_id && existingUser.tenants) {
        tenant = existingUser.tenants;
        console.log('✅ Using existing tenant:', tenant.id);
      } else {
        console.log('🔧 Creating new tenant...');
        
        // Get user info from auth for tenant creation
        const { data: authUser, error: authUserError } = await supabase.auth.getUser();
        
        if (authUserError || !authUser.user) {
          console.error('❌ Error getting auth user:', authUserError);
          throw new Error('Failed to get authenticated user information');
        }

        // Create a new tenant for this user
        const { data: newTenant, error: tenantError } = await supabase
          .from('tenants')
          .insert({
            name: onboardingData.aboutBusiness?.split('.')[0] || 'My Garden Center',
            slug: `tenant-${userId.slice(0, 8)}`,
            settings: {},
            is_active: true
          })
          .select()
          .single();

        if (tenantError) {
          console.error('❌ Error creating tenant:', tenantError);
          console.error('❌ Tenant error details:', {
            code: tenantError.code,
            message: tenantError.message,
            details: tenantError.details,
            hint: tenantError.hint
          });
          throw new Error(`Failed to create tenant: ${tenantError.message}`);
        }

        console.log('✅ Created new tenant:', newTenant.id);

        // Update/create user record in public.users table with tenant_id
        const { error: updateUserError } = await supabase
          .from('users')
          .upsert({
            id: userId,
            tenant_id: newTenant.id,
            email: authUser.user.email || '',
            name: authUser.user.user_metadata?.full_name || authUser.user.email?.split('@')[0] || 'User'
          });

        if (updateUserError) {
          console.error('❌ Error updating user with tenant_id:', updateUserError);
          throw new Error(`Failed to link user to tenant: ${updateUserError.message}`);
        }

        tenant = newTenant;
        console.log('✅ Successfully linked user to new tenant');
      }
    } catch (tenantError) {
      console.error('❌ Critical error in tenant creation/retrieval:', tenantError);
      throw new Error(`Tenant setup failed: ${tenantError.message}`);
    }

    // STEP 2: Generate company profile
    console.log('🔧 STEP 2: Generating company profile...');
    let profileData;
    
    try {
      const { data: profileResponse, error: profileError } = await supabase.functions.invoke('generate-company-profile', {
        body: {
          aboutBusiness: onboardingData.aboutBusiness,
          toneSamples: onboardingData.toneSamples,
          annualEvents: onboardingData.annualEvents
        }
      });

      if (profileError) {
        console.error('❌ Error generating company profile:', profileError);
        throw new Error(`Profile generation failed: ${profileError.message}`);
      }

      if (!profileResponse?.profileData) {
        console.error('❌ No profile data returned from edge function');
        throw new Error('Company profile generation returned no data');
      }

      profileData = profileResponse.profileData;
      console.log('✅ Successfully generated company profile');
    } catch (profileError) {
      console.error('❌ Critical error in profile generation:', profileError);
      throw new Error(`Profile generation failed: ${profileError.message}`);
    }
    
    // STEP 3: Save the generated profile to the database
    console.log('🔧 STEP 3: Saving company profile to database...');
    let savedProfile;
    
    try {
      const { data: newProfile, error: saveError } = await supabase
        .from('company_profiles')
        .upsert({
          user_id: userId,
          ...profileData
        })
        .select()
        .single();

      if (saveError) {
        console.error('❌ Error saving company profile:', saveError);
        throw new Error(`Failed to save profile: ${saveError.message}`);
      }

      savedProfile = newProfile;
      console.log('✅ Company profile saved successfully:', savedProfile.id);
    } catch (saveError) {
      console.error('❌ Critical error saving profile:', saveError);
      throw new Error(`Profile save failed: ${saveError.message}`);
    }

    // STEP 4: Create immediate campaign for current week
    console.log('🔧 STEP 4: Creating immediate campaign...');
    let immediateCampaign;
    
    try {
      const getCurrentWeekNumber = () => {
        const today = new Date();
        const firstDayOfYear = new Date(today.getFullYear(), 0, 1);
        const pastDaysOfYear = (today.getTime() - firstDayOfYear.getTime()) / 86400000;
        return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
      };

      const currentWeek = getCurrentWeekNumber();
      console.log('🎯 Creating campaign for week:', currentWeek);
      
      const immediateStartDate = new Date();
      const campaignData = {
        week_number: currentWeek,
        title: `Week ${currentWeek} Garden Center Theme`,
        theme: `Seasonal Gardening Focus - Week ${currentWeek}`,
        description: 'AI-generated weekly theme for your garden center marketing',
        start_date: immediateStartDate.toISOString().split('T')[0],
        prompt: 'Create engaging content focused on current seasonal gardening needs and trends',
        user_id: userId,
        tenant_id: tenant.id,
        source: 'onboarding_immediate'
      };

      const { data: campaignResult, error: campaignError } = await supabase
        .from('campaigns')
        .insert(campaignData)
        .select()
        .single();

      if (campaignError) {
        console.error('❌ Error creating immediate campaign:', campaignError);
        throw new Error(`Campaign creation failed: ${campaignError.message}`);
      }

      immediateCampaign = campaignResult;
      console.log('✅ Created immediate campaign:', immediateCampaign.title, 'ID:', immediateCampaign.id);
    } catch (campaignError) {
      console.error('❌ Critical error creating campaign:', campaignError);
      throw new Error(`Campaign creation failed: ${campaignError.message}`);
    }

    // STEP 5: Generate content for the immediate campaign
    console.log('🔧 STEP 5: Generating content for immediate campaign...');
    
    try {
      const dummyTaskUpdate = () => {
        console.log('📋 Task update during onboarding content generation');
      };
      
      await generateRequiredTasks(
        immediateCampaign.id, 
        [immediateCampaign], 
        userId, 
        dummyTaskUpdate,
        tenant.id
      );
      
      console.log('🎉 IMMEDIATE CONTENT GENERATED! User will see ready content on dashboard');
      
      // Verify content was created
      const { data: verifyContent, error: verifyError } = await supabase
        .from('content_tasks')
        .select('id, post_type, status, tenant_id')
        .eq('campaign_id', immediateCampaign.id)
        .eq('tenant_id', tenant.id);

      if (verifyError) {
        console.error('⚠️ Error verifying generated content:', verifyError);
      } else {
        console.log('✅ Content verification - Generated tasks:', verifyContent?.length || 0, 'for tenant:', tenant.id);
      }
      
    } catch (contentError) {
      console.error('⚠️ Error generating immediate content during onboarding:', contentError);
      // Don't throw here - profile creation was successful, content generation is secondary
      console.log('⚠️ Continuing with onboarding despite content generation issue');
    }

    // STEP 6: Generate 52-week collection (optional, non-blocking)
    console.log('🔧 STEP 6: Generating 52-week theme collection (background)...');
    
    try {
      const { data: themesData, error: themesError } = await supabase.functions.invoke('generate-weekly-themes', {
        body: { 
          userId: userId,
          generateAll52Weeks: true
        }
      });

      if (themesError) {
        console.error('⚠️ Error generating 52-week themes:', themesError);
      } else if (themesData?.themes && Array.isArray(themesData.themes)) {
        const currentWeek = getCurrentWeekNumber();
        const remainingThemes = themesData.themes.filter(theme => theme.week !== currentWeek);
        
        if (remainingThemes.length > 0) {
          const futureCampaigns = remainingThemes.map((theme: any) => {
            const startDate = new Date();
            startDate.setDate(startDate.getDate() + ((theme.week - currentWeek) * 7));
            
            return {
              week_number: theme.week,
              title: theme.title,
              theme: theme.title,
              description: theme.description,
              start_date: startDate.toISOString().split('T')[0],
              prompt: theme.content_ideas.join(' • '),
              user_id: userId,
              tenant_id: tenant.id,
              source: 'auto_generated_52_weeks'
            };
          });

          const { data: createdFutureCampaigns, error: futureCampaignError } = await supabase
            .from('campaigns')
            .insert(futureCampaigns)
            .select();

          if (futureCampaignError) {
            console.error('⚠️ Error saving future campaigns:', futureCampaignError);
          } else {
            console.log(`✅ Successfully created ${futureCampaigns.length} future campaigns`);
          }
        }
      }
    } catch (themeError) {
      console.error('⚠️ Error in 52-week theme generation (non-critical):', themeError);
      // Don't throw - this is optional background work
    }

    // STEP 7: Mark onboarding as completed
    console.log('🔧 STEP 7: Marking onboarding as completed...');
    
    try {
      const { error: updateError } = await supabase
        .from('company_profiles')
        .update({ 
          first_content_generated: true,
          onboarding_completed_at: new Date().toISOString()
        })
        .eq('user_id', userId);
        
      if (updateError) {
        console.error('⚠️ Error updating onboarding completion status:', updateError);
        // Don't throw - the main process succeeded
      } else {
        console.log('✅ Onboarding marked as completed');
      }
    } catch (completionError) {
      console.error('⚠️ Error marking onboarding complete (non-critical):', completionError);
    }

    console.log('🎉 ONBOARDING COMPLETED SUCCESSFULLY!');
    console.log('📊 Final summary:', {
      userId,
      tenantId: tenant.id,
      profileId: savedProfile.id,
      campaignId: immediateCampaign.id,
      profileCreated: !!savedProfile,
      campaignCreated: !!immediateCampaign
    });
    
    return savedProfile;
    
  } catch (error) {
    console.error('🚨 CRITICAL ONBOARDING ERROR:', error);
    console.error('🚨 Error details:', {
      name: error.name,
      message: error.message,
      stack: error.stack
    });
    
    // Re-throw with more context
    throw new Error(`Onboarding failed: ${error.message}`);
  }
};

const getCurrentWeekNumber = () => {
  const today = new Date();
  const firstDayOfYear = new Date(today.getFullYear(), 0, 1);
  const pastDaysOfYear = (today.getTime() - firstDayOfYear.getTime()) / 86400000;
  return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
};

export const saveOnboardingResponse = async (onboardingData: any, userId: string) => {
  console.log('💾 Saving onboarding response for user:', userId);
  
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
      console.error('❌ Error saving onboarding response:', error);
      throw new Error(`Failed to save onboarding data: ${error.message}`);
    }

    console.log('✅ Onboarding response saved successfully');
    return data;
  } catch (error) {
    console.error('❌ Critical error saving onboarding response:', error);
    throw error;
  }
};
