import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

type Stage = 'waiting' | 'aggregating' | 'fetching' | 'complete' | 'error';

interface Block {
  type: string;
  content: any;
  isGenerating?: boolean;
}

interface ImageMetadata {
  photographer?: string;
  unsplashId?: string;
  alt?: string;
}

interface UseHeaderBackgroundImageProps {
  blocks: Block[];
  campaignTitle: string;
  onImageReady: (imageUrl: string, metadata: ImageMetadata) => void;
  enabled?: boolean;
}

export const useHeaderBackgroundImage = ({
  blocks,
  campaignTitle,
  onImageReady,
  enabled = true
}: UseHeaderBackgroundImageProps) => {
  const [stage, setStage] = useState<Stage>('waiting');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const generateHeaderImage = useCallback(async () => {
    if (!enabled || !campaignTitle) {
      console.log('[HEADER-BG] Skipping - not enabled or no title');
      return;
    }

    setIsGenerating(true);
    setStage('aggregating');
    setError(null);

    try {
      console.log('[HEADER-BG] Starting header image generation for:', campaignTitle);

      // Step 1: Generate keywords from all block content
      const { data: keywordData, error: keywordError } = await supabase.functions.invoke(
        'generate-header-keywords',
        {
          body: {
            blocks: blocks.map(b => ({
              type: b.type,
              content: b.content
            })),
            campaignTitle
          }
        }
      );

      if (keywordError) {
        throw new Error(`Keyword generation failed: ${keywordError.message}`);
      }

      const keywords = keywordData?.keywords || 'garden center plants';
      console.log('[HEADER-BG] Generated keywords:', keywords);

      setStage('fetching');

      // Step 2: Fetch Unsplash image using the generated keywords
      const { data: imageData, error: imageError } = await supabase.functions.invoke(
        'fetch-unsplash-images',
        {
          body: {
            query: keywords,
            maxImages: 1,
            orientation: 'landscape',
            orderBy: 'relevant',
            contentFilter: 'high'
          }
        }
      );

      if (imageError) {
        throw new Error(`Image fetch failed: ${imageError.message}`);
      }

      if (imageData?.images && imageData.images.length > 0) {
        const image = imageData.images[0];
        
        console.log('[HEADER-BG] Image fetched successfully:', image.urls.regular);

        const metadata: ImageMetadata = {
          photographer: image.user.name,
          unsplashId: image.id,
          alt: keywordData?.summary || image.alt_description || keywords
        };

        setStage('complete');
        onImageReady(image.urls.regular, metadata);

        toast({
          title: "Header image generated",
          description: "Background image applied successfully",
        });
      } else {
        throw new Error('No suitable images found');
      }

    } catch (err: any) {
      console.error('[HEADER-BG] Error:', err);
      setStage('error');
      setError(err.message || 'Failed to generate header image');
      
      toast({
        title: "Could not generate header image",
        description: "Using default background instead",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  }, [blocks, campaignTitle, enabled, onImageReady, toast]);

  // Monitor when all blocks are ready (have content and not generating)
  useEffect(() => {
    if (!enabled || isGenerating || stage === 'complete') {
      return;
    }

    const allBlocksReady = blocks.length > 0 && blocks.every(b => {
      const hasContent = b.content && 
        (b.content.title || b.content.subtitle || b.content.content || b.content.text);
      const notGenerating = !b.isGenerating;
      return hasContent && notGenerating;
    });

    console.log('[HEADER-BG] Blocks ready check:', {
      blocksCount: blocks.length,
      allBlocksReady,
      currentStage: stage
    });

    if (allBlocksReady && stage === 'waiting') {
      console.log('[HEADER-BG] All blocks ready, triggering image generation');
      // Small delay to ensure all content is fully rendered
      setTimeout(() => {
        generateHeaderImage();
      }, 1000);
    }
  }, [blocks, enabled, isGenerating, stage, generateHeaderImage]);

  const retry = useCallback(() => {
    setStage('waiting');
    setError(null);
    generateHeaderImage();
  }, [generateHeaderImage]);

  return {
    stage,
    isGenerating,
    error,
    retry
  };
};
