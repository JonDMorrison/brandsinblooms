
import { UnsplashImage } from '@/services/unsplashService';

export interface TaskWithImage {
  post_type: string;
  image?: UnsplashImage;
  [key: string]: any;
}

export const getThumbnail = (task: TaskWithImage): string => {
  // Use Unsplash image if available
  if (task.image?.thumb || task.image?.url) {
    return task.image.thumb || task.image.url;
  }
  
  // Fallback to post type icons
  const iconMap: Record<string, string> = {
    instagram: '📸',
    facebook: '👥', 
    newsletter: '📧',
    video: '🎥',
    blog: '📝',
    default: '📄'
  };
  
  // For now, return emoji as data URL since we don't have SVG icons
  const emoji = iconMap[task.post_type] || iconMap.default;
  return `data:image/svg+xml,${encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40">
      <rect width="40" height="40" fill="#f1f5f9" rx="8"/>
      <text x="20" y="28" text-anchor="middle" font-size="16">${emoji}</text>
    </svg>
  `)}`;
};
