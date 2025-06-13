
import { ContentLibrary } from "@/components/content-library/ContentLibrary";
import { ProtectedPageWrapper } from "@/components/ProtectedPageWrapper";
import { Button } from "@/components/ui/button";
import { BookOpen, Upload, Plus, Search, Filter, FolderPlus } from "lucide-react";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

const ContentLibraryPage = () => {
  const [loading, setLoading] = useState(true);

  // Mock stats for demonstration
  const [stats, setStats] = useState({
    totalAssets: 245,
    templates: 18,
    recentUploads: 12,
    storageUsed: 67
  });

  useEffect(() => {
    // Simulate loading
    const timer = setTimeout(() => setLoading(false), 1000);
    return () => clearTimeout(timer);
  }, []);

  const handleUploadAsset = () => {
    console.log('Upload asset clicked');
    // Implementation for asset upload
  };

  const handleCreateTemplate = () => {
    console.log('Create template clicked');
    // Implementation for template creation
  };

  const handleCreateFolder = () => {
    console.log('Create folder clicked');
    // Implementation for folder creation
  };

  const handleSearch = () => {
    console.log('Search clicked');
    // Implementation for search
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
                  <BookOpen className="w-10 h-10 text-blue-600" />
                  Content Library
                </h1>
                <p className="text-lg text-gray-600 font-medium">
                  Manage your assets, templates, and media files
                </p>
                
                {/* Quick stats */}
                <div className="flex items-center gap-6 mt-4">
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <BookOpen className="w-4 h-4 text-green-600" />
                    <span className="font-medium">{stats.totalAssets}</span> total assets
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Plus className="w-4 h-4 text-blue-600" />
                    <span className="font-medium">{stats.templates}</span> templates
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Upload className="w-4 h-4 text-purple-600" />
                    <span className="font-medium">{stats.recentUploads}</span> recent uploads
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Filter className="w-4 h-4 text-orange-600" />
                    <span className="font-medium">{stats.storageUsed}%</span> storage used
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <Button
                  onClick={handleSearch}
                  variant="outline"
                  className="flex items-center gap-2 hover:bg-blue-50 border-blue-200 text-blue-700"
                  size="lg"
                >
                  <Search className="w-5 h-5" />
                  Search
                </Button>
                
                <Button
                  onClick={handleCreateFolder}
                  variant="outline"
                  className="flex items-center gap-2 hover:bg-green-50 border-green-200 text-green-700"
                  size="lg"
                >
                  <FolderPlus className="w-5 h-5" />
                  New Folder
                </Button>
                
                <Button
                  onClick={handleUploadAsset}
                  className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 shadow-md"
                  size="lg"
                >
                  <Upload className="w-5 h-5" />
                  Upload Asset
                </Button>
                
                <Button
                  onClick={handleCreateTemplate}
                  className="flex items-center gap-2 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 shadow-md"
                  size="lg"
                >
                  <Plus className="w-5 h-5" />
                  Create Template
                </Button>
              </div>
            </div>
          </div>
        </div>
        
        {/* Content Library */}
        <div className="max-w-7xl mx-auto p-6">
          <ContentLibrary onboardingData={{}} />
        </div>
      </div>
    </ProtectedPageWrapper>
  );
};

export default ContentLibraryPage;
