
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

  // 🔧 HYBRID: Handle ready tasks filtering with both tenant-based and user-based models
  const readyStatusFilter = ['ready', 'approved', 'posted', 'review'];
  if (isDevelopment) {
    readyStatusFilter.push('preview');
  }

  const readyTasks = tasks.filter(task => {
    const hasValidStatus = readyStatusFilter.includes(task.status);
    const hasContent = task.ai_output && task.ai_output.trim() !== '';
    
    // 🔧 HYBRID: Access check based on available model
    let hasAccess = false;
    if (tenant?.id) {
      // Tenant-based access control
      hasAccess = task.campaigns?.tenant_id === tenant.id;
    } else {
      // User-based access control
      hasAccess = task.campaigns?.user_id === user?.id || task.user_id === user?.id;
    }
    
    // 🔧 FIXED: Only exclude PREVIEW campaigns for production users
    const isPreviewCampaign = task.campaigns?.title?.startsWith('PREVIEW');
    if (!isDevelopment && isPreviewCampaign) {
      return false;
    }
    
    console.log('UnifiedDashboardGrid: Filtering task', {
      taskId: task.id,
      status: task.status,
      hasValidStatus,
      hasContent,
      hasAccess,
      isDevelopment,
      isPreview: task.status === 'preview',
      isPreviewCampaign,
      usesTenantModel: !!tenant?.id,
      includeThis: hasValidStatus && hasContent && hasAccess
    });
    
    return hasValidStatus && hasContent && hasAccess;
  });

  console.log('UnifiedDashboardGrid: Ready tasks after filtering:', readyTasks.length, 'out of', tasks.length, '(isDevelopment:', isDevelopment, ', tenant:', !!tenant?.id, ')');

  return (
    <>
      <div className="space-y-8">
        {/* Current Campaign Section */}
        <CurrentCampaignSection 
          activeCampaign={activeCampaign}
          tasks={tasks}
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
        {user && (readyTasks.length > 0 || isDevelopment) && (
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <HeadlineLarge className="text-text-primary">
                Ready to Post
              </HeadlineLarge>
              {isDevelopment && readyTasks.length === 0 && (
                <DevPreviewBadge show={true} size="sm" />
              )}
              {isDevelopment && readyTasks.some(task => task.campaigns?.title?.startsWith('PREVIEW')) && (
                <DevPreviewBadge show={true} size="sm" />
              )}
            </div>
            <BodyMedium className="text-text-secondary mt-1">
              Your content is ready to share with your audience
              {isDevelopment && readyTasks.length === 0 && (
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
