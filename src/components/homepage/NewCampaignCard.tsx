
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sparkles, Loader2, Calendar, Eye } from "lucide-react";
import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { generateRequiredTasks } from "./RequiredTasksGenerator";
import { toast } from "sonner";
import { EditableTheme } from "@/components/calendar/EditableTheme";
import { supabase } from "@/integrations/supabase/client";
import { ContentViewer } from "@/components/content/ContentViewer";

interface Campaign {
  id: string;
  title: string;
  description: string | null;
  start_date: string;
  theme: string | null;
  week_number: number;
}

interface NewCampaignCardProps {
  campaign: Campaign;
  onTaskUpdate: () => void;
  onCampaignUpdate?: () => void;
}

export const NewCampaignCard = ({ campaign, onTaskUpdate, onCampaignUpdate }: NewCampaignCardProps) => {
  const { user } = useAuth();
  const [isGenerating, setIsGenerating] = useState(false);
  const [hasContent, setHasContent] = useState(false);
  const [showContentViewer, setShowContentViewer] = useState(false);
  const [isCheckingContent, setIsCheckingContent] = useState(true);

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
          return;
        }

        setHasContent(data && data.length > 0);
      } catch (error) {
        console.error('Error in checkForContent:', error);
      } finally {
        setIsCheckingContent(false);
      }
    };

    checkForContent();
  }, [campaign.id]);

  const handleGenerateContent = async () => {
    console.log('=== CONTENT GENERATION DEBUG START ===');
    console.log('Generate content button clicked for campaign:', campaign.id);
    console.log('Campaign object:', campaign);
    console.log('User object:', user);
    console.log('onTaskUpdate function:', typeof onTaskUpdate);
    
    if (!user) {
      console.error('No user found when trying to generate content');
      toast.error("Please log in to generate content");
      return;
    }

    console.log('Starting content generation for user:', user.id);
    setIsGenerating(true);
    
    try {
      console.log('About to call generateRequiredTasks with parameters:', {
        campaignId: campaign.id,
        campaigns: [campaign],
        userId: user.id,
        onTaskUpdateType: typeof onTaskUpdate
      });
      
      console.log('Calling generateRequiredTasks function...');
      const result = await generateRequiredTasks(campaign.id, [campaign], user.id, onTaskUpdate);
      console.log('generateRequiredTasks returned:', result);
      
      console.log('Content generation completed successfully');
      toast.success("Content generated successfully! Check your tasks to review and approve the new content.");
      
      // Refresh content status after generation
      setHasContent(true);
      
      if (onCampaignUpdate) {
        console.log('Calling onCampaignUpdate callback');
        onCampaignUpdate();
      }
    } catch (error) {
      console.error('=== ERROR IN CONTENT GENERATION ===');
      console.error('Error object:', error);
      console.error('Error message:', error instanceof Error ? error.message : 'Unknown error');
      console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
      toast.error(`Unable to generate content: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      console.log('Setting isGenerating to false');
      setIsGenerating(false);
      console.log('=== CONTENT GENERATION DEBUG END ===');
    }
  };

  const handleViewContent = () => {
    setShowContentViewer(true);
  };

  const handleThemeUpdate = (newTheme: string, newDescription?: string) => {
    if (onCampaignUpdate) {
      onCampaignUpdate();
    }
  };

  const handleContentViewerClose = () => {
    setShowContentViewer(false);
    // Refresh content status when closing the viewer
    const checkForContent = async () => {
      try {
        const { data, error } = await supabase
          .from('content_tasks')
          .select('id')
          .eq('campaign_id', campaign.id)
          .limit(1);

        if (!error) {
          setHasContent(data && data.length > 0);
        }
      } catch (error) {
        console.error('Error checking content after viewer close:', error);
      }
    };
    checkForContent();
  };

  return (
    <>
      <Card className="border-blue-200 bg-blue-50">
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3">
            <CardTitle className="text-foreground text-lg sm:text-xl">{campaign.title}</CardTitle>
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary" className="bg-blue-100 text-blue-700 text-xs">
                New Campaign
              </Badge>
              <Badge variant="outline" className="border-blue-300 text-blue-600 text-xs">
                <Calendar className="w-3 h-3 mr-1" />
                Week {campaign.week_number}
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {campaign.theme && (
            <div className="mb-4 p-3 sm:p-4 bg-white rounded-lg border border-blue-200">
              <EditableTheme
                campaignId={campaign.id}
                currentTheme={campaign.theme}
                currentDescription={campaign.description || undefined}
                onThemeUpdate={handleThemeUpdate}
              />
            </div>
          )}
          
          {!campaign.theme && campaign.description && (
            <p className="text-blue-600 mb-4 text-sm sm:text-base">{campaign.description}</p>
          )}
          
          <div className="mt-4 sm:mt-6 flex justify-center">
            {isCheckingContent ? (
              <div className="flex items-center gap-2 text-blue-600">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm">Checking content...</span>
              </div>
            ) : hasContent ? (
              <Button 
                onClick={handleViewContent}
                className="bg-green-600 hover:bg-green-700 text-white px-4 sm:px-6 py-2 text-sm sm:text-base w-full sm:w-auto"
                size="default"
              >
                <Eye className="w-4 h-4 mr-2" />
                View Generated Content
              </Button>
            ) : (
              <Button 
                onClick={handleGenerateContent}
                disabled={isGenerating}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 sm:px-6 py-2 text-sm sm:text-base w-full sm:w-auto"
                size="default"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    <span className="hidden sm:inline">Generating Content...</span>
                    <span className="sm:hidden">Generating...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 mr-2" />
                    <span className="hidden sm:inline">Generate Content for This Campaign</span>
                    <span className="sm:hidden">Generate Content</span>
                  </>
                )}
              </Button>
            )}
          </div>
          <p className="text-xs text-blue-600 mt-2 text-center px-2">
            {hasContent 
              ? "Review and manage your generated content"
              : "Creates social media posts, video scripts, newsletter, and email content"
            }
          </p>
        </CardContent>
      </Card>

      <ContentViewer
        campaignId={campaign.id}
        campaignTitle={campaign.title}
        isOpen={showContentViewer}
        onClose={handleContentViewerClose}
        onTaskUpdate={onTaskUpdate}
      />
    </>
  );
};
