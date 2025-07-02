
import React, { useState, useEffect } from 'react';
import { SidebarLayout } from '@/components/SidebarLayout';
import { ComposerTray } from '@/components/publish/ComposerTray';
import { ComposerEditor } from '@/components/publish/ComposerEditor';
import { ComposerDrawer } from '@/components/publish/ComposerDrawer';
import { CalendarRibbon } from '@/components/publish/CalendarRibbon';
import { PublishingCalendarView } from '@/components/publish/PublishingCalendarView';
import { AnalyticsIntegration } from '@/components/publish/AnalyticsIntegration';
import { WorkflowAutomation } from '@/components/publish/WorkflowAutomation';
import { showSuccessToast, triggerCardPulse } from '@/components/publish/SuccessFeedback';
import { useAuth } from '@/contexts/AuthContext';
import { useTenant } from '@/hooks/useTenant';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar, BarChart3, Zap, Grid } from 'lucide-react';
import { fetchSmartImage } from '@/services/unsplashService';
import { ImageAssetManager } from '@/lib/imageAssetManager';

interface PublishData {
  content: GeneratedContent[];
  scheduledPosts: ScheduledPost[];
  socialConnections: SocialConnection[];
}

interface GeneratedContent {
  id: string;
  status: 'DRAFT' | 'SCHEDULED' | 'PUBLISHED' | 'ARCHIVED';
  caption: string;
  mediaUrl?: string;
  platform?: string;
  campaignId?: string;
  createdAt: string;
}

interface ScheduledPost {
  id: string;
  contentId: string;
  platform: 'FB' | 'IG_FEED' | 'IG_REEL';
  publishAt: string;
  status: 'QUEUED' | 'PUBLISHED' | 'ERROR';
  publishedId?: string;
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
  const [publishData, setPublishData] = useState<PublishData | null>(null);
  const [selectedContent, setSelectedContent] = useState<GeneratedContent | null>(null);
  const [loading, setLoading] = useState(true);
  const [imageLoadingStates, setImageLoadingStates] = useState<Record<string, boolean>>({});
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('content');

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
            await ImageAssetManager.createUnsplashAsset(item.id, {
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
    if (user) {
      initializePublishData();
    }
  }, [user, tenant]);

