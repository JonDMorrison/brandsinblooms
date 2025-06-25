
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
import { DevPreviewBadge } from "@/components/ui/dev-preview-badge";
import { FirstTimeConnectionCallout } from "./ready-to-post/FirstTimeConnectionCallout";
import { BatchModeToggle } from "./ready-to-post/BatchModeToggle";

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
  const [showFirstTimeCallout, setShowFirstTimeCallout] = useState(false);
  const [socialConnections, setSocialConnections] = useState<any[]>([]);
  const [batchMode, setBatchMode] = useState(false);
  const [selectedTasks, setSelectedTasks] = useState<Set<string>>(new Set());

  // Use environment-based detection instead of hardcoded email
  const isDevelopment = import.meta.env.DEV;

  // Check for first-time connection callout
  useEffect(() => {
    const checkFirstTimeConnection = () => {
      const oauthCompleted = sessionStorage.getItem('oauth_just_completed');
      const hasSeenCallout = localStorage.getItem(`first_time_callout_seen_${user?.id}`);
      
      if (oauthCompleted === 'true' && !hasSeenCallout && tasks.length > 0) {
        setShowFirstTimeCallout(true);
        // Auto-hide after 10 seconds
        setTimeout(() => {
          setShowFirstTimeCallout(false);
          if (user) {
            localStorage.setItem(`first_time_callout_seen_${user.id}`, 'true');
          }
        }, 10000);
      }
    };

    checkFirstTimeConnection();
  }, [tasks, user]);

  // Fetch social connections
  useEffect(() => {
    const fetchSocialConnections = async () => {
      if (!user) return;

      try {
        const { data, error } = await supabase
          .from('social_connections')
          .select('*')
          .eq('user_id', user.id)
          .eq('is_active', true);

        if (error) {
          console.error('Error fetching social connections:', error);
        } else {
          setSocialConnections(data || []);
        }
      } catch (error) {
        console.error('Error fetching social connections:', error);
      }
    };

    fetchSocialConnections();
  }, [user]);

  // Fetch ready tasks with enhanced error handling data
  useEffect(() => {
    const fetchReadyTasks = async () => {
      if (!user || !tenant) {
        console.log('ReadyToPostCard: No authenticated user or tenant, skipping fetch');
        return;
      }

      try {
        console.log('ReadyToPostCard: Fetching tasks for tenant:', tenant.id);
        
        // Include preview status for development
        const statusFilter = ['ready', 'approved', 'posted'];
        if (isDevelopment) {
          statusFilter.push('preview');
        }

        // Updated query to include new error handling fields
        const { data, error } = await supabase
          .from('content_tasks')
          .select(`
            *,
            campaigns (
              title,
              tenant_id
            ),
            holidays (
              holiday_name,
              holiday_date
            )
          `)
          .eq('tenant_id', tenant.id)
          .in('status', statusFilter)
          .not('ai_output', 'is', null)
          .order('created_at', { ascending: false })
          .limit(12);

        if (error) {
          console.error('ReadyToPostCard: Error fetching ready tasks:', error);
          setTasks([]);
        } else {
          console.log('ReadyToPostCard: Successfully fetched', data?.length || 0, 'ready tasks for tenant', tenant.id);
          
          const tenantTasks = data?.filter(task => {
            // For preview tasks, skip tenant validation
            if (task.campaigns?.tenant_id === 'preview') {
              return statusFilter.includes(task.status) && task.ai_output;
            }
            
            // Allow tasks with holiday_id even if they don't have campaigns
            const belongsToTenant = task.tenant_id === tenant.id;
            
            if (!belongsToTenant) {
              console.warn('ReadyToPostCard: Filtering out task that does not belong to current tenant:', task.id);
              return false;
            }
            
            const isPreviewCampaign = task.campaigns?.title?.startsWith('PREVIEW');
            if (!isDevelopment && isPreviewCampaign) {
              return false;
            }
            
            return statusFilter.includes(task.status) && task.ai_output;
          }) || [];
          
          console.log('ReadyToPostCard: Final filtered tasks:', tenantTasks.length, '(isDevelopment:', isDevelopment, ')');
          setTasks(tenantTasks);
        }
      } catch (error) {
        console.error('ReadyToPostCard: Exception in fetchReadyTasks:', error);
        setTasks([]);
      }
    };

    if (propTasks && propTasks.length > 0) {
      if (!user || !tenant) {
        console.warn('ReadyToPostCard: Received prop tasks but no authenticated user or tenant');
        setTasks([]);
        return;
      }
      
      const statusFilter = ['ready', 'approved', 'posted'];
      if (isDevelopment) {
        statusFilter.push('preview');
      }
      
      const readyTasks = propTasks
        .filter(task => {
          // For preview tasks, skip tenant validation
          if (task.campaigns?.tenant_id === 'preview') {
            return statusFilter.includes(task.status) && task.ai_output;
          }
          
          const belongsToTenant = task.tenant_id === tenant.id;
          if (!belongsToTenant) {
            console.warn('ReadyToPostCard: Filtering out task that does not belong to current tenant:', task.id);
          }
          
          const isPreviewCampaign = task.campaigns?.title?.startsWith('PREVIEW');
          if (!isDevelopment && isPreviewCampaign) {
            return false;
          }
          
          return belongsToTenant && statusFilter.includes(task.status) && task.ai_output;
        })
        .slice(0, 12);
      
      console.log('ReadyToPostCard: Using prop tasks, filtered to', readyTasks.length, 'tenant-owned ready tasks (isDevelopment:', isDevelopment, ')');
      setTasks(readyTasks);
    } else {
      fetchReadyTasks();
    }
  }, [user, tenant, propTasks, isDevelopment]);

  const handleTaskViewFull = (task: any) => {
    // Skip tenant validation for preview tasks
    if (task.campaigns?.tenant_id === 'preview') {
      if (onTaskClick) {
        onTaskClick(task);
      } else {
        setSelectedTask(task);
        setShowContentViewer(true);
      }
      return;
    }
    
    // SECURITY CHECK: Verify task belongs to current tenant before opening
    if (!user || !tenant || task.tenant_id !== tenant.id) {
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

  const handleTaskSelect = (taskId: string, selected: boolean) => {
    const newSelected = new Set(selectedTasks);
    if (selected) {
      newSelected.add(taskId);
    } else {
      newSelected.delete(taskId);
    }
    setSelectedTasks(newSelected);
  };

  if (tasks.length === 0) {
    return (
      <EnhancedAppleCard 
        variant="default" 
        surface="secondary" 
        className="apple-empty-state apple-hover-premium"
        hoverEffect="none"
        animated={true}
        data-section="ready-to-post-section"
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
          {isDevelopment && (
            <div className="mt-4 flex justify-center">
              <DevPreviewBadge show={true} size="sm" />
            </div>
          )}
          <div className="mt-4">
            <span className="text-2xl garden-breathing">🌱</span>
          </div>
        </AppleCardContent>
      </EnhancedAppleCard>
    );
  }

  const hasPreviewContent = tasks.some(task => 
    task.status === 'preview' || task.campaigns?.title?.startsWith('PREVIEW')
  );

  return (
    <>
      <EnhancedAppleCard 
        variant="elevated" 
        surface="primary"
        hoverEffect="subtle"
        animated={true}
        className={`shadow-lg ${isMobile ? 'mobile-constrained' : ''}`}
        data-section="ready-to-post-section"
      >
        <AppleCardContent className="apple-card-spacing">
          {/* First Time Connection Callout */}
          <FirstTimeConnectionCallout isVisible={showFirstTimeCallout} />
          
          {isDevelopment && hasPreviewContent && (
            <div className="mb-4 flex justify-center">
              <DevPreviewBadge show={true} />
            </div>
          )}

          {/* Batch Mode Toggle */}
          <BatchModeToggle
            batchMode={batchMode}
            onToggle={setBatchMode}
            selectedCount={selectedTasks.size}
          />
          
          <div className="space-y-0">
            {tasks.map((task, index) => (
              <div 
                key={task.id}
                style={{ animationDelay: `${index * 75}ms` }}
                className="relative"
              >
                <AccordionReadyToPostItem
                  task={task}
                  onViewFull={handleTaskViewFull}
                  onTaskUpdate={onTaskUpdate}
                  isFirst={index === 0}
                  socialConnections={socialConnections}
                  batchMode={batchMode}
                  isSelected={selectedTasks.has(task.id)}
                  onSelect={(selected) => handleTaskSelect(task.id, selected)}
                />
              </div>
            ))}
          </div>
        </AppleCardContent>
      </EnhancedAppleCard>

      {selectedTask && (
        <ContentViewer
          campaignId={selectedTask.campaign_id || `holiday-${selectedTask.holiday_id}`}
          campaignTitle={selectedTask.campaigns?.title || selectedTask.holidays?.holiday_name || 'Holiday Content'}
          isOpen={showContentViewer}
          onClose={handleContentViewerClose}
          onTaskUpdate={onTaskUpdate}
        />
      )}
    </>
  );
};
