
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Copy, ExternalLink, Facebook, Instagram } from "lucide-react";
import { toast } from "sonner";

interface SocialMediaPostModalProps {
  isOpen: boolean;
  onClose: () => void;
  platform: 'facebook' | 'instagram';
  content: string;
}

export const SocialMediaPostModal = ({ isOpen, onClose, platform, content }: SocialMediaPostModalProps) => {
  const [editedContent, setEditedContent] = useState(content);

  const platformConfig = {
    facebook: {
      name: 'Facebook',
      icon: Facebook,
      color: 'bg-blue-600 hover:bg-blue-700',
      url: 'https://www.facebook.com/share.php?u=' + encodeURIComponent(window.location.href)
    },
    instagram: {
      name: 'Instagram',
      icon: Instagram,
      color: 'bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600',
      url: 'https://www.instagram.com/'
    }
  };

  const config = platformConfig[platform];
  const IconComponent = config.icon;

  const handleCopyContent = () => {
    navigator.clipboard.writeText(editedContent);
    toast.success('Content copied to clipboard!');
  };

  const handlePostToPlatform = () => {
    // Copy content to clipboard
    navigator.clipboard.writeText(editedContent);
    
    // Open platform
    window.open(config.url, '_blank');
    
    toast.success(`Content copied! Create a new post on ${config.name} and paste the content.`);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl bg-white z-[70]">
        <DialogHeader className="bg-white">
          <DialogTitle className="flex items-center gap-3 bg-white">
            <div className={`p-2 rounded-lg text-white ${config.color}`}>
              <IconComponent className="w-5 h-5" />
            </div>
            Post to {config.name}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 bg-white">
          <div className="bg-white">
            <div className="flex items-center justify-between mb-2 bg-white">
              <label className="text-sm font-medium bg-white">Content</label>
              <Badge variant="outline" className="bg-white">{editedContent.length} characters</Badge>
            </div>
            <Textarea
              value={editedContent}
              onChange={(e) => setEditedContent(e.target.value)}
              className="min-h-[200px] text-sm leading-relaxed resize-none bg-white border-gray-300"
              placeholder={`Write your ${platform} post...`}
            />
          </div>

          <div className="flex gap-3 justify-end bg-white">
            <Button variant="outline" onClick={onClose} className="bg-white">
              Cancel
            </Button>
            <Button
              onClick={handleCopyContent}
              variant="outline"
              className="flex items-center gap-2 bg-white"
            >
              <Copy className="w-4 h-4" />
              Copy Content
            </Button>
            <Button
              onClick={handlePostToPlatform}
              className={`text-white flex items-center gap-2 ${config.color}`}
            >
              <ExternalLink className="w-4 h-4" />
              Open {config.name}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
