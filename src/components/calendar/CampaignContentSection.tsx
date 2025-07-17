
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp, FileText, AlertCircle, Eye } from "lucide-react";
import { ContentViewer } from "@/components/content/ContentViewer";
import { Badge } from "@/components/ui/badge";
import { ContentPackReviewModal } from "./ContentPackReviewModal";

interface CampaignContentSectionProps {
  campaignId: string;
  campaignTitle: string;
  hasTheme: boolean;
  hasDescription: boolean;
  onContentUpdate?: () => void;
}

export const CampaignContentSection = ({ 
  campaignId, 
  campaignTitle, 
  hasTheme, 
  hasDescription,
  onContentUpdate 
}: CampaignContentSectionProps) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showContentViewer, setShowContentViewer] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);

  const canGenerateContent = hasTheme && hasDescription;

  const handleViewContent = () => {
    setShowContentViewer(true);
  };

  const handleReviewGeneratedContent = () => {
    setShowReviewModal(true);
  };

  const handleContentUpdate = () => {
    if (onContentUpdate) {
      onContentUpdate();
    }
  };

  if (!canGenerateContent) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-md font-semibold text-gray-900 flex items-center gap-2">
            <FileText className="w-4 h-4" />
            Generated Content
          </h4>
          <Badge variant="outline" className="text-xs text-orange-600 border-orange-300">
            <AlertCircle className="w-3 h-3 mr-1" />
            Setup Required
          </Badge>
        </div>
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
          <p className="text-sm text-orange-700">
            Complete the theme and content focus above to enable content generation and review.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-md font-semibold text-gray-900 flex items-center gap-2">
          <FileText className="w-4 h-4" />
          Generated Content
        </h4>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={handleViewContent}
            variant="default"
          >
            <Eye className="w-4 h-4 mr-2" />
            Review Content
          </Button>
        </div>
      </div>

      {isExpanded && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <div className="space-y-3">
            <p className="text-sm text-gray-600">
              Generated content for this campaign will appear here after using the "Generate Content Pack" button above.
            </p>
            <div className="text-xs text-gray-500">
              Content types: Social media posts, email content, newsletter content, video scripts, and more.
            </div>
            <Button
              size="sm"
              onClick={handleReviewGeneratedContent}
              variant="default"
              className="w-full"
            >
              <Eye className="w-4 h-4 mr-2" />
              Review Content
            </Button>
          </div>
        </div>
      )}

      <ContentViewer
        campaignId={campaignId}
        campaignTitle={campaignTitle}
        isOpen={showContentViewer}
        onClose={() => setShowContentViewer(false)}
        onTaskUpdate={handleContentUpdate}
      />

      <ContentPackReviewModal
        campaignId={campaignId}
        campaignTitle={campaignTitle}
        isOpen={showReviewModal}
        onClose={() => setShowReviewModal(false)}
        onContentApproved={handleContentUpdate}
      />
    </div>
  );
};
