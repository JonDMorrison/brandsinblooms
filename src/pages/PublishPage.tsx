
import React, { useState, useEffect } from 'react';
import { SidebarLayout } from '@/components/SidebarLayout';
import { ComposerTray } from '@/components/publish/ComposerTray';
import { ComposerEditor } from '@/components/publish/ComposerEditor';
import { ComposerDrawer } from '@/components/publish/ComposerDrawer';
import { CalendarRibbon } from '@/components/publish/CalendarRibbon';
import { showSuccessToast, triggerCardPulse } from '@/components/publish/SuccessFeedback';
import { useAuth } from '@/contexts/AuthContext';
import { useTenant } from '@/hooks/useTenant';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { fetchSmartImage } from '@/services/unsplashService';

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
  const [drawerOpen, setDrawerOpen] = useState(false);

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

      // Transform content_tasks to GeneratedContent format
      const generatedContent: GeneratedContent[] = (contentTasks || []).map(task => ({
        id: task.id,
        status: 'DRAFT',
        caption: task.ai_output || '',
        mediaUrl: task.image_idea,
        platform: task.post_type,
        campaignId: task.campaign_id,
        createdAt: task.created_at
      }));

      console.log('Generated content:', generatedContent);

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
        content: generatedContent,
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

  const handleContentSelect = async (content: GeneratedContent) => {
    setSelectedContent(content);
    
    // If content doesn't have media, try to fetch from Unsplash
    if (!content.mediaUrl && content.caption) {
      try {
        const image = await fetchSmartImage(content.caption, 'garden center social media');
        if (image) {
          const updatedContent = { ...content, mediaUrl: image.url };
          setSelectedContent(updatedContent);
          
          // Update the local state
          if (publishData) {
            const updatedContentList = publishData.content.map(c => 
              c.id === content.id ? updatedContent : c
            );
            setPublishData({ ...publishData, content: updatedContentList });
          }
        }
      } catch (error) {
        console.error('Error fetching Unsplash image:', error);
      }
    }
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
      <div className="min-h-screen bg-[#F9FAFB] overflow-hidden">
        <div className="h-screen flex flex-col">
          {/* Header - Fixed height */}
          <div className="flex-shrink-0 px-4 sm:px-6 py-4 bg-white border-b border-gray-200">
            <h1 className="text-xl sm:text-2xl font-semibold text-[#3E5A6B] mb-1">Publish Portal</h1>
            <p className="text-sm sm:text-base text-gray-600">Schedule and publish your approved Facebook and Instagram content</p>
            {/* Debug info */}
            {publishData && (
              <p className="text-xs text-gray-500 mt-1">
                Found {publishData.content.length} approved posts, {publishData.socialConnections.length} connections
              </p>
            )}
          </div>

          {/* Main Content Area - Flexible with bottom padding for sticky calendar */}
          <div className="flex-1 min-h-0 flex flex-col lg:flex-row gap-4 p-4 sm:p-6 pb-32">
            {/* Left Panel - Content Tray */}
            <div className="w-full lg:w-80 xl:w-96 flex-shrink-0">
              <div className="h-full max-h-[calc(100vh-16rem)]">
                <ComposerTray
                  content={publishData?.content || []}
                  selectedContent={selectedContent}
                  onContentSelect={handleContentSelect}
                />
              </div>
            </div>

            {/* Right Panel - Editor */}
            <div className="flex-1 min-w-0">
              <div className="h-full max-h-[calc(100vh-16rem)]">
                <ComposerEditor
                  selectedContent={selectedContent}
                  onContentUpdate={(updatedContent) => setSelectedContent(updatedContent)}
                  onOpenDrawer={() => setDrawerOpen(true)}
                />
              </div>
            </div>
          </div>

          {/* Sticky Calendar Ribbon */}
          <CalendarRibbon
            selectedContent={selectedContent}
            onReschedule={(contentId, newDate) => {
              // TODO: Implement reschedule logic
              console.log('Reschedule:', contentId, newDate);
            }}
          />
        </div>

        {/* Right Drawer - Keep sticky */}
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
