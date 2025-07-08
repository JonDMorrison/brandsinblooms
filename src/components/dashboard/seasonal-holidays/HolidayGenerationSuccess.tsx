
import { Button } from "@/components/ui/button";
import { Eye } from "lucide-react";

interface HolidayGenerationSuccessProps {
  contentCount: number;
  holidayName: string;
  onViewContent: () => void;
}

export const HolidayGenerationSuccess = ({ 
  contentCount, 
  holidayName, 
  onViewContent 
}: HolidayGenerationSuccessProps) => {
  return (
    <div className="space-y-3 p-4 bg-mint-100 border border-mint-200 rounded-lg">
      <div className="text-sm text-mint-700 font-medium">
        {contentCount} post{contentCount !== 1 ? 's' : ''}
      </div>
      <Button 
        onClick={onViewContent}
        size="sm"
        className="bg-mint-600 hover:bg-mint-700"
      >
        <Eye className="w-4 h-4 mr-2" />
        Review Content
      </Button>
    </div>
  );
};
