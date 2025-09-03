import { CalendarView } from "@/components/CalendarView";
import { BackfillCampaigns } from "@/components/calendar/BackfillCampaigns";
import { PageHeader } from "@/components/common/PageHeader";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CalendarPlus, PlusCircle, Calendar } from "lucide-react";
import { AddEventDialog } from "@/components/homepage/AddEventDialog";
import { NewCampaignModal } from "@/components/homepage/NewCampaignModal";
import { GenerationProgressBanner } from "@/components/generation/GenerationProgressBanner";
import { ContentGenerationSkeleton } from "@/components/generation/ContentGenerationSkeleton";
import { PlanSuccessModal } from "@/components/plan/PlanSuccessModal";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";

import { useAuth } from "@/contexts/AuthContext";
import { useGlobalCalendarData } from "@/hooks/useGlobalCalendarData";
import { useGenerationJobTracker } from "@/state/useGenerationJobTracker";

const CalendarPage = () => {
  const { user } = useAuth();
  const { campaigns, tasks, loading, error, stats, refetch, isCached, isRefreshing } = useGlobalCalendarData();
  const { getJobsByType } = useGenerationJobTracker();
  const [searchParams] = useSearchParams();
  
  // Local state for UI
  const [showBackfill, setShowBackfill] = useState(false);
  const [showAddEventDialog, setShowAddEventDialog] = useState(false);
  const [showNewCampaignModal, setShowNewCampaignModal] = useState(false);
  const [showPlanSuccessModal, setShowPlanSuccessModal] = useState(false);
  
  // Check for plan launch success
  useEffect(() => {
    const planLaunched = searchParams.get('planLaunched');
    if (planLaunched === 'true') {
      setShowPlanSuccessModal(true);
      
      // Show success toast after modal is dismissed
      const itemCount = searchParams.get('launchItems') || '0';
      setTimeout(() => {
        toast.success(`✅ Plan scheduled successfully with ${itemCount} items`);
      }, 2000);
    }
  }, [searchParams]);

  // Check if user needs backfill (less than 50 campaigns suggests incomplete set)
  const shouldShowBackfill = campaigns.length > 0 && campaigns.length < 50;

  // Quick action handlers
  const handleEventCreated = () => {
    setShowAddEventDialog(false);
    refetch();
  };

  const handleCampaignCreated = () => {
    setShowNewCampaignModal(false);
    refetch();
  };

  const handleBackfillComplete = () => {
    setShowBackfill(false);
    refetch();
  };

  // Weekly themes modal state
  const [showWeeklyThemesModal, setShowWeeklyThemesModal] = useState(false);
  
  // Check for active seasonal/holiday generation jobs
  const campaignJobs = getJobsByType('seasonal').concat(getJobsByType('holiday'));

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-gray-50/30 flex items-center justify-center">
        <Card className="relative bg-white border border-white/20 rounded-2xl shadow-lg overflow-hidden p-8">
          <div className="absolute inset-0 bg-gradient-to-br from-white via-slate-50/80 to-slate-100/60"></div>
          <CardContent className="relative z-10 text-center space-y-4">
            <p className="text-xl font-bold bg-gradient-to-r from-slate-800 to-slate-600 bg-clip-text text-transparent">Please log in to access your calendar</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (loading && !isCached) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-gray-50/30 flex items-center justify-center">
        <Card className="relative bg-white border border-white/20 rounded-2xl shadow-lg overflow-hidden p-8">
          <div className="absolute inset-0 bg-gradient-to-br from-white via-slate-50/80 to-slate-100/60"></div>
          <CardContent className="relative z-10 text-center space-y-4">
            <div className="animate-spin rounded-full h-12 w-12 border-3 border-blue-600 border-t-transparent mx-auto"></div>
            <div>
              <p className="text-xl font-bold bg-gradient-to-r from-slate-800 to-slate-600 bg-clip-text text-transparent">Loading calendar...</p>
              <p className="text-slate-600 mt-2">Preparing your campaign overview</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-gray-50/30 flex items-center justify-center">
        <Card className="relative bg-white border border-white/20 rounded-2xl shadow-lg overflow-hidden p-8 max-w-md">
          <div className="absolute inset-0 bg-gradient-to-br from-white via-slate-50/80 to-slate-100/60"></div>
          <CardContent className="relative z-10 text-center space-y-4">
            <div className="text-red-600 mb-4">
              <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-red-100 to-red-200 rounded-full flex items-center justify-center shadow-lg">
                <Calendar className="w-8 h-8 text-red-600" />
              </div>
              <p className="text-xl font-bold bg-gradient-to-r from-red-800 to-red-600 bg-clip-text text-transparent">Error loading calendar</p>
              <p className="text-slate-600 mt-2">{error}</p>
            </div>
            <div className="relative group">
              <Button 
                onClick={refetch}
                className="w-full bg-gradient-to-r from-red-600 to-red-700 text-white hover:shadow-lg transition-colors duration-200"
              >
                Try Again
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Use stats from hook instead of calculating here

  return (
    <div className="min-h-screen bg-background">
      <PageHeader
        title="Campaign Calendar"
        description="Plan, schedule, and track your marketing campaigns"
        secondaryAction={{
          label: 'Weekly Themes',
          icon: Calendar,
          variant: 'outline',
          onClick: () => setShowWeeklyThemesModal(true)
        }}
        primaryAction={{
          label: 'Create Campaign',
          icon: PlusCircle,
          onClick: () => setShowNewCampaignModal(true)
        }}
      />
      
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        {/* Generation Progress Banner */}
        <GenerationProgressBanner />
        
        {/* Show generation placeholder for campaign content */}
        {campaignJobs.filter(job => job.status === 'generating').length > 0 && (
          <ContentGenerationSkeleton 
            type="campaign" 
            count={campaignJobs.filter(job => job.status === 'generating').length}
            className="mb-6"
          />
        )}
        
        {/* Backfill Component */}
        {shouldShowBackfill && !showBackfill && (
          <BackfillCampaigns 
            currentCampaignCount={campaigns.length}
            onBackfillComplete={handleBackfillComplete}
          />
        )}
        
        <CalendarView 
          onDataUpdate={refetch}
          showWeeklyThemesModal={showWeeklyThemesModal}
          onCloseWeeklyThemesModal={() => setShowWeeklyThemesModal(false)}
        />
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
        onCampaignCreated={handleCampaignCreated}
      />

      {/* Plan Success Modal */}
      <PlanSuccessModal 
        open={showPlanSuccessModal}
        onOpenChange={setShowPlanSuccessModal}
      />
    </div>
  );
};

export default CalendarPage;
