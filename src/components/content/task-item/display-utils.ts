
import { Instagram, Facebook, FileText, Video, Mail } from 'lucide-react';

export const getPostTypeIcon = (postType: string) => {
  switch (postType) {
    case 'instagram': return Instagram;
    case 'facebook': return Facebook;
    case 'blog': return FileText;
    case 'video': return Video;
    case 'newsletter': return Mail;
    default: return FileText;
  }
};

export const getPostTypeColor = (postType: string) => {
  switch (postType) {
    case 'instagram': return 'from-pink-50 to-purple-50 border-pink-200';
    case 'facebook': return 'from-blue-50 to-indigo-50 border-blue-200';
    case 'blog': return 'from-green-50 to-emerald-50 border-green-200';
    case 'video': return 'from-red-50 to-orange-50 border-red-200';
    case 'newsletter': return 'from-purple-50 to-indigo-50 border-purple-200';
    default: return 'from-gray-50 to-slate-50 border-gray-200';
  }
};

export const formatContent = (content: string) => {
  const cleanContent = content.replace(/<[^>]*>/g, '');
  const hashtagRegex = /#[\w]+/g;
  const hashtags = cleanContent.match(hashtagRegex) || [];
  const textWithoutHashtags = cleanContent.replace(hashtagRegex, '').trim();
  return { text: textWithoutHashtags, hashtags };
};

export const extractImageQuery = (content: string) => {
  const cleanContent = content.replace(/<[^>]*>/g, '').toLowerCase();
  const words = cleanContent.split(/\s+/).filter(word => 
    word.length > 4 && 
    !['with', 'that', 'this', 'your', 'have', 'they', 'will', 'from', 'been'].includes(word)
  );
  return `${words.slice(0, 3).join(' ')} garden plants seasonal`.trim();
};
