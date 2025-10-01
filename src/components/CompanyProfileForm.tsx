
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Building } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

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
  const { toast } = useToast();
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
        // Auto-populate already attempted for this user
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
        // No onboarding data found - leaving fields blank for new user
        setIsAutoPopulating(false);
        return;
      }
      
      parsedOnboardingData = JSON.parse(onboardingData);
      
      // Only proceed if we have meaningful onboarding data (not just sample data)
      if (parsedOnboardingData.aboutBusiness && parsedOnboardingData.aboutBusiness.trim()) {
        // Auto-populating company profile from onboarding data
        
        const { data, error } = await supabase.functions.invoke('generate-company-profile', {
          body: {
            aboutBusiness: parsedOnboardingData.aboutBusiness,
            toneSamples: parsedOnboardingData.toneSamples,
            annualEvents: parsedOnboardingData.annualEvents
          }
        });

        if (error) {
          // Error generating profile
        } else if (data.profileData) {
          setFormData(data.profileData);
          
        }
      } else {
        // No meaningful onboarding data found - skipping auto-populate
      }
    } catch (error) {
      // Error in handleAutoPopulate
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
      // Only send columns that exist in company_profiles (exclude mission_statement)
      const payload = {
        user_id: user.id,
        company_name: formData.company_name || null,
        company_overview: formData.company_overview || null,
        brand_voice: formData.brand_voice || null,
        tone_of_writing: formData.tone_of_writing || null,
        target_audience: formData.target_audience || null,
        ideal_customer: formData.ideal_customer || null,
        unique_selling_points: formData.unique_selling_points || null,
        company_values: formData.company_values || null,
        seasonal_focus: formData.seasonal_focus || null,
        specializations: formData.specializations || null,
        location_info: formData.location_info || null,
      };

      let result;
      if (profile?.id) {
        // Update existing profile
        result = await supabase
          .from('company_profiles')
          .update(payload)
          .eq('id', profile.id)
          .select()
          .maybeSingle();
      } else {
        // Create new profile
        result = await supabase
          .from('company_profiles')
          .insert(payload)
          .select()
          .maybeSingle();
      }

      if (result.error) {
        console.error('Error saving profile:', result.error);
        toast({
          title: "Error saving profile",
          description: "Failed to update company profile. Please try again.",
          variant: "destructive"
        });
        return;
      }

      // If company name was updated, sync a friendly blurb in onboarding localStorage
      if (formData.company_name) {
        const onboardingKey = `garden-center-onboarding-${user.id}`;
        const existingData = localStorage.getItem(onboardingKey);
        if (existingData) {
          try {
            const parsedData = JSON.parse(existingData);
            parsedData.aboutBusiness = `${formData.company_name} has been serving the community with quality gardening products and expert advice.`;
            localStorage.setItem(onboardingKey, JSON.stringify(parsedData));
          } catch (error) {
            console.warn('Failed to sync onboarding storage:', error);
          }
        }
      }

      toast({
        title: "Profile updated successfully",
        description: "Your changes will be reflected in all future content generation.",
      });

      onProfileUpdate(result.data);
    } catch (error) {
      console.error('Unexpected error in handleSave:', error);
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
