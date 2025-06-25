
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { Sparkles, TrendingUp, Hash, Image, Target } from 'lucide-react';
import { toast } from 'sonner';

interface OptimizationSuggestion {
  type: 'hashtags' | 'timing' | 'content' | 'image';
  title: string;
  description: string;
  action?: string;
}

interface ContentOptimizerProps {
  content: string;
  platform: 'facebook' | 'instagram';
  onOptimize: (optimizedContent: string) => void;
}

export const ContentOptimizer: React.FC<ContentOptimizerProps> = ({
  content,
  platform,
  onOptimize
}) => {
  const [analyzing, setAnalyzing] = useState(false);
  const [suggestions, setSuggestions] = useState<OptimizationSuggestion[]>([]);
  const [optimizedContent, setOptimizedContent] = useState('');

  const analyzeContent = async () => {
    setAnalyzing(true);
    try {
      const { data, error } = await supabase.functions.invoke('optimize-content', {
        body: { content, platform }
      });

      if (error) throw error;

      setSuggestions(data.suggestions || []);
      setOptimizedContent(data.optimizedContent || content);
      
      toast.success('Content analyzed successfully');
    } catch (error) {
      console.error('Error analyzing content:', error);
      toast.error('Failed to analyze content');
      
      // Fallback suggestions for demo
      const fallbackSuggestions: OptimizationSuggestion[] = [
        {
          type: 'hashtags',
          title: 'Add trending hashtags',
          description: 'Include 5-10 relevant hashtags to increase discoverability',
          action: 'Add hashtags like #trending #viral #socialmedia'
        },
        {
          type: 'timing',
          title: 'Optimal posting time',
          description: 'Post at 6:00 PM for maximum engagement',
        },
        {
          type: 'content',
          title: 'Add call-to-action',
          description: 'Include a question or prompt to encourage engagement',
          action: 'Try adding "What do you think?" at the end'
        }
      ];
      
      setSuggestions(fallbackSuggestions);
      setOptimizedContent(content);
    } finally {
      setAnalyzing(false);
    }
  };

  const getSuggestionIcon = (type: string) => {
    switch (type) {
      case 'hashtags': return Hash;
      case 'timing': return TrendingUp;
      case 'content': return Sparkles;
      case 'image': return Image;
      default: return Target;
    }
  };

  const getSuggestionColor = (type: string) => {
    switch (type) {
      case 'hashtags': return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'timing': return 'bg-green-50 text-green-700 border-green-200';
      case 'content': return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'image': return 'bg-orange-50 text-orange-700 border-orange-200';
      default: return 'bg-gray-50 text-gray-700 border-gray-200';
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5" />
            Content Optimizer
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex justify-between items-center">
            <Badge variant="secondary" className="capitalize">
              {platform} Optimization
            </Badge>
            <Button 
              onClick={analyzeContent}
              disabled={analyzing}
              size="sm"
            >
              {analyzing ? 'Analyzing...' : 'Analyze Content'}
            </Button>
          </div>

          {suggestions.length > 0 && (
            <div className="space-y-3">
              <h4 className="font-medium text-sm">Optimization Suggestions:</h4>
              {suggestions.map((suggestion, index) => {
                const Icon = getSuggestionIcon(suggestion.type);
                return (
                  <div 
                    key={index}
                    className={`p-3 rounded-lg border ${getSuggestionColor(suggestion.type)}`}
                  >
                    <div className="flex items-start gap-3">
                      <Icon className="w-4 h-4 mt-0.5 flex-shrink-0" />
                      <div className="flex-1">
                        <h5 className="font-medium text-sm">{suggestion.title}</h5>
                        <p className="text-xs opacity-80 mt-1">{suggestion.description}</p>
                        {suggestion.action && (
                          <p className="text-xs font-medium mt-2 italic">
                            💡 {suggestion.action}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {optimizedContent && optimizedContent !== content && (
            <div className="space-y-2">
              <h4 className="font-medium text-sm">Optimized Content:</h4>
              <Textarea
                value={optimizedContent}
                onChange={(e) => setOptimizedContent(e.target.value)}
                className="min-h-32"
                placeholder="Optimized content will appear here..."
              />
              <Button 
                onClick={() => onOptimize(optimizedContent)}
                size="sm"
                className="w-full"
              >
                Use Optimized Content
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
