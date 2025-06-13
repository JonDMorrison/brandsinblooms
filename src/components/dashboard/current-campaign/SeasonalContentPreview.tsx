
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, Sparkles, Leaf, Eye, Wand2 } from "lucide-react";
import type { Campaign } from "@/types";

interface SeasonalContentPreviewProps {
  campaign: Campaign;
  onGenerateContent?: () => void;
  hasContent?: boolean;
}

export const SeasonalContentPreview = ({ 
  campaign, 
  onGenerateContent,
  hasContent = false 
}: SeasonalContentPreviewProps) => {
  const getSeasonalInfo = () => {
    const month = new Date().getMonth() + 1;
    
    if (month >= 3 && month <= 5) {
      return { season: 'Spring', emoji: '🌸', color: 'bg-green-100 text-green-800' };
    } else if (month >= 6 && month <= 8) {
      return { season: 'Summer', emoji: '☀️', color: 'bg-yellow-100 text-yellow-800' };
    } else if (month >= 9 && month <= 11) {
      return { season: 'Fall', emoji: '🍂', color: 'bg-orange-100 text-orange-800' };
    } else {
      return { season: 'Winter', emoji: '❄️', color: 'bg-blue-100 text-blue-800' };
    }
  };

  const seasonalInfo = getSeasonalInfo();
  const isAnnualTheme = campaign.source === 'annual_themes';

  return (
    <Card className="mt-6 border-l-4 border-l-primary bg-gradient-to-r from-white to-primary/5">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            {isAnnualTheme ? 'Seasonal Marketing Focus' : 'Weekly Content Theme'}
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge className={seasonalInfo.color}>
              {seasonalInfo.emoji} {seasonalInfo.season}
            </Badge>
            {isAnnualTheme && (
              <Badge variant="outline" className="text-purple-700 border-purple-200 bg-purple-50">
                <Calendar className="w-3 h-3 mr-1" />
                Annual Theme
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="bg-gradient-to-r from-primary/5 to-primary/10 p-4 rounded-lg border border-primary/20">
          <h4 className="font-semibold text-gray-800 mb-2 flex items-center gap-2">
            <Leaf className="w-4 h-4 text-green-600" />
            This Week's Focus
          </h4>
          <p className="text-sm leading-relaxed text-gray-700">
            {campaign.description || "This week's content focuses on seasonal gardening activities and products that resonate with your customers' current needs and the natural growing cycle."}
          </p>
        </div>
        
        {campaign.prompt && (
          <div className="bg-gray-50 p-4 rounded-lg border">
            <h4 className="text-sm font-medium text-gray-800 mb-2 flex items-center gap-1">
              <Sparkles className="w-4 h-4 text-purple-600" />
              Content Strategy
            </h4>
            <p className="text-xs text-gray-600 leading-relaxed">
              {campaign.prompt.length > 200 
                ? campaign.prompt.substring(0, 200) + '...'
                : campaign.prompt}
            </p>
          </div>
        )}
        
        <div className="flex items-center justify-between pt-2 border-t border-gray-100">
          <div className="text-xs text-gray-500">
            {isAnnualTheme 
              ? '🎯 AI-powered seasonal themes based on gardening calendar'
              : '📅 Custom weekly marketing campaign'
            }
          </div>
          
          {onGenerateContent && (
            <Button 
              onClick={onGenerateContent}
              size="sm"
              className="bg-primary hover:bg-primary/90"
            >
              {hasContent ? (
                <>
                  <Eye className="w-3 h-3 mr-1" />
                  View Content
                </>
              ) : (
                <>
                  <Wand2 className="w-3 h-3 mr-1" />
                  Generate Content
                </>
              )}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
