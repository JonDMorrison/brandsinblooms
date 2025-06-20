
import { useState, useEffect } from "react";
import { EnhancedAppleCard } from "@/components/ui/enhanced-apple-card";
import { AppleCardContent } from "@/components/ui/apple-card";
import { BodyMedium } from "@/components/ui/typography";
import { ResponsiveGrid } from "@/components/ui/responsive-grid";
import { FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useTenant } from "@/hooks/useTenant";
import { ContentViewer } from "@/components/content/ContentViewer";
import { ImprovedReadyToPostItem } from "./ready-to-post/ImprovedReadyToPostItem";
import { useIsMobile } from "@/hooks/use-mobile";

interface ReadyToPostCardProps {
  tasks: any[];
  onTaskUpdate?: () => void;
  onTaskClick?: (task: any) => void;
}

export const ReadyToPostCard = ({ tasks: propTasks, onTaskUpdate, onTaskClick }: ReadyToPostCardProps) => {
  const { user } = useAuth();
  const { tenant } = useTenant();
  const isMobile = useIsMobile();
  const [tasks, setTasks] = useState<any[]>([]);
  const [selectedTask, setSelectedTask] = useState<any>(null);
  const [showContentViewer, setShowContentViewer] = useState(false);
  const [showAllContent, setShowAllContent] = useState(false);
  const [currentCampaign, setCurrentCampaign] = useState<any>(null);

  useEffect(() => {
    const fetchReadyTasks = async () => {
      if (!user || !tenant) {
        console.log('ReadyToPostCard: No authenticated user or tenant, skipping fetch');
        return;
      }

      try {
        console.log('ReadyToPostCard: Fetching tasks for tenant:', tenant.id);
        
        // UPDATED FILTER: Fetch approved and posted content tasks for the tenant
        const { data, error } = await supabase
          .from('content_tasks')
          .select(`
            *,
            campaigns!inner (
              title,
              tenant_id
            )
          `)
          .eq('tenant_id', tenant.id)  // Filter by current tenant
          .in('status', ['approved', 'posted'])  // Only show approved/posted
          .not('ai_output', 'is', null)
          .order('created_at', { ascending: false })
          .limit(6);

        if (error) {
          console.error('ReadyToPostCard: Error fetching ready tasks:', error);
          setTasks([]);
        } else {
          console.log('ReadyToPostCard: Successfully fetched', data?.length || 0, 'approved/posted tasks for tenant', tenant.id);
          
          // Additional security check: Verify all tasks belong to current tenant
          const tenantTasks = data?.filter(task => 
            task.campaigns && task.campaigns.tenant_id === tenant.id
          ) || [];
          
          if (tenantTasks.length !== data?.length) {
            console.warn('ReadyToPostCard: Security alert - some tasks did not belong to current tenant');
          }
          
          setTasks(tenantTasks);
          if (tenantTasks.length > 0) {
            setCurrentCampaign(tenantTasks[0].campaigns);
          }
        }
      } catch (error) {
        console.error('ReadyToPostCard: Exception in fetchReadyTasks:', error);
        setTasks([]);
      }
    };

    if (propTasks && propTasks.length > 0) {
      // UPDATED FILTER: When using prop tasks, filter to only approved/posted for current tenant
      if (!user || !tenant) {
        console.warn('ReadyToPostCard: Received prop tasks but no authenticated user or tenant');
        setTasks([]);
        return;
      }
      
      const readyTasks = propTasks
        .filter(task => {
          // Verify task belongs to current tenant
          const belongsToTenant = task.tenant_id === tenant.id;
          if (!belongsToTenant) {
            console.warn('ReadyToPostCard: Filtering out task that does not belong to current tenant:', task.id);
          }
          // Updated filter to only show approved/posted content
          return belongsToTenant && ['approved', 'posted'].includes(task.status) && task.ai_output;
        })
        .slice(0, 6);
      
      console.log('ReadyToPostCard: Using prop tasks, filtered to', readyTasks.length, 'tenant-owned approved/posted tasks');
      setTasks(readyTasks);
      if (readyTasks.length > 0) {
        setCurrentCampaign(readyTasks[0].campaigns);
      }
    } else {
      fetchReadyTasks();
    }
  }, [user, tenant, propTasks]);

  const handleTaskClick = (task: any) => {
    // SECURITY CHECK: Verify task belongs to current tenant before opening
    if (!user || !tenant || !task.campaigns || task.campaigns.tenant_id !== tenant.id) {
      console.error('ReadyToPostCard: Attempted to access task not owned by current tenant');
      return;
    }
    
    if (onTaskClick) {
      onTaskClick(task);
    } else {
      setSelectedTask(task);
      setShowContentViewer(true);
    }
  };

  const handleViewAllContent = () => {
    if (!user || !tenant || !currentCampaign || currentCampaign.tenant_id !== tenant.id) {
      console.error('ReadyToPostCard: Attempted to view content for campaign not owned by current tenant');
      return;
    }
    
    if (currentCampaign && tasks.length > 0) {
      const firstTask = tasks[0];
      setSelectedTask(firstTask);
      setShowAllContent(true);
      setShowContentViewer(true);
    }
  };

  const handleContentViewerClose = () => {
    setShowContentViewer(false);
    setSelectedTask(null);
    setShowAllContent(false);
    if (onTaskUpdate) {
      onTaskUpdate();
    }
  };

  if (tasks.length === 0) {
    return (
      <EnhancedAppleCard 
        variant="default" 
        surface="secondary" 
        className="apple-empty-state apple-hover-premium"
        hoverEffect="none"
        animated={true}
        data-ready-to-post-section="true"
      >
        <AppleCardContent className={`
          text-center apple-section-spacing
          ${isMobile ? 'py-6' : 'py-12'}
        `}>
          <div className={`
            apple-icon-container mx-auto mb-4
            ${isMobile ? 'w-12 h-12' : 'w-16 h-16'}
          `}>
            <FileText className={`text-gray-400 transition-colors duration-300 ${isMobile ? 'w-6 h-6' : 'w-8 h-8'}`} />
          </div>
          <BodyMedium className={`apple-body-enhanced text-gray-500 max-w-md mx-auto ${isMobile ? 'text-sm' : ''}`}>
            Your approved marketing content will appear here once ready to post. Create and approve campaigns to start growing your content garden!
          </BodyMedium>
          <div className="mt-4">
            <span className="text-2xl garden-breathing">🌱</span>
          </div>
        </AppleCardContent>
      </EnhancedAppleCard>
    );
  }

  return (
    <>
      <EnhancedAppleCard 
        variant="elevated" 
        surface="primary"
        hoverEffect="subtle"
        animated={true}
        className={`shadow-lg ${isMobile ? 'mobile-constrained' : ''}`}
        data-ready-to-post-section="true"
      >
        <AppleCardContent className="apple-card-spacing">
          <ResponsiveGrid 
            cols={{ mobile: 1, tablet: 1, desktop: 2 }}
            gap={{ mobile: "gap-4", tablet: "gap-5", desktop: "gap-6" }}
            animated={true}
            staggerDelay={150}
          >
            {tasks.map((task, index) => (
              <div 
                key={task.id}
                className="apple-hover-premium rounded-lg border border-gray-100 p-4 bg-white transition-all duration-300"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <ImprovedReadyToPostItem
                  task={task}
                  onClick={handleTaskClick}
                  onTaskUpdate={onTaskUpdate}
                  onEdit={onTaskClick}
                />
              </div>
            ))}
          </ResponsiveGrid>
        </AppleCardContent>
      </EnhancedAppleCard>

      {selectedTask && (
        <ContentViewer
          campaignId={selectedTask.campaign_id}
          campaignTitle={selectedTask.campaigns?.title || currentCampaign?.title || 'Campaign'}
          isOpen={showContentViewer}
          onClose={handleContentViewerClose}
          onTaskUpdate={onTaskUpdate}
        />
      )}
    </>
  );
};
