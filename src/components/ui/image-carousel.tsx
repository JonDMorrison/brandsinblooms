
import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Download, Copy, Heart, Shuffle, Info, Star } from 'lucide-react';
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
  usingPlaceholders?: boolean;
}

export const ImageCarousel = ({ 
  images, 
  query, 
  contentTaskId, 
  onShuffle,
  className = "",
  usingPlaceholders = false
}: ImageCarouselProps) => {
  const { user } = useAuth();
  const [hoveredImage, setHoveredImage] = useState<string | null>(null);
  const [favoriteImages, setFavoriteImages] = useState<Set<string>>(new Set());
  const [imageOrder, setImageOrder] = useState<ImageSuggestion[]>(images);

  // Update image order when images prop changes
  React.useEffect(() => {
    setImageOrder(images);
  }, [images]);

  // Limit to exactly 4 images
  const displayImages = imageOrder.slice(0, 4);
  const featuredImage = displayImages[0];
  const alternativeImages = displayImages.slice(1, 4);

  const handleImageClick = (clickedImage: ImageSuggestion, isFeatured: boolean) => {
    if (isFeatured) return; // Don't do anything if clicking the featured image
    
    // Move clicked image to the front (make it featured)
    const newOrder = [clickedImage, ...imageOrder.filter(img => img.id !== clickedImage.id)];
    setImageOrder(newOrder);
  };

  const handleDownload = (imageUrl: string, photographer: string) => {
    if (usingPlaceholders) {
      toast.info('Add your Unsplash API key to download real images');
      return;
    }
    
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
    const credit = usingPlaceholders 
      ? `Sample image credit: ${photographer}`
      : `Photo by ${photographer} on Unsplash`;
    navigator.clipboard.writeText(credit);
    toast.success('Credit copied to clipboard');
  };

  const handleFavorite = async (image: ImageSuggestion) => {
    if (!user) {
      toast.error('Please log in to save favorites');
      return;
    }

    if (usingPlaceholders) {
      toast.info('Add your Unsplash API key to save real images to your library');
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

  if (displayImages.length === 0) {
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

  const ImageCard = ({ image, isFeatured = false }: { image: ImageSuggestion, isFeatured?: boolean }) => (
    <div
      className={`relative group cursor-pointer ${!isFeatured ? 'hover:opacity-80 transition-opacity' : ''}`}
      onMouseEnter={() => setHoveredImage(image.id)}
      onMouseLeave={() => setHoveredImage(null)}
      onClick={() => handleImageClick(image, isFeatured)}
    >
      <div className={`${isFeatured ? 'aspect-video' : 'aspect-video'} rounded-lg overflow-hidden bg-gray-100 relative`}>
        <img
          src={image.thumb_url}
          alt={image.alt}
          className="w-full h-full object-cover transition-transform group-hover:scale-105"
          loading="lazy"
        />
        
        {/* Featured badge */}
        {isFeatured && (
          <Badge className="absolute top-2 left-2 bg-yellow-500 text-yellow-900">
            <Star className="w-3 h-3 mr-1" />
            Featured
          </Badge>
        )}
        
        {/* Click hint for alternatives */}
        {!isFeatured && hoveredImage === image.id && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center transition-opacity">
            <div className="text-white text-sm font-medium bg-black/60 px-3 py-1 rounded-full">
              Click to feature
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold">
            {usingPlaceholders ? 'Garden Center Sample Images' : 'Images for This Post'}
          </h3>
          <p className="text-sm text-gray-600">
            {usingPlaceholders ? 'High-quality garden center themed images' : `From Unsplash • Search: "${query}"`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {usingPlaceholders && (
            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300">
              <Info className="w-3 h-3 mr-1" />
              Garden Center
            </Badge>
          )}
          {onShuffle && (
            <Button variant="outline" size="sm" onClick={onShuffle}>
              <Shuffle className="w-4 h-4 mr-2" />
              Shuffle
            </Button>
          )}
        </div>
      </div>

      {/* New Vertical Layout */}
      <div className="space-y-4">
        {/* Featured Image - Full Width */}
        {featuredImage && (
          <div className="w-full">
            <ImageCard image={featuredImage} isFeatured={true} />
          </div>
        )}
        
        {/* Alternative Images - 3 Column Grid */}
        {alternativeImages.length > 0 && (
          <div className="grid grid-cols-3 gap-4">
            {alternativeImages.map((image) => (
              <ImageCard key={image.id} image={image} />
            ))}
          </div>
        )}
      </div>

      {usingPlaceholders && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-3">
          <p className="text-sm text-green-800">
            🌱 These are high-quality garden center themed images perfect for your content. Connect your Unsplash API key to access even more images from their vast library.
          </p>
        </div>
      )}
    </div>
  );
};
