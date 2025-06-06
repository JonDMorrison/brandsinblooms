import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Edit, Save, X, Building } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

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

  useEffect(() => {
    if (profile) {
      setFormData({
        company_name: profile.company_name || '',
        company_overview: profile.company_overview || '',
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
        <div className="flex gap-2">
          {isEditing ? (
            <>
              <Button variant="outline" size="sm" onClick={handleCancel} className="text-base">
                <X className="w-4 h-4 mr-2" />
                Cancel
              </Button>
              <Button size="sm" onClick={handleSave} disabled={isSaving} className="text-base">
                <Save className="w-4 h-4 mr-2" />
                {isSaving ? 'Saving...' : 'Save'}
              </Button>
            </>
          ) : (
            <Button variant="outline" size="sm" onClick={onToggleEdit} className="text-base">
              <Edit className="w-4 h-4 mr-2" />
              Edit
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-8">
        <div className="grid grid-cols-1 gap-6">
          <div>
            <Label htmlFor="company_name" className="text-lg font-semibold">Company Name</Label>
            <Input
              id="company_name"
              placeholder="Your garden center name"
              value={formData.company_name}
              onChange={(e) => handleInputChange('company_name', e.target.value)}
              disabled={!isEditing}
              className="text-lg p-4 h-12"
            />
          </div>

          <div>
            <Label htmlFor="company_overview" className="text-lg font-semibold">Company Overview</Label>
            <Textarea
              id="company_overview"
              placeholder="Brief description of your garden center, what you do, and what makes you special"
              value={formData.company_overview}
              onChange={(e) => handleInputChange('company_overview', e.target.value)}
              disabled={!isEditing}
              rows={4}
              className="text-lg p-4"
            />
          </div>

          <div>
            <Label htmlFor="brand_voice" className="text-lg font-semibold">Brand Voice</Label>
            <Textarea
              id="brand_voice"
              placeholder="How your brand speaks (e.g., friendly and approachable, expert and authoritative, warm and family-oriented)"
              value={formData.brand_voice}
              onChange={(e) => handleInputChange('brand_voice', e.target.value)}
              disabled={!isEditing}
              rows={3}
              className="text-lg p-4"
            />
          </div>

          <div>
            <Label htmlFor="tone_of_writing" className="text-lg font-semibold">Tone of Writing</Label>
            <Textarea
              id="tone_of_writing"
              placeholder="Describe your preferred writing style (e.g., casual and conversational, professional but warm, educational and helpful)"
              value={formData.tone_of_writing}
              onChange={(e) => handleInputChange('tone_of_writing', e.target.value)}
              disabled={!isEditing}
              rows={3}
              className="text-lg p-4"
            />
          </div>

          <div>
            <Label htmlFor="target_audience" className="text-lg font-semibold">Target Audience</Label>
            <Textarea
              id="target_audience"
              placeholder="Who are your main customers? (e.g., home gardeners, landscape professionals, plant enthusiasts)"
              value={formData.target_audience}
              onChange={(e) => handleInputChange('target_audience', e.target.value)}
              disabled={!isEditing}
              rows={3}
              className="text-lg p-4"
            />
          </div>

          <div>
            <Label htmlFor="ideal_customer" className="text-lg font-semibold">Ideal Customer Profile</Label>
            <Textarea
              id="ideal_customer"
              placeholder="Detailed description of your perfect customer (demographics, interests, gardening experience level)"
              value={formData.ideal_customer}
              onChange={(e) => handleInputChange('ideal_customer', e.target.value)}
              disabled={!isEditing}
              rows={3}
              className="text-lg p-4"
            />
          </div>

          <div>
            <Label htmlFor="unique_selling_points" className="text-lg font-semibold">Unique Selling Points</Label>
            <Textarea
              id="unique_selling_points"
              placeholder="What sets you apart from other garden centers? (e.g., expert advice, rare plants, local focus)"
              value={formData.unique_selling_points}
              onChange={(e) => handleInputChange('unique_selling_points', e.target.value)}
              disabled={!isEditing}
              rows={3}
              className="text-lg p-4"
            />
          </div>

          <div>
            <Label htmlFor="company_values" className="text-lg font-semibold">Company Values</Label>
            <Textarea
              id="company_values"
              placeholder="Core values that drive your business (e.g., sustainability, community support, quality)"
              value={formData.company_values}
              onChange={(e) => handleInputChange('company_values', e.target.value)}
              disabled={!isEditing}
              rows={3}
              className="text-lg p-4"
            />
          </div>

          <div>
            <Label htmlFor="seasonal_focus" className="text-lg font-semibold">Seasonal Focus</Label>
            <Textarea
              id="seasonal_focus"
              placeholder="Key seasonal events, promotions, or focuses throughout the year"
              value={formData.seasonal_focus}
              onChange={(e) => handleInputChange('seasonal_focus', e.target.value)}
              disabled={!isEditing}
              rows={3}
              className="text-lg p-4"
            />
          </div>

          <div>
            <Label htmlFor="specializations" className="text-lg font-semibold">Specializations</Label>
            <Textarea
              id="specializations"
              placeholder="Areas of expertise (e.g., native plants, organic gardening, landscaping, indoor plants)"
              value={formData.specializations}
              onChange={(e) => handleInputChange('specializations', e.target.value)}
              disabled={!isEditing}
              rows={3}
              className="text-lg p-4"
            />
          </div>

          <div>
            <Label htmlFor="location_info" className="text-lg font-semibold">Location Information</Label>
            <Textarea
              id="location_info"
              placeholder="Location details, climate zone, local growing conditions, community context"
              value={formData.location_info}
              onChange={(e) => handleInputChange('location_info', e.target.value)}
              disabled={!isEditing}
              rows={3}
              className="text-lg p-4"
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
