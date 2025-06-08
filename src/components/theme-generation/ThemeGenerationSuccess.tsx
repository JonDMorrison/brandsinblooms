
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

interface WeeklyTheme {
  week: number;
  title: string;
  description: string;
  content_ideas: string[];
}

interface ThemeGenerationSuccessProps {
  themes: WeeklyTheme[];
  loading: boolean;
  onSaveToCampaigns: () => void;
}

export const ThemeGenerationSuccess = ({ themes, loading, onSaveToCampaigns }: ThemeGenerationSuccessProps) => {
  return (
    <div className="space-y-3 p-4 bg-green-50 border border-green-200 rounded-lg">
      <div className="text-sm text-green-700 font-medium">
        ✅ Generated {themes.length} themes
      </div>
      <Button 
        onClick={onSaveToCampaigns}
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
          `Save All ${themes.length} Themes`
        )}
      </Button>
    </div>
  );
};
