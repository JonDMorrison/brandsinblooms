import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/utils/toast';
import { 
  Clock, 
  Users, 
  Target, 
  Sparkles, 
  AlertCircle, 
  Calendar,
  CheckCircle,
  RefreshCw
} from 'lucide-react';

interface SmartSendOptimizationProps {
  campaignId: string;
  personaTags: string[];
  onTimingChange: (sendAt: string, reasoning: string) => void;
  onAudienceChange: (segmentIds: string[]) => void;
  initialScheduledAt?: string;
}

interface SmartTiming {
  sendAt: string;
  reasoning: string;
  confidence: number;
  persona: string;
  timezone: string;
}

interface AudienceSuggestion {
  segment: {
    id: string;
    name: string;
    description: string;
    customer_count: number;
  };
  score: number;
  reasons: string[];
  confidence: number;
}

export const SmartSendOptimization: React.FC<SmartSendOptimizationProps> = ({
  campaignId,
  personaTags,
  onTimingChange,
  onAudienceChange,
  initialScheduledAt
}) => {
  const [smartTiming, setSmartTiming] = useState<SmartTiming | null>(null);
  const [audienceSuggestions, setAudienceSuggestions] = useState<AudienceSuggestion[]>([]);
  const [selectedSegments, setSelectedSegments] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [autoSendEnabled, setAutoSendEnabled] = useState(false);
  const [useSmartTiming, setUseSmartTiming] = useState(true);
  const [customSendTime, setCustomSendTime] = useState('');

  useEffect(() => {
    if (campaignId && personaTags.length > 0) {
      loadSmartRecommendations();
    }
  }, [campaignId, personaTags]);

  useEffect(() => {
    if (initialScheduledAt) {
      setCustomSendTime(formatDateTimeLocal(initialScheduledAt));
    }
  }, [initialScheduledAt]);

  const loadSmartRecommendations = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('smart-send-timing', {
        body: {
          campaignId,
          personaTags,
          audienceData: {}
        }
      });

      if (error) throw error;

      if (data.smartTiming) {
        setSmartTiming(data.smartTiming);
        if (useSmartTiming) {
          onTimingChange(data.smartTiming.sendAt, data.smartTiming.reasoning);
        }
      }

      if (data.audienceSuggestions) {
        setAudienceSuggestions(data.audienceSuggestions);
        
        // Auto-select highest scoring segment if none selected
        if (selectedSegments.length === 0 && data.audienceSuggestions.length > 0) {
          const topSegment = data.audienceSuggestions[0];
          setSelectedSegments([topSegment.segment.id]);
          onAudienceChange([topSegment.segment.id]);
        }
      }
    } catch (error) {
      console.error('Failed to load smart recommendations:', error);
      toast.error('Failed to load smart recommendations');
    } finally {
      setLoading(false);
    }
  };

  const handleUseSmartTiming = (enabled: boolean) => {
    setUseSmartTiming(enabled);
    
    if (enabled && smartTiming) {
      onTimingChange(smartTiming.sendAt, smartTiming.reasoning);
      setCustomSendTime(formatDateTimeLocal(smartTiming.sendAt));
    } else if (!enabled && customSendTime) {
      const customDate = new Date(customSendTime).toISOString();
      onTimingChange(customDate, 'Custom timing selected by user');
    }
  };

  const handleCustomTimeChange = (value: string) => {
    setCustomSendTime(value);
    if (!useSmartTiming) {
      const customDate = new Date(value).toISOString();
      onTimingChange(customDate, 'Custom timing selected by user');
    }
  };

  const handleSegmentSelection = (segmentId: string, selected: boolean) => {
    let newSelection: string[];
    
    if (selected) {
      newSelection = [...selectedSegments, segmentId];
    } else {
      newSelection = selectedSegments.filter(id => id !== segmentId);
    }
    
    setSelectedSegments(newSelection);
    onAudienceChange(newSelection);
  };

  const getTotalAudience = () => {
    return audienceSuggestions
      .filter(suggestion => selectedSegments.includes(suggestion.segment.id))
      .reduce((total, suggestion) => total + suggestion.segment.customer_count, 0);
  };

  const formatDateTimeLocal = (isoString: string) => {
    const date = new Date(isoString);
    return date.toISOString().slice(0, 16);
  };

  const formatDisplayTime = (isoString: string) => {
    return new Date(isoString).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="space-y-6">
      {/* Auto-Send Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            Auto-Send Settings
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="auto-send">Enable auto-send for this campaign</Label>
              <p className="text-sm text-muted-foreground">
                Campaign will send automatically at the scheduled time
              </p>
            </div>
            <Switch
              id="auto-send"
              checked={autoSendEnabled}
              onCheckedChange={setAutoSendEnabled}
            />
          </div>

          {autoSendEnabled && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                You'll receive a notification 24 hours before send with the option to cancel.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Smart Timing */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Smart Send Timing
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <RefreshCw className="h-4 w-4 animate-spin" />
              Analyzing optimal send time...
            </div>
          ) : smartTiming ? (
            <>
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="use-smart-timing">Use AI-optimized timing</Label>
                  <p className="text-sm text-muted-foreground">
                    {smartTiming.reasoning}
                  </p>
                </div>
                <Switch
                  id="use-smart-timing"
                  checked={useSmartTiming}
                  onCheckedChange={handleUseSmartTiming}
                />
              </div>

              {useSmartTiming && (
                <div className="p-3 bg-primary/5 border border-primary/20 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle className="h-4 w-4 text-primary" />
                    <span className="font-medium text-primary">Recommended Send Time</span>
                    <Badge variant="secondary">
                      {Math.round(smartTiming.confidence * 100)}% confidence
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {formatDisplayTime(smartTiming.sendAt)}
                  </p>
                </div>
              )}

              <Separator />

              <div>
                <Label htmlFor="custom-time">Custom Send Time</Label>
                <input
                  id="custom-time"
                  type="datetime-local"
                  value={customSendTime}
                  onChange={(e) => handleCustomTimeChange(e.target.value)}
                  className="w-full mt-1 px-3 py-2 border border-border rounded-md"
                  disabled={useSmartTiming}
                />
              </div>
            </>
          ) : (
            <div className="text-center py-4 text-muted-foreground">
              Add persona tags to get smart timing recommendations
            </div>
          )}
        </CardContent>
      </Card>

      {/* Audience Suggestions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Smart Audience Targeting
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {audienceSuggestions.length > 0 ? (
            <>
              <div className="text-sm text-muted-foreground mb-4">
                AI-suggested segments based on your campaign theme and persona tags:
              </div>
              
              <div className="space-y-3">
                {audienceSuggestions.map((suggestion, index) => (
                  <div
                    key={suggestion.segment.id}
                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <input
                          type="checkbox"
                          checked={selectedSegments.includes(suggestion.segment.id)}
                          onChange={(e) => handleSegmentSelection(suggestion.segment.id, e.target.checked)}
                          className="rounded"
                        />
                        <span className="font-medium">{suggestion.segment.name}</span>
                        <Badge variant={index === 0 ? 'default' : 'secondary'}>
                          {Math.round(suggestion.confidence * 100)}% match
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {suggestion.segment.customer_count} customers • {suggestion.reasons.join(', ')}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              {selectedSegments.length > 0 && (
                <div className="p-3 bg-secondary/50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    <span className="font-medium">
                      Total Audience: {getTotalAudience().toLocaleString()} customers
                    </span>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-4 text-muted-foreground">
              No audience suggestions available. Create segments to get recommendations.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};