
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
// Removed sonner import - using global toast replacement
import { Sparkles, RefreshCw } from "lucide-react";

interface SmartTheme {
  title: string;
  description: string;
  confidence: number;
  reason: string;
}

interface SmartThemeSelectorProps {
  weekNumber: number;
  currentMonth: number;
  onThemeSelected: (theme: string, description: string) => void;
}

export const SmartThemeSelector = ({ weekNumber, currentMonth, onThemeSelected }: SmartThemeSelectorProps) => {
  const { user } = useAuth();
  const [suggestedThemes, setSuggestedThemes] = useState<SmartTheme[]>([]);
  const [loading, setLoading] = useState(false);

  const generateSmartThemes = async () => {
    if (!user) return;

    setLoading(true);
    try {
      // Get month name for context
      const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'];
      const monthName = monthNames[currentMonth - 1];

      const { data, error } = await supabase.functions.invoke('generate-theme-description', {
        body: { 
          theme: `Week ${weekNumber} in ${monthName} - Smart seasonal garden center theme`
        }
      });

      if (error) {
        throw new Error(error.message);
      }

      // Generate multiple theme options
      const themes: SmartTheme[] = [
        {
          title: getSeasonalTheme(currentMonth, weekNumber),
          description: data.description || getDefaultDescription(currentMonth),
          confidence: 95,
          reason: "Based on seasonal gardening patterns"
        },
        {
          title: getPromotionalTheme(weekNumber),
          description: "Focus on driving sales with targeted promotions and featured products",
          confidence: 85,
          reason: "Promotional opportunity"
        },
        {
          title: getEducationalTheme(currentMonth),
          description: "Provide valuable gardening education and build customer expertise",
          confidence: 90,
          reason: "Educational value"
        }
      ];

      setSuggestedThemes(themes);
    } catch (error: any) {
      console.error('Error generating smart themes:', error);
      toast.error('Failed to generate theme suggestions');
    } finally {
      setLoading(false);
    }
  };

  const getSeasonalTheme = (month: number, week: number): string => {
    if (month >= 3 && month <= 5) {
      const springThemes = ['Spring Awakening', 'New Growth Focus', 'Planting Preparation', 'Garden Revival'];
      return springThemes[week % springThemes.length];
    } else if (month >= 6 && month <= 8) {
      const summerThemes = ['Summer Care Essentials', 'Heat-Resistant Solutions', 'Harvest Celebration', 'Watering Wisdom'];
      return summerThemes[week % summerThemes.length];
    } else if (month >= 9 && month <= 11) {
      const fallThemes = ['Autumn Preparations', 'Fall Color Showcase', 'Winter Prep Week', 'Seasonal Transitions'];
      return fallThemes[week % fallThemes.length];
    } else {
      const winterThemes = ['Indoor Garden Focus', 'Planning & Dreaming', 'Winter Protection', 'Holiday Greenery'];
      return winterThemes[week % winterThemes.length];
    }
  };

  const getPromotionalTheme = (week: number): string => {
    const promoThemes = ['Flash Sale Week', 'New Arrivals Spotlight', 'Customer Favorites', 'Bulk Buy Benefits'];
    return promoThemes[week % promoThemes.length];
  };

  const getEducationalTheme = (month: number): string => {
    const eduThemes = ['Expert Tips Week', 'How-To Guides', 'Plant Care Mastery', 'Problem Solving Focus'];
    return eduThemes[month % eduThemes.length];
  };

  const getDefaultDescription = (month: number): string => {
    if (month >= 3 && month <= 5) {
      return "Spring content focusing on new growth, planting, and garden preparation for the growing season.";
    } else if (month >= 6 && month <= 8) {
      return "Summer content emphasizing plant care, watering, and maintaining healthy gardens in hot weather.";
    } else if (month >= 9 && month <= 11) {
      return "Fall content covering seasonal preparations, autumn planting, and winter garden protection.";
    } else {
      return "Winter content featuring indoor gardening, planning for next year, and holiday plant care.";
    }
  };

  useEffect(() => {
    generateSmartThemes();
  }, [weekNumber, currentMonth, user]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-purple-600" />
          Smart Theme Suggestions
        </h3>
        <Button
          size="sm"
          variant="outline"
          onClick={generateSmartThemes}
          disabled={loading}
          className="h-7 px-2"
        >
          <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      <div className="space-y-2">
        {suggestedThemes.map((theme, index) => (
          <Card 
            key={index}
            className="cursor-pointer hover:bg-blue-50 transition-colors border-blue-200"
            onClick={() => onThemeSelected(theme.title, theme.description)}
          >
            <CardContent className="p-3">
              <div className="flex items-start justify-between mb-2">
                <h4 className="font-medium text-sm">{theme.title}</h4>
                <Badge variant="secondary" className="text-xs">
                  {theme.confidence}%
                </Badge>
              </div>
              <p className="text-xs text-gray-600 mb-2">{theme.description}</p>
              <div className="text-xs text-blue-600">{theme.reason}</div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};
