
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Loader2, Sparkles, AlertCircle } from "lucide-react";

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

  // Show compact view when themes are generated
  if (generatedThemes.length > 0) {
    return (
      <div className="space-y-3 p-4 bg-green-50 border border-green-200 rounded-lg">
        <div className="text-sm text-green-700 font-medium">
          ✅ Generated {generatedThemes.length} themes
        </div>
        <Button 
          onClick={saveToCampaigns}
          disabled={loading}
          size="sm"
          className="bg-green-600 hover:bg-green-700"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            `Save All ${generatedThemes.length} Themes`
          )}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      {networkError && (
        <div className="flex items-center gap-1 text-xs text-gray-600">
          <AlertCircle className="w-3 h-3" />
          AI unavailable
        </div>
      )}
      <Button 
        onClick={generateWeeklyThemes}
        disabled={loading}
        size="sm"
        className="bg-purple-600 hover:bg-purple-700"
      >
        {loading ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Generating...
          </>
        ) : (
          <>
            <Sparkles className="w-4 h-4 mr-2" />
            Generate 52 Themes
          </>
        )}
      </Button>
    </div>
  );
};
