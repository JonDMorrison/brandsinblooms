
import React from 'react';
import { Mail, Facebook, Video, Instagram, FileText, BookOpen } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PlatformChipProps {
  postType: string;
  className?: string;
}

const iconMap = {
  Mail,
  Facebook,
  Video,
  Instagram,
  FileText,
  BookOpen
};

// Helper function to properly format post type names
const formatPostTypeName = (postType: string) => {
  switch (postType.toLowerCase()) {
    case 'instagram':
      return 'Instagram';
    case 'facebook':
      return 'Facebook';
    case 'newsletter':
      return 'Newsletter';
    case 'blog':
      return 'Blog';
    case 'video':
      return 'Video';
    case 'email':
      return 'Blog'; // Map email to Blog as they seem to be the same content type
    default:
      return postType.charAt(0).toUpperCase() + postType.slice(1);
  }
};

export const PlatformChip = ({ postType, className }: PlatformChipProps) => {
  const configs = {
    newsletter: {
      icon: 'Mail',
      bgColor: 'bg-indigo-50',
      textColor: 'text-indigo-700',
      borderColor: 'border-indigo-200'
    },
    facebook: {
      icon: 'Facebook',
      bgColor: 'bg-blue-50',
      textColor: 'text-blue-700',
      borderColor: 'border-blue-200'
    },
    blog: {
      icon: 'BookOpen',  
      bgColor: 'bg-purple-50',
      textColor: 'text-purple-700',
      borderColor: 'border-purple-200'
    },
    email: {
      icon: 'BookOpen', // Use BookOpen icon for email (which should display as Blog)
      bgColor: 'bg-purple-50',
      textColor: 'text-purple-700',
      borderColor: 'border-purple-200'
    },
    video: {
      icon: 'Video',
      bgColor: 'bg-orange-50',
      textColor: 'text-orange-700',
      borderColor: 'border-orange-200'
    },
    instagram: {
      icon: 'Instagram',
      bgColor: 'bg-pink-50',
      textColor: 'text-pink-700',
      borderColor: 'border-pink-200'
    }
  };

  const config = configs[postType as keyof typeof configs] || {
    icon: 'FileText',
    bgColor: 'bg-gray-50',
    textColor: 'text-gray-700',
    borderColor: 'border-gray-200'
  };

  const IconComponent = iconMap[config.icon as keyof typeof iconMap];

  return (
    <div className={cn(
      'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium',
      config.bgColor,
      config.textColor,
      config.borderColor,
      className
    )}>
      <IconComponent className="w-3 h-3" />
      <span>{formatPostTypeName(postType)}</span>
    </div>
  );
};
