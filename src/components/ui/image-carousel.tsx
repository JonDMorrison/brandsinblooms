
import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Download, Copy, Heart, Shuffle } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface ImageSuggestion {
  id: string;
  thumb_url: string;
  download_url: string;
  alt: string;
  photographer: string;
  unsplash_id: string;
}

interface ImageCarouselProps {
  images: ImageSuggestion[];
  query: string;
  contentTaskId?: string;
  onShuffle?: () => void;
  className?: string;
}

export const ImageCarousel = ({ 
  images, 
  query, 
  contentTaskId, 
  onShuffle,
  className = "" 
}: ImageCarouselProps) => {
  const { user } = useAuth();
  const [hoveredImage, setHoveredImage] = useState<string | null>(null);
  const [favoriteImages, setFavoriteImages] = useState<Set<string>>(new Set());

  const handleDownload = (imageUrl: string, photographer: string) => {
    const link = document.createElement('a');
    link.href = imageUrl;
    link.download = `${query}-${photographer}.jpg`;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Image download started');
  };

  const handleCopyCredit = (photographer: string) => {
    const credit = `Photo by ${photographer} on Unsplash`;
    navigator.clipboard.writeText(credit);
    toast.success('Credit copied to clipboard');
  };

  const handleFavorite = async (image: ImageSuggestion) => {
    if (!user) {
      toast.error('Please log in to save favorites');
      return;
    }

    try {
      // Save to content_assets table
      const { error } = await supabase
        .from('content_assets')
        .insert({
          user_id: user.id,
          name: `${image.alt} - ${image.photographer}`,
          type: 'image',
          file_path: image.download_url,
          size_bytes: 0, // We don't know the actual size
          tags: [query, 'unsplash', 'favorite'],
          unsplash_id: image.unsplash_id,
          photographer: image.photographer
        });

      if (error) throw error;

      setFavoriteImages(prev => new Set([...prev, image.id]));
      toast.success('Image saved to your asset library');
    } catch (error) {
      console.error('Error saving favorite:', error);
      toast.error('Failed to save favorite');
    }
  };

  if (images.length === 0) {
    return (
      <Card className={`p-4 text-center ${className}`}>
        <p className="text-gray-500">No images found for "{query}"</p>
        {onShuffle && (
          <Button variant="outline" onClick={onShuffle} className="mt-2">
            <Shuffle className="w-4 h-4 mr-2" />
            Try Different Keywords
          </Button>
        )}
      </Card>
    );
  }

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold">Free Images for This Post</h3>
          <p className="text-sm text-gray-600">From Unsplash • Search: "{query}"</p>
        </div>
        {onShuffle && (
          <Button variant="outline" size="sm" onClick={onShuffle}>
            <Shuffle className="w-4 h-4 mr-2" />
            Shuffle
          </Button>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {images.map((image) => (
          <div
            key={image.id}
            className="relative group cursor-pointer"
            onMouseEnter={() => setHoveredImage(image.id)}
            onMouseLeave={() => setHoveredImage(null)}
          >
            <div className="aspect-video rounded-lg overflow-hidden bg-gray-100">
              <img
                src={image.thumb_url}
                alt={image.alt}
                className="w-full h-full object-cover transition-transform group-hover:scale-105"
                loading="lazy"
              />
              
              {/* Hover overlay */}
              {hoveredImage === image.id && (
                <div className="absolute inset-0 bg-black/60 flex items-center justify-center transition-opacity">
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => handleDownload(image.download_url, image.photographer)}
                    >
                      <Download className="w-4 h-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => handleCopyCredit(image.photographer)}
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => handleFavorite(image)}
                      disabled={favoriteImages.has(image.id)}
                    >
                      <Heart className={`w-4 h-4 ${favoriteImages.has(image.id) ? 'fill-red-500 text-red-500' : ''}`} />
                    </Button>
                  </div>
                </div>
              )}
            </div>
            
            {/* Credit badge */}
            <Badge 
              variant="secondary" 
              className="absolute bottom-2 left-2 text-xs cursor-pointer"
              onClick={() => handleCopyCredit(image.photographer)}
            >
              📷 {image.photographer}
            </Badge>
          </div>
        ))}
      </div>
    </div>
  );
};
