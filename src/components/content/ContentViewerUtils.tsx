
import { stripHtmlAndFormat } from "@/components/homepage/ready-to-post/contentUtils";
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

export const getStatusColor = (status: string) => {
  switch (status) {
    case 'completed': return 'bg-green-100 text-green-800';
    case 'scheduled': return 'bg-blue-100 text-blue-800';
    case 'draft': return 'bg-yellow-100 text-yellow-800';
    case 'generating': return 'bg-purple-100 text-purple-800';
    case 'published': return 'bg-gray-100 text-gray-800';
    default: return 'bg-gray-100 text-gray-800';
  }
};

export const getHashtagsForType = (postType: string): string => {
  const hashtagsMap: Record<string, string> = {
    instagram: '#business #entrepreneur #success #motivation #growth',
    facebook: '#business #community #update #news',
    email: '',
    newsletter: '',
    video: '#video #content #business #tips'
  };
  
  return hashtagsMap[postType] || '#business #content';
};

export const getImageIdeaForType = (postType: string): string => {
  const imageIdeasMap: Record<string, string> = {
    instagram: 'Professional photo with engaging visual elements',
    facebook: 'Community-focused image or infographic',
    email: 'Simple header image or company logo',
    newsletter: 'Newsletter banner with company branding',
    video: 'Thumbnail image for video content'
  };
  
  return imageIdeasMap[postType] || 'Professional business image';
};

export const handleCopy = (content: string) => {
  if (!content) return;
  
  // Strip HTML and format for copying
  const cleanContent = content
    .replace(/<[^>]*>/g, '')
    .replace(/\\n/g, '\n')
    .trim();
  
  navigator.clipboard.writeText(cleanContent);
};

export const formatContentForDisplay = (content: string) => {
  if (!content) return '';
  
  // First strip HTML and format
  let formatted = stripHtmlAndFormat(content);
  
  // Clean up any remaining placeholders that shouldn't be there
  formatted = formatted
    .replace(/\[company\s*name\]/gi, 'our garden center')
    .replace(/\[garden\s*center\s*name\]/gi, 'our garden center')
    .replace(/your\s*garden\s*center/gi, 'our garden center')
    .replace(/\[region\]/gi, 'your area')
    .replace(/\[location\]/gi, 'your area')
    .replace(/\[garden\s*center\s*location\]/gi, 'your area')
    .replace(/garden\s*center\s*name/gi, 'our garden center')
    .replace(/region/gi, 'your area')
    .trim();
  
  return formatted;
};
