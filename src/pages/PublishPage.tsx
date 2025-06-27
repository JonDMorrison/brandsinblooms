import React, { useState, useEffect } from 'react';
import { SidebarLayout } from '@/components/SidebarLayout';
import { ComposerTray } from '@/components/publish/ComposerTray';
import { ComposerEditor } from '@/components/publish/ComposerEditor';
import { ComposerDrawer } from '@/components/publish/ComposerDrawer';
import { CalendarRibbon } from '@/components/publish/CalendarRibbon';
import { useAuth } from '@/contexts/AuthContext';
import { useTenant } from '@/hooks/useTenant';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

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
      
      // Fetch only approved Facebook and Instagram content tasks
      const { data: contentTasks, error: contentError } = await supabase
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
        .eq(tenant?.id ? 'tenant_id' : 'user_id', tenant?.id || user?.id)
        .order('created_at', { ascending: false });

      if (contentError) throw contentError;

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

      // Auto-select first content item
      if (generatedContent.length > 0) {
        setSelectedContent(generatedContent[0]);
      }

    } catch (error) {
      console.error('Error initializing publish data:', error);
      toast.error('Failed to load publish data');
    } finally {
      setLoading(false);
    }
  };

  const handleContentSelect = (content: GeneratedContent) => {
    setSelectedContent(content);
    setDrawerOpen(true);
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
      toast.success('Post scheduled successfully');
      
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
      toast.success('Post published successfully');
      
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
      <div className="min-h-screen bg-[#F9FAFB]">
        <div className="max-w-[1120px] mx-auto px-4 py-6">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-2xl font-semibold text-[#3E5A6B] mb-2">Publish Portal</h1>
            <p className="text-gray-600">Schedule and publish your approved Facebook and Instagram content</p>
          </div>

          {/* Main Layout */}
          <div className="grid grid-cols-12 gap-6 h-[calc(100vh-12rem)]">
            {/* Left Rail - Content Tray */}
            <div className="col-span-3">
              <ComposerTray
                content={publishData?.content || []}
                selectedContent={selectedContent}
                onContentSelect={handleContentSelect}
              />
            </div>

            {/* Center Editor */}
            <div className="col-span-6">
              <ComposerEditor
                selectedContent={selectedContent}
                onContentUpdate={(updatedContent) => setSelectedContent(updatedContent)}
                onOpenDrawer={() => setDrawerOpen(true)}
              />
            </div>

            {/* Right space for drawer overlay */}
            <div className="col-span-3"></div>
          </div>

          {/* Bottom Calendar Ribbon */}
          <div className="mt-6">
            <CalendarRibbon
              selectedContent={selectedContent}
              onReschedule={(contentId, newDate) => {
                // TODO: Implement reschedule logic
                console.log('Reschedule:', contentId, newDate);
              }}
            />
          </div>
        </div>

        {/* Right Drawer */}
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
