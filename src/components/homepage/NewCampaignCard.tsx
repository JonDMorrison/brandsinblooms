import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Sparkles, Eye, Trash2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { EditableTheme } from "@/components/calendar/EditableTheme";
import { supabase } from "@/integrations/supabase/client";
import { ContentViewer } from "@/components/content/ContentViewer";
import type { Campaign, SeasonalContent } from "@/types";

interface NewCampaignCardProps {
  campaign: Campaign;
  onTaskUpdate: () => void;
  onCampaignUpdate?: () => void;
  onCampaignDelete?: (campaignId: string) => void;
  seasonalContent?: SeasonalContent;
}

export const NewCampaignCard = ({ 
  campaign, 
  onTaskUpdate, 
  onCampaignUpdate, 
  onCampaignDelete,
  seasonalContent 
}: NewCampaignCardProps) => {
  const { user } = useAuth();
  const [hasContent, setHasContent] = useState(false);
  const [showContentViewer, setShowContentViewer] = useState(false);
  const [isCheckingContent, setIsCheckingContent] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  useEffect(() => {
    const checkForContent = async () => {
      if (!campaign.id) return;
      
      setIsCheckingContent(true);
      try {
        const { data, error } = await supabase
          .from('content_tasks')
          .select('id')
          .eq('campaign_id', campaign.id)
          .limit(1);

        if (error) {
          console.error('Error checking for content:', error);
          toast.error('Failed to check content status');
          return;
        }

        setHasContent(data && data.length > 0);
      } catch (error) {
        console.error('Error in checkForContent:', error);
        toast.error('Failed to check content status');
      } finally {
        setIsCheckingContent(false);
      }
    };

    checkForContent();
  }, [campaign.id]);

  const handleDeleteCampaign = async () => {
    if (!campaign.id || !onCampaignDelete) return;
    
    setIsDeleting(true);
    
    try {
      // First delete all associated content tasks
      const { error: tasksError } = await supabase
        .from('content_tasks')
        .delete()
        .eq('campaign_id', campaign.id);

      if (tasksError) {
        console.error('Error deleting campaign tasks:', tasksError);
        toast.error('Failed to delete campaign content');
        return;
      }

      // Then delete the campaign
      const { error: campaignError } = await supabase
        .from('campaigns')
        .delete()
        .eq('id', campaign.id);

      if (campaignError) {
        console.error('Error deleting campaign:', campaignError);
        toast.error('Failed to delete campaign');
        return;
      }

      toast.success('Campaign deleted successfully');
      onCampaignDelete(campaign.id);
      setIsDeleteDialogOpen(false);
    } catch (error) {
      console.error('Error in handleDeleteCampaign:', error);
      toast.error('Failed to delete campaign');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleViewOrGenerateContent = () => {
    setShowContentViewer(true);
  };

  const handleThemeUpdate = (newTheme: string, newDescription?: string) => {
    if (onCampaignUpdate) {
      onCampaignUpdate();
    }
  };

  return (
    <Card className={`bg-white border-gray-200 transition-all duration-300 ${isDeleting ? 'opacity-50 scale-95' : 'hover:shadow-md'}`}>
      <CardHeader className="bg-white">
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <CardTitle className="text-foreground">{campaign.title}</CardTitle>
            <CardDescription className="text-muted-foreground">
              Custom Campaign
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="bg-gray-100 text-gray-700 border-gray-200">
              Week {campaign.week_number}
            </Badge>
            {onCampaignDelete && (
              <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-red-500 hover:text-red-700 hover:bg-red-50"
                    disabled={isDeleting}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete Campaign</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to delete "{campaign.title}"? This will permanently remove the campaign and all its generated content. This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleDeleteCampaign}
                      className="bg-red-600 hover:bg-red-700"
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
            )}
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="bg-white">
        {campaign.theme && (
          <div className="mb-6 p-4 bg-white rounded-lg border border-gray-200">
            <EditableTheme
              campaignId={campaign.id}
              currentTheme={campaign.theme}
              currentDescription={campaign.description || undefined}
              onThemeUpdate={handleThemeUpdate}
            />
          </div>
        )}
        
        {!campaign.theme && campaign.description && (
          <p className="text-muted-foreground mb-4">{campaign.description}</p>
        )}
        
        {seasonalContent && (
          <div className="mb-4">
            <h4 className="font-semibold text-foreground mb-2">Seasonal Focus:</h4>
            <p className="text-muted-foreground">{seasonalContent.theme}</p>
          </div>
        )}
        
        <div className="mt-6">
          {isCheckingContent ? (
            <div className="flex items-center justify-center py-4">
              <LoadingSpinner size="sm" text="Checking content status..." />
            </div>
          ) : (
            <Button 
              onClick={handleViewOrGenerateContent}
              className="max-w-xs"
              aria-label={hasContent ? "View generated content" : "Generate new content"}
            >
              {hasContent ? (
                <>
                  <Eye className="w-4 h-4 mr-2" />
                  View This Week's Content
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-2" />
                  Generate Content For This Campaign
                </>
              )}
            </Button>
          )}
          <p className="text-xs text-muted-foreground mt-2">
            {hasContent 
              ? "Review your generated content in the tasks section"
              : "Creates social media posts, video scripts, newsletter, and email content"
            }
          </p>
        </div>
      </CardContent>

      <ContentViewer
        campaignId={campaign.id}
        campaignTitle={campaign.title}
        isOpen={showContentViewer}
        onClose={() => setShowContentViewer(false)}
        onTaskUpdate={onTaskUpdate}
      />
    </Card>
  );
};
