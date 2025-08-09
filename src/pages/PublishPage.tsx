import React, { useState, useEffect, useCallback } from 'react';
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


import { useAuth } from '@/contexts/AuthContext';
import { useTenant } from '@/hooks/useTenant';
import { useDashboardData } from '@/hooks/useDashboardData';
import { supabase } from '@/integrations/supabase/client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Calendar, BarChart3, Zap, Grid, Send, Clock } from 'lucide-react';
import { optimizedImageService } from '@/services/optimizedImageService';
import { ImageAssetManager } from '@/lib/imageAssetManager';
import { debounce } from '@/utils/performanceOptimizations';

interface PublishData {
  content: GeneratedContent[];
  scheduledPosts: ScheduledPost[];
  socialConnections: SocialConnection[];
}

interface GeneratedContent {
  id: string;
  status: 'DRAFT' | 'SCHEDULED' | 'PUBLISHED' | 'ARCHIVED' | 'APPROVED' | 'REVIEW';
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
  const [prefillDone, setPrefillDone] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const bundleId = params.get('bundleId');
    const channel = params.get('channel'); // 'instagram' | 'facebook'
    if (!bundleId || prefillDone) return;

    const prefillKey = `publish-prefill:${bundleId}:${channel || 'any'}`;
    const cleanUrl = () => {
      const url = new URL(window.location.href);
      url.searchParams.delete('bundleId');
      url.searchParams.delete('channel');
      const qs = url.searchParams.toString();
      window.history.replaceState({}, '', url.pathname + (qs ? `?${qs}` : ''));
    };

    if (localStorage.getItem(prefillKey) === 'done') {
      cleanUrl();
      setPrefillDone(true);
      return;
    }

