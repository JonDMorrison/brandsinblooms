
import { Badge } from "@/components/ui/badge";
import { DialogTitle } from "@/components/ui/dialog";

interface UpcomingContentModalHeaderProps {
  week: any;
  approvedContent: Record<string, boolean>;
  generatedContent: Record<string, string>;
}

export const UpcomingContentModalHeader = ({ 
  week, 
  approvedContent, 
  generatedContent 
}: UpcomingContentModalHeaderProps) => {
  const approvedCount = Object.values(approvedContent).filter(Boolean).length;
  const generatedCount = Object.keys(generatedContent).length;

  return (
    <div className="space-y-4 pb-6 border-b">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 px-3 py-1">
              Week {week.weekNumber}
            </Badge>
            <DialogTitle className="text-2xl font-bold">{week.theme}</DialogTitle>
          </div>
          <p className="text-gray-600 text-lg">
            Week of {week.weekStart.toLocaleDateString()} • {week.description}
          </p>
          <p className="text-sm text-blue-600 font-medium">
            All content below will be generated specifically for: "{week.theme}" theme
          </p>
        </div>
        <div className="text-right space-y-1">
          <div className="text-sm text-gray-500">Progress</div>
          <div className="text-lg font-semibold text-gray-900">
            {approvedCount}/5 Approved
          </div>
          <div className="text-sm text-gray-500">
            {generatedCount}/5 Generated
          </div>
        </div>
      </div>
    </div>
  );
};
