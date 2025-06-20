import { useState, useEffect } from "react";
import { EnhancedAppleCard } from "@/components/ui/enhanced-apple-card";
import { AppleCardContent } from "@/components/ui/apple-card";
import { BodyMedium } from "@/components/ui/typography";
import { FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useTenant } from "@/hooks/useTenant";
import { ContentViewer } from "@/components/content/ContentViewer";
import { AccordionReadyToPostItem } from "./ready-to-post/AccordionReadyToPostItem";
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

  // Use environment-based detection instead of hardcoded email
  const isDevelopment = import.meta.env.DEV;

  useEffect(() => {
    const fetchReadyTasks = async () => {
      if (!user || !tenant) {
        console.log('ReadyToPostCard: No authenticated user or tenant, skipping fetch');
        return;
      }

      try {
        console.log('ReadyToPostCard: Fetching tasks for tenant:', tenant.id);
        
        // URGENT FIX: Updated status filter to match live user requirements
        const statusFilter = ['ready', 'approved', 'posted'];
        if (isDevelopment) {
          statusFilter.push('preview');
        }

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
          .in('status', statusFilter)  // URGENT FIX: Use corrected status filter
          .not('ai_output', 'is', null)
          .order('created_at', { ascending: false })
          .limit(12); // Show more items in accordion view

        if (error) {
          console.error('ReadyToPostCard: Error fetching ready tasks:', error);
          setTasks([]);
        } else {
          console.log('ReadyToPostCard: Successfully fetched', data?.length || 0, 'ready tasks for tenant', tenant.id);
          
          // Additional security check: Verify all tasks belong to current tenant
          // URGENT FIX: Also exclude PREVIEW campaigns for live users
          const tenantTasks = data?.filter(task => {
            const belongsToTenant = task.campaigns && task.campaigns.tenant_id === tenant.id;
            const isPreviewCampaign = task.campaigns?.title?.startsWith('PREVIEW');
            
            if (!isDevelopment && isPreviewCampaign) {
              return false;
            }
            
            return belongsToTenant;
          }) || [];
          
          if (tenantTasks.length !== data?.length) {
            console.warn('ReadyToPostCard: Security alert - some tasks did not belong to current tenant or were PREVIEW');
          }
          
          setTasks(tenantTasks);
        }
      } catch (error) {
        console.error('ReadyToPostCard: Exception in fetchReadyTasks:', error);
        setTasks([]);
      }
    };

    if (propTasks && propTasks.length > 0) {
      // When using prop tasks, filter to include ready, approved, posted, and preview (for dev) for current tenant
      if (!user || !tenant) {
        console.warn('ReadyToPostCard: Received prop tasks but no authenticated user or tenant');
        setTasks([]);
        return;
      }
      
      // URGENT FIX: Updated status filter
      const statusFilter = ['ready', 'approved', 'posted'];
      if (isDevelopment) {
        statusFilter.push('preview');
      }
      
      const readyTasks = propTasks
        .filter(task => {
          // Verify task belongs to current tenant
          const belongsToTenant = task.tenant_id === tenant.id;
          if (!belongsToTenant) {
            console.warn('ReadyToPostCard: Filtering out task that does not belong to current tenant:', task.id);
          }
          
          // URGENT FIX: Exclude PREVIEW campaigns for live users
          const isPreviewCampaign = task.campaigns?.title?.startsWith('PREVIEW');
          if (!isDevelopment && isPreviewCampaign) {
            return false;
          }
          
          // Updated filter to include ready, approved, posted, and preview (for dev) content
          return belongsToTenant && statusFilter.includes(task.status) && task.ai_output;
        })
        .slice(0, 12); // Show more items in accordion view
      
      console.log('ReadyToPostCard: Using prop tasks, filtered to', readyTasks.length, 'tenant-owned ready tasks');
      setTasks(readyTasks);
    } else {
      fetchReadyTasks();
    }
  }, [user, tenant, propTasks, isDevelopment]);

  const handleTaskViewFull = (task: any) => {
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

  const handleContentViewerClose = () => {
    setShowContentViewer(false);
    setSelectedTask(null);
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
          <div className="space-y-2">
            {tasks.map((task, index) => (
              <div 
                key={task.id}
                style={{ animationDelay: `${index * 75}ms` }}
              >
                <AccordionReadyToPostItem
                  task={task}
                  onViewFull={handleTaskViewFull}
                  onTaskUpdate={onTaskUpdate}
                />
              </div>
            ))}
          </div>
        </AppleCardContent>
      </EnhancedAppleCard>

      {selectedTask && (
        <ContentViewer
          campaignId={selectedTask.campaign_id}
          campaignTitle={selectedTask.campaigns?.title || 'Campaign'}
          isOpen={showContentViewer}
          onClose={handleContentViewerClose}
          onTaskUpdate={onTaskUpdate}
        />
      )}
    </>
  );
};
