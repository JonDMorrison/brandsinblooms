
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, Sparkles, Eye, Plus } from "lucide-react";
import { format } from "date-fns";

interface CustomContentItemProps {
  campaign: any;
  onGenerateContent: (campaignId: string) => Promise<void>;
  onViewContent: (campaignId: string, campaignTitle: string) => void;
  isGenerating: boolean;
  contentState?: any;
}

export const CustomContentItem = ({ 
  campaign, 
  onGenerateContent, 
  onViewContent, 
  isGenerating, 
  contentState 
}: CustomContentItemProps) => {
  const hasContent = contentState && contentState.contentCount > 0;

  const handleGenerateClick = () => {
    onGenerateContent(campaign.id);
  };

  const handleViewClick = () => {
    onViewContent(campaign.id, campaign.title);
  };

  // Format date safely with validation
  const formatCampaignDate = (dateString: string) => {
    if (!dateString) return "Date not available";
    
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return "Date not available";
      return format(date, "MMMM dd, yyyy");
    } catch (error) {
      return "Date not available";
    }
  };

  return (
    <Card className="mb-4 hover:shadow-md transition-shadow">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Plus className="w-5 h-5 text-blue-500" />
          {campaign.title}
        </CardTitle>
        <p className="text-sm text-gray-500">
          <Calendar className="w-4 h-4 mr-1 inline-block" />
          {formatCampaignDate(campaign.created_at)}
        </p>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {campaign.description && (
            <p className="text-sm text-gray-600">{campaign.description}</p>
          )}
          
          <div className="flex gap-2">
            {!hasContent ? (
              <Button
                onClick={handleGenerateClick}
                disabled={isGenerating}
                className="flex items-center gap-2"
                size="sm"
              >
                <Sparkles className="w-4 h-4" />
                {isGenerating ? 'Generating...' : 'Generate Content'}
              </Button>
            ) : (
              <div className="flex gap-2">
                <Button
                  onClick={handleViewClick}
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-2"
                >
                  <Eye className="w-4 h-4" />
                  View Content ({contentState.contentCount})
                </Button>
                <Button
                  onClick={handleGenerateClick}
                  disabled={isGenerating}
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-2"
                >
                  <Sparkles className="w-4 h-4" />
                  {isGenerating ? 'Regenerating...' : 'Regenerate'}
                </Button>
              </div>
            )}
          </div>

          {hasContent && (
            <div className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded">
              ✓ Content ready for {contentState.contentCount} post{contentState.contentCount !== 1 ? 's' : ''}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
