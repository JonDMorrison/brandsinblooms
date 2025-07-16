import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Brain, Mail, MessageSquare, TrendingUp, Clock, Lightbulb, Copy } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface SegmentInsightsProps {
  segmentId: string;
}

interface Insights {
  top_products: string[];
  engagement_score: number;
  subject_line_suggestions: string[];
  sms_tone_recommendation: string;
  best_time_to_send: string;
  campaign_recommendations: Array<{
    title: string;
    description: string;
  }>;
}

export function SegmentInsights({ segmentId }: SegmentInsightsProps) {
  const [insights, setInsights] = useState<Insights | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const { toast } = useToast();

  const generateInsights = async () => {
    setIsGenerating(true);
    try {
      // Get segment data first
      const { data: segment } = await supabase
        .from('crm_segments')
        .select('*')
        .eq('id', segmentId)
        .single();

      // Fetch personas data for enhanced insights
      const { data: personas } = await supabase
        .from('personas')
        .select('*');

      const { data, error } = await supabase.functions.invoke('generate-segment-insights', {
        body: { 
          segmentId,
          segmentData: {
            name: segment?.name,
            description: segment?.description,
            conditions: segment?.conditions,
            customer_count: segment?.customer_count
          },
          personas: personas || []
        }
      });

      if (error) throw error;
      setInsights(data.insights);
      
      toast({
        title: "AI Insights Generated",
        description: "Fresh insights have been generated for this segment.",
      });
    } catch (error) {
      console.error('Error generating insights:', error);
      toast({
        title: "Error",
        description: "Failed to generate insights. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied",
      description: "Text copied to clipboard.",
    });
  };

  if (!insights) {
    return (
      <Card>
        <CardHeader className="text-center">
          <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4">
            <Brain className="h-6 w-6 text-primary" />
          </div>
          <CardTitle>AI-Powered Segment Insights</CardTitle>
          <CardDescription>
            Generate personalized content recommendations and marketing insights using ChatGPT
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center">
          <Button 
            onClick={generateInsights} 
            disabled={isGenerating}
            className="flex items-center gap-2"
          >
            {isGenerating ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Generating Insights...
              </>
            ) : (
              <>
                <Brain className="h-4 w-4" />
                Generate AI Insights
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Brain className="h-5 w-5 text-primary" />
            AI-Generated Insights
          </h3>
          <p className="text-sm text-muted-foreground">
            Powered by ChatGPT marketing analysis
          </p>
        </div>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={generateInsights}
          disabled={isGenerating}
        >
          Refresh Insights
        </Button>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="email">Email</TabsTrigger>
          <TabsTrigger value="sms">SMS</TabsTrigger>
          <TabsTrigger value="campaigns">Campaigns</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Engagement Score</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{insights.engagement_score}%</div>
                <p className="text-xs text-muted-foreground">
                  Based on purchase behavior
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Best Send Time</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-sm font-medium">{insights.best_time_to_send}</div>
                <p className="text-xs text-muted-foreground">
                  Optimal timing for campaigns
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Top Products</CardTitle>
                <Lightbulb className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-1">
                  {insights.top_products.slice(0, 3).map((product, index) => (
                    <Badge key={index} variant="secondary" className="text-xs">
                      {product}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="email" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5" />
                Email Subject Line Suggestions
              </CardTitle>
              <CardDescription>
                AI-generated subject lines optimized for this segment
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {insights.subject_line_suggestions.map((subject, index) => (
                <div key={index} className="flex items-center justify-between p-3 border rounded">
                  <span className="text-sm">{subject}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyToClipboard(subject)}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sms" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                SMS Tone Recommendation
              </CardTitle>
              <CardDescription>
                Optimal communication tone for SMS campaigns
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Badge variant="default" className="text-sm">
                  {insights.sms_tone_recommendation}
                </Badge>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copyToClipboard(insights.sms_tone_recommendation)}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                Use this tone when crafting SMS messages for this segment
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="campaigns" className="space-y-4">
          <div className="grid gap-4">
            {insights.campaign_recommendations.map((campaign, index) => (
              <Card key={index}>
                <CardHeader>
                  <CardTitle className="text-base">{campaign.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{campaign.description}</p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-3"
                    onClick={() => copyToClipboard(`${campaign.title}: ${campaign.description}`)}
                  >
                    <Copy className="h-4 w-4 mr-2" />
                    Copy Campaign Idea
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}