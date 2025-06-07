
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
  switch (postType) {
    case 'instagram': return 'bg-pink-100 text-pink-800 border-pink-200';
    case 'facebook': return 'bg-blue-100 text-blue-800 border-blue-200';
    case 'email': return 'bg-green-100 text-green-800 border-green-200';
    case 'newsletter': return 'bg-purple-100 text-purple-800 border-purple-200';
    case 'video': return 'bg-red-100 text-red-800 border-red-200';
    default: return 'bg-gray-100 text-gray-800 border-gray-200';
  }
};
