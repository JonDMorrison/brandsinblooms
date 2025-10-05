
import React, { useState } from 'react';
import { MediaSelectorSidebar } from './MediaSelectorSidebar';
import { Camera, Upload, Sparkles } from 'lucide-react';
import { AIImageLoadingOverlay } from '@/components/ui/AIImageLoadingOverlay';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface MediaSelectorImageProps {
  src?: string;
  onChange?: (src: string, metadata?: any) => void;
  contentContext?: string;
  className?: string;
  month?: string;
  weekNumber?: number;
  contentType?: 'facebook' | 'instagram' | 'blog';
  imageGenerationStatus?: string | null;
}

// Helper function to get seasonal search query based on current date
const getSeasonalSearchQuery = (): string => {
  const now = new Date();
  const month = now.getMonth(); // 0-11
  const day = now.getDate();
  
  // Christmas season (Dec 1 - Dec 31)
  if (month === 11) {
    return 'christmas decorations garden winter holidays';
  }
  
  // New Year / Winter (Jan 1 - Feb 28)
  if (month === 0 || month === 1) {
    return 'winter garden snow frost evergreen';
  }
  
  // Early Spring (Mar 1 - Apr 30)
  if (month === 2 || month === 3) {
    return 'spring flowers bloom garden tulips daffodils';
  }
  
  // Late Spring / Early Summer (May 1 - Jun 30)
  if (month === 4 || month === 5) {
    return 'summer garden roses colorful flowers sunshine';
  }
  
  // Summer (Jul 1 - Aug 31)
  if (month === 6 || month === 7) {
    return 'summer garden vegetables tomatoes sunflowers';
  }
  
  // Fall (Sep 1 - Oct 31)
  if (month === 8 || month === 9) {
    return 'fall autumn garden pumpkins harvest leaves';
  }
  
  // Halloween / Thanksgiving prep (Nov 1 - Nov 30)
  if (month === 10) {
    if (day < 15) {
      return 'fall garden harvest pumpkins mums chrysanthemums';
    } else {
      return 'thanksgiving autumn harvest garden decorations';
    }
  }
  
  // Default fallback
  return 'beautiful garden flowers plants';
};

export const MediaSelectorImage: React.FC<MediaSelectorImageProps> = ({
  src = '',
  onChange,
  contentContext = '',
  className = '',
  month,
  weekNumber,
  contentType,
  imageGenerationStatus
}) => {
  console.log('[MediaSelectorImage] Component props:', { 
    src, 
    hasOnChange: !!onChange, 
    contentContext,
    imageGenerationStatus 
  });
  
  const [isSelecting, setIsSelecting] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const { toast } = useToast();

  const handleImageSelect = (imageUrl: string, metadata?: any) => {
    console.log('[MediaSelectorImage] Image selected:', imageUrl, metadata);
    
    if (onChange) {
      onChange(imageUrl, metadata);
      console.log('[MediaSelectorImage] onChange called successfully');
    } else {
      console.error('[MediaSelectorImage] onChange prop is missing!');
    }
  };

  const handleGenerateImage = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!contentContext) {
      toast({
        title: "No content available",
        description: "Please generate content first before creating an image.",
        variant: "destructive"
      });
      return;
    }

    setIsGenerating(true);
    console.log('[MediaSelectorImage] Generating AI image for context:', contentContext);

    try {
      const { data, error } = await supabase.functions.invoke('generate-content-image', {
        body: { contentContext }
      });

      if (error) throw error;

      if (data?.imageUrl) {
        console.log('[MediaSelectorImage] Image generated successfully');
        handleImageSelect(data.imageUrl, { source: 'ai-generated', model: 'gemini' });
        toast({
          title: "Image generated!",
          description: "Your AI-generated image is ready.",
        });
      } else {
        throw new Error('No image URL returned');
      }
    } catch (error) {
      console.error('[MediaSelectorImage] Failed to generate image:', error);
      toast({
        title: "Generation failed",
        description: "Could not generate image. Please try manual selection.",
        variant: "destructive"
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSelectClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    console.log('[MediaSelectorImage] Select button clicked, opening sidebar');
    setIsSelecting(true);
  };

  const handleClose = () => {
    console.log('[MediaSelectorImage] Sidebar closing');
    setIsSelecting(false);
  };

  return (
    <>
      <div className={`relative group w-full h-48 bg-gray-100 rounded-lg overflow-hidden flex items-center justify-center border-2 border-dashed border-gray-300 hover:border-gray-400 transition-colors ${className}`}>
        {isGenerating && (
          <AIImageLoadingOverlay 
            message="AI is creating your garden image..."
            showIcon={true}
          />
        )}
        
        {src ? (
          <img 
            src={src} 
            alt="Selected content" 
            className="object-cover w-full h-full"
            onLoad={() => console.log('🖼️ Image loaded successfully:', src)}
            onError={(e) => console.error('🖼️ Image failed to load:', src, e)}
          />
        ) : (
          <div className="text-center text-gray-400">
            <Camera className="w-12 h-12 mx-auto mb-2" />
            <span className="text-sm">No image selected</span>
          </div>
        )}

        {!isGenerating && (
          <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity flex gap-2 items-center justify-center z-50">
            <button
              onClick={handleGenerateImage}
              disabled={!contentContext}
              className="bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2 rounded-md text-sm font-medium flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Sparkles className="w-4 h-4" />
              Generate with AI
            </button>
            <button
              onClick={handleSelectClick}
              className="bg-secondary hover:bg-secondary/90 text-secondary-foreground px-4 py-2 rounded-md text-sm font-medium flex items-center gap-2 transition-colors"
            >
              <Upload className="w-4 h-4" />
              Select Image
            </button>
          </div>
        )}
      </div>

      {/* Sidebar */}
      <MediaSelectorSidebar
        isOpen={isSelecting}
        onClose={handleClose}
        onImageSelect={handleImageSelect}
        contentContext={contentContext}
        selectedImageUrl={src}
      />
    </>
  );
};
