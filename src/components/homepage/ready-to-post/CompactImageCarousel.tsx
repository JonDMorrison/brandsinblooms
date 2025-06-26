import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Download, Copy, MoreHorizontal, Image as ImageIcon } from 'lucide-react';
import { toast } from 'sonner';
import { useImageSuggestions } from '@/hooks/useImageSuggestions';
import { useIsMobile } from '@/hooks/use-mobile';

interface CompactImageCarouselProps {
  task: any;
  campaignTheme?: string;
  onShowAll?: () => void;
}

export const CompactImageCarousel = ({ task, campaignTheme, onShowAll }: CompactImageCarouselProps) => {
  const { images, loading, fetchNewImages, usingPlaceholders } = useImageSuggestions(task?.id, task?.post_type);
  const isMobile = useIsMobile();
  const [hasAutoFetched, setHasAutoFetched] = useState(false);
  const [imageErrors, setImageErrors] = useState<Set<string>>(new Set());

  // Auto-fetch images when component mounts with smart content analysis
  useEffect(() => {
    if (task?.id && images.length === 0 && !loading && !hasAutoFetched) {
      console.log('[COMPACT_CAROUSEL] Auto-fetching images with smart analysis for task:', task.id);
      console.log('[COMPACT_CAROUSEL] Task content preview:', task.ai_output?.substring(0, 100));
      console.log('[COMPACT_CAROUSEL] Campaign theme:', campaignTheme);
      
      // Use smart analysis - pass content and campaign info
      fetchNewImages('', task.id, task.post_type, task.ai_output, campaignTheme);
      setHasAutoFetched(true);
    }
  }, [task?.id, images.length, loading, hasAutoFetched, task?.ai_output, campaignTheme]);

  const handleDownload = (imageUrl: string, photographer: string, event: React.MouseEvent) => {
    event.stopPropagation();
    if (usingPlaceholders) {
      toast.info('These are sample images - add your Unsplash API key for downloads');
      return;
    }
    
    const link = document.createElement('a');
    link.href = imageUrl;
    link.download = `${task?.post_type}-${photographer}.jpg`;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Image download started');
  };

  const handleCopyCredit = (photographer: string, event: React.MouseEvent) => {
    event.stopPropagation();
    const credit = usingPlaceholders 
      ? `Sample image credit: ${photographer}`
      : `Photo by ${photographer} on Unsplash`;
    navigator.clipboard.writeText(credit);
    toast.success('Credit copied to clipboard');
  };

  const handleImageError = (imageId: string) => {
    console.log('[COMPACT_CAROUSEL] Image load error for:', imageId);
    setImageErrors(prev => new Set([...prev, imageId]));
  };

  const handleImageLoad = (imageId: string) => {
    console.log('[COMPACT_CAROUSEL] Image loaded successfully:', imageId);
    setImageErrors(prev => {
      const newSet = new Set(prev);
      newSet.delete(imageId);
      return newSet;
    });
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 p-2 bg-stone-50 rounded-lg">
        <div className="animate-spin w-4 h-4 border-2 border-stone-300 border-t-blue-500 rounded-full"></div>
        <span className="text-xs text-stone-600">Finding relevant images...</span>
      </div>
    );
  }

  if (images.length === 0) {
    return (
      <div className="flex items-center gap-2 p-2 bg-stone-50 rounded-lg">
        <ImageIcon className="w-4 h-4 text-stone-400" />
        <span className="text-xs text-stone-500">No relevant images found</span>
      </div>
    );
  }

  // Show 2-3 images based on screen size
  const displayCount = isMobile ? 2 : 3;
  const displayImages = images.slice(0, displayCount);
  const hasMore = images.length > displayCount;

  const getPlatformBadgeText = (postType: string) => {
    const badges = {
      instagram: '📱 Instagram Style',
      facebook: '👥 Facebook Style', 
      newsletter: '📧 Newsletter Style',
      email: '✉️ Email Style',
      video: '🎥 Video Style'
    };
    return badges[postType] || '📷 Images';
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ImageIcon className="w-4 h-4 text-stone-600" />
          <span className="text-xs font-medium text-stone-700">
            {getPlatformBadgeText(task?.post_type)}
          </span>
          {usingPlaceholders && (
            <Badge variant="outline" className="text-xs">
              Sample
            </Badge>
          )}
        </div>
        {hasMore && onShowAll && (
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={onShowAll}
            className="h-6 px-2 text-xs text-stone-600 hover:text-stone-800"
          >
            +{images.length - displayCount} more
          </Button>
        )}
      </div>

      <div className={`grid gap-2 ${isMobile ? 'grid-cols-2' : 'grid-cols-3'}`}>
        {displayImages.map((image, index) => (
          <div
            key={image.id}
            className="relative group aspect-video rounded-md overflow-hidden bg-stone-100 cursor-pointer"
          >
            {!imageErrors.has(image.id) ? (
              <img
                src={image.thumb_url}
                alt={image.alt}
                className="w-full h-full object-cover transition-transform group-hover:scale-105"
                loading="lazy"
                onError={() => handleImageError(image.id)}
                onLoad={() => handleImageLoad(image.id)}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gray-200">
                <ImageIcon className="w-8 h-8 text-gray-400" />
              </div>
            )}
            
            {/* Hover overlay with actions */}
            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
              <Button
                size="sm"
                variant="secondary"
                className="h-6 w-6 p-0"
                onClick={(e) => handleDownload(image.download_url, image.photographer, e)}
              >
                <Download className="w-3 h-3" />
              </Button>
              <Button
                size="sm"
                variant="secondary"
                className="h-6 w-6 p-0"
                onClick={(e) => handleCopyCredit(image.photographer, e)}
              >
                <Copy className="w-3 h-3" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      {usingPlaceholders && (
        <div className="text-xs text-stone-500 italic">
          💡 Using sample images - add Unsplash API key for real photos
        </div>
      )}
    </div>
  );
};
