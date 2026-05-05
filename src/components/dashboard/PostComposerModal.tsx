import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui-legacy/dialog";
import { Button } from "@/components/ui-legacy/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui-legacy/card";
import { Badge } from "@/components/ui-legacy/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui-legacy/tabs";
import { Switch } from "@/components/ui-legacy/switch";
import { Label } from "@/components/ui-legacy/label";
import {
  Share2,
  Calendar,
  Image,
  Sparkles,
  Facebook,
  Instagram,
  Twitter,
} from "lucide-react";
import { postTemplates } from "@/lib/social/postTemplates";

interface PostComposerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PostComposerModal = ({ isOpen, onClose }: PostComposerModalProps) => {
  const navigate = useNavigate();
  const [platforms, setPlatforms] = useState({
    facebook: true,
    instagram: true,
    twitter: false
  });
  const [schedulePost, setSchedulePost] = useState(false);

  // Tertiary action: blank composer (no template prefill). PublishPage reads
  // ?compose=blank and opens the composer drawer with an empty caption so the
  // user lands directly in the editor instead of on the list view.
  const handleStartBlank = () => {
    navigate("/publish?compose=blank");
    onClose();
  };

  // Primary action: a template card click navigates straight to the composer
  // with the template content prefilled (PublishPage reads ?template= and
  // creates a new content_tasks row from the matching template).
  const handleTemplateClick = (templateId: string) => {
    navigate(`/publish?template=${encodeURIComponent(templateId)}`);
    onClose();
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
                  role="button"
                  tabIndex={0}
                  className="cursor-pointer transition-all hover:shadow-md focus:outline-none focus:ring-2 focus:ring-primary"
                  onClick={() => handleTemplateClick(template.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      handleTemplateClick(template.id);
                    }
                  }}
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
                  <Instagram className="w-5 h-5" style={{ color: 'hsl(var(--brand-teal))' }} />
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
          <Button variant="ghost" onClick={handleStartBlank}>
            Start blank
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};