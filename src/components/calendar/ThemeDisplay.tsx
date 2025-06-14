
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Edit2, FileText, Lightbulb } from "lucide-react";
import { GenerateContentPackButton } from "@/components/content/GenerateContentPackButton";

interface ThemeDisplayProps {
  campaignId: string;
  currentTheme: string;
  currentDescription?: string;
  weekNumber?: number;
  onEdit: () => void;
  onContentGenerated?: () => void;
}

export const ThemeDisplay = ({
  campaignId,
  currentTheme,
  currentDescription,
  weekNumber,
  onEdit,
  onContentGenerated
}: ThemeDisplayProps) => {
  const hasTheme = currentTheme && currentTheme.trim() !== "";
  const hasDescription = currentDescription && currentDescription.trim() !== "";
  const canGenerateContent = hasTheme && hasDescription;

  return (
    <div className="space-y-4">
      {currentTheme ? (
        <div className="space-y-4">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-3">
                <Lightbulb className="w-5 h-5 text-yellow-600" />
                <h4 className="font-semibold text-gray-900">Theme</h4>
              </div>
              <p className="text-gray-800 font-medium mb-3">{currentTheme}</p>
              
              {currentDescription && (
                <>
                  <div className="flex items-center gap-2 mb-2">
                    <FileText className="w-4 h-4 text-blue-600" />
                    <h5 className="font-medium text-gray-700">Description</h5>
                  </div>
                  <p className="text-gray-600 text-sm leading-relaxed">{currentDescription}</p>
                </>
              )}
            </div>
            
            <Button
              size="sm"
              variant="outline"
              onClick={onEdit}
              className="flex items-center gap-2 ml-4"
            >
              <Edit2 className="w-4 h-4" />
              Edit
            </Button>
          </div>

          {/* Generate Content Pack Section */}
          {canGenerateContent && (
            <div className="border-t border-gray-200 pt-4">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h5 className="font-medium text-green-900 mb-2">Ready to Generate Content</h5>
                    <p className="text-sm text-green-700 mb-3">
                      Your theme and description are set. Generate 5 pieces of professional content for this campaign.
                    </p>
                  </div>
                  <GenerateContentPackButton
                    campaignId={campaignId}
                    campaignTitle={currentTheme}
                    theme={currentTheme}
                    description={currentDescription}
                    weekNumber={weekNumber}
                    onGenerated={onContentGenerated}
                    size="sm"
                    className="ml-4"
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="text-center py-6">
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <p className="text-amber-800 text-sm">
              <strong>No theme set.</strong> Click "Edit Theme" to add a theme and description for this campaign.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
