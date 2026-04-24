
import React from 'react';
import { 
  DocumentTextIcon, 
  VideoCameraIcon, 
  EnvelopeIcon,
  UserGroupIcon,
  CameraIcon
} from '@heroicons/react/24/outline';
import { cn } from '@/lib/utils';

interface PostTypeAvatarProps {
  type: string;
  className?: string;
}

const getPostTypeConfig = (type: string) => {
  const configs = {
    newsletter: {
      icon: EnvelopeIcon,
      bgGradient: 'from-indigo-100 to-indigo-50',
      textColor: 'text-indigo-600',
      darkBg: 'dark:from-indigo-900/30 dark:to-indigo-800/20',
      darkText: 'dark:text-indigo-400'
    },
    facebook: {
      icon: UserGroupIcon,
      bgGradient: 'from-sky-100 to-sky-50',
      textColor: 'text-sky-600',
      darkBg: 'dark:from-sky-900/30 dark:to-sky-800/20',
      darkText: 'dark:text-sky-400'
    },
    instagram: {
      icon: CameraIcon,
      bgGradient: 'from-pink-100 to-pink-50',
      textColor: 'text-pink-600',
      darkBg: 'dark:from-pink-900/30 dark:to-pink-800/20',
      darkText: 'dark:text-pink-400'
    },
    blog: {
      icon: DocumentTextIcon,
      bgGradient: 'from-violet-100 to-violet-50',
      textColor: 'text-violet-600',
      darkBg: 'dark:from-violet-900/30 dark:to-violet-800/20',
      darkText: 'dark:text-violet-400'
    },
    video: {
      icon: VideoCameraIcon,
      bgGradient: 'from-amber-100 to-amber-50',
      textColor: 'text-amber-600',
      darkBg: 'dark:from-amber-900/30 dark:to-amber-800/20',
      darkText: 'dark:text-amber-400'
    }
  };

  return configs[type as keyof typeof configs] || configs.blog;
};

export const PostTypeAvatar = ({ type, className }: PostTypeAvatarProps) => {
  const config = getPostTypeConfig(type);
  const Icon = config.icon;

  return (
    <div className={cn(
      "flex items-center justify-center rounded-lg bg-gradient-to-br ring-1 ring-white/20",
      "w-9 h-9 sm:w-8 sm:h-8", // 36x36 default, 32x32 on small screens
      config.bgGradient,
      config.darkBg,
      className
    )}>
      <Icon className={cn(
        "w-5 h-5 sm:w-4 sm:h-4",
        config.textColor,
        config.darkText
      )} />
    </div>
  );
};
