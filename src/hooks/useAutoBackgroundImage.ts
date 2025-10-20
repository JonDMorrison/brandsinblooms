import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface UseAutoBackgroundImageProps {
  headline?: string;
  currentBackgroundUrl?: string;
  onImageSelected?: (imageUrl: string, metadata?: any) => void;
  enabled?: boolean;
  shouldAutoFetch?: boolean;
}

interface UnsplashImage {
  id: string;
  urls: {
    regular: string;
    small: string;
    thumb: string;
  };
  alt_description?: string;
  description?: string;
  user: {
    name: string;
    username: string;
  };
}

export const useAutoBackgroundImage = ({
  headline,
  currentBackgroundUrl,
  onImageSelected,
  enabled = true,
  shouldAutoFetch = true
}: UseAutoBackgroundImageProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const [autoImage, setAutoImage] = useState<UnsplashImage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  // Extract meaningful keywords from headline for better search results
  const extractSearchKeywords = useCallback((text: string): string => {
    if (!text) return '';
    
    // Remove common words and focus on meaningful terms
    const commonWords = ['the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'your', 'our', 'this', 'that', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'can', 'a', 'an'];
    
    const words = text.toLowerCase()
      .replace(/[^\w\s]/g, ' ') // Replace punctuation with spaces
      .split(/\s+/)
      .filter(word => word.length > 2 && !commonWords.includes(word));
    
    // Take the most relevant keywords (first 3-4 words)
    return words.slice(0, 4).join(' ');
  }, []);

  const fetchBackgroundImage = useCallback(async (searchText: string) => {
    if (!searchText.trim() || !enabled) return;

    setIsLoading(true);
    setError(null);

    try {
      console.log('[useAutoBackgroundImage] Fetching image for:', searchText);
      
      const { data, error: functionError } = await supabase.functions.invoke('fetch-unsplash-images', {
        body: {
          query: searchText,
          maxImages: 1,
          orientation: 'landscape', // Better for header backgrounds
          orderBy: 'relevant',
          contentFilter: 'high'
        }
      });

      if (functionError) {
        throw new Error(functionError.message);
      }

      if (data?.images && data.images.length > 0) {
        const selectedImage = data.images[0];
        setAutoImage(selectedImage);
        
        // Automatically apply the image if callback is provided
        if (onImageSelected) {
          onImageSelected(selectedImage.urls.regular, {
            alt: selectedImage.alt_description || selectedImage.description,
            photographer: selectedImage.user.name,
            unsplashId: selectedImage.id
          });
        }

        console.log('[useAutoBackgroundImage] Image selected:', selectedImage.urls.regular);
      } else {
        console.log('[useAutoBackgroundImage] No suitable images found');
        setAutoImage(null);
      }
    } catch (err: any) {
      console.error('[useAutoBackgroundImage] Error fetching image:', err);
      setError(err.message);
      toast({
        title: "Could not fetch background image",
        description: "Using default background instead.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [enabled, onImageSelected, toast]);

  // Debounced effect to fetch image when headline changes
  useEffect(() => {
    if (!headline || !enabled || !shouldAutoFetch) return;

    // Only fetch if we don't already have a background image
    if (currentBackgroundUrl) return;

    const searchKeywords = extractSearchKeywords(headline);
    if (!searchKeywords) return;

    // Debounce the API call
    const timeoutId = setTimeout(() => {
      fetchBackgroundImage(searchKeywords);
    }, 1000); // Wait 1 second after user stops typing

    return () => clearTimeout(timeoutId);
  }, [headline, currentBackgroundUrl, enabled, shouldAutoFetch, extractSearchKeywords, fetchBackgroundImage]);

  const refetchImage = useCallback(() => {
    if (headline) {
      const searchKeywords = extractSearchKeywords(headline);
      fetchBackgroundImage(searchKeywords);
    }
  }, [headline, extractSearchKeywords, fetchBackgroundImage]);

  return {
    isLoading,
    autoImage,
    error,
    refetchImage
  };
};