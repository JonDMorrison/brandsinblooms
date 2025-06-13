
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, Plus, FileText, Image, BookOpen, Upload, FolderPlus } from "lucide-react";
import { TemplateGrid } from "./TemplateGrid";
import { AssetManager } from "./AssetManager";
import { CreateTemplateDialog } from "./CreateTemplateDialog";
import { useContentTemplates } from "@/hooks/useContentTemplates";
import { useContentAssets } from "@/hooks/useContentAssets";

interface ContentLibraryProps {
  onboardingData: any;
}

export const ContentLibrary = ({ onboardingData }: ContentLibraryProps) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [showCreateTemplate, setShowCreateTemplate] = useState(false);
  
  const { templates, loading: templatesLoading, createTemplate, useTemplate, deleteTemplate } = useContentTemplates();
  const { assets, loading: assetsLoading, uploadAsset, deleteAsset } = useContentAssets();

  const categories = [
    { id: "all", label: "All Templates", count: templates.length },
    { id: "Educational", label: "Educational", count: templates.filter(t => t.category === "Educational").length },
    { id: "Promotional", label: "Promotional", count: templates.filter(t => t.category === "Promotional").length },
    { id: "Community", label: "Community", count: templates.filter(t => t.category === "Community").length },
    { id: "Seasonal", label: "Seasonal", count: templates.filter(t => t.category === "Seasonal").length }
  ];

  const filteredTemplates = templates.filter(template => {
    const matchesSearch = template.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         template.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         template.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesCategory = selectedCategory === "all" || template.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const handleCreateTemplate = async (templateData: any) => {
    try {
      await createTemplate(templateData);
      setShowCreateTemplate(false);
    } catch (error) {
      // Error is handled in the hook
    }
  };

  const handleUseTemplate = async (template: any) => {
    await useTemplate(template.id);
    // You could also copy to clipboard or open in editor here
    navigator.clipboard.writeText(template.content);
  };

  const handleUploadAssets = async (files: FileList) => {
    for (const file of Array.from(files)) {
      try {
        await uploadAsset(file);
      } catch (error) {
        // Error is handled in the hook
      }
    }
  };

  // Quick stats
  const stats = {
    totalAssets: assets.length,
    templates: templates.length,
    recentUploads: assets.filter(a => {
      const uploadDate = new Date(a.created_at);
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      return uploadDate > weekAgo;
    }).length,
    storageUsed: Math.round((assets.reduce((sum, asset) => sum + asset.size_bytes, 0) / (1024 * 1024 * 100)) * 100) // Percentage of 100MB
  };

  return (
    <div className="space-y-6">
      {/* Enhanced Header */}
      <div className="bg-white border-b border-gray-200 shadow-sm rounded-lg">
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
                  <FolderPlus className="w-4 h-4 text-orange-600" />
                  <span className="font-medium">{stats.storageUsed}%</span> storage used
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <Button
                onClick={() => setShowCreateTemplate(true)}
                className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 shadow-md"
                size="lg"
              >
                <Plus className="w-5 h-5" />
                New Template
              </Button>
            </div>
          </div>
        </div>
      </div>

      <Tabs defaultValue="templates" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="templates" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Templates
          </TabsTrigger>
          <TabsTrigger value="assets" className="flex items-center gap-2">
            <Image className="h-4 w-4" />
            Assets
          </TabsTrigger>
        </TabsList>

        <TabsContent value="templates" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Content Templates</CardTitle>
              <CardDescription>Pre-built templates to speed up your content creation</CardDescription>
            </CardHeader>
            <CardContent>
              {/* Search and Filters */}
              <div className="flex flex-col sm:flex-row gap-4 mb-6">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <Input
                    placeholder="Search templates..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <div className="flex gap-2 flex-wrap">
                  {categories.map(category => (
                    <Button
                      key={category.id}
                      variant={selectedCategory === category.id ? "default" : "outline"}
                      size="sm"
                      onClick={() => setSelectedCategory(category.id)}
                      className="flex items-center gap-1"
                    >
                      {category.label}
                      <Badge variant="secondary" className="ml-1">
                        {category.count}
                      </Badge>
                    </Button>
                  ))}
                </div>
              </div>

              <TemplateGrid 
                templates={filteredTemplates}
                loading={templatesLoading}
                onUseTemplate={handleUseTemplate}
                onEditTemplate={(template) => console.log("Editing template:", template)}
                onDeleteTemplate={deleteTemplate}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="assets" className="space-y-4">
          <AssetManager 
            assets={assets}
            loading={assetsLoading}
            onUpload={handleUploadAssets}
            onDelete={deleteAsset}
          />
        </TabsContent>
      </Tabs>

      <CreateTemplateDialog
        open={showCreateTemplate}
        onOpenChange={setShowCreateTemplate}
        onCreateTemplate={handleCreateTemplate}
      />
    </div>
  );
};
