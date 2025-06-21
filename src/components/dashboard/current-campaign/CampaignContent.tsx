
import { EnhancedAppleCard } from "@/components/ui/enhanced-apple-card";
import { AppleCardHeader, AppleCardContent } from "@/components/ui/apple-card";
import { HeadlineLarge, BodyMedium } from "@/components/ui/typography";
import { Button } from "@/components/ui/button";
import { Sparkles, RefreshCw, Bug, Database } from "lucide-react";
import { TaskItem } from "./TaskItem";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { verifyNewsletterGeneration, runNewsletterDiagnostics, forceCreateNewsletterTask } from "../../../scripts/dev/verifyNewsletter";
import { useState } from "react";

interface CampaignContentProps {
  activeCampaign: any;
  tasks: any[];
  onTaskClick: (task: any) => void;
  onTaskUpdate: () => void;
  onRefreshContent?: () => void;
  isRefreshing?: boolean;
}

export const CampaignContent = ({ 
  activeCampaign, 
  tasks, 
  onTaskClick, 
  onTaskUpdate,
  onRefreshContent,
  isRefreshing = false
}: CampaignContentProps) => {
  const { user } = useAuth();
  const [debugInfo, setDebugInfo] = useState<any>(null);
  const [showDebugPanel, setShowDebugPanel] = useState(false);
  
  console.log('CampaignContent: Rendering with campaign:', activeCampaign?.title);
  console.log('CampaignContent: Tasks count:', tasks.length);
  
  // 🔍 ENHANCED LOGGING: Track newsletter tasks specifically
  const newsletterTasks = tasks.filter(task => task.post_type === 'newsletter');
  const tasksByType = tasks.reduce((acc, task) => {
    acc[task.post_type] = (acc[task.post_type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  console.log('📰 Newsletter tasks found:', newsletterTasks.length);
  console.log('📊 Tasks by type:', tasksByType);
  
  if (newsletterTasks.length === 0) {
    console.warn('⚠️ No newsletter tasks found in current campaign');
  }
  
  // Calculate progress metrics
  const tasksWithContent = tasks.filter(task => task.ai_output && task.ai_output.trim() !== '');

  // Dev-only functions
  const isDevelopment = process.env.NODE_ENV === 'development';
  const isDevUser = user?.email === 'jon@getclear.ca';

  const runDiagnostics = async () => {
    if (!activeCampaign) return;
    
    try {
      console.log('🔍 Running newsletter diagnostics...');
      const result = await runNewsletterDiagnostics(activeCampaign.id);
      setDebugInfo(result);
      setShowDebugPanel(true);
      
      const verification = await verifyNewsletterGeneration(activeCampaign.id, user?.id || '');
      console.log('🔍 Verification result:', verification);
      
      toast.info(`Diagnostics complete. Newsletter tasks found: ${result?.newsletterTasks?.length || 0}`);
    } catch (error) {
      console.error('❌ Diagnostics failed:', error);
      toast.error('Diagnostics failed');
    }
  };

  const forceCreateNewsletter = async () => {
    if (!activeCampaign || !user) return;
    
    try {
      const result = await forceCreateNewsletterTask(
        activeCampaign.id, 
        user.id, 
        activeCampaign.tenant_id
      );
      
      if (result.success) {
        toast.success('Newsletter task force-created successfully!');
        onTaskUpdate();
      } else {
        toast.error(`Failed to force-create newsletter: ${result.error}`);
      }
    } catch (error) {
      console.error('❌ Force creation failed:', error);
      toast.error('Force creation failed');
    }
  };

  return (
    <EnhancedAppleCard 
      variant="elevated" 
      surface="primary"
      hoverEffect="subtle"
      animated={true}
      data-campaign-section="true"
    >
      <AppleCardHeader className="pb-4">
        <div className="space-y-4">
          {/* Header with Title and Actions */}
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-semibold text-text-primary">Your Weekly Content</h2>
            <div className="flex items-center gap-2">
              {/* Dev Debug Panel */}
              {isDevelopment && isDevUser && (
                <div className="flex items-center gap-2">
                  <Button
                    onClick={runDiagnostics}
                    size="sm"
                    variant="outline"
                    className="flex items-center gap-2 border-orange-300 text-orange-600"
                  >
                    <Bug className="w-4 h-4" />
                    Debug
                  </Button>
                  <Button
                    onClick={forceCreateNewsletter}
                    size="sm"
                    variant="outline"
                    className="flex items-center gap-2 border-purple-300 text-purple-600"
                  >
                    <Database className="w-4 h-4" />
                    Force Newsletter
                  </Button>
                </div>
              )}
              
              {onRefreshContent && (
                <Button
                  onClick={onRefreshContent}
                  disabled={isRefreshing}
                  size="sm"
                  variant="outline"
                  className="flex items-center gap-2"
                >
                  <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                  {isRefreshing ? 'Refreshing...' : 'Refresh Content'}
                </Button>
              )}
            </div>
          </div>
          
          {/* Campaign Info */}
          <div className="flex items-center gap-3 apple-slide-up">
            <div className="flex items-center justify-center w-8 h-8 bg-primary/10 rounded-lg">
              <Sparkles className="w-4 h-4 text-primary" />
            </div>
            <div>
              <HeadlineLarge className="text-text-primary text-lg">
                {activeCampaign?.title || 'Loading...'}
              </HeadlineLarge>
              {tasksWithContent.length > 0 && (
                <BodyMedium className="text-text-secondary text-sm">
                  Professional marketing content generated by AI
                </BodyMedium>
              )}
            </div>
          </div>
          
          {/* 🔍 DEV PREVIEW: Newsletter Debug Info */}
          {isDevelopment && isDevUser && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm">
              <div className="font-medium text-blue-800 mb-1">🔍 DEV: Newsletter Debug</div>
              <div className="text-blue-700 space-y-1">
                <div>Total tasks: {tasks.length}</div>
                <div className={newsletterTasks.length === 0 ? 'text-red-600 font-bold' : 'text-green-600'}>
                  Newsletter tasks: {newsletterTasks.length} {newsletterTasks.length === 0 ? '❌ MISSING!' : '✅'}
                </div>
                <div>Task types: {Object.keys(tasksByType).join(', ')}</div>
                {newsletterTasks.length > 0 && (
                  <div>Newsletter IDs: {newsletterTasks.map(t => t.id.slice(0, 8)).join(', ')}</div>
                )}
                <div className="mt-2 pt-2 border-t border-blue-300">
                  <div className="text-xs">Expected: instagram, facebook, blog, video, newsletter</div>
                  <div className="text-xs">Missing: {['instagram', 'facebook', 'blog', 'video', 'newsletter'].filter(type => !tasksByType[type]).join(', ') || 'None'}</div>
                </div>
              </div>
            </div>
          )}

          {/* Debug Panel */}
          {showDebugPanel && debugInfo && isDevelopment && isDevUser && (
            <div className="bg-gray-50 border border-gray-300 rounded-lg p-4 text-sm">
              <div className="flex items-center justify-between mb-2">
                <div className="font-medium text-gray-800">🔍 Diagnostic Results</div>
                <Button
                  onClick={() => setShowDebugPanel(false)}
                  size="sm"
                  variant="ghost"
                  className="text-gray-500 hover:text-gray-700"
                >
                  ×
                </Button>
              </div>
              <div className="space-y-2 text-gray-700">
                <div>Newsletter tasks in DB: {debugInfo.newsletterTasks?.length || 0}</div>
                <div>All task types: {Object.entries(debugInfo.taskSummary || {}).map(([type, count]) => `${type}(${count})`).join(', ')}</div>
                <div>Campaign ID: {debugInfo.campaignInfo?.id}</div>
                {debugInfo.newsletterTasks?.length === 0 && (
                  <div className="text-red-600 font-medium">⚠️ Newsletter task missing from database!</div>
                )}
              </div>
            </div>
          )}
        </div>
      </AppleCardHeader>

      <AppleCardContent className="space-y-4">
        {/* Content Display */}
        {!activeCampaign && (
          <div className="text-center py-8 apple-slide-up">
            <BodyMedium className="text-text-secondary">
              No active campaign found.
            </BodyMedium>
          </div>
        )}

        {activeCampaign && tasks.length === 0 && (
          <div className="text-center py-8 apple-slide-up">
            <div className="flex items-center justify-center w-12 h-12 bg-blue-100 rounded-full mx-auto mb-3">
              <Sparkles className="w-6 h-6 text-blue-600 animate-pulse" />
            </div>
            <BodyMedium className="text-text-secondary mb-2">
              Generating your marketing content...
            </BodyMedium>
            <BodyMedium className="text-text-tertiary text-sm">
              Campaign: {activeCampaign?.title || 'Unknown'} 
              {activeCampaign?.id && ` (ID: ${activeCampaign.id.slice(0, 8)}...)`}
            </BodyMedium>
          </div>
        )}

        {activeCampaign && tasks.length > 0 && (
          <div className="space-y-3">
            {tasks.map((task, index) => {
              console.log('CampaignContent: Rendering task', index + 1, ':', task.id, task.post_type);
              
              // 🔍 Special logging for newsletter tasks
              if (task.post_type === 'newsletter') {
                console.log('📰 Rendering newsletter task:', {
                  id: task.id,
                  content_length: task.ai_output?.length || 0,
                  status: task.status,
                  created_at: task.created_at
                });
              }
              
              return (
                <TaskItem
                  key={task.id}
                  task={task}
                  onClick={() => {
                    console.log('CampaignContent: Task clicked:', task.id, task.post_type);
                    onTaskClick(task);
                  }}
                  onTaskUpdate={onTaskUpdate}
                />
              );
            })}
          </div>
        )}
      </AppleCardContent>
    </EnhancedAppleCard>
  );
};
