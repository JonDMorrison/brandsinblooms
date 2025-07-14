import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckCircle, Clock, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useTenant } from "@/hooks/useTenant";

interface ProgressiveDashboardShellProps {
  children: React.ReactNode;
}

interface GenerationProgress {
  profile: boolean;
  campaigns: number;
  contentTasks: number;
  totalExpected: number;
  isComplete: boolean;
}

export const ProgressiveDashboardShell = ({ children }: ProgressiveDashboardShellProps) => {
  const { user } = useAuth();
  const { tenant } = useTenant();
  const [progress, setProgress] = useState<GenerationProgress>({
    profile: true, // Profile is already created when we reach this point
    campaigns: 0,
    contentTasks: 0,
    totalExpected: 52, // Expected number of campaigns + tasks
    isComplete: false
  });
  const [showBanner, setShowBanner] = useState(true);

  useEffect(() => {
    if (!user || !tenant) return;

    // Check if content generation is still in progress
    const checkGenerationStatus = async () => {
      try {
        // Check campaigns
        const { data: campaigns, error: campaignError } = await supabase
          .from('campaigns')
          .select('id')
          .eq('tenant_id', tenant.id);

        // Check content tasks
        const { data: tasks, error: taskError } = await supabase
          .from('content_tasks')
          .select('id')
          .eq('tenant_id', tenant.id);

        if (!campaignError && !taskError) {
          const campaignCount = campaigns?.length || 0;
          const taskCount = tasks?.length || 0;
          const total = campaignCount + taskCount;
          
          setProgress(prev => ({
            ...prev,
            campaigns: campaignCount,
            contentTasks: taskCount,
            isComplete: total >= 60 // Rough estimate for completion
          }));

          // Hide banner if content generation is complete
          if (total >= 60) {
            setTimeout(() => setShowBanner(false), 2000);
          }
        }
      } catch (error) {
        console.error('Error checking generation status:', error);
      }
    };

    // Initial check
    checkGenerationStatus();

    // Set up real-time subscription for campaigns
    const campaignChannel = supabase
      .channel('campaign-updates')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'campaigns',
          filter: `tenant_id=eq.${tenant.id}`
        },
        () => checkGenerationStatus()
      )
      .subscribe();

    // Set up real-time subscription for content tasks
    const taskChannel = supabase
      .channel('task-updates')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'content_tasks',
          filter: `tenant_id=eq.${tenant.id}`
        },
        () => checkGenerationStatus()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(campaignChannel);
      supabase.removeChannel(taskChannel);
    };
  }, [user, tenant]);

  const progressPercentage = Math.min(
    ((progress.campaigns + progress.contentTasks) / progress.totalExpected) * 100,
    100
  );

  if (!showBanner) {
    return <>{children}</>;
  }

  return (
    <div className="w-full">
      {/* Progress Banner */}
      <Card className="mb-6 border-blue-200 bg-blue-50">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
              <CardTitle className="text-lg text-blue-900">
                Setting up your content library
              </CardTitle>
            </div>
            <div className="text-sm text-blue-700">
              {Math.round(progressPercentage)}% complete
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <Progress value={progressPercentage} className="w-full" />
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div className="flex items-center space-x-2">
              <CheckCircle className="w-4 h-4 text-green-600" />
              <span className="text-gray-700">Profile Created</span>
            </div>
            
            <div className="flex items-center space-x-2">
              {progress.campaigns > 0 ? (
                <CheckCircle className="w-4 h-4 text-green-600" />
              ) : (
                <Clock className="w-4 h-4 text-yellow-600" />
              )}
              <span className="text-gray-700">
                Campaigns ({progress.campaigns}/52)
              </span>
            </div>
            
            <div className="flex items-center space-x-2">
              {progress.contentTasks > 0 ? (
                <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
              ) : (
                <Clock className="w-4 h-4 text-yellow-600" />
              )}
              <span className="text-gray-700">
                Content Posts ({progress.contentTasks}+)
              </span>
            </div>
          </div>

          <div className="text-xs text-blue-600">
            Your dashboard is ready to use! Content will appear as it's generated.
          </div>
        </CardContent>
      </Card>

      {/* Dashboard Content */}
      {children}
    </div>
  );
};