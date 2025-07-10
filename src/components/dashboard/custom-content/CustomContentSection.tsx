
import * as React from "react";
import { HeadlineLarge, BodyMedium } from "@/components/ui/typography";
import { CustomContentItem } from "./CustomContentItem";
import { ContentViewer } from "@/components/content/ContentViewer";
import { useAuth } from "@/contexts/AuthContext";
import { useTenant } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";
import { generateRequiredTasks } from "@/components/homepage/RequiredTasksGenerator";
import { Plus, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface CustomContentSectionProps {
  userCreatedCampaigns: any[];
  onContentGenerated?: () => void;
  className?: string;
}

export const CustomContentSection = ({
  userCreatedCampaigns,
  onContentGenerated,
  className
}: CustomContentSectionProps) => {
  const { user } = useAuth();
  const { tenant } = useTenant();
  const [generatingCampaigns, setGeneratingCampaigns] = React.useState<Set<string>>(new Set());
  const [campaignContentState, setCampaignContentState] = React.useState<Record<string, any>>({});
  const [displayLimit, setDisplayLimit] = React.useState(6);
  const [campaigns, setCampaigns] = React.useState(userCreatedCampaigns);
  const [contentViewerState, setContentViewerState] = React.useState<{
    isOpen: boolean;
    campaignId: string | null;
    campaignTitle: string;
  }>({
    isOpen: false,
    campaignId: null,
    campaignTitle: ''
  });

  // Update campaigns when prop changes
  React.useEffect(() => {
    console.log('🔧 CustomContentSection: Received userCreatedCampaigns:', userCreatedCampaigns.length, userCreatedCampaigns);
    setCampaigns(userCreatedCampaigns);
  }, [userCreatedCampaigns]);

  // Get the campaigns to display based on the current limit
  const displayedCampaigns = React.useMemo(() => {
    return campaigns.slice(0, displayLimit);
  }, [campaigns, displayLimit]);

  // Calculate if there are more campaigns to show
  const hasMoreCampaigns = campaigns.length > displayLimit;
  const remainingCount = campaigns.length - displayLimit;

  // Handle load more
  const handleLoadMore = () => {
    setDisplayLimit(prev => Math.min(prev + 6, campaigns.length));
  };

  // Fetch content state for each campaign
  const fetchCampaignContent = React.useCallback(async () => {
    if (!user || campaigns.length === 0) return;

    try {
      const campaignIds = campaigns.map(c => c.id);
      
      let query = supabase
        .from('content_tasks')
        .select('campaign_id, status, ai_output')
        .in('campaign_id', campaignIds);

      if (tenant?.id) {
        query = query.eq('tenant_id', tenant.id);
      } else {
        query = query.eq('user_id', user.id);
      }

      const { data: tasks } = await query;

      if (tasks) {
        const contentState: Record<string, any> = {};
        
        campaignIds.forEach(campaignId => {
          const campaignTasks = tasks.filter(task => task.campaign_id === campaignId);
          const tasksWithContent = campaignTasks.filter(task => 
            task.ai_output && 
            task.ai_output.trim() !== '' && 
            ['review', 'ready', 'approved', 'posted'].includes(task.status)
          );
          
          const tasksNeedingReview = campaignTasks.filter(task => 
            task.ai_output && 
            task.ai_output.trim() !== '' && 
            task.status === 'review'
          );
          
          contentState[campaignId] = {
            contentCount: tasksWithContent.length,
            totalTasks: campaignTasks.length,
            needsReview: tasksNeedingReview.length,
            approvedCount: campaignTasks.filter(task => task.status === 'approved').length
          };
        });
        
        setCampaignContentState(contentState);
      }
    } catch (error) {
      console.error('Error fetching campaign content state:', error);
    }
  }, [user, tenant, campaigns]);

  React.useEffect(() => {
    fetchCampaignContent();
  }, [fetchCampaignContent]);

  const handleGenerateContent = async (campaignId: string) => {
    const campaign = campaigns.find(c => c.id === campaignId);
    if (!campaign || !user) return;

    setGeneratingCampaigns(prev => new Set(prev).add(campaignId));

    try {
      console.log('Generating content for custom campaign:', campaign.title);
      
      const result = await generateRequiredTasks(
        campaignId,
        [campaign],
        user.id,
        () => {
          fetchCampaignContent();
          if (onContentGenerated) onContentGenerated();
        },
        tenant?.id
      );

      if (result.success) {
        toast.success(`Generated content for ${campaign.title}!`);
        
        // Optimistically update the campaign content state
        setCampaignContentState(prev => ({
          ...prev,
          [campaignId]: {
            contentCount: 5, // Standard number of content pieces generated
            totalTasks: 5,
            needsReview: 5,
            approvedCount: 0
          }
        }));

        // Add delay to allow database transaction to commit, then refresh
        setTimeout(async () => {
          await fetchCampaignContent();
          
          // Retry once more if content still not found (fallback for timing issues)
          setTimeout(async () => {
            const currentState = campaignContentState[campaignId];
            if (!currentState || currentState.contentCount === 0) {
              await fetchCampaignContent();
            }
          }, 1000);
        }, 500);
      } else {
        toast.error(`Failed to generate content: ${result.message}`);
      }
    } catch (error) {
      console.error('Failed to generate campaign content:', error);
      toast.error('Failed to generate content. Please try again.');
    } finally {
      setGeneratingCampaigns(prev => {
        const newSet = new Set(prev);
        newSet.delete(campaignId);
        return newSet;
      });
    }
  };

  const handleViewContent = (campaignId: string, campaignTitle: string) => {
    const contentState = campaignContentState[campaignId];
    if (!contentState || contentState.contentCount === 0) {
      toast.error('No content available for this campaign');
      return;
    }
    
    setContentViewerState({
      isOpen: true,
      campaignId,
      campaignTitle
    });
  };

  const handleDeleteCampaign = async (campaignId: string) => {
    if (!user) return;

    try {
      // First delete all associated content tasks
      const { error: tasksError } = await supabase
        .from('content_tasks')
        .delete()
        .eq('campaign_id', campaignId);

      if (tasksError) {
        console.error('Error deleting campaign tasks:', tasksError);
        toast.error('Failed to delete campaign content');
        throw tasksError;
      }

      // Then delete the campaign
      const { error: campaignError } = await supabase
        .from('campaigns')
        .delete()
        .eq('id', campaignId);

      if (campaignError) {
        console.error('Error deleting campaign:', campaignError);
        toast.error('Failed to delete campaign');
        throw campaignError;
      }

      // Remove from local state with animation delay
      setTimeout(() => {
        setCampaigns(prev => prev.filter(c => c.id !== campaignId));
        setCampaignContentState(prev => {
          const newState = { ...prev };
          delete newState[campaignId];
          return newState;
        });
      }, 500); // Match animation duration

      toast.success('Campaign deleted successfully');
      
      if (onContentGenerated) {
        onContentGenerated();
      }
    } catch (error) {
      console.error('Error in handleDeleteCampaign:', error);
      throw error; // Re-throw to be handled by the component
    }
  };

  const handleContentViewerClose = () => {
    setContentViewerState({
      isOpen: false,
      campaignId: null,
      campaignTitle: ''
    });
    
    // Refresh content state when viewer closes
    fetchCampaignContent();
  };

  // Always show the section, even if empty - this allows users to create campaigns
  const shouldShowEmptyState = campaigns.length === 0;

  return (
    <>
      <div className={cn('space-y-8', className)}>
        {/* Modern Gradient Header Section */}
        <div className="relative bg-gradient-to-br from-slate-50 via-white to-gray-50/30 backdrop-blur-sm rounded-3xl border border-white/20 shadow-2xl overflow-hidden p-8">
          {/* Decorative Background Pattern */}
          <div className="absolute inset-0 overflow-hidden">
            <div className="absolute -top-10 -right-10 w-40 h-40 bg-gradient-to-br from-purple-500/10 to-pink-500/10 rounded-full blur-3xl"></div>
            <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-gradient-to-br from-blue-500/10 to-purple-500/10 rounded-full blur-3xl"></div>
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 opacity-5">
              <Plus className="w-64 h-64 text-purple-400" />
            </div>
          </div>
          
          {/* Header Content */}
          <div className="relative z-10 flex items-center justify-between">
            <div className="flex flex-col gap-3">
              <div className="inline-flex items-center gap-3 mb-2">
                <div className="p-3 bg-gradient-to-br from-purple-500 to-pink-600 rounded-2xl shadow-lg">
                  <Plus className="w-8 h-8 text-white" />
                </div>
              </div>
              <HeadlineLarge className="text-4xl font-bold bg-gradient-to-r from-slate-800 via-slate-700 to-slate-600 bg-clip-text text-transparent">Your Custom Content</HeadlineLarge>
              <BodyMedium className="text-lg text-slate-600 max-w-2xl leading-relaxed">
                Your custom campaigns and promotional content
              </BodyMedium>
            </div>
          </div>
        </div>

        {/* Campaign Cards Grid or Empty State */}
        {shouldShowEmptyState ? (
          <div className="text-center py-12 px-6 border-2 border-dashed border-gray-300 rounded-lg bg-gray-50">
            <div className="flex flex-col items-center space-y-4">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
                <Plus className="w-8 h-8 text-primary" />
              </div>
              <div className="space-y-2">
                <h3 className="text-lg font-semibold text-foreground">No Custom Campaigns Yet</h3>
                <p className="text-muted-foreground max-w-md">
                  Create custom campaigns for special events, promotions, or seasonal content that's unique to your garden center.
                </p>
              </div>
              <p className="text-xs text-muted-foreground">
                Try creating a campaign using the Quick Actions section above
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {displayedCampaigns.map((campaign, index) => (
              <div 
                key={campaign.id}
                className="transform transition-all duration-300 hover:scale-[1.02] group"
                style={{ 
                  animationDelay: `${index * 100}ms`,
                  animation: 'fadeInUp 0.6s ease-out forwards'
                }}
              >
                <CustomContentItem
                  campaign={campaign}
                  onGenerateContent={handleGenerateContent}
                  onViewContent={handleViewContent}
                  onDeleteCampaign={handleDeleteCampaign}
                  isGenerating={generatingCampaigns.has(campaign.id)}
                  contentState={campaignContentState[campaign.id]}
                />
              </div>
            ))}
          </div>
        )}

        {/* Load More Button */}
        {hasMoreCampaigns && (
          <div className="flex justify-center pt-4">
            <Button
              onClick={handleLoadMore}
              variant="outline"
              className="flex items-center gap-2 px-6 py-3 text-sm font-medium border-blue-200 text-blue-700 hover:bg-blue-50 hover:border-blue-300 transition-colors"
            >
              <ChevronDown className="w-4 h-4" />
              Load More ({remainingCount} remaining)
            </Button>
          </div>
        )}
      </div>

      {/* Content Viewer Modal */}
      {contentViewerState.isOpen && contentViewerState.campaignId && (
        <ContentViewer
          campaignId={contentViewerState.campaignId}
          campaignTitle={contentViewerState.campaignTitle}
          isOpen={contentViewerState.isOpen}
          onClose={handleContentViewerClose}
          onTaskUpdate={() => {
            fetchCampaignContent();
            if (onContentGenerated) onContentGenerated();
          }}
        />
      )}
    </>
  );
};
