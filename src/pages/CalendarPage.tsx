import { CalendarView } from "@/components/CalendarView";
import { BackfillCampaigns } from "@/components/calendar/BackfillCampaigns";
import { useState } from "react";
import { SidebarLayout } from "@/components/SidebarLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CalendarPlus, PlusCircle, Calendar } from "lucide-react";
import { AddEventDialog } from "@/components/homepage/AddEventDialog";
import { NewCampaignModal } from "@/components/homepage/NewCampaignModal";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useCalendarData } from "@/hooks/useCalendarData";

const CalendarPage = () => {
  const { user } = useAuth();
  const { campaigns, tasks, loading, error, stats, refetch } = useCalendarData();
  
  // Local state for UI
  const [showBackfill, setShowBackfill] = useState(false);
  const [showAddEventDialog, setShowAddEventDialog] = useState(false);
  const [showNewCampaignModal, setShowNewCampaignModal] = useState(false);

  // Check if user needs backfill (less than 50 campaigns suggests incomplete set)
  const shouldShowBackfill = campaigns.length > 0 && campaigns.length < 50;

  // Quick action handlers
  const handleEventCreated = () => {
    setShowAddEventDialog(false);
    refetch();
    toast.success('🎉 Event added successfully! Your marketing content will be tailored for this event.');
  };

  const handleCampaignCreated = () => {
    setShowNewCampaignModal(false);
    refetch();
    toast.success('🚀 Campaign created! Ready to generate amazing content for your audience.');
  };

  const handleBackfillComplete = () => {
    setShowBackfill(false);
    refetch();
  };

  if (!user) {
    return (
      <SidebarLayout>
        <div className="flex items-center justify-center min-h-screen">
          <Card className="p-8 shadow-lg border-0">
            <CardContent className="text-center space-y-4">
              <p className="text-lg font-semibold text-gray-900">Please log in to access your calendar</p>
            </CardContent>
          </Card>
        </div>
      </SidebarLayout>
    );
  }

  if (loading) {
    return (
      <SidebarLayout>
        <div className="flex items-center justify-center min-h-screen">
          <Card className="p-8 shadow-lg border-0">
            <CardContent className="text-center space-y-4">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
              <div>
                <p className="text-lg font-semibold text-gray-900">Loading calendar...</p>
                <p className="text-sm text-gray-600 mt-1">Preparing your campaign overview</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </SidebarLayout>
    );
  }

  if (error) {
    return (
      <SidebarLayout>
        <div className="flex items-center justify-center min-h-screen">
          <Card className="p-8 shadow-lg border-0 max-w-md">
            <CardContent className="text-center space-y-4">
              <div className="text-red-600 mb-4">
                <Calendar className="w-12 h-12 mx-auto mb-3" />
                <p className="text-lg font-semibold">Error loading calendar</p>
                <p className="text-sm text-gray-600 mt-1">{error}</p>
              </div>
              <Button 
                onClick={refetch}
                className="w-full bg-red-600 hover:bg-red-700"
              >
                Try Again
              </Button>
            </CardContent>
          </Card>
        </div>
      </SidebarLayout>
    );
  }

  // Use stats from hook instead of calculating here

  return (
    <SidebarLayout>
      <div className="p-6 space-y-6">
        {/* Page Header */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="space-y-2">
            <h1 className="text-4xl font-bold text-gray-900 flex items-center gap-3">
              <Calendar className="w-10 h-10 text-blue-600" />
              Campaign Calendar
            </h1>
            <p className="text-lg text-gray-600 font-medium">
              Plan, schedule, and track your marketing campaigns
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            <Button
              onClick={() => setShowAddEventDialog(true)}
              variant="secondary"
              size="lg"
              className="flex items-center gap-2 !bg-blue-600 !text-white hover:!bg-blue-700 !border-blue-600 shadow-md z-10 relative"
              style={{
                backgroundColor: '#2563eb !important',
                color: 'white !important',
                borderColor: '#2563eb !important'
              }}
            >
              <CalendarPlus className="w-5 h-5" />
              Promote Event
            </Button>
            
            <Button
              onClick={() => setShowNewCampaignModal(true)}
              variant="secondary"
              size="lg"
              className="flex items-center gap-2 !bg-green-600 !text-white hover:!bg-green-700 !border-green-600 shadow-md z-10 relative"
              style={{
                backgroundColor: '#16a34a !important',
                color: 'white !important',
                borderColor: '#16a34a !important'
              }}
            >
              <PlusCircle className="w-5 h-5" />
              Create Campaign
            </Button>
          </div>
        </div>
        
        {/* Calendar Content */}
        <div className="space-y-6">
          {/* Backfill Component */}
          {shouldShowBackfill && !showBackfill && (
            <BackfillCampaigns 
              currentCampaignCount={campaigns.length}
              onBackfillComplete={handleBackfillComplete}
            />
          )}
          
          <CalendarView 
            campaigns={campaigns} 
            tasks={tasks}
            onDataUpdate={refetch}
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
      </div>
    </SidebarLayout>
  );
};

export default CalendarPage;
