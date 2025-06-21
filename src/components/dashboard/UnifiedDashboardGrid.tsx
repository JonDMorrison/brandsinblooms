
import * as React from "react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { HeadlineLarge, BodyMedium } from "@/components/ui/typography";
import { QuickActionsSection } from "@/components/dashboard/current-campaign/QuickActionsSection";
import { CurrentCampaignSection } from "@/components/dashboard/CurrentCampaignSection";
import { SeasonalHolidaysCard } from "./seasonal-holidays/SeasonalHolidaysCard";
import { ReadyToPostCard } from "@/components/homepage/ReadyToPostCard";
import { AddEventDialog } from "@/components/homepage/AddEventDialog";
import { NewCampaignModal } from "@/components/homepage/NewCampaignModal";
import { useUser } from "@/hooks/useUser";
import { useTenant } from "@/hooks/useTenant";
import { DevPreviewBadge } from "@/components/ui/dev-preview-badge";
import type { Campaign } from "@/types/content";
import { toast } from "sonner";
import { EnhancedSeasonalHolidaysCard } from "./seasonal-holidays/EnhancedSeasonalHolidaysCard";
import { sampleTasks, sampleCampaign } from "@/data/sampleContent";
import { usePreviewMode } from "@/contexts/PreviewModeContext";
import { PreviewModeToggle } from "@/components/ui/preview-mode-toggle";

interface UnifiedDashboardGridProps {
  activeCampaign?: Campaign | null;
  userCreatedCampaigns?: Campaign[];
  tasks?: any[];
  onTaskUpdate: () => void;
  onCampaignCreated?: () => void;
  onCampaignUpdate?: () => void;
  onCreateCampaign?: () => void;
}

