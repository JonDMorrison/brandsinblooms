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
import { useTenant } from "@/hooks/useTenant";

const CalendarPage = () => {
  const { user } = useAuth();
  const { tenant } = useTenant();
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
      
      console.log('CalendarPage: Fetching data for user:', user.id, 'tenant:', tenant?.id || 'none');
      
      // Build campaigns query based on tenant vs user model
      let campaignsQuery = supabase
        .from('campaigns')
        .select('*')
        .order('start_date', { ascending: true });

      if (tenant?.id) {
        // Tenant-based access control
        campaignsQuery = campaignsQuery.eq('tenant_id', tenant.id);
        console.log('CalendarPage: Using tenant-based campaigns query for tenant:', tenant.id);
      } else {
        // User-based access control
        campaignsQuery = campaignsQuery.eq('user_id', user.id);
        console.log('CalendarPage: Using user-based campaigns query for user:', user.id);
      }

      const { data: campaignsData, error: campaignsError } = await campaignsQuery;

      if (campaignsError) {
        console.error('CalendarPage: Error fetching campaigns:', campaignsError);
        throw campaignsError;
      }

      // Build tasks query with inner join to ensure we only get tasks for user's/tenant's campaigns
      let tasksQuery = supabase
        .from('content_tasks')
        .select(`
          *,
          campaigns!inner (
            title,
            week_number,
            start_date,
            user_id,
            tenant_id
          )
        `)
        .order('scheduled_date', { ascending: true });

      if (tenant?.id) {
        // Tenant-based access control
        tasksQuery = tasksQuery.eq('campaigns.tenant_id', tenant.id);
        console.log('CalendarPage: Using tenant-based tasks query for tenant:', tenant.id);
      } else {
        // User-based access control
        tasksQuery = tasksQuery.eq('campaigns.user_id', user.id);
        console.log('CalendarPage: Using user-based tasks query for user:', user.id);
      }

      const { data: tasksData, error: tasksError } = await tasksQuery;

      if (tasksError) {
        console.error('CalendarPage: Error fetching tasks:', tasksError);
        throw tasksError;
      }

      console.log('CalendarPage: Successfully fetched', campaignsData?.length || 0, 'campaigns and', tasksData?.length || 0, 'tasks');

      // Additional security verification - ensure all data belongs to current user/tenant
      const userCampaigns = campaignsData?.filter(campaign => 
        tenant?.id ? campaign.tenant_id === tenant.id : campaign.user_id === user.id
      ) || [];
      
      const userTasks = tasksData?.filter(task => 
        task.campaigns && (
          tenant?.id ? task.campaigns.tenant_id === tenant.id : task.campaigns.user_id === user.id
        )
      ) || [];

      if (userCampaigns.length !== campaignsData?.length) {
        console.warn('CalendarPage: Security alert - some campaigns did not belong to current user/tenant');
      }
      if (userTasks.length !== tasksData?.length) {
        console.warn('CalendarPage: Security alert - some tasks did not belong to current user/tenant');
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
  }, [user, tenant]);

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
      <div className="flex items-center justify-center min-h-screen">
        <Card className="p-8 shadow-lg border-0">
          <CardContent className="text-center space-y-4">
            <p className="text-lg font-semibold text-gray-900">Please log in to access your calendar</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (loading) {
    return (
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
    );
  }

  if (error) {
    return (
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
    );
  }

  const currentWeek = getCurrentWeekNumber();
  const upcomingCampaigns = campaigns.filter(c => c.week_number >= currentWeek).length;
  const completedTasks = tasks.filter(t => t.status === 'completed').length;

  return (
    <div className="space-y-6">
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
      
      {/* Calendar Content */}
      <div className="space-y-6">
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
  );
};

export default CalendarPage;
