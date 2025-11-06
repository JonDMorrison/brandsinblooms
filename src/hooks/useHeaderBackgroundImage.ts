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
      console.log('[HEADER-BG] Starting AI header image generation for:', campaignTitle);

      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('No authenticated user');
      }

      // Aggregate content from all blocks
      const aggregatedContent = blocks
        .map(b => {
          const content = b.content;
          return [
            content?.title,
            content?.subtitle,
            content?.content,
            content?.text
          ].filter(Boolean).join(' ');
        })
        .filter(Boolean)
        .join(' ');

      console.log('[HEADER-BG] Aggregated content length:', aggregatedContent.length);

      setStage('fetching');

      // Generate AI image directly from content
      const { data: imageData, error: imageError } = await supabase.functions.invoke(
        'generate-ai-image',
        {
          body: {
            contentContext: aggregatedContent,
            contentTitle: campaignTitle,
            channel: 'newsletter',
            uploadToStorage: true,
            userId: user.id
          }
        }
      );

      if (imageError) {
        throw new Error(`Image generation failed: ${imageError.message}`);
      }

      console.log('[HEADER-BG] AI image generated successfully:', imageData.imageUrl);

      const metadata: ImageMetadata = {
        photographer: 'AI Generated',
        unsplashId: imageData.imageId,
        alt: imageData.metadata?.prompt || campaignTitle
      };

      setStage('complete');
      onImageReady(imageData.imageUrl, metadata);

      toast({
        title: "Header image generated",
        description: "AI-powered background applied successfully",
      });

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
