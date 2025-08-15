import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Modal, ModalLabel } from "@/components/ui/Modal";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
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
    <Modal
      open={isOpen}
      onOpenChange={onClose}
      title="Create Social Post"
      description="Choose a template and platforms to get started"
      size="xl"
    >
      <Tabs defaultValue="templates" className="w-full">
        <TabsList className="grid w-full grid-cols-3 bg-white/5 border border-white/10">
          <TabsTrigger value="templates" className="data-[state=active]:bg-white/10 text-ink-2 data-[state=active]:text-ink-1">Templates</TabsTrigger>
          <TabsTrigger value="platforms" className="data-[state=active]:bg-white/10 text-ink-2 data-[state=active]:text-ink-1">Platforms</TabsTrigger>
          <TabsTrigger value="schedule" className="data-[state=active]:bg-white/10 text-ink-2 data-[state=active]:text-ink-1">Schedule</TabsTrigger>
        </TabsList>

        <TabsContent value="templates" className="space-y-4 mt-4">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="w-4 h-4 text-brand-green" />
            <span className="text-sm font-medium text-ink-1">AI-Generated Templates</span>
          </div>
          
          <div className="grid gap-3">
            {postTemplates.map((template) => (
              <div
                key={template.id}
                className={`glass grad-border p-4 rounded-xl cursor-pointer transition-all duration-200 hover:shadow-glow hover:-translate-y-0.5 ${
                  selectedTemplate === template.id ? 'ring-2 ring-brand-green' : ''
                }`}
                onClick={() => handleTemplateSelect(template.id)}
              >
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-heading text-base text-ink-1">{template.title}</h3>
                  <Badge variant="secondary" className="bg-white/10 text-ink-2 border-white/10">{template.category}</Badge>
                </div>
                <p className="text-sm text-ink-2 mb-2">
                  {template.description}
                </p>
                <div className="bg-white/5 p-3 rounded-lg text-sm italic text-ink-2 border border-white/10">
                  "{template.content}"
                </div>
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="platforms" className="space-y-4 mt-4">
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 glass rounded-lg border border-white/10">
              <div className="flex items-center gap-3">
                <Facebook className="w-5 h-5 text-blue-400" />
                <div>
                  <ModalLabel className="text-sm font-medium text-ink-1 mb-0">Facebook</ModalLabel>
                  <p className="text-xs text-ink-2">Post to your business page</p>
                </div>
              </div>
              <Switch 
                checked={platforms.facebook}
                onCheckedChange={() => togglePlatform('facebook')}
              />
            </div>

            <div className="flex items-center justify-between p-3 glass rounded-lg border border-white/10">
              <div className="flex items-center gap-3">
                <Instagram className="w-5 h-5 text-pink-400" />
                <div>
                  <ModalLabel className="text-sm font-medium text-ink-1 mb-0">Instagram</ModalLabel>
                  <p className="text-xs text-ink-2">Share to your feed</p>
                </div>
              </div>
              <Switch 
                checked={platforms.instagram}
                onCheckedChange={() => togglePlatform('instagram')}
              />
            </div>

            <div className="flex items-center justify-between p-3 glass rounded-lg border border-white/10">
              <div className="flex items-center gap-3">
                <Twitter className="w-5 h-5 text-blue-300" />
                <div>
                  <ModalLabel className="text-sm font-medium text-ink-1 mb-0">Twitter</ModalLabel>
                  <p className="text-xs text-ink-2">Tweet to your followers</p>
                </div>
              </div>
              <Switch 
                checked={platforms.twitter}
                onCheckedChange={() => togglePlatform('twitter')}
              />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="schedule" className="space-y-4 mt-4">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <ModalLabel className="text-sm font-medium text-ink-1 mb-1">Schedule for later</ModalLabel>
                <p className="text-xs text-ink-2">Post at the optimal time</p>
              </div>
              <Switch 
                checked={schedulePost}
                onCheckedChange={setSchedulePost}
              />
            </div>

            {schedulePost && (
              <div className="glass p-4 rounded-lg border border-white/10">
                <div className="flex items-center gap-2 text-sm text-ink-2">
                  <Calendar className="w-4 h-4" />
                  <span>Optimal posting time: Today at 3:00 PM</span>
                </div>
              </div>
            )}

            <div className="bg-gradient-to-r from-brand-green/10 to-brand-teal/10 p-4 rounded-lg border border-brand-green/20">
              <div className="flex items-start gap-2">
                <Sparkles className="w-4 h-4 text-brand-green mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-ink-1">AI Recommendation</p>
                  <p className="text-xs text-ink-2">
                    Based on your audience, the best time to post is weekdays between 2-4 PM
                  </p>
                </div>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      <div className="flex justify-between pt-4 border-t border-white/10 mt-6">
        <Button variant="outline" onClick={onClose} className="btn-ghost">
          Cancel
        </Button>
        <Button onClick={handleCreatePost} className="btn-orange">
          Open Full Composer
        </Button>
      </div>
    </Modal>
  );
};