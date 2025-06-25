
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useTenant } from "@/hooks/useTenant";
import { NewCampaignDialog } from "./homepage/NewCampaignDialog";
import { ReadyToPostCard } from "./homepage/ReadyToPostCard";
import { ReviewQueueCard } from "./content/ReviewQueueCard";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { getCurrentWeekNumber } from "@/utils/dateUtils";
import { HomepageHeader } from "./homepage/HomepageHeader";
import { HomepageActions } from "./homepage/HomepageActions";
import { HomepageMainContent } from "./homepage/HomepageMainContent";
import { HomepageSidebar } from "./homepage/HomepageSidebar";
import { Campaign } from "@/types/content";
import { HomepageErrorBoundary } from "./homepage/HomepageErrorBoundary";

export const Homepage = () => {
  const { user } = useAuth();
  const { tenant, loading: tenantLoading } = useTenant();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openNewCampaign, setOpenNewCampaign] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check if user is developer
  const isDeveloper = user?.email === 'jon@getclear.ca';

  const fetchCampaigns = async () => {
    if (!user) {
      console.log('Homepage: No authenticated user, skipping campaign fetch');
      setLoading(false);
      return;
    }

    if (tenantLoading) {
      console.log('Homepage: Tenant still loading, waiting...');
      return;
    }

    try {
      setError(null);
      console.log('Homepage: Fetching campaigns for user:', user.id, 'tenant:', tenant?.id || 'none');
      
      // Build the query based on tenant availability
      let campaignQuery = supabase.from('campaigns').select('*');
      
      if (tenant?.id) {
        campaignQuery = campaignQuery.eq('tenant_id', tenant.id);
      } else {
        campaignQuery = campaignQuery.eq('user_id', user.id);
      }

      const { data, error } = await campaignQuery.order('created_at', { ascending: false });

      if (error) {
        console.error('Homepage: Error fetching campaigns:', error);
        setError('Failed to load campaigns');
        toast.error('Failed to load campaigns');
        setCampaigns([]);
      } else {
        console.log('Homepage: Successfully fetched', data?.length || 0, 'campaigns');
        setCampaigns(data || []);
      }
    } catch (error) {
      console.error('Homepage: Error fetching campaigns:', error);
      setError('An unexpected error occurred while loading campaigns');
      toast.error('An unexpected error occurred');
      setCampaigns([]);
    } finally {
      // CRITICAL FIX: Always set loading to false
      setLoading(false);
    }
  };

  const fetchTasks = async () => {
    if (!user) {
      console.log('Homepage: No authenticated user, skipping task fetch');
      return;
    }

    if (tenantLoading) {
      console.log('Homepage: Tenant still loading, skipping task fetch');
      return;
    }

    try {
      console.log('Homepage: Fetching tasks for user:', user.id, 'tenant:', tenant?.id || 'none');
      
      // Build status filter with valid statuses only
      const statusFilter = ['planned', 'review', 'approved', 'posted', 'generated'];
      if (isDeveloper) {
        statusFilter.push('preview');
      }

      // Build the query based on tenant availability
      let taskQuery = supabase
        .from('content_tasks')
        .select(`
          *,
          campaigns!inner (
            title,
            tenant_id,
            user_id
          ),
          holidays (
            holiday_name,
            holiday_date
          )
        `)
        .in('status', statusFilter)
        .order('created_at', { ascending: false });

      if (tenant?.id) {
        taskQuery = taskQuery.eq('tenant_id', tenant.id);
      } else {
        taskQuery = taskQuery.eq('user_id', user.id);
      }

      const { data, error } = await taskQuery;

      if (error) {
        console.error('Homepage: Error fetching tasks:', error);
        // Don't show error toast for tasks, just log it
        setTasks([]);
      } else {
        // Security filter to double-check ownership
        const securityCheckedTasks = data?.filter(task => {
          if (tenant?.id) {
            return task.campaigns?.tenant_id === tenant.id;
          } else {
            return task.campaigns?.user_id === user.id || task.user_id === user.id;
          }
        }) || [];
        
        console.log('Homepage: Successfully fetched', securityCheckedTasks.length, 'tasks');
        setTasks(securityCheckedTasks);
      }
    } catch (error) {
      console.error('Homepage: Error fetching tasks:', error);
      setTasks([]);
    }
  };

  const handleCampaignCreate = async (newCampaign: Campaign) => {
    try {
      await fetchCampaigns();
      toast.success('Campaign created successfully');
      setOpenNewCampaign(false);
    } catch (error) {
      console.error('Error handling campaign creation:', error);
      toast.error('Failed to refresh campaigns');
    }
  };

  const handleTaskUpdate = () => {
    fetchTasks();
  };

  const handleThemesGenerated = () => {
    fetchCampaigns();
  };

  // Initial data loading with proper dependency management
  useEffect(() => {
    if (!user) {
      console.log('Homepage: No user, setting loading to false');
      setLoading(false);
      return;
    }

    if (tenantLoading) {
      console.log('Homepage: Tenant loading, waiting...');
      return;
    }

    // User is authenticated and tenant loading is complete
    console.log('Homepage: Starting data fetch for user:', user.id, 'tenant:', tenant?.id || 'none');
    fetchCampaigns();
    fetchTasks();
  }, [user, tenant, tenantLoading]);

  // Handle early returns with proper loading states
  if (!user || tenantLoading) {
    return (
      <div className="min-h-screen bg-garden-background">
        <div className="max-w-5xl mx-auto p-6">
          <div className="flex justify-center items-center py-20">
            <div className="text-center">
              <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4 text-garden-green" />
              <p className="text-garden-green font-medium text-lg">
                {!user ? 'Please log in to access your campaigns' : 'Loading your workspace...'}
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Show tenant assignment message if user has no tenant
  if (!tenant) {
    return (
      <div className="min-h-screen bg-garden-background">
        <div className="max-w-5xl mx-auto p-6">
          <div className="flex justify-center items-center py-20">
            <div className="text-center">
              <p className="text-garden-green font-medium text-lg">Setting up your workspace...</p>
              <p className="text-gray-500 text-sm mt-2">Please contact support to assign you to an organization.</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <div className="min-h-screen bg-garden-background">
        <div className="max-w-5xl mx-auto p-6">
          <div className="flex justify-center items-center py-20">
            <div className="text-center">
              <p className="text-red-600 font-medium text-lg">{error}</p>
              <button 
                onClick={() => {
                  setError(null);
                  setLoading(true);
                  fetchCampaigns();
                  fetchTasks();
                }}
                className="mt-4 px-4 py-2 bg-garden-green text-white rounded hover:bg-garden-green/90"
              >
                Try Again
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-garden-background">
        <div className="max-w-5xl mx-auto p-6">
          <HomepageErrorBoundary>
            <HomepageHeader 
              onNewCampaignClick={() => setOpenNewCampaign(true)} 
              onImportComplete={fetchCampaigns} 
            />
          </HomepageErrorBoundary>
          
          <div className="flex justify-center items-center py-20">
            <div className="text-center">
              <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4 text-garden-green" />
              <p className="text-garden-green font-medium text-lg">Loading your campaigns and content...</p>
              <p className="text-gray-500 text-sm mt-2">Setting up your marketing workspace</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const weekNumber = getCurrentWeekNumber();
  let currentCampaign = campaigns.find(c => c.week_number === weekNumber);
  
  if (!currentCampaign && campaigns.length > 0) {
    console.log(`Homepage: No campaign found for current week ${weekNumber}, available weeks:`, 
      campaigns.map(c => c.week_number));
  }

  return (
    <HomepageErrorBoundary>
      <div className="min-h-screen bg-garden-background p-6">
        <div className="max-w-5xl mx-auto space-y-8">
          <HomepageErrorBoundary>
            <HomepageHeader 
              onNewCampaignClick={() => setOpenNewCampaign(true)} 
              onImportComplete={fetchCampaigns} 
            />
          </HomepageErrorBoundary>

          <HomepageErrorBoundary>
            <HomepageActions 
              onNewCampaignClick={() => setOpenNewCampaign(true)} 
              onImportComplete={fetchCampaigns} 
            />
          </HomepageErrorBoundary>

          <HomepageErrorBoundary>
            <ReviewQueueCard onTaskUpdate={handleTaskUpdate} />
          </HomepageErrorBoundary>

          <HomepageErrorBoundary>
            <ReadyToPostCard 
              tasks={tasks}
              onTaskUpdate={handleTaskUpdate}
            />
          </HomepageErrorBoundary>

          <div className="grid lg:grid-cols-3 gap-6">
            <HomepageErrorBoundary>
              <HomepageMainContent 
                currentCampaign={currentCampaign}
                onTaskUpdate={handleTaskUpdate}
              />
            </HomepageErrorBoundary>
            
            <HomepageErrorBoundary>
              <HomepageSidebar onThemesGenerated={handleThemesGenerated} />
            </HomepageErrorBoundary>
          </div>
        </div>

        <NewCampaignDialog 
          open={openNewCampaign} 
          onOpenChange={setOpenNewCampaign} 
          onCreate={handleCampaignCreate} 
        />
      </div>
    </HomepageErrorBoundary>
  );
};
