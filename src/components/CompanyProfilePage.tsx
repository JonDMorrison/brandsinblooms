
import { useState, useEffect } from "react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { CompanyProfileForm } from "@/components/CompanyProfileForm";
import { CompanyProfilePreview } from "@/components/CompanyProfilePreview";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export const CompanyProfilePage = () => {
  const { user } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);

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
        <div className="max-w-6xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-garden-green-dark mb-2">
              Company Profile
            </h1>
            <p className="text-garden-green">
              Manage your company information to help AI create better, more personalized content
            </p>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div>
              <CompanyProfileForm 
                profile={profile}
                isEditing={isEditing}
                onToggleEdit={() => setIsEditing(!isEditing)}
                onProfileUpdate={handleProfileUpdate}
              />
            </div>
            <div>
              <CompanyProfilePreview profile={profile} />
            </div>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
};
