
import { useState, useEffect } from "react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { CompanyProfileForm } from "@/components/CompanyProfileForm";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useTenant } from "@/hooks/useTenant";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Save, ArrowLeft } from "lucide-react";
import { UserMenu } from "@/components/UserMenu";

export const CompanyProfilePage = () => {
  const { user } = useAuth();
  const { tenant } = useTenant();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (user) {
      fetchProfile();
    }
  }, [user, tenant]);

  const fetchProfile = async () => {
    try {
      console.log('CompanyProfilePage: Fetching profile for user:', user?.id, 'tenant:', tenant?.id || 'none');

      // In tenant model, company profile is still tied to the user who created the tenant
      // But we should be aware of tenant context for any tenant-specific settings
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

      console.log('CompanyProfilePage: Profile loaded for', tenant?.id ? 'tenant mode' : 'user mode');
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
      <div className="min-h-screen bg-garden-background">
        {/* Header with Return Button and User Menu */}
        <div className="p-6 border-b border-green-200 bg-white">
          <div className="flex justify-between items-center">
            <Button
              variant="outline"
              onClick={handleReturnToDashboard}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Return To Dashboard
            </Button>
            <UserMenu />
          </div>
        </div>

        <div className="p-6">
          <div className="max-w-4xl mx-auto bg-white rounded-lg shadow-sm p-8">
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-garden-green-dark mb-2">
                Company Profile
                {tenant?.name && (
                  <span className="text-lg font-normal text-gray-600 ml-2">
                    ({tenant.name})
                  </span>
                )}
              </h1>
              <p className="text-garden-green">
                Manage your company information to help AI create better, more personalized content
                {tenant?.id && (
                  <span className="block text-sm text-gray-500 mt-1">
                    Profile settings apply to all users in your organization
                  </span>
                )}
              </p>
            </div>
            
            <CompanyProfileForm 
              profile={profile}
              isEditing={isEditing}
              onToggleEdit={() => setIsEditing(!isEditing)}
              onProfileUpdate={handleProfileUpdate}
            />

            {/* Bottom Save Button */}
            <div className="mt-8 flex justify-end">
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
      </div>
    </TooltipProvider>
  );
};
