
import { Instagram, Facebook, Mail, BookOpen, Video, FileText } from "lucide-react";

export const getPostTypeIcon = (postType: string) => {
  switch (postType) {
    case 'instagram': return Instagram;
    case 'facebook': return Facebook;
    case 'newsletter': return BookOpen;
    case 'video': return Video;
    default: return FileText;
  }
};

export const getPostTypeLabel = (postType: string) => {
  switch (postType) {
    case 'instagram': return 'Instagram Post';
    case 'facebook': return 'Facebook Post';
    case 'newsletter': return 'Newsletter';
    case 'video': return 'Video';
    default: return 'Content';
  }
};

export const getPostTypeColor = (postType: string) => {
  // Use consistent primary green theme with varying opacity levels for distinction
  switch (postType) {
    case 'instagram': return 'bg-primary/10 text-primary border-primary/20';
    case 'facebook': return 'bg-primary/15 text-primary border-primary/25';
    case 'newsletter': return 'bg-primary/12 text-primary border-primary/22';
    case 'video': return 'bg-primary/18 text-primary border-primary/28';
    default: return 'bg-primary/8 text-primary border-primary/18';
  }
};
