
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Loader2, Calendar, Sparkles } from "lucide-react";

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

  const generateWeeklyThemes = async () => {
    if (!user) {
      toast.error('Please log in to generate themes');
      return;
    }

    setLoading(true);
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
      toast.error(error.message || 'Failed to generate weekly themes');
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

      toast.success('52-week campaign calendar created successfully!');
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

        <Button 
          onClick={generateWeeklyThemes}
          disabled={loading}
          className="w-full bg-purple-600 hover:bg-purple-700"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Generating 52 Unique Themes...
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
                'Save All 52 Themes to Campaign Calendar'
              )}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
