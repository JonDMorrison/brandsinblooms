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
      
      // Attempt 1: AI-generated keywords
      setProgress(30);
      let result = await imageGenerationService.fetchImageForChannel(request);
      
      setProgress(70);
      
      // Check quality and retry if needed
      if (result.validationScore !== undefined && result.validationScore < 70 && maxRetries > 0) {
        const warning = `Low quality image (score: ${result.validationScore}), retrying... (${maxRetries} attempts left)`;
        setValidationWarnings(prev => [...prev, warning]);
        console.warn(warning);
        
        setProgress(40);
        
        // Retry with remaining attempts
        result = await generateImageForChannel(channel, content, title, maxRetries - 1);
        
        if (!result) {
          throw new Error('All retry attempts failed');
        }
      }
      
      // Add warnings if fallback was used
      if (result.fallbackUsed) {
        setValidationWarnings(prev => [
          ...prev,
          'AI keywords failed validation - using fallback query'
        ]);
      }
      
      setProgress(100);
      return result;
      
    } catch (error) {
      console.error('Image generation failed:', error);
      setValidationWarnings(prev => [
        ...prev,
        'Image generation failed. Please try manual selection.'
      ]);
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
