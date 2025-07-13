import { supabase } from '@/integrations/supabase/client';

export interface AIScheduleRecommendation {
  datetime: string;
  confidence: number;
  reasoning: string;
  platform: string;
  factors: string[];
}

export interface AIScheduleRequest {
  contentType: string;
  platform: string;
  targetAudience?: string;
  urgency?: 'low' | 'medium' | 'high';
  timezone?: string;
}

export class AISchedulingAPI {
  static async getRecommendations(request: AIScheduleRequest): Promise<AIScheduleRecommendation[]> {
    try {
      const { data, error } = await supabase.functions.invoke('ai-schedule-recommendations', {
        body: {
          ...request,
          timezone: request.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone
        }
      });

      if (error) {
        throw new Error(error.message);
      }

      return data.recommendations || [];
    } catch (error) {
      console.error('AI Scheduling API error:', error);
      throw error;
    }
  }

  static async enhanceScheduledPost(scheduledPostId: string, aiMetadata: any): Promise<void> {
    try {
      const { error } = await supabase
        .from('scheduled_posts')
        .update({ 
          // Add ai_metadata field to store AI recommendation context
          // This would require a database migration to add the field
        })
        .eq('id', scheduledPostId);

      if (error) {
        throw new Error(error.message);
      }
    } catch (error) {
      console.error('Error enhancing scheduled post:', error);
      // Non-critical error, don't throw
    }
  }

  static formatRecommendationForDisplay(recommendation: AIScheduleRecommendation): string {
    const date = new Date(recommendation.datetime);
    const timeString = date.toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
    const dateString = date.toLocaleDateString([], { 
      month: 'short', 
      day: 'numeric' 
    });
    
    return `${dateString} at ${timeString}`;
  }

  static getConfidenceLevel(confidence: number): 'low' | 'medium' | 'high' {
    if (confidence >= 0.8) return 'high';
    if (confidence >= 0.6) return 'medium';
    return 'low';
  }

  static getConfidenceColor(confidence: number): string {
    const level = this.getConfidenceLevel(confidence);
    switch (level) {
      case 'high': return 'text-green-600';
      case 'medium': return 'text-yellow-600';
      case 'low': return 'text-red-600';
      default: return 'text-gray-600';
    }
  }
}