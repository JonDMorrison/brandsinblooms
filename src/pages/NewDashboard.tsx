
import React, { useState, useEffect } from 'react';
import { FullWidthLayout } from '@/components/FullWidthLayout';
import { useAuth } from '@/contexts/AuthContext';
import { useTenant } from '@/hooks/useTenant';
import { supabase } from '@/integrations/supabase/client';
import { TodaysFocusCard } from '@/components/new-dashboard/TodaysFocusCard';
import { DraftTray } from '@/components/new-dashboard/DraftTray';
import { ComposerPanel } from '@/components/new-dashboard/ComposerPanel';
import { SmartTimeRibbon } from '@/components/new-dashboard/SmartTimeRibbon';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { toast } from 'sonner';

interface DashboardData {
  currentCampaign: any;
  tasks: any[];
  socialConnections: any[];
}

const NewDashboard = () => {
  const { user } = useAuth();
  const { tenant } = useTenant();
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedDraft, setSelectedDraft] = useState<any>(null);

  useEffect(() => {
    if (user) {
      fetchDashboardData();
    }
  }, [user, tenant]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);

      // Fetch current campaign
      const campaignQuery = supabase
        .from('campaigns')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1);

      if (tenant?.id) {
        campaignQuery.eq('tenant_id', tenant.id);
      } else {
        campaignQuery.eq('user_id', user?.id);
      }

      const { data: campaigns } = await campaignQuery;
      const currentCampaign = campaigns?.[0] || null;

      // Fetch tasks
      const taskQuery = supabase
        .from('content_tasks')
        .select(`
          *,
          campaigns (
            title,
            user_id,
            tenant_id
          )
        `)
        .in('status', ['draft', 'generated', 'approved'])
        .order('created_at', { ascending: false });

      if (tenant?.id) {
        taskQuery.eq('tenant_id', tenant.id);
      } else {
        taskQuery.eq('user_id', user?.id);
      }

      const { data: tasks } = await taskQuery;

      // Fetch social connections
      const { data: connections } = await supabase
        .from('social_connections')
        .select('*')
        .eq('user_id', user?.id)
        .eq('is_active', true);

      setDashboardData({
        currentCampaign,
        tasks: tasks || [],
        socialConnections: connections || []
      });

    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const handleTaskUpdate = () => {
    fetchDashboardData();
  };

  if (loading) {
    return (
      <FullWidthLayout>
        <div className="min-h-screen bg-[#F9FAFB] flex items-center justify-center">
          <LoadingSpinner size="lg" text="Loading BloomSuite Dashboard..." />
        </div>
      </FullWidthLayout>
    );
  }

  return (
    <FullWidthLayout>
      <div className="min-h-screen bg-[#F9FAFB] p-6">
        <div className="max-w-full mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-semibold text-[#3E5A6B] mb-2">BloomSuite Dashboard</h1>
            <p className="text-gray-600">Your content creation command center</p>
          </div>

          {/* Main Dashboard Grid - Now with full width */}
          <div className="grid grid-cols-12 gap-6 mb-6">
            {/* Today's Focus - Left Column */}
            <div className="col-span-3">
              <TodaysFocusCard 
                campaign={dashboardData?.currentCampaign}
                onComplete={() => handleTaskUpdate()}
              />
            </div>

            {/* Draft Tray - Second Column */}
            <div className="col-span-3">
              <DraftTray 
                tasks={dashboardData?.tasks || []}
                selectedDraft={selectedDraft}
                onSelectDraft={setSelectedDraft}
              />
            </div>

            {/* Composer Panel - Right 6 Columns */}
            <div className="col-span-6">
              <ComposerPanel 
                selectedDraft={selectedDraft}
                socialConnections={dashboardData?.socialConnections || []}
                onTaskUpdate={handleTaskUpdate}
              />
            </div>
          </div>

          {/* Smart-Time Ribbon - Full Width */}
          <SmartTimeRibbon 
            tasks={dashboardData?.tasks || []}
            onScheduleUpdate={handleTaskUpdate}
          />
        </div>
      </div>
    </FullWidthLayout>
  );
};

export default NewDashboard;
