
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, Sparkles, Loader2, CheckCircle, AlertTriangle, RefreshCw, Wifi, WifiOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import { handleError } from "@/utils/errorHandling";

interface BackfillCampaignsProps {
  currentCampaignCount: number;
  onBackfillComplete: () => void;
}

const generateFallbackThemes = () => {
  const themes = [];
  const seasons = [
    {
      name: "Spring",
      themes: [
        "Spring Garden Awakening",
        "Early Season Planting Excellence", 
        "Spring Flower Power",
        "Soil Preparation Mastery",
        "Container Garden Success",
        "Spring Pest Prevention",
        "Seed Starting Success",
        "Spring Lawn Care",
        "Early Harvest Planning",
        "Spring Clean Garden Prep",
        "Cool Weather Crops",
        "Spring Fertilization",
        "Garden Tool Preparation"
      ]
    },
    {
      name: "Summer", 
      themes: [
        "Summer Heat Solutions",
        "Peak Season Harvest",
        "Water-Wise Gardening",
        "Summer Flower Care",
        "Heat-Tolerant Plants",
        "Summer Pest Management",
        "Drought Resistance",
        "Summer Pruning",
        "Mulching Mastery",
        "Summer Vegetables",
        "Shade Gardening",
        "Summer Composting",
        "Hot Weather Success"
      ]
    },
    {
      name: "Fall",
      themes: [
        "Autumn Garden Harvest",
        "Fall Planting Opportunities", 
        "Winter Preparation",
        "Fall Color Displays",
        "Leaf Management",
        "Fall Bulb Planting",
        "Season Extension",
        "Fall Cleanup",
        "Winter Protection",
        "Fall Fertilization",
        "Autumn Composting",
        "Fall Tree Care",
        "Winter Vegetable Prep"
      ]
    },
    {
      name: "Winter",
      themes: [
        "Winter Garden Planning",
        "Indoor Growing Success",
        "Holiday Plant Care",
        "Winter Interest Plants",
        "Greenhouse Management",
        "Tool Maintenance",
        "Seed Catalog Planning",
        "Winter Protection",
        "Houseplant Care",
        "Winter Bird Feeding",
        "Planning Next Season",
        "Winter Garden Dreams",
        "Cold Frame Gardening"
      ]
    }
  ];

  for (let week = 1; week <= 52; week++) {
    const seasonIndex = Math.floor((week - 1) / 13);
    const season = seasons[seasonIndex];
    const themeIndex = ((week - 1) % 13) % season.themes.length;
    
    themes.push({
      week: week,
      title: `${season.themes[themeIndex]} - Week ${week}`,
      description: `Seasonal garden center focus for ${season.name.toLowerCase()}: ${season.themes[themeIndex]}`,
      content_ideas: [
        `${season.name} gardening tips and techniques`,
        `Seasonal plant care and maintenance`,
        `Customer education and workshops`,
        `Product recommendations and displays`
      ]
    });
  }

  return themes;
};

