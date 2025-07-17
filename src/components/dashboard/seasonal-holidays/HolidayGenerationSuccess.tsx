
import { Button } from "@/components/ui/button";
import { Eye, Mail } from "lucide-react";
import { useNavigate } from "react-router-dom";

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
  const navigate = useNavigate();

  const handleUseinCRM = () => {
    const searchParams = new URLSearchParams({
      source: 'seasonal_event',
      holiday_id: holiday?.id || '',
      holiday_name: holidayName
    });
    navigate(`/crm/campaigns/new?${searchParams.toString()}`);
  };

  return (
    <div className="flex gap-2">
      <Button 
        onClick={onViewContent}
        size="sm"
        variant="outline"
        className="flex-1"
      >
        <Eye className="w-4 h-4 mr-2" />
        Review
      </Button>
      <Button 
        onClick={handleUseinCRM}
        size="sm"
        className="bg-blue-600 hover:bg-blue-700 flex-1"
      >
        <Mail className="w-4 h-4 mr-2" />
        Use in CRM
      </Button>
    </div>
  );
};
