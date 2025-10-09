// AUDIT: Rebuilt PublishPage using new component structure
// - Uses PostCard components for rendering individual posts
// - Integrates ComposerDrawer for editing, publishing, and scheduling
// - Wires to publish-task via usePublishActions hook
// - Maps useDashboardData tasks to PublishItem format
// - Functional "Publish Now" and "Schedule" buttons via drawer

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Search, Send, Filter } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useDashboardData } from '@/hooks/useDashboardData';
import { useTenant } from '@/hooks/useTenant';
import { usePublishActions } from '@/hooks/usePublishActions';
import { validatePostForPlatform } from '@/utils/validatePost';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import PostCard from '@/components/publish/PostCard';
import ComposerDrawer, { ComposerMode } from '@/components/publish/ComposerDrawer';
import type { PublishItem, PublishNowInput, ScheduleInput } from '@/types/publish';

interface GeneratedContent {
  id: string;
  status: 'DRAFT' | 'SCHEDULED' | 'PUBLISHED' | 'ARCHIVED' | 'APPROVED' | 'REVIEW';
  caption: string;
  mediaUrl?: string;
  platform?: string;
  campaignId?: string;
  createdAt: string;
}

const PublishPage = () => {
  const { user } = useAuth();
  const { tenant, loading: tenantLoading } = useTenant();
  const { data: dashboardData, isLoading, refetch } = useDashboardData();
  const { publishNow, schedule } = usePublishActions();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // State for content and prefill logic
  const [content, setContent] = useState<GeneratedContent[]>([]);
  const [loading, setLoading] = useState(true);
  const [prefillDone, setPrefillDone] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Drawer state
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState<ComposerMode>('edit');
  const [selectedItem, setSelectedItem] = useState<PublishItem | null>(null);

  // Convert dashboard data to PublishItem format (ready to post)
  const publishItems: PublishItem[] = useMemo(() => {
    const tasks = dashboardData?.tasks || [];
    const socialConnections = dashboardData?.socialConnections || [];

    return tasks
      .filter(task => 
        ['facebook', 'instagram'].includes(task.post_type) &&
        task.status.toLowerCase() !== 'published'
      )
      .map(task => {
        const connection = socialConnections.find(
          conn => conn.platform === task.post_type && conn.is_active
        );

        return {
          taskId: task.id,
          tenantId: task.tenant_id,
          platform: task.post_type as "facebook" | "instagram",
          accountId: connection?.platform_account_id || null,
          accountName: connection?.platform_account_name || null,
          caption: task.ai_output?.trim() || null,
          firstComment: (task as any).first_comment || null,
          mediaUrl: task.image_url || (task.attachments as any)?.image?.url || null,
          scheduledFor: (task as any).scheduled_for || null,
          status: task.status.toLowerCase() as PublishItem['status'],
          attachments: task.attachments
        };
      });
  }, [dashboardData]);

  // Convert published tasks to published items format
  const publishedItems: (PublishItem & { publishedAt: string })[] = useMemo(() => {
    const publishedTasks = dashboardData?.publishedTasks || [];
    const scheduledPosts = dashboardData?.scheduledPosts || [];
    const socialConnections = dashboardData?.socialConnections || [];
    
    return publishedTasks
      .filter(task => ['facebook', 'instagram'].includes(task.post_type))
      .map(task => {
        const connection = socialConnections.find(
          conn => conn.platform === task.post_type && conn.is_active
        );
        
        // Find corresponding scheduled post for publish timestamp
        const scheduledPost = scheduledPosts.find(
          post => post.content_id === task.id && post.status === 'PUBLISHED'
        );
        
        return {
          taskId: task.id,
          tenantId: task.tenant_id,
          platform: task.post_type as "facebook" | "instagram",
          accountId: connection?.platform_account_id || null,
          accountName: connection?.platform_account_name || null,
          caption: task.ai_output?.trim() || null,
          firstComment: (task as any).first_comment || null,
          mediaUrl: task.image_url || (task.attachments as any)?.image?.url || null,
          scheduledFor: null,
          status: 'published' as const,
          attachments: task.attachments,
          publishedAt: scheduledPost?.publish_at || task.created_at
        };
      })
      .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
  }, [dashboardData]);

  // Available accounts for ComposerDrawer
  const availableAccounts = useMemo(() => {
    const connections = dashboardData?.socialConnections || [];
    return connections
      .filter(conn => conn.is_active)
      .map(conn => ({
        platform: conn.platform as "facebook" | "instagram",
        accountId: conn.platform_account_id,
        accountName: conn.platform_account_name || conn.username || `${conn.platform} account`
      }));
  }, [dashboardData]);

  // Filter ready items by search term
  const filteredReadyItems = useMemo(() => {
    if (!searchTerm) return publishItems;
    const term = searchTerm.toLowerCase();
    return publishItems.filter(item =>
      item.caption?.toLowerCase().includes(term) ||
      item.platform.toLowerCase().includes(term) ||
      item.accountName?.toLowerCase().includes(term)
    );
  }, [publishItems, searchTerm]);

  // Filter published items by search term
  const filteredPublishedItems = useMemo(() => {
    if (!searchTerm) return publishedItems;
    const term = searchTerm.toLowerCase();
    return publishedItems.filter(item =>
      item.caption?.toLowerCase().includes(term) ||
      item.platform.toLowerCase().includes(term) ||
      item.accountName?.toLowerCase().includes(term)
    );
  }, [publishedItems, searchTerm]);

  // Prefill logic (unchanged from original)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const bundleId = params.get('bundleId');
    const channel = params.get('channel');
    if (!bundleId || prefillDone || !user || !tenant || tenantLoading) return;

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
        console.log('🔍 Starting prefill process...');
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

        const extractContent = (item: any): string => {
          const candidates = [
            item.body,
            item.markdown, 
            item.script,
            item.caption,
            item.text,
            item.content
          ].filter(Boolean);
          
          return candidates.sort((a, b) => (b?.length || 0) - (a?.length || 0))[0] || '';
        };
        
        const content = extractContent(item);
        const imageUrl = item.media?.url || bundleData.content.recommendedImages?.[0]?.url || null;
        
        const insertPayload: any = {
          user_id: user.id,
          tenant_id: tenant.id,
          post_type: item.channel === 'instagram' ? 'instagram' : (item.channel === 'facebook' ? 'facebook' : 'instagram'),
          ai_output: content.trim() || 'Content generated from campaign',
          image_url: imageUrl,
          attachments: imageUrl ? { image: { url: imageUrl, alt: item.alt || 'Campaign image', thumb: imageUrl } } : null,
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

        // Invalidate dashboard data to refresh UI immediately
        queryClient.invalidateQueries({ queryKey: ['dashboard-data'] });

        localStorage.setItem(prefillKey, 'done');
        cleanUrl();
        setPrefillDone(true);
      } catch (e) {
        console.warn('Publish prefill failed', e);
      }
    })();
  }, [prefillDone, user, tenant, tenantLoading, queryClient]);

  // Set loading state
  useEffect(() => {
    if (user && !isLoading) {
      setLoading(false);
    }
  }, [user, isLoading]);

  // Drawer handlers
  const handleOpenDrawer = (item: PublishItem, mode: ComposerMode) => {
    setSelectedItem(item);
    setDrawerMode(mode);
    setDrawerOpen(true);
  };

  const handleCloseDrawer = () => {
    setDrawerOpen(false);
    setSelectedItem(null);
  };

  // Save draft handler
  const handleSaveDraft = useCallback(async (taskId: string, partial: {
    caption?: string | null;
    mediaUrl?: string | null;
    firstComment?: string | null;
    accountId?: string | null;
  }) => {
    const updateData: any = {};
    if (partial.caption !== undefined) updateData.ai_output = partial.caption;
    if (partial.mediaUrl !== undefined) updateData.image_url = partial.mediaUrl;
    // Note: firstComment is Instagram-specific and not stored in content_tasks
    // Note: accountId is not stored in content_tasks - it's passed to publish functions

    if (partial.mediaUrl) {
      updateData.attachments = {
        image: { 
          url: partial.mediaUrl, 
          alt: 'Content image',
          thumb: partial.mediaUrl 
        }
      };
    }

    const { data, error } = await supabase
      .from('content_tasks')
      .update(updateData)
      .eq('id', taskId)
      .select()
      .single();

    if (error) throw error;

    // Update local state optimistically
    const updated: PublishItem = {
      ...(selectedItem as PublishItem),
      caption: data.ai_output || null,
      mediaUrl: data.image_url || null,
      firstComment: (data as any).first_comment || null,
      accountId: (data as any).account_id || null,
    };
    setSelectedItem(updated);

    // Refresh dashboard data
    refetch?.();

    return updated;
  }, [selectedItem, refetch]);

  // Publish now handler
  const handlePublishNow = useCallback(async (taskId: string, input: PublishNowInput) => {
    await publishNow(taskId, input);
    
    // Close the drawer since publishing was successful
    setDrawerOpen(false);
    setSelectedItem(null);
    
    // Refresh data to show updated status
    refetch?.();
  }, [publishNow, refetch]);

  // Schedule handler  
  const handleSchedule = useCallback(async (taskId: string, input: ScheduleInput) => {
    await schedule(taskId, input);
    
    // Close the drawer since scheduling was successful
    setDrawerOpen(false);
    setSelectedItem(null);
    
    // Refresh data to show updated status
    refetch?.();
  }, [schedule, refetch]);

  // Delete handler
  const handleDelete = useCallback(async (item: PublishItem) => {
    if (!confirm('Are you sure you want to delete this content? This action cannot be undone.')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('content_tasks')
        .delete()
        .eq('id', item.taskId);

      if (error) throw error;

      toast({
        title: "Content deleted",
        description: "The content has been successfully deleted.",
      });

      // Refresh data to remove the deleted item
      refetch?.();
    } catch (error: any) {
      console.error('Delete error:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to delete content",
        variant: "destructive",
      });
    }
  }, [toast, refetch]);

  if (loading || isLoading || tenantLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading publish portal...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="space-y-4">
        <div className="space-y-2">
          <h1 className="text-4xl font-bold text-gray-900 flex items-center gap-3">
            <Send className="w-10 h-10 text-primary" />
            Publish Portal
          </h1>
          <p className="text-lg text-gray-600 font-medium">
            Direct social publishing with smart scheduling and analytics
          </p>
        </div>

        {/* Search Bar */}
        <div className="flex gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder="Search posts by caption, platform, or account..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Button variant="outline" size="icon">
            <Filter className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="ready" className="w-full">
        <TabsList className="grid w-full grid-cols-2 h-12 bg-gray-100 p-1 rounded-lg">
          <TabsTrigger 
            value="ready" 
            className="h-10 data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-sm data-[state=active]:font-semibold data-[state=inactive]:text-gray-600 data-[state=inactive]:hover:text-gray-900 transition-all duration-200"
          >
            Ready to Post
          </TabsTrigger>
          <TabsTrigger 
            value="published"
            className="h-10 data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-sm data-[state=active]:font-semibold data-[state=inactive]:text-gray-600 data-[state=inactive]:hover:text-gray-900 transition-all duration-200"
          >
            Published
          </TabsTrigger>
        </TabsList>

        <TabsContent value="ready" className="space-y-6">
          {/* Ready to Post Content List */}
          <div className="space-y-4">
            {filteredReadyItems.length === 0 ? (
              <Card className="col-span-full">
                <CardContent className="text-center py-12">
                  <Send className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <CardTitle className="mb-2">
                    {publishItems.length === 0 ? "No content ready to publish" : "No matching content"}
                  </CardTitle>
                  <CardDescription>
                    {publishItems.length === 0 
                      ? "Approved content from the Create Flow will appear here ready for publishing."
                      : "Try adjusting your search terms to find content."
                    }
                  </CardDescription>
                </CardContent>
              </Card>
            ) : (
              filteredReadyItems.map((item) => (
                <PostCard
                  key={`ready-${item.taskId}-${filteredReadyItems.length}`}
                    item={item}
                    onEdit={(item) => handleOpenDrawer(item, 'edit')}
                    onPublishNow={(item) => handleOpenDrawer(item, 'edit')}
                    onSchedule={(item) => handleOpenDrawer(item, 'schedule')}
                    onDelete={handleDelete}
                  />
              ))
            )}
          </div>
        </TabsContent>

        <TabsContent value="published" className="space-y-6">
          {/* Published Content List */}
          <div className="space-y-4">
            {filteredPublishedItems.length === 0 ? (
              <Card className="col-span-full">
                <CardContent className="text-center py-12">
                  <Send className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <CardTitle className="mb-2">
                    {publishedItems.length === 0 ? "No published posts" : "No matching published posts"}
                  </CardTitle>
                  <CardDescription>
                    {publishedItems.length === 0 
                      ? "Published posts will appear here with their publication dates."
                      : "Try adjusting your search terms to find published posts."
                    }
                  </CardDescription>
                </CardContent>
              </Card>
            ) : (
              filteredPublishedItems.map((item) => (
                <PostCard
                  key={`published-${item.taskId}-${filteredPublishedItems.length}`}
                    item={item}
                    publishedAt={item.publishedAt}
                    onEdit={(item) => handleOpenDrawer(item, 'edit')}
                    onPublishNow={(item) => handleOpenDrawer(item, 'edit')}
                    onSchedule={(item) => handleOpenDrawer(item, 'schedule')}
                    onDelete={handleDelete}
                  />
              ))
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Composer Drawer */}
      <ComposerDrawer
        open={drawerOpen}
        mode={drawerMode}
        item={selectedItem}
        accounts={availableAccounts}
        onClose={handleCloseDrawer}
        validate={validatePostForPlatform}
        onSaveDraft={handleSaveDraft}
        onPublishNow={handlePublishNow}
        onSchedule={handleSchedule}
      />
    </div>
  );
};

export default PublishPage;
