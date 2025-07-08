
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
    <Button 
      onClick={onViewContent}
      size="sm"
      className="bg-mint-600 hover:bg-mint-700 w-full"
    >
      <Eye className="w-4 h-4 mr-2" />
      Review Content
    </Button>
  );
};
