import React, { useState, useRef, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ArrowUp, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface AIPersonalizationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImageSelect?: (imageUrl: string) => void;
}

// Sample images for the grid (using Unsplash garden/plant images)
const sampleImages = [
  'https://images.unsplash.com/photo-1465146344425-f00d5f5c8f07?w=400&h=400&fit=crop',
  'https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=400&h=400&fit=crop',
  'https://images.unsplash.com/photo-1466692476868-aef1dfb1e735?w=400&h=400&fit=crop',
  'https://images.unsplash.com/photo-1530836369250-ef72a3f5cda8?w=400&h=400&fit=crop',
  'https://images.unsplash.com/photo-1523348837708-15d4a09cfac2?w=400&h=400&fit=crop',
  'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&h=400&fit=crop',
  'https://images.unsplash.com/photo-1592150621744-aca64f48394a?w=400&h=400&fit=crop',
  'https://images.unsplash.com/photo-1563691243940-4f4e3e5b9f3c?w=400&h=400&fit=crop',
  'https://images.unsplash.com/photo-1485955900006-10f4d324d411?w=400&h=400&fit=crop',
  'https://images.unsplash.com/photo-1490750967868-88aa4486c946?w=400&h=400&fit=crop',
];

export const AIPersonalizationDialog: React.FC<AIPersonalizationDialogProps> = ({
  open,
  onOpenChange,
  onImageSelect,
}) => {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImages, setGeneratedImages] = useState<string[]>([]);
  const [loadingPlaceholders, setLoadingPlaceholders] = useState<number>(0);
  const { toast } = useToast();
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to top when placeholders appear
  useEffect(() => {
    if (loadingPlaceholders > 0 && scrollAreaRef.current) {
      const viewport = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      viewport?.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [loadingPlaceholders]);

  const handleGenerateImages = async () => {
    if (!prompt.trim()) return;

    setIsGenerating(true);
    setLoadingPlaceholders(4);
    
    try {
      // Single call to generate keywords and fetch images
      const { data, error } = await supabase.functions.invoke(
        'generate-prompt-images',
        { 
          body: { 
            prompt: prompt.trim(),
            maxImages: 4,
            orientation: 'squarish'
          } 
        }
      );

      if (error || data?.error) {
        console.error('Image generation failed:', error || data);
        
        // Handle rate limit specifically
        if (data?.details?.includes('rate limit')) {
          toast({
            title: 'Service Temporarily Unavailable',
            description: 'Image service rate limit reached. Please try again in a moment.',
            variant: 'destructive',
          });
        } else {
          toast({
            title: 'Failed to Generate Images',
            description: data?.details || 'Please try a different prompt.',
            variant: 'destructive',
          });
        }
        
        setIsGenerating(false);
        setLoadingPlaceholders(0);
        return;
      }

      const validImages = data.images
        .map((img: any) => img.urls?.regular || img.urls?.small)
        .filter(Boolean) as string[];

      if (validImages.length === 0) {
        throw new Error('No images found for your search');
      }

      console.log(`✅ Generated ${validImages.length} images using: "${data.usedQuery}"`);
      
      // Prepend new images to the grid
      setGeneratedImages(prev => [...validImages, ...prev]);
      setLoadingPlaceholders(0);
      
      toast({
        title: 'Images Generated!',
        description: `Found ${validImages.length} images using: ${data.keywords.slice(0, 2).join(', ')}`,
      });

      setPrompt('');
    } catch (error) {
      console.error('Error generating images:', error);
      toast({
        title: 'Failed to Generate Images',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      });
      setLoadingPlaceholders(0);
    } finally {
      setIsGenerating(false);
    }
  };

  // Combine generated images with sample images and limit to 5
  const allImages = [...generatedImages, ...sampleImages].slice(0, 5);

  // Loading placeholder component
  const LoadingPlaceholder = ({ index }: { index: number }) => (
    <div 
      key={`loading-${index}`}
      className="relative aspect-square rounded-lg overflow-hidden bg-muted ring-1 ring-border animate-fade-in animate-scale-in"
      style={{ 
        minHeight: '120px', 
        minWidth: '120px',
        animationDelay: `${index * 50}ms`,
        animationFillMode: 'backwards'
      }}
    >
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 animate-pulse">
        <Loader2 className="w-6 h-6 text-primary animate-spin" />
        <span className="text-xs text-muted-foreground font-medium">
          Generating image
        </span>
      </div>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>AI Personalization</DialogTitle>
        </DialogHeader>
        <div className="py-4">
          <p className="text-sm text-foreground mb-4">
            Select a style to personalize your image with AI
          </p>
          
          <ScrollArea className="h-[320px] w-full pr-4" ref={scrollAreaRef}>
            <div className="grid grid-cols-5 gap-4 w-full">
              {/* Show loading placeholders first */}
              {Array.from({ length: loadingPlaceholders }).map((_, index) => (
                <LoadingPlaceholder key={`loading-${index}`} index={index} />
              ))}
              
              {/* Then show actual images */}
              {allImages.map((image, index) => (
                <div
                  key={index}
                  onClick={() => setSelectedImage(image)}
                  className={`
                    relative aspect-square rounded-lg overflow-hidden cursor-pointer
                    transition-all duration-200 hover:scale-105 hover:shadow-lg
                    bg-muted
                    ${selectedImage === image ? 'ring-4 ring-primary shadow-xl' : 'ring-1 ring-border'}
                  `}
                  style={{ minHeight: '120px', minWidth: '120px' }}
                >
                  <img
                    src={image}
                    alt={`Style ${index + 1}`}
                    className="w-full h-full object-cover"
                    loading="eager"
                    onError={(e) => {
                      console.error('Failed to load image:', image);
                      e.currentTarget.style.display = 'none';
                    }}
                    onLoad={() => console.log('Image loaded:', index)}
                  />
                  {selectedImage === image && (
                    <div className="absolute inset-0 bg-primary/20 flex items-center justify-center z-10">
                      <div className="bg-primary text-primary-foreground rounded-full w-8 h-8 flex items-center justify-center font-bold">
                        ✓
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </ScrollArea>

          <div className="mt-8 w-1/2 mx-auto">
            <div className="flex gap-2 items-end">
              <Textarea
                id="ai-prompt"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Tell something about the image you are looking for, how it should look?"
                rows={4}
                className="resize-none flex-1"
              />
              
              {/* Conditionally render button based on state */}
              {selectedImage && !prompt.trim() ? (
                <Button
                  key="select-button"
                  className="flex-shrink-0 animate-fade-in animate-scale-in"
                  variant="default"
                  onClick={() => {
                    if (selectedImage && onImageSelect) {
                      onImageSelect(selectedImage);
                      toast({
                        title: 'Image selected!',
                        description: 'Your personalized image has been applied.',
                      });
                      // Reset states
                      setSelectedImage(null);
                      setPrompt('');
                      onOpenChange(false);
                    }
                  }}
                >
                  Select this image
                </Button>
              ) : (
                <Button
                  key="send-button"
                  className="rounded-full w-8 h-8 p-0 flex-shrink-0 animate-fade-in animate-scale-in"
                  disabled={!prompt.trim() || isGenerating}
                  onClick={handleGenerateImages}
                >
                  {isGenerating ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <ArrowUp className="w-3 h-3" />
                  )}
                </Button>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
