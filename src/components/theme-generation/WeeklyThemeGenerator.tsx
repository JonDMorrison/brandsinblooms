
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Loader2, Calendar, Sparkles, AlertCircle } from "lucide-react";

interface WeeklyTheme {
  week: number;
  title: string;
  description: string;
  content_ideas: string[];
}

interface WeeklyThemeGeneratorProps {
  onThemesGenerated?: (themes: WeeklyTheme[]) => void;
}

export const WeeklyThemeGenerator = ({ onThemesGenerated }: WeeklyThemeGeneratorProps) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [generatedThemes, setGeneratedThemes] = useState<WeeklyTheme[]>([]);
  const [networkError, setNetworkError] = useState(false);

  const generateFallbackThemes = () => {
    const fallbackThemes: WeeklyTheme[] = [
      { week: 1, title: "New Year Garden Planning", description: "Start the year with garden planning and goal setting. Focus on what plants and projects customers want to tackle this year.", content_ideas: ["Garden planning worksheets", "Goal setting tips", "Year-round planning calendar"] },
      { week: 2, title: "Winter Plant Care", description: "Essential winter care tips for houseplants and outdoor gardens. Help customers keep their plants healthy during cold months.", content_ideas: ["Winter watering schedules", "Indoor humidity tips", "Protecting outdoor plants"] },
      { week: 3, title: "Seed Starting Prep", description: "Get ready for seed starting season. Showcase supplies and techniques for starting seeds indoors.", content_ideas: ["Seed starting supplies", "Timing charts", "Germination tips"] },
      { week: 4, title: "Houseplant Spotlight", description: "Feature popular houseplants perfect for winter months. Focus on low-light and air-purifying varieties.", content_ideas: ["Plant care guides", "Air-purifying plants", "Low-light options"] },
      { week: 5, title: "Garden Tool Maintenance", description: "Winter is perfect for cleaning and maintaining garden tools. Share tips for tool care and storage.", content_ideas: ["Tool cleaning tips", "Sharpening guides", "Storage solutions"] }
    ];

    setGeneratedThemes(fallbackThemes);
    toast.success(`Generated ${fallbackThemes.length} starter themes! You can customize these and generate more later.`);
    onThemesGenerated?.(fallbackThemes);
  };

  const generateWeeklyThemes = async () => {
    if (!user) {
      toast.error('Please log in to generate themes');
      return;
    }

    setLoading(true);
    setNetworkError(false);
    
    try {
      console.log('Generating 52-week themes for user:', user.id);
      
      const { data, error } = await supabase.functions.invoke('generate-weekly-themes', {
        body: { 
          userId: user.id,
          startYear: new Date().getFullYear()
        }
      });

      if (error) {
        console.error('Error generating themes:', error);
        
        // Check if it's a network error
        if (error.message?.includes('Failed to send a request') || error.message?.includes('Failed to fetch')) {
          setNetworkError(true);
          toast.error('Network connection issue. You can use starter themes while we resolve this.');
          generateFallbackThemes();
          return;
        }
        
        throw new Error(error.message || 'Failed to generate themes');
      }

      if (data?.themes && Array.isArray(data.themes)) {
        setGeneratedThemes(data.themes);
        onThemesGenerated?.(data.themes);
        toast.success(`Generated ${data.themes.length} unique weekly themes!`);
      } else {
        throw new Error('Invalid response format from theme generator');
      }
    } catch (error: any) {
      console.error('Error generating weekly themes:', error);
      
      // If it's a network error, offer fallback
      if (error.message?.includes('Failed to fetch') || error.message?.includes('network')) {
        setNetworkError(true);
        toast.error('Connection issue detected. Using starter themes instead.');
        generateFallbackThemes();
      } else {
        toast.error(error.message || 'Failed to generate weekly themes');
      }
    } finally {
      setLoading(false);
    }
  };

  const saveToCampaigns = async () => {
    if (!generatedThemes.length || !user) return;

    setLoading(true);
    try {
      const campaigns = generatedThemes.map((theme, index) => {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() + (index * 7));
        
        return {
          week_number: theme.week,
          title: theme.title,
          theme: theme.title,
          description: theme.description,
          start_date: startDate.toISOString().split('T')[0],
          prompt: theme.content_ideas.join(' • ')
        };
      });

      const { error } = await supabase
        .from('campaigns')
        .insert(campaigns);

      if (error) {
        throw new Error(error.message);
      }

      toast.success(`${generatedThemes.length}-week campaign calendar created successfully!`);
      setGeneratedThemes([]);
    } catch (error: any) {
      console.error('Error saving campaigns:', error);
      toast.error(error.message || 'Failed to save campaigns');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-purple-600" />
          AI Weekly Theme Generator
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-sm text-gray-600">
          Generate a complete 52-week content calendar with unique, seasonal themes tailored to your garden center.
        </div>

        {networkError && (
          <div className="flex items-center gap-2 p-3 bg-orange-50 border border-orange-200 rounded-lg">
            <AlertCircle className="w-4 h-4 text-orange-600" />
            <div className="text-sm text-orange-700">
              AI service temporarily unavailable. Starter themes provided to get you going!
            </div>
          </div>
        )}

        <Button 
          onClick={generateWeeklyThemes}
          disabled={loading}
          className="bg-purple-600 hover:bg-purple-700"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Generating Themes...
            </>
          ) : (
            <>
              <Calendar className="w-4 h-4 mr-2" />
              Generate 52-Week Theme Calendar
            </>
          )}
        </Button>

        {generatedThemes.length > 0 && (
          <div className="space-y-4">
            <div className="text-sm text-green-600 font-medium">
              ✅ Generated {generatedThemes.length} unique weekly themes
            </div>
            
            <div className="max-h-48 overflow-y-auto space-y-2 p-4 bg-gray-50 rounded-lg">
              {generatedThemes.slice(0, 5).map((theme) => (
                <div key={theme.week} className="text-xs">
                  <span className="font-medium">Week {theme.week}:</span> {theme.title}
                </div>
              ))}
              {generatedThemes.length > 5 && (
                <div className="text-xs text-gray-500">
                  ...and {generatedThemes.length - 5} more themes
                </div>
              )}
            </div>

            <Button 
              onClick={saveToCampaigns}
              disabled={loading}
              className="w-full bg-green-600 hover:bg-green-700"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving to Campaign Calendar...
                </>
              ) : (
                `Save All ${generatedThemes.length} Themes to Campaign Calendar`
              )}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
