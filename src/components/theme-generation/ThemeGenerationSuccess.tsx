
import { Button } from "@/components/ui-legacy/button";
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
    <div className="space-y-3 p-4 bg-blue-50 border border-blue-200 rounded-lg">
      <div className="text-sm text-blue-900 font-medium">
        ✅ Generated {themes.length} themes
      </div>
      <Button 
        onClick={onSaveToCampaigns}
        disabled={loading}
        size="sm"
        className="bg-blue-800 hover:bg-blue-900"
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
