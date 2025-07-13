import { useState, useCallback } from 'react';
import { useSmartTime } from './useSmartTime';
import { useAIScheduling } from './useAIScheduling';

interface EnhancedTimeSlot {
  datetime: string;
  source: 'analytics' | 'ai' | 'fallback';
  confidence: number;
  reasoning: string;
  platform: string;
}

interface UseEnhancedSmartTimeReturn {
  getBestTimesForPlatform: (platform: string) => string[];
  getEnhancedRecommendations: (params: {
    platform: string;
    contentType?: string;
    urgency?: 'low' | 'medium' | 'high';
  }) => Promise<EnhancedTimeSlot[]>;
  getBestSlot: (platform?: string) => Promise<{ bestDateTime: string; alternatives: string[] }>;
  isLoading: boolean;
  refreshSmartTimes: () => Promise<void>;
}

export const useEnhancedSmartTime = (): UseEnhancedSmartTimeReturn => {
  const smartTime = useSmartTime();
  const { generateAIRecommendations } = useAIScheduling();
  const [isEnhancedLoading, setIsEnhancedLoading] = useState(false);

  const getEnhancedRecommendations = useCallback(async (params: {
    platform: string;
    contentType?: string;
    urgency?: 'low' | 'medium' | 'high';
  }): Promise<EnhancedTimeSlot[]> => {
    setIsEnhancedLoading(true);
    
    try {
      // Get both analytics-based and AI recommendations
      const analyticsBasedTimes = smartTime.getBestTimesForPlatform(params.platform);
      const aiRecommendations = await generateAIRecommendations({
        contentType: params.contentType || 'social_post',
        platform: params.platform,
        urgency: params.urgency || 'medium'
      });

      const enhancedSlots: EnhancedTimeSlot[] = [];

      // Add AI recommendations first (usually higher confidence)
      aiRecommendations.forEach(rec => {
        enhancedSlots.push({
          datetime: rec.datetime,
          source: 'ai',
          confidence: rec.confidence,
          reasoning: rec.reasoning,
          platform: params.platform
        });
      });

      // Add analytics-based times as fallback
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      analyticsBasedTimes.forEach((time, index) => {
        const [hours, minutes] = time.split(':').map(Number);
        const analyticsDate = new Date(tomorrow);
        analyticsDate.setHours(hours, minutes, 0, 0);
        
        // Only add if not already covered by AI recommendations
        const alreadyCovered = enhancedSlots.some(slot => {
          const slotTime = new Date(slot.datetime);
          return Math.abs(slotTime.getTime() - analyticsDate.getTime()) < 60 * 60 * 1000; // within 1 hour
        });
        
        if (!alreadyCovered) {
          enhancedSlots.push({
            datetime: analyticsDate.toISOString(),
            source: 'analytics',
            confidence: 0.8 - (index * 0.1), // Decreasing confidence
            reasoning: `Based on your historical ${params.platform} performance data`,
            platform: params.platform
          });
        }
      });

      // Sort by confidence and limit to top 5
      return enhancedSlots
        .sort((a, b) => b.confidence - a.confidence)
        .slice(0, 5);

    } catch (error) {
      console.error('Enhanced recommendations error:', error);
      
      // Fallback to analytics-only recommendations
      const analyticsBasedTimes = smartTime.getBestTimesForPlatform(params.platform);
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      return analyticsBasedTimes.map((time, index) => {
        const [hours, minutes] = time.split(':').map(Number);
        const fallbackDate = new Date(tomorrow);
        fallbackDate.setHours(hours, minutes, 0, 0);
        
        return {
          datetime: fallbackDate.toISOString(),
          source: 'fallback',
          confidence: 0.7,
          reasoning: `Analytics-based optimal time for ${params.platform}`,
          platform: params.platform
        };
      });
    } finally {
      setIsEnhancedLoading(false);
    }
  }, [smartTime, generateAIRecommendations]);

  return {
    ...smartTime,
    getEnhancedRecommendations,
    isLoading: smartTime.isLoading || isEnhancedLoading
  };
};