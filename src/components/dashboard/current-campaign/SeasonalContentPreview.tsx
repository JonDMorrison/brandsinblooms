
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, Sparkles, Leaf } from "lucide-react";
import type { Campaign } from "@/types";

interface SeasonalContentPreviewProps {
  campaign: Campaign;
}

export const SeasonalContentPreview = ({ campaign }: SeasonalContentPreviewProps) => {
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
    <Card className="mt-6 border-l-4 border-l-primary">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            Seasonal Content Focus
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge className={seasonalInfo.color}>
              {seasonalInfo.emoji} {seasonalInfo.season}
            </Badge>
            {isAnnualTheme && (
              <Badge variant="outline" className="text-purple-700 border-purple-200">
                <Calendar className="w-3 h-3 mr-1" />
                Annual Theme
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="bg-gradient-to-r from-primary/5 to-primary/10 p-4 rounded-lg border border-primary/20">
            <p className="text-sm leading-relaxed text-gray-700">
              {campaign.description || campaign.prompt || "This week's content will focus on seasonal gardening activities and products that resonate with your customers' current needs."}
            </p>
          </div>
          
          {campaign.prompt && campaign.description && (
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-gray-800 flex items-center gap-1">
                  <Leaf className="w-4 h-4 text-green-600" />
                  Content Strategy
                </h4>
                <p className="text-xs text-gray-600 bg-gray-50 p-3 rounded border">
                  {campaign.prompt.split('•').slice(0, 2).join('•')}
                </p>
              </div>
              
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-gray-800 flex items-center gap-1">
                  <Sparkles className="w-4 h-4 text-purple-600" />
                  AI Generated Content
                </h4>
                <p className="text-xs text-gray-600 bg-gray-50 p-3 rounded border">
                  Your social posts, newsletters, and marketing materials will automatically align with this seasonal theme for maximum customer engagement.
                </p>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
