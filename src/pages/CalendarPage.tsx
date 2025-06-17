
import { CalendarView } from "@/components/CalendarView";
import { BackfillCampaigns } from "@/components/calendar/BackfillCampaigns";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ProtectedPageWrapper } from "@/components/ProtectedPageWrapper";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CalendarPlus, PlusCircle, Calendar } from "lucide-react";
import { AddEventDialog } from "@/components/homepage/AddEventDialog";
import { NewCampaignModal } from "@/components/homepage/NewCampaignModal";
import { toast } from "sonner";
import { getCurrentWeekNumber } from "@/utils/dateUtils";
import { useAuth } from "@/contexts/AuthContext";

const CalendarPage = () => {
  const { user } = useAuth();
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showBackfill, setShowBackfill] = useState(false);
  
  // Add state for quick action modals
  const [showAddEventDialog, setShowAddEventDialog] = useState(false);
  const [showNewCampaignModal, setShowNewCampaignModal] = useState(false);

  const fetchData = async () => {
    if (!user) {
      console.log('CalendarPage: No authenticated user, skipping data fetch');
      setLoading(false);
      return;
    }

    try {
      setError(null);
      
      console.log('CalendarPage: Fetching data for user:', user.id);
      
      // SECURITY FIX: Explicitly filter campaigns by current user
      const { data: campaignsData, error: campaignsError } = await supabase
        .from('campaigns')
        .select('*')
        .eq('user_id', user.id)  // CRITICAL: Only fetch current user's campaigns
        .order('start_date', { ascending: true });

      if (campaignsError) {
        console.error('CalendarPage: Error fetching campaigns:', campaignsError);
        throw campaignsError;
      }

      // SECURITY FIX: Use inner join to ensure we only get tasks for user's campaigns
      const { data: tasksData, error: tasksError } = await supabase
        .from('content_tasks')
        .select(`
          *,
          campaigns!inner (
            title,
            week_number,
            start_date,
            user_id
          )
        `)
        .eq('campaigns.user_id', user.id)  // CRITICAL: Filter by current user
        .order('scheduled_date', { ascending: true });

      if (tasksError) {
        console.error('CalendarPage: Error fetching tasks:', tasksError);
        throw tasksError;
      }

      console.log('CalendarPage: Successfully fetched', campaignsData?.length || 0, 'campaigns and', tasksData?.length || 0, 'tasks for user', user.id);

      // Additional security verification
      const userCampaigns = campaignsData?.filter(campaign => campaign.user_id === user.id) || [];
      const userTasks = tasksData?.filter(task => 
        task.campaigns && task.campaigns.user_id === user.id
      ) || [];

      if (userCampaigns.length !== campaignsData?.length) {
        console.warn('CalendarPage: Security alert - some campaigns did not belong to current user');
      }
      if (userTasks.length !== tasksData?.length) {
        console.warn('CalendarPage: Security alert - some tasks did not belong to current user');
      }

      setCampaigns(userCampaigns);
      setTasks(userTasks);
      
      // Check if user needs backfill (less than 50 campaigns suggests incomplete set)
      const campaignCount = userCampaigns.length;
      if (campaignCount > 0 && campaignCount < 50) {
        setShowBackfill(true);
      } else {
        setShowBackfill(false);
      }
    } catch (error) {
      console.error('CalendarPage: Error fetching data:', error);
      setError(error instanceof Error ? error.message : 'Failed to load calendar data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchData();
    } else {
      setLoading(false);
    }
  }, [user]);

  // Quick action handlers
  const handleEventCreated = () => {
    setShowAddEventDialog(false);
    fetchData();
    toast.success('🎉 Event added successfully! Your marketing content will be tailored for this event.');
  };

  const handleCampaignCreated = () => {
    setShowNewCampaignModal(false);
    fetchData();
    toast.success('🚀 Campaign created! Ready to generate amazing content for your audience.');
  };

  const handleBackfillComplete = () => {
    setShowBackfill(false);
    fetchData();
  };

  // Early return if no authenticated user
  if (!user) {
    return (
      <ProtectedPageWrapper>
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
          <div className="flex items-center justify-center min-h-screen">
            <Card className="p-8 shadow-lg border-0">
              <CardContent className="text-center space-y-4">
                <p className="text-lg font-semibold text-gray-900">Please log in to access your calendar</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </ProtectedPageWrapper>
    );
  }

  if (loading) {
    return (
      <ProtectedPageWrapper>
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
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
        </div>
      </ProtectedPageWrapper>
    );
  }

  if (error) {
    return (
      <ProtectedPageWrapper>
        <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-100">
          <div className="flex items-center justify-center min-h-screen">
            <Card className="p-8 shadow-lg border-0 max-w-md">
              <CardContent className="text-center space-y-4">
                <div className="text-red-600 mb-4">
                  <Calendar className="w-12 h-12 mx-auto mb-3" />
                  <p className="text-lg font-semibold">Error loading calendar</p>
                  <p className="text-sm text-gray-600 mt-1">{error}</p>
                </div>
                <Button 
                  onClick={fetchData}
                  className="w-full bg-red-600 hover:bg-red-700"
                >
                  Try Again
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </ProtectedPageWrapper>
    );
  }

  const currentWeek = getCurrentWeekNumber();
  const upcomingCampaigns = campaigns.filter(c => c.week_number >= currentWeek).length;
  const completedTasks = tasks.filter(t => t.status === 'completed').length;

  return (
    <ProtectedPageWrapper>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
        {/* Enhanced Header */}
        <div className="bg-white border-b border-gray-200 shadow-sm">
          <div className="max-w-7xl mx-auto px-6 py-8">
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
                  className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 shadow-md"
                  size="lg"
                >
                  <CalendarPlus className="w-5 h-5" />
                  Promote Event
                </Button>
                
                <Button
                  onClick={() => setShowNewCampaignModal(true)}
                  className="flex items-center gap-2 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 shadow-md"
                  size="lg"
                >
                  <PlusCircle className="w-5 h-5" />
                  Create Campaign
                </Button>
              </div>
            </div>
          </div>
        </div>
        
        {/* Calendar Content */}
        <div className="max-w-7xl mx-auto p-6 space-y-6">
          {/* Backfill Component */}
          {showBackfill && (
            <BackfillCampaigns 
              currentCampaignCount={campaigns.length}
              onBackfillComplete={handleBackfillComplete}
            />
          )}
          
          <CalendarView 
            campaigns={campaigns} 
            tasks={tasks}
            onDataUpdate={fetchData}
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
    </ProtectedPageWrapper>
  );
};

export default CalendarPage;
