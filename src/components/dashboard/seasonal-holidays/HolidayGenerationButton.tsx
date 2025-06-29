
import { Button } from "@/components/ui/button";
import { Loader2, Sparkles, AlertCircle } from "lucide-react";

interface HolidayGenerationButtonProps {
  loading: boolean;
  networkError?: boolean;
  onGenerate: () => void;
  holidayName: string;
}

export const HolidayGenerationButton = ({ 
  loading, 
  networkError, 
  onGenerate, 
  holidayName 
}: HolidayGenerationButtonProps) => {
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
        className="bg-brand hover:bg-brand/90 w-full"
      >
        {loading ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Generating...
          </>
        ) : (
          <>
            <Sparkles className="w-4 h-4 mr-2" />
            Generate Content & Review
          </>
        )}
      </Button>
    </div>
  );
};
