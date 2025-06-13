
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ProtectedPageWrapper } from "@/components/ProtectedPageWrapper";
import { DashboardContent } from "@/components/dashboard/DashboardContent";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Home, TrendingUp, Users, Clock, PlusCircle, BarChart3 } from "lucide-react";
import { AddEventDialog } from "@/components/homepage/AddEventDialog";
import { NewCampaignModal } from "@/components/homepage/NewCampaignModal";
import { toast } from "sonner";
import { getCurrentWeekNumber } from "@/utils/dateUtils";

const Index = () => {
  const [onboardingData, setOnboardingData] = useState({
    aboutBusiness: "",
    toneSamples: "",
    annualEvents: "",
    websiteUrl: ""
  });

  // Add state for quick action modals
  const [showAddEventDialog, setShowAddEventDialog] = useState(false);
  const [showNewCampaignModal, setShowNewCampaignModal] = useState(false);

  // Mock stats for demonstration
  const [stats, setStats] = useState({
    totalCampaigns: 0,
    activeCampaigns: 0,
    completedTasks: 0,
    pendingTasks: 0
  });

  useEffect(() => {
    // Load stats from database
    const loadStats = async () => {
      try {
        const { data: campaigns } = await supabase
          .from('campaigns')
          .select('*');

        const { data: tasks } = await supabase
          .from('content_tasks')
          .select('*');

        const currentWeek = getCurrentWeekNumber();
        const activeCampaigns = campaigns?.filter(c => c.week_number >= currentWeek).length || 0;
        const completedTasks = tasks?.filter(t => t.status === 'completed').length || 0;
        const pendingTasks = tasks?.filter(t => t.status === 'pending').length || 0;

        setStats({
          totalCampaigns: campaigns?.length || 0,
          activeCampaigns,
          completedTasks,
          pendingTasks
        });
      } catch (error) {
        console.error('Error loading stats:', error);
      }
    };

    loadStats();
  }, []);

  const handleBusinessNameChange = (newName: string) => {
    const updatedData = {
      ...onboardingData,
      aboutBusiness: `${newName} has been serving the community with quality gardening products and expert advice.`
    };
    setOnboardingData(updatedData);
  };

  const handleCampaignCreated = () => {
    // Refresh dashboard data
    window.location.reload();
  };

  // Quick action handlers
  const handleEventCreated = () => {
    setShowAddEventDialog(false);
    handleCampaignCreated();
    toast.success('🎉 Event added successfully! Your marketing content will be tailored for this event.');
  };

  const handleCampaignCreatedInternal = () => {
    setShowNewCampaignModal(false);
    handleCampaignCreated();
    toast.success('🚀 Campaign created! Ready to generate amazing content for your audience.');
  };

  return (
    <ProtectedPageWrapper>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
        {/* Enhanced Header */}
        <div className="bg-white border-b border-gray-200 shadow-sm">
          <div className="max-w-7xl mx-auto px-6 py-8">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
              <div className="space-y-2">
                <h1 className="text-4xl font-bold text-gray-900 flex items-center gap-3">
                  <Home className="w-10 h-10 text-blue-600" />
                  Dashboard Overview
                </h1>
                <p className="text-lg text-gray-600 font-medium">
                  Your marketing hub at a glance
                </p>
                
                {/* Quick stats */}
                <div className="flex items-center gap-6 mt-4">
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <TrendingUp className="w-4 h-4 text-green-600" />
                    <span className="font-medium">{stats.totalCampaigns}</span> total campaigns
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Clock className="w-4 h-4 text-blue-600" />
                    <span className="font-medium">{stats.activeCampaigns}</span> active
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <BarChart3 className="w-4 h-4 text-purple-600" />
                    <span className="font-medium">{stats.completedTasks}</span> tasks completed
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Users className="w-4 h-4 text-orange-600" />
                    <span className="font-medium">{stats.pendingTasks}</span> pending
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <Button
                  onClick={() => setShowAddEventDialog(true)}
                  className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 shadow-md"
                  size="lg"
                >
                  <BarChart3 className="w-5 h-5" />
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
        
        {/* Dashboard Content */}
        <div className="max-w-7xl mx-auto p-6">
          <DashboardContent
            onboardingData={onboardingData}
            onBusinessNameChange={handleBusinessNameChange}
            onCampaignCreated={handleCampaignCreated}
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
          onCampaignCreated={handleCampaignCreatedInternal}
        />
      </div>
    </ProtectedPageWrapper>
  );
};

export default Index;
