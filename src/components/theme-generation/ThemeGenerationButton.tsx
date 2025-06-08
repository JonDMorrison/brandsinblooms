
import { Button } from "@/components/ui/button";
import { Loader2, Sparkles, AlertCircle } from "lucide-react";

interface ThemeGenerationButtonProps {
  loading: boolean;
  networkError: boolean;
  onGenerate: () => void;
}

export const ThemeGenerationButton = ({ loading, networkError, onGenerate }: ThemeGenerationButtonProps) => {
  return (
    <div className="flex items-center gap-2">
      {networkError && (
        <div className="flex items-center gap-1 text-xs text-gray-600">
          <AlertCircle className="w-3 h-3" />
          AI unavailable
        </div>
      )}
      <Button 
        onClick={onGenerate}
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
