
import React, { useState, useEffect } from 'react';
import { SidebarLayout } from '@/components/SidebarLayout';
import { EnhancedComposerTray } from '@/components/publish/EnhancedComposerTray';
import { DirectSocialPublisher } from '@/components/publish/DirectSocialPublisher';
import { ModernPublishDashboard } from '@/components/publish/ModernPublishDashboard';
import { ComposerDrawer } from '@/components/publish/ComposerDrawer';
import { CalendarRibbon } from '@/components/publish/CalendarRibbon';
import { PublishingCalendarView } from '@/components/publish/PublishingCalendarView';
import { AnalyticsIntegration } from '@/components/publish/AnalyticsIntegration';
import { WorkflowAutomation } from '@/components/publish/WorkflowAutomation';
import { PublishDebugger } from '@/components/publish/PublishDebugger';
import { PublishMetrics } from '@/components/publish/PublishMetrics';
import { TestModeToggle } from '@/components/publish/TestModeToggle';
import { showSuccessToast, triggerCardPulse } from '@/components/publish/SuccessFeedback';
import { useAuth } from '@/contexts/AuthContext';
import { useTenant } from '@/hooks/useTenant';
import { useDashboardData } from '@/hooks/useDashboardData';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Calendar, BarChart3, Zap, Grid, Send, Clock } from 'lucide-react';
import { fetchSmartImage } from '@/services/unsplashService';
import { ImageAssetManager } from '@/lib/imageAssetManager';

interface PublishData {
  content: GeneratedContent[];
  scheduledPosts: ScheduledPost[];
  socialConnections: SocialConnection[];
}

interface GeneratedContent {
  id: string;
  status: 'DRAFT' | 'SCHEDULED' | 'PUBLISHED' | 'ARCHIVED' | 'APPROVED';
  caption: string;
  mediaUrl?: string;
  platform?: string;
  campaignId?: string;
  createdAt: string;
}

interface ScheduledPost {
  id: string;
  content_id: string;
  platform: 'FB' | 'IG_FEED' | 'IG_REEL';
  publish_at: string;
  status: 'QUEUED' | 'PUBLISHED' | 'ERROR';
  published_id?: string;
}

interface SocialConnection {
  id: string;
  platform: string;
  isActive: boolean;
  platformAccountName: string;
}

