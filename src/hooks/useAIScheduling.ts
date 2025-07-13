import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface AITimeSlot {
  datetime: string;
  confidence: number;
  reasoning: string;
  platform: string;
  factors: string[];
}

interface AISchedulingReturn {
  generateAIRecommendations: (params: {
    contentType: string;
    platform: string;
    targetAudience?: string;
    urgency?: 'low' | 'medium' | 'high';
  }) => Promise<AITimeSlot[]>;
  isGenerating: boolean;
  error: string | null;
}

export const useAIScheduling = (): AISchedulingReturn => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateAIRecommendations = useCallback(async (params: {
    contentType: string;
    platform: string;
    targetAudience?: string;
    urgency?: 'low' | 'medium' | 'high';
  }): Promise<AITimeSlot[]> => {
    setIsGenerating(true);
    setError(null);

    try {
      const { data, error: functionError } = await supabase.functions.invoke('ai-schedule-recommendations', {
        body: {
          contentType: params.contentType,
          platform: params.platform,
          targetAudience: params.targetAudience || 'general',
          urgency: params.urgency || 'medium',
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
        }
      });

      if (functionError) {
        throw new Error(functionError.message);
      }

      return data.recommendations || [];
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to generate AI recommendations';
      setError(errorMessage);
      console.error('AI scheduling error:', err);
      
      // Return fallback recommendations
      return [{
        datetime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        confidence: 0.7,
        reasoning: 'Fallback recommendation based on general best practices',
        platform: params.platform,
        factors: ['General best practice timing']
      }];
    } finally {
      setIsGenerating(false);
    }
  }, []);

  return {
    generateAIRecommendations,
    isGenerating,
    error
  };
};