
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Building } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { CompanyProfileFormFields } from "./company-profile/CompanyProfileFormFields";
import { CompanyProfileLoadingState } from "./company-profile/CompanyProfileLoadingState";
import { CompanyProfileFormActions } from "./company-profile/CompanyProfileFormActions";

interface CompanyProfileFormProps {
  profile: any;
  isEditing: boolean;
  onToggleEdit: () => void;
  onProfileUpdate: (profile: any) => void;
}

export const CompanyProfileForm = ({ profile, isEditing, onToggleEdit, onProfileUpdate }: CompanyProfileFormProps) => {
  const { user } = useAuth();
  const [formData, setFormData] = useState({
    company_name: '',
    company_overview: '',
    mission_statement: '',
    brand_voice: '',
    tone_of_writing: '',
    target_audience: '',
    ideal_customer: '',
    unique_selling_points: '',
    company_values: '',
    seasonal_focus: '',
    specializations: '',
    location_info: ''
  });
  const [isSaving, setIsSaving] = useState(false);
  const [isAutoPopulating, setIsAutoPopulating] = useState(false);

  useEffect(() => {
    if (profile) {
      setFormData({
        company_name: profile.company_name || '',
        company_overview: profile.company_overview || '',
        mission_statement: profile.mission_statement || '',
        brand_voice: profile.brand_voice || '',
        tone_of_writing: profile.tone_of_writing || '',
        target_audience: profile.target_audience || '',
        ideal_customer: profile.ideal_customer || '',
        unique_selling_points: profile.unique_selling_points || '',
        company_values: profile.company_values || '',
        seasonal_focus: profile.seasonal_focus || '',
        specializations: profile.specializations || '',
        location_info: profile.location_info || ''
      });
    }
  }, [profile]);

  // Separate effect for auto-populate logic that only runs once when no profile exists
  useEffect(() => {
    const shouldAutoPopulate = async () => {
      if (!user || profile !== null) return; // Don't run if profile exists or user not loaded
      
      // Check if we've already attempted auto-populate for this user
      const autoPopulateKey = `garden-center-autopopulated-${user.id}`;
      const hasAlreadyTriedAutoPopulate = localStorage.getItem(autoPopulateKey);
      
      if (hasAlreadyTriedAutoPopulate) {
        console.log('Auto-populate already attempted for this user');
        return;
      }

      await handleAutoPopulate();
      // Mark that we've attempted auto-populate for this user
      localStorage.setItem(autoPopulateKey, 'true');
    };

    shouldAutoPopulate();
  }, [user, profile]); // Only depend on user and profile

  const handleAutoPopulate = async () => {
    if (!user) return;

    setIsAutoPopulating(true);
    
    try {
      // Get onboarding data from localStorage - only use real user data
      let onboardingData = localStorage.getItem(`garden-center-onboarding-${user.id}`);
      let parsedOnboardingData;
      
      if (!onboardingData) {
        // No onboarding data exists - leave fields blank for new users
        console.log('No onboarding data found - leaving fields blank for new user');
        setIsAutoPopulating(false);
        return;
      }
      
      parsedOnboardingData = JSON.parse(onboardingData);
      
      // Only proceed if we have meaningful onboarding data (not just sample data)
      if (parsedOnboardingData.aboutBusiness && parsedOnboardingData.aboutBusiness.trim()) {
        console.log('Auto-populating company profile from onboarding data...');
        
        const { data, error } = await supabase.functions.invoke('generate-company-profile', {
          body: {
            aboutBusiness: parsedOnboardingData.aboutBusiness,
            toneSamples: parsedOnboardingData.toneSamples,
            annualEvents: parsedOnboardingData.annualEvents
          }
        });

        if (error) {
          console.error('Error generating profile:', error);
        } else if (data.profileData) {
          setFormData(data.profileData);
          toast.success('Company profile auto-populated based on your onboarding responses!');
        }
      } else {
        console.log('No meaningful onboarding data found - skipping auto-populate');
      }
    } catch (error) {
      console.error('Error in handleAutoPopulate:', error);
    } finally {
      setIsAutoPopulating(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSave = async () => {
    if (!user) return;

    setIsSaving(true);
    try {
      const profileData = {
        ...formData,
        user_id: user.id
      };

      let result;
      if (profile) {
        // Update existing profile
        result = await supabase
          .from('company_profiles')
          .update(profileData)
          .eq('id', profile.id)
          .select()
          .single();
      } else {
        // Create new profile
        result = await supabase
          .from('company_profiles')
          .insert(profileData)
          .select()
          .single();
      }

      if (result.error) {
        console.error('Error saving profile:', result.error);
        toast.error('Failed to save company profile');
        return;
      }

      toast.success('Company profile saved successfully');
      onProfileUpdate(result.data);
    } catch (error) {
      console.error('Error in handleSave:', error);
      toast.error('An unexpected error occurred');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    if (profile) {
      setFormData({
        company_name: profile.company_name || '',
        company_overview: profile.company_overview || '',
        mission_statement: profile.mission_statement || '',
        brand_voice: profile.brand_voice || '',
        tone_of_writing: profile.tone_of_writing || '',
        target_audience: profile.target_audience || '',
        ideal_customer: profile.ideal_customer || '',
        unique_selling_points: profile.unique_selling_points || '',
        company_values: profile.company_values || '',
        seasonal_focus: profile.seasonal_focus || '',
        specializations: profile.specializations || '',
        location_info: profile.location_info || ''
      });
    }
    onToggleEdit();
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-3 text-2xl">
          <Building className="w-6 h-6" />
          Company Information
        </CardTitle>
        <CompanyProfileFormActions
          isEditing={isEditing}
          isSaving={isSaving}
          onToggleEdit={onToggleEdit}
          onSave={handleSave}
          onCancel={handleCancel}
        />
      </CardHeader>
      <CardContent className="space-y-8">
        {isAutoPopulating ? (
          <CompanyProfileLoadingState />
        ) : (
          <CompanyProfileFormFields
            formData={formData}
            isEditing={isEditing}
            onInputChange={handleInputChange}
          />
        )}
      </CardContent>
    </Card>
  );
};
