import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { UnifiedDashboardGrid } from '@/components/dashboard/UnifiedDashboardGrid';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useTenant } from '@/hooks/useTenant';
import { toast } from 'sonner';

interface CRMCampaignCreatorProps {
  campaignSlug?: string;
  contentTaskId?: string | null;
}

export const CRMCampaignCreator: React.FC<CRMCampaignCreatorProps> = ({ 
  campaignSlug, 
  contentTaskId 
}) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { tenant } = useTenant();
  
  const [activeCampaign, setActiveCampaign] = useState<any>(null);
  const [userCreatedCampaigns, setUserCreatedCampaigns] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchCampaignData();
    }
  }, [user, tenant]);

  const fetchCampaignData = async () => {
    if (!user) return;

    try {
      setLoading(true);

      // Fetch campaigns
      let campaignsQuery = supabase
        .from('campaigns')
        .select('*')
        .order('created_at', { ascending: false });

      if (tenant?.id) {
        campaignsQuery = campaignsQuery.eq('tenant_id', tenant.id);
      } else {
        campaignsQuery = campaignsQuery.eq('user_id', user.id);
      }

      const { data: campaignsData, error: campaignsError } = await campaignsQuery;

      if (campaignsError) throw campaignsError;

      const userCampaigns = campaignsData || [];
      // Get the most recent campaign as active
      const active = userCampaigns[0] || null;

      setActiveCampaign(active);
      setUserCreatedCampaigns(userCampaigns);

      // Fetch tasks for active campaign
      if (active) {
        const { data: tasksData, error: tasksError } = await supabase
          .from('content_tasks')
          .select('*, campaigns(*)')
          .eq('campaign_id', active.id)
          .order('scheduled_for', { ascending: true });

        if (tasksError) throw tasksError;
        setTasks(tasksData || []);
      } else {
        setTasks([]);
      }
    } catch (error) {
      console.error('Error fetching campaign data:', error);
      toast.error('Failed to load campaign data');
    } finally {
      setLoading(false);
    }
  };

  const handleTaskUpdate = () => {
    fetchCampaignData();
  };

  const handleCampaignCreated = () => {
    fetchCampaignData();
  };

  const handleCampaignUpdate = () => {
    fetchCampaignData();
  };

  const handleCreateCampaign = () => {
    // Trigger campaign creation flow
    toast.info('Campaign creation flow');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading campaign data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-full mx-auto p-6 space-y-6">
        {/* Back Button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/crm/campaigns')}
          className="flex items-center gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Campaigns
        </Button>

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Campaign Content</h1>
            <p className="text-muted-foreground">Manage your campaign content and schedule</p>
          </div>
        </div>

        {/* Unified Dashboard Grid */}
        <UnifiedDashboardGrid
          activeCampaign={activeCampaign}
          userCreatedCampaigns={userCreatedCampaigns}
          tasks={tasks}
          onTaskUpdate={handleTaskUpdate}
          onCampaignCreated={handleCampaignCreated}
          onCampaignUpdate={handleCampaignUpdate}
          onCreateCampaign={handleCreateCampaign}
        />
      </div>
    </div>
  );
};
