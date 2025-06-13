
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Edit2, Sparkles, FileText, Lightbulb } from "lucide-react";
import { useState } from "react";
import { generateContentForCampaign } from "@/components/homepage/ContentGenerationServices";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

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
  const { user } = useAuth();
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerateContent = async () => {
    if (!user) {
      toast.error('Please log in to generate content');
      return;
    }

    setIsGenerating(true);
    try {
      const result = await generateContentForCampaign(
        campaignId,
        currentTheme,
        currentDescription || '',
        user.id,
        weekNumber
      );

      if (result.success) {
        toast.success('Content generated successfully!');
        if (onContentGenerated) {
          onContentGenerated();
        }
      } else {
        toast.error(result.message || 'Failed to generate content');
      }
    } catch (error) {
      console.error('Error generating content:', error);
      toast.error('Failed to generate content');
    } finally {
      setIsGenerating(false);
    }
  };

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

          <div className="flex justify-center">
            <Button
              onClick={handleGenerateContent}
              disabled={isGenerating}
              className="bg-green-600 hover:bg-green-700 text-white"
              size="lg"
            >
              {isGenerating ? (
                <>
                  <div className="w-4 h-4 mr-2 animate-spin border-2 border-white border-t-transparent rounded-full"></div>
                  Generating Content...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-2" />
                  Generate Content For This Campaign
                </>
              )}
            </Button>
          </div>
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
