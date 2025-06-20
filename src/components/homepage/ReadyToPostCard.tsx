
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
import { SimpleReadyToPostCard } from "./ready-to-post/SimpleReadyToPostCard";
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

  // Check if user is developer
  const isDeveloper = user?.email === 'jon@getclear.ca';

  useEffect(() => {
    const fetchReadyTasks = async () => {
      if (!user || !tenant) {
        console.log('ReadyToPostCard: No authenticated user or tenant, skipping fetch');
        return;
      }

      try {
        console.log('ReadyToPostCard: Fetching tasks for tenant:', tenant.id);
        
        // Build status filter - include 'approved' for everyone, 'posted' for everyone, and 'preview' for developer
        const statusFilter = ['approved', 'posted'];
        if (isDeveloper) {
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
          .in('status', statusFilter)  // Include approved, posted, and preview (for dev)
          .not('ai_output', 'is', null)
          .order('created_at', { ascending: false })
          .limit(12); // Show more items in simplified view

        if (error) {
          console.error('ReadyToPostCard: Error fetching ready tasks:', error);
          setTasks([]);
        } else {
          console.log('ReadyToPostCard: Successfully fetched', data?.length || 0, 'ready tasks for tenant', tenant.id);
          
          // Additional security check: Verify all tasks belong to current tenant
          const tenantTasks = data?.filter(task => 
            task.campaigns && task.campaigns.tenant_id === tenant.id
          ) || [];
          
          if (tenantTasks.length !== data?.length) {
            console.warn('ReadyToPostCard: Security alert - some tasks did not belong to current tenant');
          }
          
          setTasks(tenantTasks);
        }
      } catch (error) {
        console.error('ReadyToPostCard: Exception in fetchReadyTasks:', error);
        setTasks([]);
      }
    };

    if (propTasks && propTasks.length > 0) {
      // When using prop tasks, filter to include approved, posted, and preview (for dev) for current tenant
      if (!user || !tenant) {
        console.warn('ReadyToPostCard: Received prop tasks but no authenticated user or tenant');
        setTasks([]);
        return;
      }
      
      // Build status filter
      const statusFilter = ['approved', 'posted'];
      if (isDeveloper) {
        statusFilter.push('preview');
      }
      
      const readyTasks = propTasks
        .filter(task => {
          // Verify task belongs to current tenant
          const belongsToTenant = task.tenant_id === tenant.id;
          if (!belongsToTenant) {
            console.warn('ReadyToPostCard: Filtering out task that does not belong to current tenant:', task.id);
          }
          // Updated filter to include approved, posted, and preview (for dev) content
          return belongsToTenant && statusFilter.includes(task.status) && task.ai_output;
        })
        .slice(0, 12); // Show more items in simplified view
      
      console.log('ReadyToPostCard: Using prop tasks, filtered to', readyTasks.length, 'tenant-owned ready tasks');
      setTasks(readyTasks);
    } else {
      fetchReadyTasks();
    }
  }, [user, tenant, propTasks, isDeveloper]);

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
          <ResponsiveGrid 
            cols={{ mobile: 1, tablet: 2, desktop: 4 }}
            gap={{ mobile: "gap-4", tablet: "gap-4", desktop: "gap-4" }}
            animated={true}
            staggerDelay={100}
          >
            {tasks.map((task, index) => (
              <div 
                key={task.id}
                className="relative"
                style={{ animationDelay: `${index * 75}ms` }}
              >
                <SimpleReadyToPostCard
                  task={task}
                  onClick={handleTaskClick}
                />
              </div>
            ))}
          </ResponsiveGrid>
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
