import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Brain, CheckCircle2, AlertCircle } from 'lucide-react';

interface AnalyzeStepProps {
  jobId: string;
  onComplete: (suggestions: any[]) => void;
  onBack: () => void;
}

export const AnalyzeStep = ({ jobId, onComplete, onBack }: AnalyzeStepProps) => {
  const { toast } = useToast();
  const [analyzing, setAnalyzing] = useState(false);
  const [suggestions, setSuggestions] = useState<any[]>([]);

  const handleAnalyze = async () => {
    setAnalyzing(true);
    try {
      toast({
        title: 'Creating embeddings...',
        description: 'Analyzing your data with AI'
      });

      // Create embeddings
      const embedResponse: any = await supabase.functions.invoke('migration-ai-embed', {
        body: { jobId }
      });

      if (embedResponse.error) throw embedResponse.error;

      toast({
        title: 'Generating suggestions...',
        description: 'AI is recommending mappings'
      });

      // Get suggestions
      const suggestResponse: any = await supabase.functions.invoke('migration-ai-suggest', {
        body: { jobId }
      });

      if (suggestResponse.error) throw suggestResponse.error;

      const suggestData = suggestResponse.data as { suggestions: any[] };
      setSuggestions(suggestData.suggestions || []);
      
      toast({
        title: 'Analysis Complete',
        description: `Generated ${suggestData.suggestions?.length || 0} suggestions`
      });

    } catch (error: any) {
      console.error('Analyze error:', error);
      toast({
        title: 'Analysis Failed',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setAnalyzing(false);
    }
  };

  const getActionBadge = (action: string) => {
    const badges: Record<string, { label: string; color: string }> = {
      create_segment: { label: 'Create Segment', color: 'bg-blue-100 text-blue-800' },
      map_to_segment: { label: 'Map to Segment', color: 'bg-green-100 text-green-800' },
      create_persona: { label: 'Create Persona', color: 'bg-purple-100 text-purple-800' },
      map_to_persona: { label: 'Map to Persona', color: 'bg-indigo-100 text-indigo-800' },
      skip: { label: 'Skip', color: 'bg-gray-100 text-gray-800' }
    };

    const badge = badges[action] || { label: action, color: 'bg-gray-100 text-gray-800' };
    return <span className={`px-2 py-1 rounded-full text-xs font-medium ${badge.color}`}>{badge.label}</span>;
  };

  const getConfidenceBadge = (confidence: number) => {
    const percent = Math.round(confidence * 100);
    const color = confidence >= 0.75 ? 'text-green-600' :
                  confidence >= 0.5 ? 'text-yellow-600' : 'text-red-600';
    
    return (
      <span className={`font-semibold ${color}`}>
        {percent}% confident
      </span>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold mb-2">AI Analysis</h2>
        <p className="text-muted-foreground">
          Our AI will analyze your provider's tags and segments and recommend how to map them to BloomSuite.
        </p>
      </div>

      {suggestions.length === 0 ? (
        <Card className="p-8 text-center">
          <Brain className="w-16 h-16 mx-auto mb-4 text-primary opacity-50" />
          <h3 className="text-lg font-semibold mb-2">Ready to Analyze</h3>
          <p className="text-muted-foreground mb-6">
            Click the button below to start AI analysis of your imported data.
          </p>
          <Button onClick={handleAnalyze} disabled={analyzing} size="lg">
            {analyzing && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {analyzing ? 'Analyzing...' : 'Start AI Analysis'}
          </Button>
        </Card>
      ) : (
        <>
          <Card className="p-4 bg-primary/5 border-primary/20">
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle2 className="w-4 h-4 text-primary" />
              <span className="font-medium">Analysis complete - {suggestions.length} suggestions generated</span>
            </div>
          </Card>

          <div className="space-y-3">
            {suggestions.map((suggestion, index) => (
              <Card key={index} className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h4 className="font-semibold">{suggestion.artifact_name}</h4>
                    {suggestion.error && (
                      <p className="text-sm text-destructive flex items-center gap-1 mt-1">
                        <AlertCircle className="w-3 h-3" />
                        {suggestion.error}
                      </p>
                    )}
                  </div>
                  {!suggestion.error && (
                    <div className="flex items-center gap-2">
                      {getActionBadge(suggestion.action)}
                      {getConfidenceBadge(suggestion.confidence)}
                    </div>
                  )}
                </div>

                {!suggestion.error && (
                  <>
                    {suggestion.target_name && (
                      <p className="text-sm mb-2">
                        <span className="text-muted-foreground">Target:</span>{' '}
                        <span className="font-medium">{suggestion.target_name}</span>
                      </p>
                    )}
                    <p className="text-sm text-muted-foreground">{suggestion.rationale}</p>
                  </>
                )}
              </Card>
            ))}
          </div>
        </>
      )}

      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack}>
          Back
        </Button>
        {suggestions.length > 0 && (
          <Button onClick={() => onComplete(suggestions)}>
            Continue to Apply
          </Button>
        )}
      </div>
    </div>
  );
};