export const UnifiedDashboardGrid = ({ 
  activeCampaign,
  userCreatedCampaigns = [],
  tasks = [],
  onTaskUpdate,
  onCampaignCreated,
  onCampaignUpdate,
  onCreateCampaign
}: UnifiedDashboardGridProps) => {
  const { user } = useAuth();
  const { tenant } = useTenant();
  const { isNewUser, loading } = useUser();
  const { isPreviewMode } = usePreviewMode();
  const navigate = useNavigate();

  // Use environment-based detection instead of hardcoded email
  const isDevelopment = import.meta.env.DEV;

  // State for quick action modals
  const [showAddEventDialog, setShowAddEventDialog] = useState(false);
  const [showNewCampaignModal, setShowNewCampaignModal] = useState(false);

  // Quick action handlers
  const handleNewCampaignClick = () => {
    setShowNewCampaignModal(true);
  };

  const handleAddEventClick = () => {
    setShowAddEventDialog(true);
  };

  const handleViewCalendar = () => {
    navigate('/calendar');
  };

  const handleEventCreated = () => {
    setShowAddEventDialog(false);
    onTaskUpdate();
    onCampaignCreated?.();
    toast.success('🎉 Event added successfully! Your marketing content will be tailored for this event.');
  };

  const handleCampaignCreatedInternal = () => {
    setShowNewCampaignModal(false);
    onTaskUpdate();
    onCampaignCreated?.();
    toast.success('🚀 Campaign created! Ready to generate amazing content for your audience.');
  };

  if (loading) {
    return <div className="text-center py-12">Loading dashboard...</div>;
  }

  // Enhanced ready tasks filtering with preview content
  const readyStatusFilter = ['ready', 'approved', 'posted', 'review'];
  if (isDevelopment || isPreviewMode) {
    readyStatusFilter.push('preview');
  }

  // Combine real tasks with sample tasks when in preview mode
  let combinedTasks = tasks.filter(task => {
    const hasValidStatus = readyStatusFilter.includes(task.status);
    const hasContent = task.ai_output && task.ai_output.trim() !== '';
    
    // Access check based on available model
    let hasAccess = false;
    if (tenant?.id) {
      hasAccess = task.campaigns?.tenant_id === tenant.id;
    } else {
      hasAccess = task.campaigns?.user_id === user?.id || task.user_id === user?.id;
    }
    
    // Only exclude PREVIEW campaigns for production users when not in preview mode
    const isPreviewCampaign = task.campaigns?.title?.startsWith('PREVIEW');
    if (!isDevelopment && !isPreviewMode && isPreviewCampaign) {
      return false;
    }
    
    return hasValidStatus && hasContent && hasAccess;
  });

  // Add sample tasks when preview mode is enabled
  if (isPreviewMode) {
    console.log('🔍 PREVIEW MODE: Adding sample tasks to dashboard');
    combinedTasks = [...combinedTasks, ...sampleTasks];
  }

  const readyTasks = combinedTasks;

  // Enhanced active campaign with preview support
  let displayCampaign = activeCampaign;
  let displayTasks = tasks;

  if (isPreviewMode) {
    console.log('🔍 PREVIEW MODE: Using sample campaign and tasks');
    // In preview mode, show sample campaign if no active campaign or if user wants to see preview
    if (!activeCampaign) {
      displayCampaign = sampleCampaign as Campaign;
    }
    // Always include sample tasks in preview mode
    displayTasks = [...tasks, ...sampleTasks];
  }

  console.log('UnifiedDashboardGrid: Ready tasks after filtering:', readyTasks.length, 'out of', tasks.length, '(isDevelopment:', isDevelopment, ', tenant:', !!tenant?.id, ', previewMode:', isPreviewMode, ')');

  return (
    <>
      <div className="space-y-8">
        {/* Preview Mode Toggle */}
        <PreviewModeToggle />

        {/* Current Campaign Section */}
        <CurrentCampaignSection 
          activeCampaign={displayCampaign}
          tasks={displayTasks}
          onTaskUpdate={onTaskUpdate}
          onCreateCampaign={onCreateCampaign || (() => {})}
          onCampaignCreated={onCampaignCreated || (() => {})}
        />

        {/* Enhanced Seasonal Holidays Section - Only show for authenticated users */}
        {user && (
          <div className="space-y-6">
            <div>
              <HeadlineLarge className="text-text-primary">
                Seasonal Marketing Opportunities
              </HeadlineLarge>
              <BodyMedium className="text-text-secondary mt-1">
                Create timely content for upcoming holidays and observances
              </BodyMedium>
            </div>
            <EnhancedSeasonalHolidaysCard onContentGenerated={onTaskUpdate} />
          </div>
        )}

        {/* Quick Actions */}
        <QuickActionsSection 
          onNewCampaignClick={handleNewCampaignClick}
          onAddEventClick={handleAddEventClick}
          onViewCalendar={handleViewCalendar}
        />

        {/* Ready to Post Section */}
        {user && (readyTasks.length > 0 || isDevelopment || isPreviewMode) && (
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <HeadlineLarge className="text-text-primary">
                Ready to Post
              </HeadlineLarge>
              {isPreviewMode && (
                <DevPreviewBadge show={true} size="sm" />
              )}
              {isDevelopment && readyTasks.length === 0 && !isPreviewMode && (
                <DevPreviewBadge show={true} size="sm" />
              )}
            </div>
            <BodyMedium className="text-text-secondary mt-1">
              Your content is ready to share with your audience
              {isPreviewMode && (
                <span className="text-blue-600 ml-2">(Preview mode - showing sample content)</span>
              )}
              {isDevelopment && readyTasks.length === 0 && !isPreviewMode && (
                <span className="text-blue-600 ml-2">(No content available in development preview)</span>
              )}
            </BodyMedium>
            <ReadyToPostCard 
              tasks={readyTasks}
              onTaskUpdate={onTaskUpdate}
            />
          </div>
        )}
      </div>

      {/* Quick Action Modals */}
      <AddEventDialog 
        open={showAddEventDialog}
        onOpenChange={setShowAddEventDialog}
        onEventCreated={handleEventCreated}
      />

      <NewCampaignModal 
        open={showNewCampaignModal}
        onOpenChange={setShowNewCampaignModal}
        onCampaignCreated={handleCampaignCreatedInternal}
      />
    </>
  );
};
