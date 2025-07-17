
import { Button } from "@/components/ui/button";
import { Eye } from "lucide-react";

interface HolidayGenerationSuccessProps {
  contentCount: number;
  holidayName: string;
  holiday?: any;
  onViewContent: () => void;
}

export const HolidayGenerationSuccess = ({ 
  contentCount, 
  holidayName, 
  holiday,
  onViewContent 
}: HolidayGenerationSuccessProps) => {

  return (
    <Button 
      onClick={onViewContent}
      size="sm"
      variant="outline"
    >
      <Eye className="w-4 h-4 mr-2" />
      Review
    </Button>
  );
};
