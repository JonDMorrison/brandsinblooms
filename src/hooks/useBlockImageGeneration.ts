import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface UseBlockImageGenerationProps {
  blockId: string;
  blockType: string;
  content: string | undefined;
  currentImageUrl?: string;
  isContentGenerating: boolean;
  onImageReady: (imageUrl: string, metadata?: any) => void;
  enabled?: boolean;
}

export const useBlockImageGeneration = ({
  blockId,
  blockType,
  content,
  currentImageUrl,
  isContentGenerating,
  onImageReady,
  enabled = true
}: UseBlockImageGenerationProps) => {
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasTriggeredRef = useRef(false);

  useEffect(() => {
    // Conditions to trigger image generation:
    // 1. Enabled
    // 2. Has content
    // 3. Content is NOT currently generating
    // 4. No existing image
    // 5. Haven't already triggered
    
    if (
      enabled &&
      content &&
      content.trim().length > 0 &&
      !isContentGenerating &&
      !currentImageUrl &&
      !hasTriggeredRef.current
    ) {
      console.log(`[useBlockImageGeneration] Triggering image generation for block ${blockId}`);
      hasTriggeredRef.current = true;
      generateImage();
    }
  }, [content, isContentGenerating, currentImageUrl, enabled, blockId]);

  const generateImage = async () => {
    if (!content) return;

    setIsGeneratingImage(true);
    setError(null);

    try {
      console.log(`[useBlockImageGeneration] Generating AI image for ${blockType} block:`, content.substring(0, 100));

      const { data, error: functionError } = await supabase.functions.invoke('generate-ai-image', {
        body: {
          contentContext: content,
          contentTitle: content.substring(0, 100),
          channel: 'newsletter',
          uploadToStorage: true,
          userId: (await supabase.auth.getUser()).data.user?.id
        }
      });

      if (functionError) {
        console.error('[useBlockImageGeneration] Function error:', functionError);
        setError(functionError.message);
        setIsGeneratingImage(false);
        return;
      }

      if (data?.imageUrl) {
        console.log(`[useBlockImageGeneration] Image ready for block ${blockId}:`, data.imageUrl);
        onImageReady(data.imageUrl, data.metadata);
      } else {
        console.error('[useBlockImageGeneration] No image URL returned');
        setError('No image URL returned');
      }
    } catch (err: any) {
      console.error('[useBlockImageGeneration] Error:', err);
      setError(err.message || 'Failed to generate image');
    } finally {
      setIsGeneratingImage(false);
    }
  };

  return { isGeneratingImage, error };
};
