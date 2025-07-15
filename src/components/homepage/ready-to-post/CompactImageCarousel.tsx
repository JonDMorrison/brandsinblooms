
import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Download, Copy, MoreHorizontal, Image as ImageIcon, Star } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useImageSuggestions } from '@/hooks/useImageSuggestions';
import { useIsMobile } from '@/hooks/use-mobile';
import { downloadUnsplashImage, copyAttributionToClipboard } from '@/services/unsplashDownloadService';

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
      
      // Add a small delay to prevent race conditions with other image fetching
      const timeoutId = setTimeout(() => {
        if (images.length === 0) { // Double-check images haven't loaded from elsewhere
          fetchNewImages('', task.id, task.post_type, task.ai_output, campaignTheme);
        }
      }, 100);
      
      setHasAutoFetched(true);
      return () => clearTimeout(timeoutId);
    }
  }, [task?.id, images.length, loading, hasAutoFetched]);

  const handleDownload = async (image: any, event: React.MouseEvent) => {
    event.stopPropagation();
    if (usingPlaceholders) {
      toast({
        title: "Sample images only",
        description: "Add your Unsplash API key for high-res downloads",
      });
      return;
    }
    
    const result = await downloadUnsplashImage({
      imageUrl: image.download_url,
      photographer: image.photographer,
      photographerUsername: image.photographer_username,
      photographerUrl: image.photographer_url,
      unsplashId: image.unsplash_id || 'unknown',
      downloadLocation: image.download_location,
      quality: 'full'
    });
    
    if (result.success) {
      toast({ 
        title: "Image downloaded", 
        description: `Downloaded high-resolution image: ${result.filename}` 
      });
    } else {
      toast({ 
        title: "Download failed", 
        description: result.error,
        variant: "destructive"
      });
    }
  };

  const handleCopyCredit = async (image: any, event: React.MouseEvent) => {
    event.stopPropagation();
    
    if (usingPlaceholders) {
      const credit = `Sample image credit: ${image.photographer}`;
      navigator.clipboard.writeText(credit);
      toast({ title: "Attribution copied", description: "Sample credit copied to clipboard" });
      return;
    }
    
    const success = await copyAttributionToClipboard(
      image.photographer, 
      image.photographer_url, 
      'facebook'
    );
    
    if (success) {
      toast({ title: "Attribution copied", description: "Photographer credit copied to clipboard" });
    } else {
      toast({ title: "Copy failed", description: "Failed to copy attribution", variant: "destructive" });
    }
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

  // Always show exactly 4 images - 1 featured + 3 alternatives
  const displayedImages = images.slice(0, 4);
  const featuredImage = displayedImages[0];
  const alternativeImages = displayedImages.slice(1);

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
        <span className="text-xs text-stone-500">1 featured + 3 alternatives</span>
      </div>

      {/* Compact 2x2 Grid Layout */}
      <div className="grid grid-cols-3 gap-1 h-20">
        {/* Featured Image - Takes 2/3 width */}
        {featuredImage && (
          <div className="col-span-2 relative group aspect-video rounded-md overflow-hidden bg-stone-100 cursor-pointer">
            {!imageErrors.has(featuredImage.id) ? (
              <img
                src={featuredImage.thumb_url}
                alt={featuredImage.alt}
                className="w-full h-full object-cover transition-transform group-hover:scale-105"
                loading="lazy"
                onError={() => handleImageError(featuredImage.id)}
                onLoad={() => handleImageLoad(featuredImage.id)}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gray-200">
                <ImageIcon className="w-6 h-6 text-gray-400" />
              </div>
            )}
            
            {/* Featured badge */}
            <Badge className="absolute top-1 left-1 bg-yellow-500 text-yellow-900 text-xs py-0 px-1">
              <Star className="w-2 h-2" />
            </Badge>
            
            {/* Hover overlay */}
            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
              <Button
                size="sm"
                variant="secondary"
                className="h-5 w-5 p-0"
                onClick={(e) => handleDownload(featuredImage, e)}
              >
                <Download className="w-2 h-2" />
              </Button>
              <Button
                size="sm"
                variant="secondary"
                className="h-5 w-5 p-0"
                onClick={(e) => handleCopyCredit(featuredImage, e)}
              >
                <Copy className="w-2 h-2" />
              </Button>
            </div>
          </div>
        )}

        {/* Alternative Images - Take 1/3 width, stacked */}
        <div className="flex flex-col gap-1">
          {alternativeImages.slice(0, 2).map((image, index) => (
            <div
              key={image.id}
              className="relative group aspect-video rounded-md overflow-hidden bg-stone-100 cursor-pointer flex-1"
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
                  <ImageIcon className="w-4 h-4 text-gray-400" />
                </div>
              )}
              
              {/* Hover overlay */}
              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
                <Button
                  size="sm"
                  variant="secondary"
                  className="h-4 w-4 p-0"
                  onClick={(e) => handleDownload(image, e)}
                >
                  <Download className="w-2 h-2" />
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  className="h-4 w-4 p-0"
                  onClick={(e) => handleCopyCredit(image, e)}
                >
                  <Copy className="w-2 h-2" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {usingPlaceholders && (
        <div className="text-xs text-stone-500 italic">
          💡 Using 4 sample images (1 featured + 3 alternatives) - add Unsplash API key for real photos
        </div>
      )}
    </div>
  );
};
