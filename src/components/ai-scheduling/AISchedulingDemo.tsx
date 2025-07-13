import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Brain, Clock, TrendingUp, Sparkles } from 'lucide-react';
import { format } from 'date-fns';
import { useEnhancedSmartTime } from '@/hooks/useEnhancedSmartTime';
import { AISchedulingAPI } from '@/lib/aiSchedulingAPI';

export const AISchedulingDemo = () => {
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { getEnhancedRecommendations } = useEnhancedSmartTime();

  const loadRecommendations = async () => {
    setIsLoading(true);
    try {
      const enhanced = await getEnhancedRecommendations({
        platform: 'facebook',
        contentType: 'promotional_post',
        urgency: 'medium'
      });
      setRecommendations(enhanced);
    } catch (error) {
      console.error('Failed to load recommendations:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getSourceIcon = (source: string) => {
    switch (source) {
      case 'ai': return <Brain className="w-4 h-4 text-purple-500" />;
      case 'analytics': return <TrendingUp className="w-4 h-4 text-blue-500" />;
      default: return <Clock className="w-4 h-4 text-gray-500" />;
    }
  };

  const getSourceLabel = (source: string) => {
    switch (source) {
      case 'ai': return 'AI Recommended';
      case 'analytics': return 'Analytics Based';
      default: return 'Standard Time';
    }
  };

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-purple-500" />
          AI-Enhanced Scheduling Demo
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button 
          onClick={loadRecommendations}
          disabled={isLoading}
          className="w-full"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Generating AI Recommendations...
            </>
          ) : (
            <>
              <Brain className="w-4 h-4 mr-2" />
              Get Enhanced Scheduling Recommendations
            </>
          )}
        </Button>

        {recommendations.length > 0 && (
          <div className="space-y-3">
            <h3 className="font-medium text-sm text-muted-foreground">
              Recommended Posting Times
            </h3>
            {recommendations.map((rec, index) => (
              <Card key={index} className="p-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    {getSourceIcon(rec.source)}
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium">
                          {format(new Date(rec.datetime), 'MMM d, yyyy')} at{' '}
                          {format(new Date(rec.datetime), 'h:mm a')}
                        </span>
                        <Badge 
                          variant="secondary" 
                          className={AISchedulingAPI.getConfidenceColor(rec.confidence)}
                        >
                          {Math.round(rec.confidence * 100)}% confident
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">
                        {rec.reasoning}
                      </p>
                      <Badge variant="outline" className="text-xs">
                        {getSourceLabel(rec.source)}
                      </Badge>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}

        <div className="text-xs text-muted-foreground space-y-1">
          <p><strong>How it works:</strong></p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>AI analyzes your content type, platform, and audience</li>
            <li>Combines AI insights with your historical analytics data</li>
            <li>Provides confidence scores and reasoning for each recommendation</li>
            <li>Seamlessly integrates with existing scheduling components</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
};