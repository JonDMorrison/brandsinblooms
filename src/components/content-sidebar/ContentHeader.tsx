
import { Instagram, Facebook, Mail, BookOpen } from "lucide-react";

interface ContentHeaderProps {
  postType: string;
}

export const ContentHeader = ({ postType }: ContentHeaderProps) => {
  const getPostTypeIcon = (type: string) => {
    switch (type) {
      case "instagram": return <Instagram className="w-4 h-4" />;
      case "facebook": return <Facebook className="w-4 h-4" />;
      case "email": return <Mail className="w-4 h-4" />;
      case "newsletter": return <BookOpen className="w-4 h-4" />;
      default: return <Mail className="w-4 h-4" />;
    }
  };

  return (
    <div className="flex items-center gap-2 text-green-800">
      {getPostTypeIcon(postType)}
      Content Editor - {postType.charAt(0).toUpperCase() + postType.slice(1)} Post
    </div>
  );
};
