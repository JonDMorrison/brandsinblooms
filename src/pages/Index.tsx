
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ProtectedPageWrapper } from "@/components/ProtectedPageWrapper";
import { DashboardContent } from "@/components/dashboard/DashboardContent";
import { WelcomeSection } from "@/components/homepage/WelcomeSection";
import { Card, CardContent } from "@/components/ui/card";
import { Home, TrendingUp, Users, Clock, BarChart3 } from "lucide-react";
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
        {/* Enhanced Header with Seasonal Welcome */}
        <div className="bg-white border-b border-gray-200 shadow-sm">
          <div className="max-w-7xl mx-auto px-6 py-8">
            <WelcomeSection 
              onboardingData={onboardingData}
              onBusinessNameChange={handleBusinessNameChange}
            />
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
