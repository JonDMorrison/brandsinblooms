import React, { useState, useEffect, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { 
  Search, 
  Loader2, 
  Image as ImageIcon, 
  Edit3, 
  Download, 
  Eye, 
  RefreshCw,
  CheckCircle,
  Camera
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { CanvaEditor } from '@/components/canva/CanvaEditor';

interface UnsplashImage {
  id: string;
  urls: {
    thumb: string;
    small: string;
    regular: string;
    full: string;
  };
  alt_description: string;
  user: {
    name: string;
    username: string;
  };
  photographer: string;
  download_url: string;
}

interface GeneratedContent {
  id: string;
  caption: string;
  mediaUrl?: string;
  imageSource?: string;
  photographer?: string;
}

interface EnhancedImageSelectorProps {
  selectedContent: GeneratedContent | null;
  onImageSelect: (imageUrl: string, metadata: any) => void;
}

// Smart query extraction from content
const generateSmartQuery = (content: string): string => {
  const words = content.toLowerCase().split(/\s+/);
  
  // Garden center specific keywords to prioritize
  const gardenKeywords = ['plant', 'flower', 'garden', 'tree', 'soil', 'seed', 'bloom', 'leaf', 'nursery'];
  const actionKeywords = ['care', 'grow', 'plant', 'water', 'prune', 'fertilize'];
  
  const foundGardenTerms = words.filter(word => 
    gardenKeywords.some(keyword => word.includes(keyword))
  ).slice(0, 2);
  
  const foundActionTerms = words.filter(word => 
    actionKeywords.some(keyword => word.includes(keyword))
  ).slice(0, 1);
  
  // Combine terms for a focused search
  const queryTerms = [...foundGardenTerms, ...foundActionTerms];
  
  if (queryTerms.length === 0) {
    return 'beautiful garden plants';
  }
  
  return queryTerms.join(' ');
};

const ImageGrid = ({ 
  images, 
  selectedImageId, 
  onImageSelect, 
  loading 
}: {
  images: UnsplashImage[];
  selectedImageId: string | null;
  onImageSelect: (image: UnsplashImage) => void;
  loading: boolean;
}) => {
  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="aspect-square bg-gray-100 rounded-lg animate-pulse flex items-center justify-center">
            <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
          </div>
        ))}
      </div>
    );
  }

  if (images.length === 0) {
    return (
      <div className="grid grid-cols-2 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="aspect-square bg-gray-50 rounded-lg border-2 border-dashed border-gray-200 flex items-center justify-center">
            <div className="text-center">
              <ImageIcon className="w-6 h-6 text-gray-400 mx-auto mb-1" />
              <p className="text-xs text-gray-500">No image</p>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3">
      {images.slice(0, 4).map((image) => (
        <div
          key={image.id}
          onClick={() => onImageSelect(image)}
          className={cn(
            "aspect-square rounded-lg overflow-hidden cursor-pointer transition-all duration-200 relative group",
            "hover:scale-105 hover:shadow-lg",
            selectedImageId === image.id 
              ? "ring-2 ring-primary ring-offset-2" 
              : "border border-gray-200"
          )}
        >
          <img
            src={image.urls.small}
            alt={image.alt_description || 'Garden image'}
            className="w-full h-full object-cover"
          />
          
          {/* Overlay with photographer info */}
          <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-all duration-200 flex items-end">
            <div className="w-full p-2 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
              <p className="text-white text-xs font-medium truncate">
                📷 {image.user.name}
              </p>
            </div>
          </div>
          
          {/* Selection indicator */}
          {selectedImageId === image.id && (
            <div className="absolute top-2 right-2 bg-primary text-white rounded-full p-1">
              <CheckCircle className="w-3 h-3" />
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

const ImagePreviewPanel = ({ 
  selectedImage, 
  onUseImage, 
  onEditInCanva 
}: {
  selectedImage: UnsplashImage | null;
  onUseImage: () => void;
  onEditInCanva: () => void;
}) => {
  if (!selectedImage) {
    return (
      <div className="aspect-[4/3] bg-gray-50 rounded-lg border-2 border-dashed border-gray-200 flex items-center justify-center">
        <div className="text-center">
          <Camera className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <h3 className="font-medium text-gray-700 mb-1">No Image Selected</h3>
          <p className="text-sm text-gray-500">Choose an image from the grid above</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Large preview */}
      <div className="aspect-[4/3] rounded-lg overflow-hidden border border-gray-200 relative group">
        <img
          src={selectedImage.urls.regular}
          alt={selectedImage.alt_description || 'Selected image'}
          className="w-full h-full object-cover"
        />
        
        {/* Image info overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="absolute bottom-0 left-0 right-0 p-4 text-white">
            <p className="font-medium mb-1">{selectedImage.alt_description || 'Garden image'}</p>
            <p className="text-sm opacity-90">📷 Photo by {selectedImage.user.name}</p>
          </div>
        </div>
      </div>

      {/* Metadata */}
      <div className="bg-gray-50 rounded-lg p-3">
        <div className="flex items-center justify-between mb-2">
          <Badge variant="outline" className="text-xs">
            <Camera className="w-3 h-3 mr-1" />
            Unsplash
          </Badge>
          <span className="text-xs text-gray-500">High Quality</span>
        </div>
        <p className="text-sm text-gray-700 mb-1">
          <strong>Photographer:</strong> {selectedImage.user.name}
        </p>
        <p className="text-xs text-gray-500">
          This image will be attributed correctly when posted
        </p>
      </div>

      {/* Action buttons */}
      <div className="flex gap-2">
        <Button 
          onClick={onUseImage}
          className="flex-1"
        >
          <CheckCircle className="w-4 h-4 mr-2" />
          Use This Image
        </Button>
        <Button 
          onClick={onEditInCanva}
          variant="outline"
        >
          <Edit3 className="w-4 h-4 mr-2" />
          Edit in Canva
        </Button>
      </div>
    </div>
  );
};

export const EnhancedImageSelector = ({ 
  selectedContent, 
  onImageSelect 
}: EnhancedImageSelectorProps) => {
  const [images, setImages] = useState<UnsplashImage[]>([]);
  const [selectedImage, setSelectedImage] = useState<UnsplashImage | null>(null);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showCanvaEditor, setShowCanvaEditor] = useState(false);

  // Auto-search when content changes
  useEffect(() => {
    if (selectedContent?.caption) {
      const autoQuery = generateSmartQuery(selectedContent.caption);
      setSearchQuery(autoQuery);
      fetchImages(autoQuery);
    }
  }, [selectedContent]);

  const fetchImages = async (query: string) => {
    if (!query.trim()) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('fetch-unsplash-images', {
        body: { 
          query: query.trim(),
          per_page: 8,
          orientation: 'squarish'
        }
      });

      if (error) throw error;
      
      if (data?.results) {
        const formattedImages: UnsplashImage[] = data.results.map((img: any) => ({
          id: img.id,
          urls: img.urls,
          alt_description: img.alt_description,
          user: img.user,
          photographer: img.user.name,
          download_url: img.urls.regular
        }));
        
        setImages(formattedImages);
        
        // Auto-select first image if none selected
        if (formattedImages.length > 0 && !selectedImage) {
          setSelectedImage(formattedImages[0]);
        }
      } else {
        setImages([]);
      }
    } catch (error) {
      console.error('Error fetching images:', error);
      toast.error('Failed to fetch images');
      setImages([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    if (query.trim()) {
      fetchImages(query);
    }
  };

  const handleImageGridSelect = (image: UnsplashImage) => {
    setSelectedImage(image);
  };

  const handleUseImage = async () => {
    if (!selectedImage || !selectedContent) return;

    try {
      // Update the content task with the selected image
      await supabase
        .from('content_tasks')
        .update({
          attachments: {
            image: {
              id: selectedImage.id,
              url: selectedImage.urls.regular,
              thumb: selectedImage.urls.thumb,
              alt: selectedImage.alt_description,
              photographer: selectedImage.user.name,
              author_name: selectedImage.user.name,
              source: 'unsplash',
              unsplash_id: selectedImage.id
            }
          }
        })
        .eq('id', selectedContent.id);

      // Call the parent callback
      onImageSelect(selectedImage.urls.regular, {
        source: 'unsplash',
        photographer: selectedImage.user.name,
        unsplash_id: selectedImage.id,
        alt: selectedImage.alt_description
      });

      toast.success('Image selected successfully!');
    } catch (error) {
      console.error('Error selecting image:', error);
      toast.error('Failed to select image');
    }
  };

  const handleEditInCanva = () => {
    if (selectedImage) {
      setShowCanvaEditor(true);
    }
  };

  const handleCanvaImageSave = async (editedImageUrl: string) => {
    if (!selectedContent) return;

    try {
      // Update content task with edited image
      await supabase
        .from('content_tasks')
        .update({
          attachments: {
            image: {
              id: `canva_${Date.now()}`,
              url: editedImageUrl,
              thumb: editedImageUrl,
              alt: selectedImage?.alt_description || 'Edited image',
              photographer: selectedImage?.user.name,
              author_name: selectedImage?.user.name,
              source: 'canva_edited',
              original_unsplash_id: selectedImage?.id
            }
          }
        })
        .eq('id', selectedContent.id);

      onImageSelect(editedImageUrl, {
        source: 'canva_edited',
        photographer: selectedImage?.user.name,
        original_unsplash_id: selectedImage?.id
      });

      setShowCanvaEditor(false);
      toast.success('Edited image saved successfully!');
    } catch (error) {
      console.error('Error saving edited image:', error);
      toast.error('Failed to save edited image');
    }
  };

  if (!selectedContent) {
    return (
      <Card className="p-6 text-center">
        <ImageIcon className="w-12 h-12 text-gray-400 mx-auto mb-3" />
        <h3 className="font-medium text-gray-700 mb-1">Select Content First</h3>
        <p className="text-sm text-gray-500">Choose content to see relevant image suggestions</p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Search Header */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
            <Input
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="Search for images..."
              className="pl-10"
              onKeyDown={(e) => e.key === 'Enter' && fetchImages(searchQuery)}
            />
          </div>
          <Button 
            variant="outline" 
            size="icon"
            onClick={() => fetchImages(searchQuery)}
            disabled={loading}
          >
            <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
          </Button>
        </div>
        
        {/* Auto-search indicator */}
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
          Auto-suggested based on your content
        </div>
      </div>

      {/* Image Grid */}
      <div>
        <h3 className="font-medium text-gray-900 mb-3">Choose an Image</h3>
        <ImageGrid
          images={images}
          selectedImageId={selectedImage?.id || null}
          onImageSelect={handleImageGridSelect}
          loading={loading}
        />
        
        {images.length > 4 && (
          <Button 
            variant="outline" 
            className="w-full mt-3"
            onClick={() => fetchImages(searchQuery)}
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Search for More Images
          </Button>
        )}
      </div>

      {/* Preview Panel */}
      <div>
        <h3 className="font-medium text-gray-900 mb-3">Preview & Actions</h3>
        <ImagePreviewPanel
          selectedImage={selectedImage}
          onUseImage={handleUseImage}
          onEditInCanva={handleEditInCanva}
        />
      </div>

      {/* Canva Editor Dialog */}
      {selectedImage && (
        <CanvaEditor
          isOpen={showCanvaEditor}
          onClose={() => setShowCanvaEditor(false)}
          imageUrl={selectedImage.urls.regular}
          contentTaskId={selectedContent.id}
          titleText={selectedImage.alt_description || 'Garden Image'}
          onDesignComplete={handleCanvaImageSave}
        />
      )}
    </div>
  );
};