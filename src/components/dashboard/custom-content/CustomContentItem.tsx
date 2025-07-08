
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Calendar, Sparkles, Eye, Plus, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { LoadingSpinner } from "@/components/ui/loading-spinner";

interface CustomContentItemProps {
  campaign: any;
  onGenerateContent: (campaignId: string) => Promise<void>;
  onViewContent: (campaignId: string, campaignTitle: string) => void;
  onDeleteCampaign: (campaignId: string) => Promise<void>;
  isGenerating: boolean;
  contentState?: any;
}

export const CustomContentItem = ({ 
  campaign, 
  onGenerateContent, 
  onViewContent, 
  onDeleteCampaign,
  isGenerating, 
  contentState 
}: CustomContentItemProps) => {
  const [isDeleting, setIsDeleting] = useState(false);
  const [isAnimatingOut, setIsAnimatingOut] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  
  const hasContent = contentState && contentState.contentCount > 0;

  const handleGenerateClick = () => {
    onGenerateContent(campaign.id);
  };

  const handleViewClick = () => {
    onViewContent(campaign.id, campaign.title);
  };

  const handleDeleteClick = async () => {
    setIsDeleting(true);
    setIsAnimatingOut(true);
    
    try {
      await onDeleteCampaign(campaign.id);
      setIsDeleteDialogOpen(false);
    } catch (error) {
      console.error('Error deleting campaign:', error);
      setIsAnimatingOut(false);
    } finally {
      setIsDeleting(false);
    }
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
    <Card className={`mb-4 hover:shadow-md transition-all duration-300 h-full flex flex-col ${
      isAnimatingOut ? 'animate-[fadeOut_0.5s_ease-out_forwards,scaleDown_0.5s_ease-out_forwards]' : ''
    }`}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Plus className="w-5 h-5 text-blue-500" />
            {campaign.title}
          </CardTitle>
          
          <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
            <AlertDialogTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="text-red-600 hover:text-red-700 hover:bg-red-50 opacity-30 hover:opacity-100 transition-all duration-200"
                disabled={isDeleting}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="bg-white">
              <AlertDialogHeader>
                <AlertDialogTitle className="text-gray-900">Delete Campaign</AlertDialogTitle>
                <AlertDialogDescription className="text-gray-600">
                  Are you sure you want to delete "{campaign.title}"? This will permanently remove the campaign and all its generated content. This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className="text-gray-700">Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDeleteClick}
                  className="bg-red-600 hover:bg-red-700 text-white"
                  disabled={isDeleting}
                >
                  {isDeleting ? (
                    <>
                      <LoadingSpinner size="sm" />
                      Deleting...
                    </>
                  ) : (
                    'Delete Campaign'
                  )}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
        
        <p className="text-sm text-gray-500">
          <Calendar className="w-4 h-4 mr-1 inline-block" />
          {formatCampaignDate(campaign.created_at)}
        </p>
      </CardHeader>
      <CardContent className="flex-1">
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
                  size="sm"
                  className="bg-mint-600 hover:bg-mint-700 flex items-center gap-2"
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
            <div className="flex flex-wrap gap-2">
              {contentState.needsReview > 0 && (
                <div className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded">
                  📝 {contentState.needsReview} post{contentState.needsReview !== 1 ? 's' : ''} need{contentState.needsReview === 1 ? 's' : ''} review
                </div>
              )}
              {contentState.approvedCount > 0 && (
                <div className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded">
                  ✓ {contentState.approvedCount} post{contentState.approvedCount !== 1 ? 's' : ''} approved
                </div>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