export const BackfillCampaigns = ({ currentCampaignCount, onBackfillComplete }: BackfillCampaignsProps) => {
  const { user } = useAuth();
  const { isOnline } = useNetworkStatus();
  const [loading, setLoading] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  const saveCampaignsToDatabase = async (themes: any[]) => {
    if (!user) throw new Error('User not authenticated');

    const campaigns = themes.map((theme, index) => {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() + (index * 7));
      
      return {
        week_number: theme.week,
        title: theme.title,
        theme: theme.title,
        description: theme.description,
        start_date: startDate.toISOString().split('T')[0],
        prompt: theme.content_ideas.join(' • '),
        user_id: user.id,
        source: 'backfill_52_weeks'
      };
    });

    const { error: saveError } = await supabase
      .from('campaigns')
      .insert(campaigns);

    if (saveError) {
      throw new Error(saveError.message);
    }

    return campaigns.length;
  };

  const tryEdgeFunctionGeneration = async () => {
    const { data, error } = await supabase.functions.invoke('generate-weekly-themes', {
      body: { 
        userId: user.id,
        generateAll52Weeks: true,
        startYear: new Date().getFullYear()
      }
    });

    if (error) {
      throw error;
    }

    if (!data?.themes || !Array.isArray(data.themes)) {
      throw new Error('Invalid response format from theme generator');
    }

    return data.themes;
  };

  const handleBackfillCampaigns = async () => {
    if (!user) {
      toast.error('Please log in to generate campaigns');
      return;
    }

    setLoading(true);
    setError(null);
    
    try {
      console.log('🚀 Starting campaign backfill process...');
      
      let themes;
      let usingFallback = false;

      // Try the edge function first if online
      if (isOnline && retryCount < 2) {
        try {
          console.log('Attempting edge function generation...');
          themes = await tryEdgeFunctionGeneration();
          console.log('✅ Edge function generation successful');
        } catch (edgeError) {
          console.log('❌ Edge function failed, using fallback themes:', edgeError);
          const appError = handleError(edgeError, 'campaign generation');
          
          if (appError.isNetworkError) {
            toast.warning('Connection issue detected. Using built-in seasonal themes instead.');
          } else {
            toast.warning('Generation service unavailable. Using built-in seasonal themes instead.');
          }
          
          themes = generateFallbackThemes();
          usingFallback = true;
        }
      } else {
        console.log('Using fallback themes (offline or too many retries)');
        themes = generateFallbackThemes();
        usingFallback = true;
      }

      // Save themes to database
      const savedCount = await saveCampaignsToDatabase(themes);
      
      console.log(`✅ Successfully saved ${savedCount} campaigns`);
      setCompleted(true);
      
      const successMessage = usingFallback 
        ? `🎉 Generated complete 52-week garden center marketing calendar using seasonal themes!`
        : `🎉 Generated complete 52-week garden center marketing calendar!`;
      
      toast.success(successMessage);
      
      // Call the completion callback after a short delay
      setTimeout(() => {
        onBackfillComplete();
      }, 2000);
      
    } catch (error: any) {
      console.error('Error in backfill process:', error);
      const errorMessage = error.message || 'Failed to generate campaigns';
      setError(errorMessage);
      toast.error(`Generation failed: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  const handleRetry = () => {
    setRetryCount(prev => prev + 1);
    setError(null);
    handleBackfillCampaigns();
  };

  const missingCampaigns = 52 - currentCampaignCount;

  if (completed) {
    return (
      <Card className="border-green-200 bg-green-50">
        <CardContent className="p-6">
          <div className="flex items-center gap-3">
            <CheckCircle className="w-6 h-6 text-green-600" />
            <div>
              <h3 className="font-semibold text-green-900">Backfill Complete!</h3>
              <p className="text-sm text-green-700">Your full 52-week marketing calendar is now ready.</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error && !loading) {
    return (
      <Card className="border-red-200 bg-red-50">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-6 h-6 text-red-600" />
            <div>
              <CardTitle className="text-lg text-red-900">Generation Failed</CardTitle>
              <p className="text-sm text-red-700 mt-1">
                {error}
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex items-center gap-4">
            <Button 
              onClick={handleRetry}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Try Again
            </Button>
            <div className="flex items-center gap-2 text-sm text-red-600">
              {isOnline ? (
                <Wifi className="w-4 h-4" />
              ) : (
                <WifiOff className="w-4 h-4" />
              )}
              {isOnline ? 'Connected' : 'Offline - Will use built-in themes'}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-orange-200 bg-orange-50">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Calendar className="w-6 h-6 text-orange-600" />
            <div>
              <CardTitle className="text-lg text-orange-900">Complete Your Marketing Calendar</CardTitle>
              <p className="text-sm text-orange-700 mt-1">
                Generate your missing {missingCampaigns} weekly campaigns to have a full year planned
              </p>
            </div>
          </div>
          <Badge className="bg-orange-100 text-orange-800 border-orange-300">
            {currentCampaignCount}/52 campaigns
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex items-center gap-4">
          <Button 
            onClick={handleBackfillCampaigns}
            disabled={loading}
            className="bg-orange-600 hover:bg-orange-700 text-white"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Generating {missingCampaigns} campaigns...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 mr-2" />
                Generate Full Year ({missingCampaigns} campaigns)
              </>
            )}
          </Button>
          <div className="flex items-center gap-2 text-sm text-orange-600">
            {isOnline ? (
              <Wifi className="w-4 h-4" />
            ) : (
              <WifiOff className="w-4 h-4" />
            )}
            <span>
              {isOnline 
                ? 'Will create seasonal garden center themes for the entire year'
                : 'Offline mode - will use built-in seasonal themes'
              }
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