const PublishPage = () => {
  const { user } = useAuth();
  const { tenant } = useTenant();
  const { data: dashboardData, isLoading, refetch } = useDashboardData();
  const [publishData, setPublishData] = useState<PublishData | null>(null);
  const [selectedContent, setSelectedContent] = useState<GeneratedContent | null>(null);
  const [loading, setLoading] = useState(true);
  const [imageLoadingStates, setImageLoadingStates] = useState<Record<string, boolean>>({});
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('publisher');
  const [showDebugger, setShowDebugger] = useState(false);
  const [metricsRefresh, setMetricsRefresh] = useState(0);
  const [testMode, setTestMode] = useState(false);

  // Function to fetch images for multiple content items
  const fetchImagesForContent = async (content: GeneratedContent[]): Promise<GeneratedContent[]> => {
    const updatedContent = [...content];
    
    // Set loading states for all content
    const initialLoadingStates: Record<string, boolean> = {};
    content.forEach(item => {
      initialLoadingStates[item.id] = true;
    });
    setImageLoadingStates(initialLoadingStates);

    // Fetch images for each content item in parallel
    const imagePromises = content.map(async (item, index) => {
      if (item.caption) {
        try {
          const image = await fetchSmartImage(item.caption, 'garden center social media');
          if (image) {
            updatedContent[index] = { ...item, mediaUrl: image.url };
            
            // Create image asset record for tracking
            await ImageAssetManager.createUnsplashAsset(user?.id || '', item.id, {
              url: image.url,
              thumb: image.thumb,
              alt: image.alt,
              photographer: image.photographer,
              unsplash_id: image.unsplash_id
            });
          }
        } catch (error) {
          console.error(`Error fetching image for content ${item.id}:`, error);
        }
      }
      
      // Update individual loading state
      setImageLoadingStates(prev => ({ ...prev, [item.id]: false }));
      return updatedContent[index];
    });

    await Promise.allSettled(imagePromises);
    
    // Clear all loading states
    setImageLoadingStates({});
    
    return updatedContent;
  };

  useEffect(() => {
    if (user && !isLoading && dashboardData) {
      initializePublishData();
    }
  }, [user, tenant, dashboardData, isLoading]);

  const initializePublishData = async () => {
    try {
      setLoading(true);
      
      // Use data from the dashboard hook for better performance
      if (!dashboardData) {
        console.log('No dashboard data available yet');
        return;
      }

      console.log('Using dashboard data:', {
        draftsCount: dashboardData.drafts?.length || 0,
        tasksCount: dashboardData.tasks?.length || 0,
        connectionsCount: dashboardData.socialConnections?.length || 0
      });

      // Get approved content from dashboard data
      const approvedTasks = dashboardData.tasks?.filter(task => 
        task.status === 'approved' && 
        ['facebook', 'instagram'].includes(task.post_type)
      ) || [];

      // Transform to GeneratedContent format and fetch images
      const generatedContent: GeneratedContent[] = approvedTasks.map(task => ({
        id: task.id,
        status: task.status.toUpperCase() as 'DRAFT' | 'SCHEDULED' | 'PUBLISHED' | 'ARCHIVED' | 'APPROVED',
        caption: task.ai_output || '',
        mediaUrl: (task.attachments as any)?.image?.url || undefined,
        platform: task.post_type,
        campaignId: task.campaign_id,
        createdAt: task.created_at
      }));

      console.log('Generated content:', generatedContent);

      // Fetch images for content that doesn't have them
      const contentWithImages = await fetchImagesForContent(generatedContent);

      const socialConnections: SocialConnection[] = (dashboardData.socialConnections || []).map(conn => ({
        id: conn.id,
        platform: conn.platform,
        isActive: conn.is_active,
        platformAccountName: conn.platform_account_name || ''
      }));

      setPublishData({
        content: contentWithImages,
        scheduledPosts: dashboardData.scheduledPosts || [],
        socialConnections
      });

      console.log('Final publish data:', {
        contentCount: contentWithImages.length,
        connectionsCount: socialConnections.length,
        scheduledCount: dashboardData.scheduledPosts?.length || 0
      });

    } catch (error) {
      console.error('Error initializing publish data:', error);
      toast.error('Failed to load publish data');
    } finally {
      setLoading(false);
    }
  };

  const handleContentSelect = (content: GeneratedContent) => {
    setSelectedContent(content);
  };

  const handleSchedulePost = async (scheduleData: {
    contentId: string;
    caption: string;
    mediaUrl?: string;
    platforms: string[];
    publishAt: string;
  }) => {
    try {
      console.log('📅 Scheduling post:', scheduleData);
      
      // Call our new publish-task endpoint with publishAt
      const { data, error } = await supabase.functions.invoke('publish-task', {
        body: {
          taskId: scheduleData.contentId,
          platforms: scheduleData.platforms,
          publishAt: scheduleData.publishAt
        }
      });

      if (error) {
        console.error('Schedule error:', error);
        toast.error(`Scheduling failed: ${error.message}`);
        return;
      }

      if (data?.success) {
        const successCount = data.results?.filter((r: any) => r.success).length || 0;
        const totalCount = data.results?.length || 0;
        
        const formattedTime = new Date(scheduleData.publishAt).toLocaleDateString('en-US', {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
          hour12: true
        });
        
        if (successCount === totalCount) {
          toast.success(`Successfully scheduled for ${formattedTime}!`);
        } else if (successCount > 0) {
          toast.success(`Scheduled ${successCount}/${totalCount} platforms for ${formattedTime}`);
        } else {
          toast.error('Scheduling failed on all platforms');
        }
        
        showSuccessToast('scheduled', formattedTime);
        triggerCardPulse(scheduleData.contentId);
      } else {
        toast.error(data?.message || 'Scheduling failed');
      }
      
      // Refresh data
      await refetch();
      await initializePublishData();
      setMetricsRefresh(prev => prev + 1);
      
    } catch (error) {
      console.error('Error scheduling post:', error);
      toast.error('Failed to schedule post - please try again');
    }
  };

  const handlePublishNow = async (publishDataPayload: {
    contentId: string;
    caption: string;
    mediaUrl?: string;
    platforms: string[];
  }) => {
    try {
      console.log('🚀 Publishing now:', publishDataPayload, { testMode });
      
      // If in test mode, simulate the publish
      if (testMode) {
        console.log('🧪 TEST MODE: Simulating publish...');
        
        // Simulate processing time
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        // Mock successful response
        toast.success(`✅ TEST: Successfully simulated publishing to ${publishDataPayload.platforms.length} platform(s)!`);
        showSuccessToast('published');
        triggerCardPulse(publishDataPayload.contentId);
        
        // Refresh data
        setMetricsRefresh(prev => prev + 1);
        return;
      }
      
      // Call our new publish-task endpoint
      const { data, error } = await supabase.functions.invoke('publish-task', {
        body: {
          taskId: publishDataPayload.contentId,
          platforms: publishDataPayload.platforms
        }
      });

      if (error) {
        console.error('Publish error:', error);
        toast.error(`Publishing failed: ${error.message}`);
        return;
      }

      if (data?.success) {
        const successCount = data.results?.filter((r: any) => r.success).length || 0;
        const totalCount = data.results?.length || 0;
        
        if (successCount === totalCount) {
          toast.success(`Successfully published to all ${totalCount} platform(s)!`);
        } else if (successCount > 0) {
          toast.success(`Published to ${successCount}/${totalCount} platforms`);
        } else {
          toast.error('Publishing failed on all platforms');
        }
        
        showSuccessToast('published');
        triggerCardPulse(publishDataPayload.contentId);
      } else {
        toast.error(data?.message || 'Publishing failed');
      }
      
      // Refresh data
      await refetch();
      await initializePublishData();
      setMetricsRefresh(prev => prev + 1);
      
    } catch (error) {
      console.error('Error publishing post:', error);
      toast.error('Failed to publish post - please try again');
    }
  };

  const handleReschedule = (postId: string, newDate: Date) => {
    console.log('Reschedule post:', postId, 'to:', newDate);
    toast.success(`Post rescheduled to ${newDate.toLocaleDateString()}`);
  };

  const handleAnalyticsView = (postId: string) => {
    console.log('View analytics for post:', postId);
    setActiveTab('analytics');
  };

  const handleBulkAction = (postIds: string[], action: string) => {
    console.log('Bulk action:', action, 'for posts:', postIds);
    toast.success(`${action} applied to ${postIds.length} posts`);
  };

  const handleOptimalTimeSelect = (time: string) => {
    console.log('Selected optimal time:', time);
    // This could auto-fill the scheduling time in the composer
    toast.success(`Optimal time ${time} selected`);
  };

  const handleAutomationUpdate = (rules: any[]) => {
    console.log('Automation rules updated:', rules);
    // Apply automation rules to content
  };

  const handleQuickPublish = async (content: GeneratedContent) => {
    try {
      await handlePublishNow({
        contentId: content.id,
        caption: content.caption,
        mediaUrl: content.mediaUrl,
        platforms: content.platform ? [content.platform] : ['facebook', 'instagram']
      });
    } catch (error) {
      console.error('Quick publish error:', error);
    }
  };

  const handleQuickSchedule = (content: GeneratedContent) => {
    setSelectedContent(content);
    setDrawerOpen(true);
  };

  if (loading || isLoading) {
    return (
      <SidebarLayout>
        <div className="min-h-screen bg-[#F9FAFB] flex items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full"></div>
            <p className="text-gray-600">Loading publish portal...</p>
          </div>
        </div>
      </SidebarLayout>
    );
  }

  return (
    <SidebarLayout>
      <div className="min-h-screen bg-[#F9FAFB]">
        {/* Enhanced Header */}
        <div className="px-4 sm:px-6 py-6 bg-gradient-to-r from-white to-gray-50 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">Publish Portal</h1>
              <p className="text-sm sm:text-base text-gray-600">Direct social publishing with smart scheduling and analytics</p>
              {publishData && (
                <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
                  <span className="flex items-center gap-1">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    {publishData.content.length} ready to publish
                  </span>
                  <span className="flex items-center gap-1">
                    <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                    {publishData.socialConnections.length} connections
                  </span>
                </div>
              )}
            </div>
            <div className="hidden sm:flex items-center gap-2">
              <div className="text-right">
                <p className="text-sm font-medium text-gray-900">Connected Platforms</p>
                <div className="flex items-center gap-1 mt-1">
                  {publishData?.socialConnections.map(conn => (
                    <div key={conn.id} className="w-2 h-2 bg-green-500 rounded-full"></div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Enhanced Tabbed Interface */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1">
          <div className="px-4 sm:px-6 py-3 bg-white border-b">
            <div className="flex items-center justify-between">
              <TabsList className="grid w-full max-w-md grid-cols-3">
                <TabsTrigger value="publisher">Publisher</TabsTrigger>
                <TabsTrigger value="calendar">Calendar</TabsTrigger>
                <TabsTrigger value="analytics">Analytics</TabsTrigger>
              </TabsList>
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowDebugger(true)}
                className="text-xs"
              >
                <Zap className="w-4 h-4 mr-1" />
                Debug
              </Button>
            </div>
          </div>

          <div className="p-4 sm:p-6">
            <TabsContent value="publisher" className="space-y-6 mt-6">
              {/* Test Mode Toggle */}
              <TestModeToggle onTestModeChange={setTestMode} />
              
              {/* Metrics Overview */}
              <PublishMetrics refreshTrigger={metricsRefresh} />
              <div className="flex flex-col lg:flex-row gap-6 min-h-[calc(100vh-20rem)]">
                {/* Left Panel - Enhanced Content Library */}
                <div className="w-full lg:w-96 xl:w-[420px] flex-shrink-0">
                  <EnhancedComposerTray
                    content={publishData?.content || []}
                    selectedContent={selectedContent}
                    onContentSelect={handleContentSelect}
                    imageLoadingStates={imageLoadingStates}
                    onQuickPublish={handleQuickPublish}
                    onQuickSchedule={handleQuickSchedule}
                  />
                </div>

                {/* Right Panel - Direct Publisher */}
                <div className="flex-1 min-w-0">
                  <DirectSocialPublisher
                    selectedContent={selectedContent}
                    onPublishSuccess={() => {
                      refetch();
                      initializePublishData();
                      setMetricsRefresh(prev => prev + 1);
                    }}
                    onScheduleSuccess={() => {
                      refetch();
                      initializePublishData();
                      setMetricsRefresh(prev => prev + 1);
                    }}
                  />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="calendar" className="mt-0">
              <PublishingCalendarView
                onReschedule={handleReschedule}
                onAnalyticsView={handleAnalyticsView}
                onBulkAction={handleBulkAction}
              />
            </TabsContent>

            <TabsContent value="analytics" className="mt-0">
              <ModernPublishDashboard />
            </TabsContent>
          </div>
        </Tabs>

        {/* ComposerDrawer for scheduling */}
        <ComposerDrawer
          isOpen={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          selectedContent={selectedContent}
          socialConnections={publishData?.socialConnections || []}
          onSchedule={handleSchedulePost}
          onPublishNow={() => {}}
        />

        {/* Debug Tool */}
        <PublishDebugger 
          isVisible={showDebugger}
          onClose={() => setShowDebugger(false)}
        />
      </div>
    </SidebarLayout>
  );
};

export default PublishPage;
