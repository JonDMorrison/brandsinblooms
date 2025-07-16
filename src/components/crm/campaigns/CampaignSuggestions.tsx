import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { Target, Sparkles, Calendar } from 'lucide-react';

interface CampaignTemplate {
  id: string;
  title: string;
  description: string;
  season: string;
  tags: string[];
  ai_prompt_context: string;
  campaign_type: string;
  persona_id: string;
  created_at: string;
}

interface Persona {
  id: string;
  name: string;
  icon: string;
  color_theme: string;
}

interface CampaignSuggestionsProps {
  dominantPersona: Persona;
  campaignType: 'email' | 'sms';
  onSuggestionSelect: (suggestion: CampaignTemplate) => void;
}

export const CampaignSuggestions: React.FC<CampaignSuggestionsProps> = ({
  dominantPersona,
  campaignType,
  onSuggestionSelect
}) => {
  const [suggestions, setSuggestions] = useState<CampaignTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSuggestions();
  }, [dominantPersona.id, campaignType]);

  const loadSuggestions = async () => {
    try {
      setLoading(true);
      
      // Get current season for filtering
      const currentMonth = new Date().getMonth() + 1;
      let currentSeason = 'all';
      if (currentMonth >= 3 && currentMonth <= 5) currentSeason = 'spring';
      else if (currentMonth >= 6 && currentMonth <= 8) currentSeason = 'summer';
      else if (currentMonth >= 9 && currentMonth <= 11) currentSeason = 'fall';
      else currentSeason = 'winter';

      const { data, error } = await supabase
        .from('crm_persona_campaign_templates')
        .select('*')
        .eq('persona_id', dominantPersona.id)
        .eq('campaign_type', campaignType)
        .or(`season.eq.all,season.eq.${currentSeason}`)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setSuggestions(data || []);
    } catch (error) {
      console.error('Error loading campaign suggestions:', error);
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  };

  const getSeasonIcon = (season: string) => {
    switch (season) {
      case 'spring': return '🌸';
      case 'summer': return '☀️';
      case 'fall': return '🍂';
      case 'winter': return '❄️';
      default: return '📅';
    }
  };

  const getSeasonColor = (season: string) => {
    switch (season) {
      case 'spring': return 'bg-green-100 text-green-800 border-green-200';
      case 'summer': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'fall': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'winter': return 'bg-blue-100 text-blue-800 border-blue-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            🎯 Campaign Suggestions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4 text-muted-foreground">
            Loading suggestions...
          </div>
        </CardContent>
      </Card>
    );
  }

  if (suggestions.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            🎯 Campaign Suggestions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4 text-muted-foreground">
            No campaign suggestions available for this persona.
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Target className="h-5 w-5" />
          🎯 Campaign Suggestions
        </CardTitle>
        <div className="flex items-center gap-2 mt-2">
          <Badge 
            variant="secondary" 
            className="text-xs"
            style={{ backgroundColor: dominantPersona.color_theme + '20', color: dominantPersona.color_theme }}
          >
            {dominantPersona.icon} For {dominantPersona.name}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {suggestions.map((suggestion) => (
          <div
            key={suggestion.id}
            className="border border-border rounded-lg p-4 hover:border-primary/50 transition-colors"
          >
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-2">
                <h4 className="font-medium text-sm leading-tight">{suggestion.title}</h4>
                {suggestion.season !== 'all' && (
                  <Badge variant="outline" className={`text-xs shrink-0 ${getSeasonColor(suggestion.season)}`}>
                    {getSeasonIcon(suggestion.season)} {suggestion.season}
                  </Badge>
                )}
              </div>
              
              <p className="text-xs text-muted-foreground line-clamp-2">
                {suggestion.description}
              </p>
              
              {suggestion.tags && suggestion.tags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {suggestion.tags.slice(0, 3).map((tag, index) => (
                    <Badge key={index} variant="outline" className="text-xs px-2 py-0">
                      {tag}
                    </Badge>
                  ))}
                  {suggestion.tags.length > 3 && (
                    <Badge variant="outline" className="text-xs px-2 py-0">
                      +{suggestion.tags.length - 3}
                    </Badge>
                  )}
                </div>
              )}
              
              <Button
                size="sm"
                onClick={() => onSuggestionSelect(suggestion)}
                className="w-full text-xs"
              >
                <Sparkles className="h-3 w-3 mr-1" />
                Use this idea → Generate with AI
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};