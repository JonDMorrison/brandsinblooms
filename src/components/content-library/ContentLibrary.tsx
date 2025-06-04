
import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, Plus, Filter, Download, Edit, Trash2, FileText, Image, Video, Calendar } from "lucide-react";
import { TemplateGrid } from "./TemplateGrid";
import { AssetManager } from "./AssetManager";
import { CreateTemplateDialog } from "./CreateTemplateDialog";

interface ContentLibraryProps {
  onboardingData: any;
}

export const ContentLibrary = ({ onboardingData }: ContentLibraryProps) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [showCreateTemplate, setShowCreateTemplate] = useState(false);
  const [templates, setTemplates] = useState([
    {
      id: "1",
      title: "Plant Care Tips",
      category: "Educational",
      description: "Weekly plant care advice template",
      content: "🌱 Plant Care Tip of the Week!\n\nThis week's focus: [PLANT_NAME]\n\n💡 Care Tip: [TIP_CONTENT]\n\n📍 Visit us for all your [PLANT_NAME] needs!\n\n#PlantCare #GreenThumb #[PLANT_NAME] #GardenCenter",
      variables: ["PLANT_NAME", "TIP_CONTENT"],
      type: "social_post",
      tags: ["tips", "education", "plants"],
      createdAt: "2024-01-15",
      usageCount: 24
    },
    {
      id: "2",
      title: "Seasonal Sale Announcement",
      category: "Promotional",
      description: "Template for seasonal sales and promotions",
      content: "🌺 [SEASON] Sale Alert! 🌺\n\n💰 [DISCOUNT_PERCENTAGE]% OFF on [PRODUCT_CATEGORY]\n⏰ Sale ends [END_DATE]\n\n🚗 Visit us at [LOCATION]\n📞 Call [PHONE_NUMBER]\n\n#Sale #[SEASON]Sale #GardenCenter #Plants #Savings",
      variables: ["SEASON", "DISCOUNT_PERCENTAGE", "PRODUCT_CATEGORY", "END_DATE", "LOCATION", "PHONE_NUMBER"],
      type: "social_post",
      tags: ["sale", "promotion", "seasonal"],
      createdAt: "2024-01-10",
      usageCount: 18
    },
    {
      id: "3",
      title: "Workshop Announcement",
      category: "Community",
      description: "Template for announcing gardening workshops",
      content: "🌿 Join Our [WORKSHOP_NAME] Workshop! 🌿\n\n📅 Date: [DATE]\n🕐 Time: [TIME]\n👥 Spaces: [AVAILABLE_SPOTS] available\n💰 Cost: [PRICE]\n\nWhat you'll learn:\n✅ [LEARNING_POINT_1]\n✅ [LEARNING_POINT_2]\n✅ [LEARNING_POINT_3]\n\nRegister now: [REGISTRATION_LINK]\n\n#Workshop #GardeningWorkshop #LearnToGarden #Community",
      variables: ["WORKSHOP_NAME", "DATE", "TIME", "AVAILABLE_SPOTS", "PRICE", "LEARNING_POINT_1", "LEARNING_POINT_2", "LEARNING_POINT_3", "REGISTRATION_LINK"],
      type: "social_post",
      tags: ["workshop", "community", "education"],
      createdAt: "2024-01-08",
      usageCount: 12
    }
  ]);

  const [assets, setAssets] = useState([
    {
      id: "1",
      name: "spring-garden-hero.jpg",
      type: "image",
      size: "2.4 MB",
      dimensions: "1920x1080",
      uploadedAt: "2024-01-20",
      tags: ["spring", "garden", "hero", "seasonal"],
      url: "/placeholder.svg"
    },
    {
      id: "2",
      name: "plant-care-infographic.png",
      type: "image",
      size: "1.8 MB",
      dimensions: "1080x1080",
      uploadedAt: "2024-01-18",
      tags: ["infographic", "care", "education"],
      url: "/placeholder.svg"
    },
    {
      id: "3",
      name: "summer-sale-video.mp4",
      type: "video",
      size: "12.5 MB",
      duration: "30s",
      uploadedAt: "2024-01-15",
      tags: ["video", "sale", "summer", "promotional"],
      url: "/placeholder.svg"
    }
  ]);

  const categories = [
    { id: "all", label: "All Templates", count: templates.length },
    { id: "Educational", label: "Educational", count: templates.filter(t => t.category === "Educational").length },
    { id: "Promotional", label: "Promotional", count: templates.filter(t => t.category === "Promotional").length },
    { id: "Community", label: "Community", count: templates.filter(t => t.category === "Community").length },
    { id: "Seasonal", label: "Seasonal", count: templates.filter(t => t.category === "Seasonal").length }
  ];

  const filteredTemplates = templates.filter(template => {
    const matchesSearch = template.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         template.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         template.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesCategory = selectedCategory === "all" || template.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const handleCreateTemplate = (templateData: any) => {
    const newTemplate = {
      id: Date.now().toString(),
      ...templateData,
      createdAt: new Date().toISOString().split('T')[0],
      usageCount: 0
    };
    setTemplates([...templates, newTemplate]);
    setShowCreateTemplate(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-green-800">Content Library</h1>
          <p className="text-green-600">Manage your templates and marketing assets</p>
        </div>
        <Button onClick={() => setShowCreateTemplate(true)} className="bg-green-600 hover:bg-green-700">
          <Plus className="h-4 w-4 mr-2" />
          New Template
        </Button>
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
                onUseTemplate={(template) => console.log("Using template:", template)}
                onEditTemplate={(template) => console.log("Editing template:", template)}
                onDeleteTemplate={(templateId) => {
                  setTemplates(templates.filter(t => t.id !== templateId));
                }}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="assets" className="space-y-4">
          <AssetManager 
            assets={assets}
            onUpload={(files) => console.log("Uploading files:", files)}
            onDelete={(assetId) => {
              setAssets(assets.filter(a => a.id !== assetId));
            }}
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
