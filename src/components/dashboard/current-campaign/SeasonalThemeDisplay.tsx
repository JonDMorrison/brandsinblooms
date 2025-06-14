
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Leaf, Droplets, Sun, Snowflake, Crown } from "lucide-react";
import type { Campaign } from "@/types";

interface SeasonalThemeDisplayProps {
  campaign: Campaign;
}

export const SeasonalThemeDisplay = ({ campaign }: SeasonalThemeDisplayProps) => {
  const getSeasonalIcon = () => {
    const month = new Date().getMonth() + 1;
    
    if (month >= 3 && month <= 5) {
      return { icon: Leaf, color: "text-green-600", season: "Spring" };
    } else if (month >= 6 && month <= 8) {
      return { icon: Sun, color: "text-yellow-600", season: "Summer" };
    } else if (month >= 9 && month <= 11) {
      return { icon: Droplets, color: "text-orange-600", season: "Fall" };
    } else {
      return { icon: Snowflake, color: "text-blue-600", season: "Winter" };
    }
  };

  const getSourceIcon = () => {
    switch (campaign.source) {
      case 'master_templates':
        return { icon: Crown, label: "Curated Theme", color: "text-purple-600" };
      case 'seasonal_garden_themes':
        return { icon: Leaf, label: "Seasonal Focus", color: "text-green-600" };
      default:
        return { icon: Leaf, label: "Garden Theme", color: "text-gray-600" };
    }
  };

  const seasonalInfo = getSeasonalIcon();
  const sourceInfo = getSourceIcon();
  const SeasonIcon = seasonalInfo.icon;
  const SourceIcon = sourceInfo.icon;

  return (
    <Card className="border-l-4 border-l-primary bg-gradient-to-r from-primary/5 to-primary/10">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <SeasonIcon className={`w-5 h-5 ${seasonalInfo.color}`} />
            {seasonalInfo.season} Theme
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">
              <SourceIcon className={`w-3 h-3 mr-1 ${sourceInfo.color}`} />
              {sourceInfo.label}
            </Badge>
            <Badge variant="secondary">Week {campaign.week_number}</Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <h3 className="text-xl font-bold text-gray-900 mb-2">{campaign.title}</h3>
          {campaign.theme && campaign.theme !== campaign.title && (
            <p className="text-lg font-semibold text-primary mb-3">{campaign.theme}</p>
          )}
        </div>

        {campaign.description && (
          <div className="bg-white/80 backdrop-blur-sm p-4 rounded-lg border border-primary/20">
            <p className="text-sm leading-relaxed text-gray-700">
              {campaign.description}
            </p>
          </div>
        )}

        <div className="text-xs text-gray-600 bg-white/60 p-2 rounded border border-gray-200">
          🌱 Professional garden center content designed for {seasonalInfo.season.toLowerCase()} season
        </div>
      </CardContent>
    </Card>
  );
};
