import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { 
  Share2, 
  Calendar, 
  Image, 
  Sparkles,
  Facebook,
  Instagram,
  Twitter
} from "lucide-react";

interface PostComposerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const postTemplates = [
  {
    id: 'seasonal-tips',
    title: 'Seasonal Garden Tips',
    description: 'Share helpful gardening advice for the current season',
    category: 'Educational',
    content: 'Spring is here! 🌸 Time to prepare your garden for the growing season...'
  },
  {
    id: 'product-showcase',
    title: 'Product Showcase',
    description: 'Highlight featured plants or garden supplies',
    category: 'Product',
    content: 'Check out these beautiful succulents! Perfect for beginners...'
  },
  {
    id: 'behind-scenes',
    title: 'Behind the Scenes',
    description: 'Show your team or garden center in action',
    category: 'Personal',
    content: 'Our team is hard at work preparing for spring arrivals...'
  }
];

export const PostComposerModal = ({ isOpen, onClose }: PostComposerModalProps) => {
  const navigate = useNavigate();
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [platforms, setPlatforms] = useState({
    facebook: true,
    instagram: true,
    twitter: false
  });
  const [schedulePost, setSchedulePost] = useState(false);

  const handleCreatePost = () => {
    // Navigate to the full composer
    navigate('/publish');
    onClose();
  };

  const handleTemplateSelect = (templateId: string) => {
    setSelectedTemplate(templateId);
  };

  const togglePlatform = (platform: keyof typeof platforms) => {
    setPlatforms(prev => ({
      ...prev,
      [platform]: !prev[platform]
    }));
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="w-5 h-5" />
            Create Social Post
          </DialogTitle>
          <DialogDescription>
            Choose a template and platforms to get started
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="templates" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="templates">Templates</TabsTrigger>
            <TabsTrigger value="platforms">Platforms</TabsTrigger>
            <TabsTrigger value="schedule">Schedule</TabsTrigger>
          </TabsList>

          <TabsContent value="templates" className="space-y-4">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium">AI-Generated Templates</span>
            </div>
            
            <div className="grid gap-3">
              {postTemplates.map((template) => (
                <Card 
                  key={template.id}
                  className={`cursor-pointer transition-all hover:shadow-md ${
                    selectedTemplate === template.id ? 'ring-2 ring-primary' : ''
                  }`}
                  onClick={() => handleTemplateSelect(template.id)}
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">{template.title}</CardTitle>
                      <Badge variant="secondary">{template.category}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground mb-2">
                      {template.description}
                    </p>
                    <div className="bg-gray-50 p-3 rounded text-sm italic">
                      "{template.content}"
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="platforms" className="space-y-4">
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-3">
                  <Facebook className="w-5 h-5 text-blue-600" />
                  <div>
                    <Label className="text-sm font-medium">Facebook</Label>
                    <p className="text-xs text-muted-foreground">Post to your business page</p>
                  </div>
                </div>
                <Switch 
                  checked={platforms.facebook}
                  onCheckedChange={() => togglePlatform('facebook')}
                />
              </div>

              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-3">
                  <Instagram className="w-5 h-5 text-pink-600" />
                  <div>
                    <Label className="text-sm font-medium">Instagram</Label>
                    <p className="text-xs text-muted-foreground">Share to your feed</p>
                  </div>
                </div>
                <Switch 
                  checked={platforms.instagram}
                  onCheckedChange={() => togglePlatform('instagram')}
                />
              </div>

              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-3">
                  <Twitter className="w-5 h-5 text-blue-400" />
                  <div>
                    <Label className="text-sm font-medium">Twitter</Label>
                    <p className="text-xs text-muted-foreground">Tweet to your followers</p>
                  </div>
                </div>
                <Switch 
                  checked={platforms.twitter}
                  onCheckedChange={() => togglePlatform('twitter')}
                />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="schedule" className="space-y-4">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm font-medium">Schedule for later</Label>
                  <p className="text-xs text-muted-foreground">Post at the optimal time</p>
                </div>
                <Switch 
                  checked={schedulePost}
                  onCheckedChange={setSchedulePost}
                />
              </div>

              {schedulePost && (
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Calendar className="w-4 h-4" />
                      <span>Optimal posting time: Today at 3:00 PM</span>
                    </div>
                  </CardContent>
                </Card>
              )}

              <div className="bg-blue-50 p-4 rounded-lg">
                <div className="flex items-start gap-2">
                  <Sparkles className="w-4 h-4 text-blue-600 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-blue-900">AI Recommendation</p>
                    <p className="text-xs text-blue-700">
                      Based on your audience, the best time to post is weekdays between 2-4 PM
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <div className="flex justify-between pt-4 border-t">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleCreatePost}>
            Open Full Composer
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};