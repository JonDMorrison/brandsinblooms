import { CalendarView } from "@/components/CalendarView";
import { BackfillCampaigns } from "@/components/calendar/BackfillCampaigns";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CalendarPlus, PlusCircle, Calendar } from "lucide-react";
import { AddEventDialog } from "@/components/homepage/AddEventDialog";
import { NewCampaignModal } from "@/components/homepage/NewCampaignModal";

import { useAuth } from "@/contexts/AuthContext";
import { useGlobalCalendarData } from "@/hooks/useGlobalCalendarData";

const CalendarPage = () => {
  const { user } = useAuth();
  const { campaigns, tasks, loading, error, stats, refetch, isCached, isRefreshing } = useGlobalCalendarData();
  
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
  };

  const handleCampaignCreated = () => {
    setShowNewCampaignModal(false);
    refetch();
  };

  const handleBackfillComplete = () => {
    setShowBackfill(false);
    refetch();
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-gray-50/30 flex items-center justify-center">
        <Card className="relative bg-gradient-to-br from-white/80 to-white/40 backdrop-blur-sm border border-white/20 rounded-2xl shadow-2xl overflow-hidden p-8">
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
        <Card className="relative bg-gradient-to-br from-white/80 to-white/40 backdrop-blur-sm border border-white/20 rounded-2xl shadow-2xl overflow-hidden p-8">
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
        <Card className="relative bg-gradient-to-br from-white/80 to-white/40 backdrop-blur-sm border border-white/20 rounded-2xl shadow-2xl overflow-hidden p-8 max-w-md">
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
                className="w-full bg-gradient-to-r from-red-600 to-red-700 text-white hover:shadow-2xl transition-all duration-300 hover:scale-105"
              >
                Try Again
              </Button>
              <div className="absolute inset-0 bg-gradient-to-br from-red-500/20 to-red-600/20 rounded-lg blur-xl group-hover:blur-lg transition-all duration-300"></div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Use stats from hook instead of calculating here

  return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-gray-50/30 p-6 space-y-8">
        {/* Modern Gradient Header Section */}
        <div className="relative bg-gradient-to-br from-slate-50 via-white to-gray-50/30 backdrop-blur-sm rounded-3xl border border-white/20 shadow-2xl overflow-hidden p-8">
          {/* Decorative Background Pattern */}
          <div className="absolute inset-0 overflow-hidden">
            <div className="absolute -top-10 -right-10 w-40 h-40 bg-gradient-to-br from-blue-500/10 to-purple-500/10 rounded-full blur-3xl"></div>
            <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-gradient-to-br from-emerald-500/10 to-blue-500/10 rounded-full blur-3xl"></div>
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 opacity-5">
              <Calendar className="w-64 h-64 text-blue-400" />
            </div>
          </div>
          
          {/* Header Content */}
          <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-3 mb-2">
                <div className="p-3 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl shadow-lg">
                  <Calendar className="w-8 h-8 text-white" />
                </div>
              </div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-slate-800 via-slate-700 to-slate-600 bg-clip-text text-transparent flex items-center gap-3">
                Campaign Calendar
                {isRefreshing && (
                  <div className="text-sm bg-blue-100 text-blue-700 px-2 py-1 rounded-full flex items-center gap-1">
                    <div className="w-3 h-3 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                    Syncing
                  </div>
                )}
              </h1>
              <p className="text-lg text-slate-600 max-w-2xl leading-relaxed">
                Plan, schedule, and track your marketing campaigns {isCached && <span className="text-sm text-green-600">(Cached)</span>}
              </p>
            </div>
            
            <div className="flex items-center gap-3">
              <div className="relative group">
                <Button
                  onClick={() => setShowAddEventDialog(true)}
                  variant="outline"
                  size="lg"
                  className="flex items-center gap-2 bg-white/70 backdrop-blur-sm border-white/30 text-slate-700 hover:bg-white/90 hover:border-teal-200 shadow-lg transition-all duration-300 hover:scale-105"
                >
                  <CalendarPlus className="w-5 h-5" />
                  Promote Event
                </Button>
                <div className="absolute inset-0 bg-gradient-to-br from-teal-500/20 to-blue-500/20 rounded-lg blur-xl group-hover:blur-lg transition-all duration-300"></div>
              </div>
              
              <div className="relative group">
                <Button
                  onClick={() => setShowNewCampaignModal(true)}
                  size="lg"
                  className="flex items-center gap-2 bg-gradient-to-r from-emerald-600 via-green-600 to-teal-600 text-white hover:shadow-2xl transition-all duration-300 hover:scale-105 shadow-lg"
                >
                  <PlusCircle className="w-5 h-5" />
                  Create Campaign
                </Button>
                <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/20 to-teal-500/20 rounded-lg blur-xl group-hover:blur-lg transition-all duration-300"></div>
              </div>
            </div>
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
  );
};

export default CalendarPage;
