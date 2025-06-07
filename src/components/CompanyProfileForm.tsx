
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
  const [hasAutoPopulated, setHasAutoPopulated] = useState(false);
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
    } else if (!hasAutoPopulated) {
      // Auto-populate if no profile exists and we haven't done it yet
      handleAutoPopulate();
    }
  }, [profile, hasAutoPopulated]);

  const handleAutoPopulate = async () => {
    if (!user || hasAutoPopulated) return;

    setIsAutoPopulating(true);
    
    try {
      // Get onboarding data from localStorage, or use sample Minter Gardening data
      let onboardingData = localStorage.getItem(`garden-center-onboarding-${user.id}`);
      let parsedOnboardingData;
      
      if (!onboardingData) {
        // Use sample Minter Gardening data for demonstration
        parsedOnboardingData = {
          aboutBusiness: "Minter Country Garden has been serving our community for 25 years as a family-run business dedicated to helping both novice and experienced gardeners create the garden of their dreams. We offer a wide variety of plants, from edible gardens to drought-tolerant options, and pride ourselves on providing expert advice and quality products that promote harmony with nature.",
          toneSamples: "Welcome to spring at Minter Country Garden! 🌱 Whether you're a seasoned green thumb or just starting your gardening journey, we're here to help you bloom where you're planted. Our friendly staff loves sharing tips and tricks to help your garden thrive. From pet-friendly plants to low-maintenance beauties, we've got something special waiting for every garden lover. Stop by and let's grow something amazing together!",
          annualEvents: "Spring Garden Festival (March) - Our biggest event featuring new arrivals, expert workshops, and special pricing. Mother's Day Flower Extravaganza (May) - Beautiful hanging baskets and potted arrangements. Father's Day Garden Tools & Grilling Plants (June) - Herb gardens and outdoor living plants. Halloween Harvest Decorations (October) - Pumpkins, mums, and fall decorating supplies. Holiday Evergreen & Wreath Workshop (December) - Fresh wreaths and holiday arrangements."
        };
        
        // Store this sample data so it appears in the preview
        localStorage.setItem(`garden-center-onboarding-${user.id}`, JSON.stringify(parsedOnboardingData));
        console.log('Using sample Minter Gardening data for demonstration');
      } else {
        parsedOnboardingData = JSON.parse(onboardingData);
      }

      const { data, error } = await supabase.functions.invoke('generate-company-profile', {
        body: {
          aboutBusiness: parsedOnboardingData.aboutBusiness,
          toneSamples: parsedOnboardingData.toneSamples,
          annualEvents: parsedOnboardingData.annualEvents
        }
      });

      if (error) {
        console.error('Error generating profile:', error);
        setHasAutoPopulated(true);
        return;
      }

      if (data.profileData) {
        setFormData(data.profileData);
        toast.success('Company profile auto-populated based on your onboarding responses!');
      }
    } catch (error) {
      console.error('Error in handleAutoPopulate:', error);
    } finally {
      setHasAutoPopulated(true);
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
