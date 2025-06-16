
import { Instagram, Facebook, Mail, BookOpen, Video, FileText } from "lucide-react";

export const getPostTypeIcon = (postType: string) => {
  switch (postType) {
    case 'instagram': return <Instagram className="w-4 h-4" />;
    case 'facebook': return <Facebook className="w-4 h-4" />;
    case 'email': return <Mail className="w-4 h-4" />;
    case 'newsletter': return <BookOpen className="w-4 h-4" />;
    case 'video': return <Video className="w-4 h-4" />;
    default: return <FileText className="w-4 h-4" />;
  }
};

export const getPostTypeColor = (postType: string) => {
  // Use consistent primary green theme with varying opacity levels for distinction
  switch (postType) {
    case 'instagram': return 'bg-primary/10 text-primary border-primary/20';
    case 'facebook': return 'bg-primary/15 text-primary border-primary/25';
    case 'email': return 'bg-primary/20 text-primary border-primary/30';
    case 'newsletter': return 'bg-primary/12 text-primary border-primary/22';
    case 'video': return 'bg-primary/18 text-primary border-primary/28';
    default: return 'bg-primary/8 text-primary border-primary/18';
  }
};
