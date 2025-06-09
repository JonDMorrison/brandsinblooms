
import { useState, useEffect } from "react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { CompanyProfileForm } from "@/components/CompanyProfileForm";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Save, ArrowLeft } from "lucide-react";

export const CompanyProfilePage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (user) {
      fetchProfile();
    }
  }, [user]);

  const fetchProfile = async () => {
    try {
      const { data, error } = await supabase
        .from('company_profiles')
        .select('*')
        .eq('user_id', user?.id)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching profile:', error);
        toast.error('Failed to load company profile');
        return;
      }

      setProfile(data);
    } catch (error) {
      console.error('Error in fetchProfile:', error);
      toast.error('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleProfileUpdate = (updatedProfile: any) => {
    setProfile(updatedProfile);
    setIsEditing(false);
    fetchProfile(); // Refresh data from server
  };

  const handleSave = async () => {
    // This will trigger the save from the form component
    setIsSaving(true);
    // The actual save logic is handled by the CompanyProfileForm component
    // We just need to provide a way to trigger it from here
  };

  const handleReturnToDashboard = () => {
    navigate('/app');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-garden-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-primary font-medium">Loading company profile...</p>
        </div>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-garden-background p-6">
        <div className="max-w-4xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-garden-green-dark mb-2">
              Company Profile
            </h1>
            <p className="text-garden-green">
              Manage your company information to help AI create better, more personalized content
            </p>
          </div>
          
          <CompanyProfileForm 
            profile={profile}
            isEditing={isEditing}
            onToggleEdit={() => setIsEditing(!isEditing)}
            onProfileUpdate={handleProfileUpdate}
          />

          {/* Bottom Action Buttons */}
          <div className="mt-8 flex justify-between items-center">
            <Button
              variant="outline"
              onClick={handleReturnToDashboard}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Return To Dashboard
            </Button>
            
            <Button
              onClick={handleSave}
              disabled={isSaving || !isEditing}
              className="flex items-center gap-2"
            >
              <Save className="w-4 h-4" />
              {isSaving ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
};