  const initializePublishData = async () => {
    try {
      setLoading(true);
      
      console.log('Fetching content with params:', {
        tenant_id: tenant?.id,
        user_id: user?.id,
        using_tenant: !!tenant?.id
      });
      
      // Fetch approved Facebook and Instagram content tasks
      // Try both tenant-based and user-based queries to see what content exists
      const query = supabase
        .from('content_tasks')
        .select(`
          *,
          campaigns!inner (
            title,
            user_id,
            tenant_id
          )
        `)
        .eq('status', 'approved')
        .in('post_type', ['facebook', 'instagram'])
        .order('created_at', { ascending: false });

      // Apply the appropriate filter based on tenant setup
      if (tenant?.id) {
        query.eq('tenant_id', tenant.id);
      } else {
        query.eq('user_id', user?.id);
      }

      const { data: contentTasks, error: contentError } = await query;

      console.log('Content query result:', { contentTasks, contentError });

      if (contentError) {
        console.error('Content fetch error:', contentError);
        throw contentError;
      }

      // Also try to fetch all content tasks to see what's available for debugging
      const { data: allTasks, error: allTasksError } = await supabase
        .from('content_tasks')
        .select(`
          *,
          campaigns (
            title,
            user_id,
            tenant_id
          )
        `)
        .in('post_type', ['facebook', 'instagram'])
        .order('created_at', { ascending: false })
        .limit(10);

      console.log('All available tasks (debug):', { allTasks, allTasksError });

      // Transform content_tasks to GeneratedContent format and fetch images
      const generatedContent: GeneratedContent[] = (contentTasks || []).map(task => ({
        id: task.id,
        status: 'DRAFT',
        caption: task.ai_output || '',
        mediaUrl: undefined, // Will be populated by fetchImagesForContent
        platform: task.post_type,
        campaignId: task.campaign_id,
        createdAt: task.created_at
      }));

      console.log('Generated content (before image fetch):', generatedContent);

      // Fetch images for all content automatically
      const contentWithImages = await fetchImagesForContent(generatedContent);
      
      console.log('Generated content (after image fetch):', contentWithImages);

      // Fetch social connections
      const { data: connections, error: connectionsError } = await supabase
        .from('social_connections')
        .select('*')
        .eq('user_id', user?.id)
        .eq('is_active', true);

      if (connectionsError) throw connectionsError;

      const socialConnections: SocialConnection[] = (connections || []).map(conn => ({
        id: conn.id,
        platform: conn.platform,
        isActive: conn.is_active,
        platformAccountName: conn.platform_account_name || ''
      }));

      setPublishData({
        content: contentWithImages,
        scheduledPosts: [], // TODO: Implement scheduled posts table
        socialConnections
      });

      console.log('Final publish data:', {
        contentCount: generatedContent.length,
        connectionsCount: socialConnections.length
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
      // TODO: Implement scheduling API call
      
      // Show success feedback
      const formattedTime = new Date(scheduleData.publishAt).toLocaleDateString('en-US', {
        weekday: 'short',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
      
      showSuccessToast('scheduled', formattedTime);
      triggerCardPulse(scheduleData.contentId);
      
      // Update local state
      if (publishData && selectedContent) {
        const updatedContent = publishData.content.map(c => 
          c.id === scheduleData.contentId 
            ? { ...c, status: 'SCHEDULED' as const }
            : c
        );
        
        setPublishData({
          ...publishData,
          content: updatedContent
        });
        
        if (selectedContent.id === scheduleData.contentId) {
          setSelectedContent({ ...selectedContent, status: 'SCHEDULED' });
        }
      }
    } catch (error) {
      console.error('Error scheduling post:', error);
      toast.error('Failed to schedule post');
    }
  };

  const handlePublishNow = async (publishDataPayload: {
    contentId: string;
    caption: string;
    mediaUrl?: string;
    platforms: string[];
  }) => {
    try {
      // TODO: Implement immediate publish API call
      
      // Show success feedback
      showSuccessToast('published');
      triggerCardPulse(publishDataPayload.contentId);
      
      // Update local state
      if (publishData && selectedContent) {
        const updatedContent = publishData.content.map(c => 
          c.id === publishDataPayload.contentId 
            ? { ...c, status: 'PUBLISHED' as const }
            : c
        );
        
        setPublishData({
          ...publishData,
          content: updatedContent
        });
        
        if (selectedContent.id === publishDataPayload.contentId) {
          setSelectedContent({ ...selectedContent, status: 'PUBLISHED' });
        }
      }
    } catch (error) {
      console.error('Error publishing post:', error);
      toast.error('Failed to publish post');
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

  if (loading) {
    return (
      <SidebarLayout>
        <div className="min-h-screen bg-[#F9FAFB] flex items-center justify-center">
          <div className="animate-spin w-8 h-8 border-2 border-[#68BEB9] border-t-transparent rounded-full"></div>
        </div>
      </SidebarLayout>
    );
  }

  return (
    <SidebarLayout>
      <div className="min-h-screen bg-[#F9FAFB]">
        {/* Header */}
        <div className="px-4 sm:px-6 py-4 bg-white border-b border-gray-200">
          <h1 className="text-xl sm:text-2xl font-semibold text-[#3E5A6B] mb-1">Publish Portal</h1>
          <p className="text-sm sm:text-base text-gray-600">Advanced publishing with calendar, analytics, and automation</p>
          {publishData && (
            <p className="text-xs text-gray-500 mt-1">
              {publishData.content.length} approved posts, {publishData.socialConnections.length} connections
            </p>
          )}
        </div>

        {/* Tabbed Interface */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1">
          <div className="px-4 sm:px-6 py-3 bg-white border-b">
            <TabsList className="grid w-full max-w-md grid-cols-4">
              <TabsTrigger value="content" className="flex items-center gap-2">
                <Grid className="w-4 h-4" />
                Content
              </TabsTrigger>
              <TabsTrigger value="calendar" className="flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                Calendar
              </TabsTrigger>
              <TabsTrigger value="analytics" className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4" />
                Analytics
              </TabsTrigger>
              <TabsTrigger value="automation" className="flex items-center gap-2">
                <Zap className="w-4 h-4" />
                Automation
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="p-4 sm:p-6">
            <TabsContent value="content" className="mt-0">
              <div className="flex flex-col lg:flex-row gap-4 min-h-[calc(100vh-20rem)]">
                {/* Left Panel - Content Tray */}
                <div className="w-full lg:w-80 xl:w-96 flex-shrink-0">
                  <ComposerTray
                    content={publishData?.content || []}
                    selectedContent={selectedContent}
                    onContentSelect={handleContentSelect}
                    imageLoadingStates={imageLoadingStates}
                  />
                </div>

                {/* Right Panel - Editor */}
                <div className="flex-1 min-w-0">
                  <ComposerEditor
                    selectedContent={selectedContent}
                    onContentUpdate={(updatedContent) => setSelectedContent(updatedContent)}
                    onOpenDrawer={() => setDrawerOpen(true)}
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
              <AnalyticsIntegration
                selectedPost={selectedContent?.id}
                onOptimalTimeSelect={handleOptimalTimeSelect}
              />
            </TabsContent>

            <TabsContent value="automation" className="mt-0">
              <WorkflowAutomation
                onRuleUpdate={handleAutomationUpdate}
              />
            </TabsContent>
          </div>
        </Tabs>

        {/* Composer Drawer */}
        <ComposerDrawer
          isOpen={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          selectedContent={selectedContent}
          socialConnections={publishData?.socialConnections || []}
          onSchedule={handleSchedulePost}
          onPublishNow={handlePublishNow}
        />
      </div>
    </SidebarLayout>
  );
};

export default PublishPage;
