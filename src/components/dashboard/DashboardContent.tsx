
import { useDashboardData } from "./useDashboardData";
import { WelcomeSection } from "@/components/homepage/WelcomeSection";
import { QuickActionsGrid } from "@/components/homepage/QuickActionsGrid";
import { CampaignCard } from "@/components/homepage/CampaignCard";
import { NewCampaignCard } from "@/components/homepage/NewCampaignCard";
import { WhatsComingNextCard } from "@/components/homepage/WhatsComingNextCard";
import { AnalyticsSnapshot } from "@/components/homepage/AnalyticsSnapshot";
import { NextStepBanner } from "@/components/homepage/NextStepBanner";
import { ReadyToPostCard } from "@/components/homepage/ReadyToPostCard";
import { ReviewQueue } from "@/components/content/ReviewQueue";
import { SetupProgressCard } from "@/components/homepage/SetupProgressCard";
import { NewCampaignDialog } from "@/components/homepage/NewCampaignDialog";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlusCircle, AlertTriangle, RefreshCw, Calendar, Clock } from "lucide-react";
import { useState } from "react";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { SampleCampaignCard } from "./SampleCampaignCard";
import { useAuth } from "@/contexts/AuthContext";

interface DashboardContentProps {
  onboardingData: any;
  onBusinessNameChange: (newName: string) => void;
  onCampaignCreated: () => void;
  onTaskClick?: (task: any) => void;
}

export const DashboardContent = ({
  onboardingData,
  onBusinessNameChange,
  onCampaignCreated,
  onTaskClick
}: DashboardContentProps) => {
  const [showNewCampaignDialog, setShowNewCampaignDialog] = useState(false);
  const { user } = useAuth();
  
  const {
    campaigns,
    tasks,
    loading,
    error,
    isOffline,
    handleTaskUpdate,
    handleCampaignCreated,
    refetch
  } = useDashboardData();

  const handleCampaignCreatedWrapper = async () => {
    try {
      console.log('DashboardContent: Campaign created, triggering refresh');
      await handleCampaignCreated();
      onCampaignCreated();
    } catch (error) {
      console.error('DashboardContent: Error handling campaign creation:', error);
    }
  };

  const handleGetStarted = () => {
    setShowNewCampaignDialog(true);
  };

  // Show loading state
  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <LoadingSpinner size="lg" text="Loading your marketing hub..." />
      </div>
    );
  }

  // Show error state with retry option
  if (error && !isOffline) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <Card className="max-w-md w-full border-destructive/20">
          <CardContent className="p-6 text-center">
            <AlertTriangle className="w-16 h-16 mx-auto mb-4 text-destructive" />
            <h2 className="text-xl font-semibold text-destructive mb-2">Dashboard Error</h2>
            <p className="text-destructive/80 mb-6">
              We encountered an issue loading your dashboard. This might be a temporary problem.
            </p>
            <Button 
              onClick={() => refetch()} 
              className="w-full"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Try Again
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const businessName = onboardingData?.aboutBusiness?.split('.')[0] || "Your Garden Center";

  return (
    <div className="p-8 bg-gray-50 min-h-screen">
      {/* Welcome Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <span className="text-4xl">☀️</span>
          <h1 className="text-3xl font-bold text-gray-900">
            Welcome back, {businessName}!
          </h1>
        </div>
        <p className="text-gray-600 text-lg">
          Your AI-powered marketing assistant is ready to help you create engaging content that grows your business.
        </p>
      </div>

      {/* Content Ready Banner */}
      <Card className="mb-8 bg-gradient-to-r from-green-50 to-blue-50 border-green-200">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <span className="text-2xl">📝</span>
              <div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  Your Content is Ready to Review!
                </h3>
                <p className="text-gray-600 mb-3">
                  We've generated personalized marketing content for you. Take a look and customize it to your liking.
                </p>
                <div className="flex items-center gap-2 text-sm text-gray-700">
                  <span>✅</span>
                  <span>Edit, approve, or regenerate any piece until it's perfect for your brand.</span>
                </div>
              </div>
            </div>
            <Button className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 text-lg">
              Review Your Content →
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column - Quick Actions */}
        <div className="lg:col-span-2 space-y-8">
          
          {/* Quick Actions */}
          <div>
            <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center gap-2">
              <span>⚡</span>
              Quick Actions
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Create Campaign */}
              <Card className="hover:shadow-md transition-shadow bg-green-50 border-green-200">
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <div className="bg-green-100 p-3 rounded-lg">
                      <PlusCircle className="w-6 h-6 text-green-600" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">
                        Create Campaign
                      </h3>
                      <p className="text-gray-600 text-sm mb-2">
                        Build themed marketing campaigns
                      </p>
                      <p className="text-gray-500 text-xs">
                        Get 5+ content pieces instantly
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Promote Event */}
              <Card className="hover:shadow-md transition-shadow bg-blue-50 border-blue-200">
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <div className="bg-blue-100 p-3 rounded-lg">
                      <Calendar className="w-6 h-6 text-blue-600" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">
                        Promote Event
                      </h3>
                      <p className="text-gray-600 text-sm mb-2">
                        Get help marketing your events
                      </p>
                      <p className="text-gray-500 text-xs">
                        Custom promotional content
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Content Calendar */}
              <Card className="hover:shadow-md transition-shadow bg-purple-50 border-purple-200">
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <div className="bg-purple-100 p-3 rounded-lg">
                      <Calendar className="w-6 h-6 text-purple-600" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">
                        Content Calendar
                      </h3>
                      <p className="text-gray-600 text-sm mb-2">
                        See your planned content schedule
                      </p>
                      <p className="text-gray-500 text-xs">
                        Preview what's coming this year
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>

        {/* Right Column - Status Cards */}
        <div className="space-y-6">
          
          {/* Review Queue */}
          <Card>
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Clock className="w-5 h-5" />
                Review Queue
              </h3>
              <p className="text-gray-600 text-sm mb-6">
                Content ready for your review
              </p>
              
              <div className="text-center py-8">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl">✅</span>
                </div>
                <h4 className="font-semibold text-gray-900 mb-2">All caught up!</h4>
                <p className="text-gray-500 text-sm">No content pending review</p>
              </div>
            </CardContent>
          </Card>

          {/* Ready to Post */}
          <Card>
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                Ready to Post
                <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full font-medium ml-auto">
                  22
                </span>
              </h3>
              <p className="text-gray-600 text-sm">
                Approved content ready for publishing
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* New Campaign Dialog */}
      <NewCampaignDialog 
        open={showNewCampaignDialog} 
        onOpenChange={setShowNewCampaignDialog} 
        onCreate={(newCampaign) => {
          setShowNewCampaignDialog(false);
          handleCampaignCreatedWrapper();
        }} 
      />
    </div>
  );
};
