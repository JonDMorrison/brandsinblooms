/**
 * useImageGeneration Hook
 * Manages image generation state with retry logic and validation tracking
 */

import { useState } from 'react';
import { imageGenerationService, ChannelImageRequest, ImageGenerationResult } from '@/services/imageGenerationService';

interface UseImageGenerationReturn {
  generateImageForChannel: (
    channel: string,
    content: string,
    title?: string,
    maxRetries?: number
  ) => Promise<ImageGenerationResult | null>;
  isGenerating: boolean;
  progress: number;
  validationWarnings: string[];
  clearWarnings: () => void;
}

export function useImageGeneration(): UseImageGenerationReturn {
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [validationWarnings, setValidationWarnings] = useState<string[]>([]);
  
  const generateImageForChannel = async (
    channel: string,
    content: string,
    title?: string,
    maxRetries: number = 2
  ): Promise<ImageGenerationResult | null> => {
    setIsGenerating(true);
    setProgress(10);
    setValidationWarnings([]);
    
    try {
      const request: ChannelImageRequest = {
        channel: channel as any,
        contentContext: content,
        contentTitle: title,
        useAIKeywords: true
      };
      
      // Generate image using faceted approach
      setProgress(30);
      const result = await imageGenerationService.fetchImageForChannel(request);
      
      setProgress(70);
      
      // Add any validation warnings from metadata
      if (result.validationWarnings && result.validationWarnings.length > 0) {
        setValidationWarnings(result.validationWarnings);
      }
      
      setProgress(100);
      return result;
      
    } catch (error) {
      console.error('Image generation failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Image generation failed';
      setValidationWarnings([errorMessage]);
      return null;
    } finally {
      setIsGenerating(false);
      // Reset progress after a short delay
      setTimeout(() => setProgress(0), 1000);
    }
  };
  
  const clearWarnings = () => {
    setValidationWarnings([]);
  };
  
  return {
    generateImageForChannel,
    isGenerating,
    progress,
    validationWarnings,
    clearWarnings
  };
}
