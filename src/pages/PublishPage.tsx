import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useDashboardData } from '@/hooks/useDashboardData';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Send, Calendar, BarChart3, Zap } from 'lucide-react';
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
  const { data: dashboardData, isLoading } = useDashboardData();
  const [content, setContent] = useState<GeneratedContent[]>([]);
  const [loading, setLoading] = useState(true);
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
          user_id: user?.id,
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

        setContent(prev => [newContent, ...prev]);
        localStorage.setItem(prefillKey, 'done');
        cleanUrl();
        setPrefillDone(true);
      } catch (e) {
        console.warn('Publish prefill failed', e);
      }
    })();
  }, [prefillDone, user]);

  useEffect(() => {
    if (user && !isLoading && dashboardData) {
      const publishableTasks = dashboardData.tasks?.filter(task => 
        (task.status === 'approved' || task.status === 'review') && 
        ['facebook', 'instagram'].includes(task.post_type)
      ) || [];

      const generatedContent: GeneratedContent[] = publishableTasks.map(task => ({
        id: task.id,
        status: task.status.toUpperCase() as 'DRAFT' | 'SCHEDULED' | 'PUBLISHED' | 'ARCHIVED' | 'APPROVED' | 'REVIEW',
        caption: task.ai_output || '',
        mediaUrl: (task.attachments as any)?.image?.thumb || (task.attachments as any)?.image?.url || undefined,
        platform: task.post_type,
        campaignId: task.campaign_id,
        createdAt: task.created_at
      }));

      // Merge with existing prefilled content instead of replacing
      setContent(prev => {
        const existingIds = new Set(prev.map(item => item.id));
        const newItems = generatedContent.filter(item => !existingIds.has(item.id));
        return [...prev, ...newItems];
      });
      setLoading(false);
    }
  }, [user, dashboardData, isLoading]);

  if (loading || isLoading) {
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
      <div className="space-y-2">
        <h1 className="text-4xl font-bold text-gray-900 flex items-center gap-3">
          <Send className="w-10 h-10 text-primary" />
          Publish Portal
        </h1>
        <p className="text-lg text-gray-600 font-medium">
          Direct social publishing with smart scheduling and analytics
        </p>
      </div>

      {/* Content Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {content.length === 0 ? (
          <Card className="col-span-full">
            <CardContent className="text-center py-12">
              <Send className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <CardTitle className="mb-2">No content ready to publish</CardTitle>
              <CardDescription>
                Approved content from the Create Flow will appear here ready for publishing.
              </CardDescription>
            </CardContent>
          </Card>
        ) : (
          content.map((item) => (
            <Card key={item.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {item.mediaUrl && (
                      <img 
                        src={item.mediaUrl} 
                        alt="Content thumbnail" 
                        className="w-8 h-8 object-cover rounded-md border"
                      />
                    )}
                    <CardTitle className="text-lg capitalize">{item.platform}</CardTitle>
                  </div>
                  <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full">
                    {item.status}
                  </span>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {item.mediaUrl && (
                  <div className="aspect-video bg-muted rounded-lg overflow-hidden">
                    <img 
                      src={item.mediaUrl} 
                      alt="Content media" 
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
                <p className="text-sm text-muted-foreground line-clamp-3">
                  {item.caption}
                </p>
                <div className="flex gap-2">
                  <Button size="sm" className="flex-1">
                    Publish Now
                  </Button>
                  <Button size="sm" variant="outline" className="flex-1">
                    Schedule
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
};

export default PublishPage;