    (async () => {
      try {
        const { data, error } = await supabase
          .from('draft_snapshots' as any)
          .select('content')
          .eq('doc_type', 'content_bundle')
          .eq('doc_id', bundleId)
          .order('version', { ascending: false })
          .limit(1)
          .maybeSingle();

        const bundleData: any = data as any;
        if (error || !bundleData?.content) {
          console.warn('Bundle not found for publish prefill', error);
          return;
        }

        const items = (bundleData.content.items || []) as any[];
        const preferred = channel && items.find((it: any) => it.channel === channel);
        const fallback = items.find((it: any) => it.channel === 'instagram' || it.channel === 'facebook');
        const item = (preferred as any) || (fallback as any) || items[0];
        if (!item) return;

        const insertPayload: any = {
          post_type: item.channel === 'instagram' ? 'instagram' : (item.channel === 'facebook' ? 'facebook' : 'instagram'),
          ai_output: item.body,
          image_url: item.media?.url || null,
          status: 'review'
        };
        const { data: inserted, error: insertError } = await supabase
          .from('content_tasks' as any)
          .insert(insertPayload)
          .select('*')
          .single();

        if (insertError) {
          console.error('Failed inserting content task from bundle', insertError);
          return;
        }

        const insertedRow: any = inserted as any;

        const newContent: GeneratedContent = {
          id: insertedRow.id,
          status: ((insertedRow.status || 'REVIEW').toString().toUpperCase()) as any,
          caption: insertedRow.ai_output || '',
          mediaUrl: insertedRow.image_url || undefined,
          platform: insertedRow.post_type,
          campaignId: insertedRow.campaign_id || undefined,
          createdAt: insertedRow.created_at
        };

        setSelectedContent(newContent);
        setPublishData(prev => prev ? { ...prev, content: [newContent, ...(prev.content || [])] } : { content: [newContent], scheduledPosts: [], socialConnections: [] });
        setDrawerOpen(true);
        localStorage.setItem(prefillKey, 'done');
        cleanUrl();
        setPrefillDone(true);
      } catch (e) {
        console.warn('Publish prefill failed', e);
      }
    })();
  }, [prefillDone]);
  // Optimized function to fetch images in background
  const fetchImagesInBackground = useCallback(
    debounce(async (content: GeneratedContent[]) => {
      const requests = content
        .filter(item => item.caption && !item.mediaUrl)
        .map(item => ({ keyword: item.caption, context: 'garden center social media' }));

      if (requests.length === 0) return;

      try {
        const images = await optimizedImageService.batchFetchImages(requests);
        
        // Update content with fetched images in the background
        const contentWithImages = content.map((item) => {
          if (item.caption && !item.mediaUrl) {
            const imageIndex = requests.findIndex(req => req.keyword === item.caption);
            const image = imageIndex !== -1 ? images[imageIndex] : null;
            
            if (image) {
              // Create asset record in background - don't await
              ImageAssetManager.createUnsplashAsset(user?.id || '', item.id, {
                url: image.url,
                thumb: image.thumb,
                alt: image.alt,
                photographer: image.photographer,
                unsplash_id: image.unsplash_id
              }).catch(console.warn);
              
              return { ...item, mediaUrl: image.url };
            }
          }
          return item;
        });

        // Update publish data if there are changes
        setPublishData(prev => prev ? {
          ...prev,
          content: contentWithImages
        } : null);
        
      } catch (error) {
        console.warn('Background image fetching failed:', error);
      }
    }, 500),
    [user?.id]
  );

  // Optimized initialization function
  const initializePublishData = useCallback(async () => {
    try {
      setLoading(true);
      
      if (!dashboardData) {
        console.log('No dashboard data available yet');
        return;
      }

      console.log('Using dashboard data:', {
        draftsCount: dashboardData.drafts?.length || 0,
        tasksCount: dashboardData.tasks?.length || 0,
        connectionsCount: dashboardData.socialConnections?.length || 0
      });

      // Get approved and review content from dashboard data
      const publishableTasks = dashboardData.tasks?.filter(task => 
        (task.status === 'approved' || task.status === 'review') && 
        ['facebook', 'instagram'].includes(task.post_type)
      ) || [];

      // Transform to GeneratedContent format WITHOUT fetching images immediately
      const generatedContent: GeneratedContent[] = publishableTasks.map(task => ({
        id: task.id,
        status: task.status.toUpperCase() as 'DRAFT' | 'SCHEDULED' | 'PUBLISHED' | 'ARCHIVED' | 'APPROVED' | 'REVIEW',
        caption: task.ai_output || '',
        mediaUrl: (task.attachments as any)?.image?.url || undefined,
        platform: task.post_type,
        campaignId: task.campaign_id,
        createdAt: task.created_at
      }));

      const socialConnections: SocialConnection[] = (dashboardData.socialConnections || []).map(conn => ({
        id: conn.id,
        platform: conn.platform,
        isActive: conn.is_active,
        platformAccountName: conn.platform_account_name || ''
      }));

      // Set data immediately without waiting for images
      setPublishData({
        content: generatedContent,
        scheduledPosts: dashboardData.scheduledPosts || [],
        socialConnections
      });

      console.log('Initial publish data set:', {
        contentCount: generatedContent.length,
        connectionsCount: socialConnections.length,
        scheduledCount: dashboardData.scheduledPosts?.length || 0
      });

      // Fetch images in background after initial render
      setTimeout(() => {
        fetchImagesInBackground(generatedContent);
      }, 100);

    } catch (error) {
      console.error('Error initializing publish data:', error);
      
    } finally {
      setLoading(false);
    }
  }, [dashboardData, fetchImagesInBackground]);

  useEffect(() => {
    if (user && !isLoading && dashboardData) {
      initializePublishData();
    }
  }, [user, tenant, dashboardData, isLoading, initializePublishData]);

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
      
      const { data, error } = await supabase.functions.invoke('publish-task', {
        body: {
          taskId: scheduleData.contentId,
          platforms: scheduleData.platforms,
          publishAt: scheduleData.publishAt
        }
      });

      if (error) {
        console.error('Schedule error:', error);
        
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
        
      } else {
        
      }
      
      // Refresh data
      await refetch();
      await initializePublishData();
      setMetricsRefresh(prev => prev + 1);
      
    } catch (error) {
      console.error('Error scheduling post:', error);
      
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
      
      if (testMode) {
        console.log('🧪 TEST MODE: Simulating publish...');
        await new Promise(resolve => setTimeout(resolve, 1500));
        setMetricsRefresh(prev => prev + 1);
        return;
      }
      
      const { data, error } = await supabase.functions.invoke('publish-task', {
        body: {
          taskId: publishDataPayload.contentId,
          platforms: publishDataPayload.platforms
        }
      });

      if (error) {
        console.error('Publish error:', error);
        
        return;
      }

      if (data?.success) {
        const successCount = data.results?.filter((r: any) => r.success).length || 0;
        const totalCount = data.results?.length || 0;
        
      } else {
        
      }
      
      await refetch();
      await initializePublishData();
      setMetricsRefresh(prev => prev + 1);
      
    } catch (error) {
      console.error('Error publishing post:', error);
      
    }
  };

  const handleReschedule = (postId: string, newDate: Date) => {
    console.log('Reschedule post:', postId, 'to:', newDate);
    
  };

  const handleAnalyticsView = (postId: string) => {
    console.log('View analytics for post:', postId);
    setActiveTab('analytics');
  };

  const handleBulkAction = (postIds: string[], action: string) => {
    console.log('Bulk action:', action, 'for posts:', postIds);
    
  };

  const handleOptimalTimeSelect = (time: string) => {
    console.log('Selected optimal time:', time);
    
  };

  const handleAutomationUpdate = (rules: any[]) => {
    console.log('Automation rules updated:', rules);
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
    return null;
  }

  return (
      <div className="min-h-screen bg-[#F9FAFB]">
        {/* Modern SaaS Gradient Header */}
        <div className="relative px-4 sm:px-6 py-8 bg-gradient-to-br from-white/80 to-white/40 backdrop-blur-sm border-b border-white/30 overflow-hidden">
          {/* Decorative Background Elements */}
          <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-blue-500/10 to-purple-500/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2"></div>
          <div className="absolute bottom-0 left-0 w-80 h-80 bg-gradient-to-br from-emerald-500/10 to-blue-500/10 rounded-full blur-2xl translate-y-1/2 -translate-x-1/2"></div>
          
          <div className="absolute top-4 right-8 opacity-20">
            <Send className="w-32 h-32 text-slate-300" />
          </div>
          
          <div className="absolute inset-0 bg-black/5"></div>
          
          <div className="relative z-10 flex items-center justify-between">
            <div>
              <h1 className="text-3xl sm:text-4xl font-bold mb-3 bg-gradient-to-r from-slate-800 via-slate-700 to-slate-600 bg-clip-text text-transparent">
                Publish Portal
              </h1>
              <p className="text-base sm:text-lg text-slate-700 font-medium mb-4">
                Direct social publishing with smart scheduling and analytics
              </p>
              {publishData && (
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="bg-white/50 backdrop-blur-sm rounded-xl px-4 py-2 border border-white/30 shadow-lg">
                    <span className="flex items-center gap-2 text-sm font-medium text-slate-700">
                      <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                      {publishData.content.length} ready to publish
                    </span>
                  </div>
                  <div className="bg-white/50 backdrop-blur-sm rounded-xl px-4 py-2 border border-white/30 shadow-lg">
                    <span className="flex items-center gap-2 text-sm font-medium text-slate-700">
                      <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                      {publishData.socialConnections.length} connections
                    </span>
                  </div>
                </div>
              )}
            </div>
            <div className="hidden lg:flex items-center gap-3">
              <div className="bg-white/50 backdrop-blur-sm rounded-2xl p-4 border border-white/30 shadow-lg">
                <p className="text-sm font-semibold text-slate-800 mb-2">Connected Platforms</p>
                <div className="flex items-center gap-2">
                  {publishData?.socialConnections.map(conn => (
                    <div key={conn.id} className="w-3 h-3 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-full shadow-md"></div>
                  ))}
                  {(!publishData?.socialConnections || publishData.socialConnections.length === 0) && (
                    <span className="text-xs text-slate-500">No connections</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Enhanced Tabbed Interface */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1">
          <div className="p-4 sm:p-6">
            <TabsContent value="publisher" className="space-y-6 mt-6">
              <div className={`flex flex-col lg:flex-row gap-6 min-h-[calc(100vh-20rem)] transition-all duration-300 ${
                testMode ? 'bg-amber-50/30 rounded-xl border border-amber-200/50' : ''
              }`}>
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

        {/* Floating Debug Button */}
        <div className="fixed bottom-6 right-6 z-50">
          <Button
            onClick={() => setShowDebugger(!showDebugger)}
            className={`bg-white/70 backdrop-blur-sm border border-white/40 shadow-lg hover:shadow-xl transition-all duration-300 ${
              showDebugger ? 'bg-slate-600 text-white' : 'text-slate-700 hover:bg-white/90'
            }`}
            size="sm"
            title="Toggle debug panel"
          >
            <Clock className="w-4 h-4 mr-2" />
            Debug
            {showDebugger && (
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-500 rounded-full animate-pulse"></div>
            )}
          </Button>
        </div>

        {/* Test Mode Visual Overlay */}
        {testMode && (
          <div className="fixed inset-0 pointer-events-none z-10">
            <div className="absolute inset-0 border-4 border-amber-400/30 animate-pulse"></div>
            <div className="absolute top-4 right-4 bg-amber-500 text-white px-3 py-1 rounded-full text-sm font-semibold shadow-lg animate-bounce">
              🧪 TEST MODE ACTIVE
            </div>
          </div>
        )}

        {/* Debug Tool */}
        <PublishDebugger 
          isVisible={showDebugger}
          onClose={() => setShowDebugger(false)}
        />

        {/* Metrics Overview - Moved to Bottom */}
        <div className="p-4 sm:p-6">
          <PublishMetrics refreshTrigger={metricsRefresh} />
        </div>
      </div>
  );
};

export default PublishPage;