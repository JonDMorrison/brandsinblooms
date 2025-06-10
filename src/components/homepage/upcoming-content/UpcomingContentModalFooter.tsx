
import { Button } from "@/components/ui/button";

interface UpcomingContentModalFooterProps {
  approvedContent: Record<string, boolean>;
  onClose: () => void;
}

export const UpcomingContentModalFooter = ({ 
  approvedContent, 
  onClose 
}: UpcomingContentModalFooterProps) => {
  const approvedCount = Object.values(approvedContent).filter(Boolean).length;

  return (
    <div className="flex justify-between items-center pt-6 border-t">
      <div className="text-sm text-gray-500">
        {approvedCount > 0 && (
          <span className="text-green-600 font-medium">
            {approvedCount} content piece{approvedCount !== 1 ? 's' : ''} approved
          </span>
        )}
      </div>
      <div className="flex gap-3">
        <Button variant="outline" onClick={onClose} className="transition-all duration-200">
          Close
        </Button>
        <Button onClick={onClose} className="bg-green-600 hover:bg-green-700 transition-all duration-200">
          Save & Continue
        </Button>
      </div>
    </div>
  );
};
