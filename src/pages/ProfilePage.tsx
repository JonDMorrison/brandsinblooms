
import { CompanyProfilePage } from "@/components/CompanyProfilePage";
import { ProtectedPageWrapper } from "@/components/ProtectedPageWrapper";
import { Button } from "@/components/ui/button";
import { Building, Save, Upload, RefreshCw, Edit, Globe } from "lucide-react";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

const ProfilePage = () => {
  const [loading, setLoading] = useState(true);

  // Mock stats for demonstration
  const [stats, setStats] = useState({
    profileComplete: 85,
    lastUpdated: '2 days ago',
    integrations: 4,
    brandAssets: 12
  });

  useEffect(() => {
    // Simulate loading
    const timer = setTimeout(() => setLoading(false), 1000);
    return () => clearTimeout(timer);
  }, []);

  const handleSaveProfile = () => {
    console.log('Save profile clicked');
    // Implementation for saving profile
  };

  const handleUploadLogo = () => {
    console.log('Upload logo clicked');
    // Implementation for logo upload
  };

  const handleRefreshProfile = () => {
    console.log('Refresh profile clicked');
    // Implementation for refreshing profile data
  };

  const handleEditProfile = () => {
    console.log('Edit profile clicked');
    // Implementation for editing profile
  };

  return (
    <ProtectedPageWrapper>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
        {/* Enhanced Header */}
        <div className="bg-white border-b border-gray-200 shadow-sm">
          <div className="max-w-7xl mx-auto px-6 py-8">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
              <div className="space-y-2">
                <h1 className="text-4xl font-bold text-gray-900 flex items-center gap-3">
                  <Building className="w-10 h-10 text-blue-600" />
                  Company Profile
                </h1>
                <p className="text-lg text-gray-600 font-medium">
                  Manage your company information for AI content generation
                </p>
                
                {/* Quick stats */}
                <div className="flex items-center gap-6 mt-4">
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Building className="w-4 h-4 text-green-600" />
                    <span className="font-medium">{stats.profileComplete}%</span> profile complete
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <RefreshCw className="w-4 h-4 text-blue-600" />
                    <span className="font-medium">Updated {stats.lastUpdated}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Globe className="w-4 h-4 text-purple-600" />
                    <span className="font-medium">{stats.integrations}</span> integrations
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Upload className="w-4 h-4 text-orange-600" />
                    <span className="font-medium">{stats.brandAssets}</span> brand assets
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <Button
                  onClick={handleRefreshProfile}
                  variant="outline"
                  className="flex items-center gap-2 hover:bg-blue-50 border-blue-200 text-blue-700"
                  size="lg"
                >
                  <RefreshCw className="w-5 h-5" />
                  Refresh Data
                </Button>
                
                <Button
                  onClick={handleUploadLogo}
                  variant="outline"
                  className="flex items-center gap-2 hover:bg-green-50 border-green-200 text-green-700"
                  size="lg"
                >
                  <Upload className="w-5 h-5" />
                  Upload Logo
                </Button>
                
                <Button
                  onClick={handleEditProfile}
                  className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 shadow-md"
                  size="lg"
                >
                  <Edit className="w-5 h-5" />
                  Edit Profile
                </Button>
                
                <Button
                  onClick={handleSaveProfile}
                  className="flex items-center gap-2 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 shadow-md"
                  size="lg"
                >
                  <Save className="w-5 h-5" />
                  Save Changes
                </Button>
              </div>
            </div>
          </div>
        </div>
        
        {/* Profile Content */}
        <div className="max-w-7xl mx-auto p-6">
          <CompanyProfilePage />
        </div>
      </div>
    </ProtectedPageWrapper>
  );
};

export default ProfilePage;
