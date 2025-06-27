
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
    <div className="space-y-3 p-4 bg-green-50 border border-green-200 rounded-lg">
      <div className="text-sm text-green-700 font-medium">
        ✅ Generated {contentCount} pieces of content
      </div>
      <Button 
        onClick={onViewContent}
        size="sm"
        className="bg-green-600 hover:bg-green-700"
      >
        <Eye className="w-4 h-4 mr-2" />
        Review Content
      </Button>
    </div>
  );
};
