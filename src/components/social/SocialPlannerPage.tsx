
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { ConnectMetaButton } from './ConnectMetaButton';
import { NewPostModal } from './NewPostModal';
import { PostList } from './PostList';
import { TokenMeter } from './TokenMeter';

export const SocialPlannerPage = () => {
  const { user } = useAuth();
  const [featureEnabled, setFeatureEnabled] = useState(false);
  const [connections, setConnections] = useState([]);
  const [posts, setPosts] = useState([]);
  const [isNewPostModalOpen, setIsNewPostModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkFeatureFlag();
    loadData();
  }, [user]);

  const checkFeatureFlag = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase.rpc('feature_enabled', {
        feature_name: 'social_posting_v1'
      });
      
      if (error) throw error;
      setFeatureEnabled(data);
    } catch (error) {
      console.error('Error checking feature flag:', error);
    }
  };

  const loadData = async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      
      // Load connections
      const { data: connectionsData, error: connectionsError } = await supabase
        .from('social_connections')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true);
      
      if (connectionsError) throw connectionsError;
      setConnections(connectionsData || []);

      // Load posts
      const { data: postsData, error: postsError } = await supabase
        .from('social_posts')
        .select(`
          *,
          social_connections!inner(platform, platform_account_name)
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      
      if (postsError) throw postsError;
      setPosts(postsData || []);
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Failed to load social media data');
    } finally {
      setLoading(false);
    }
  };

  const handleConnectionSuccess = () => {
    loadData();
    toast.success('Successfully connected to Meta platform!');
  };

  const handlePostCreated = () => {
    loadData();
    setIsNewPostModalOpen(false);
    toast.success('Post created successfully!');
  };

  if (!featureEnabled) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <div className="text-center">
              <h2 className="text-2xl font-bold mb-2">Social Media Feature Not Available</h2>
              <p className="text-muted-foreground">
                This feature is not enabled in your current plan.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="grid gap-6">
          <div className="h-8 bg-gray-200 rounded animate-pulse" />
          <div className="h-32 bg-gray-200 rounded animate-pulse" />
          <div className="h-64 bg-gray-200 rounded animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="grid gap-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Social Media Planner</h1>
            <p className="text-muted-foreground">
              Manage your Facebook and Instagram posts
            </p>
          </div>
          <div className="flex gap-3">
            <ConnectMetaButton onSuccess={handleConnectionSuccess} />
            <Button onClick={() => setIsNewPostModalOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              New Post
            </Button>
          </div>
        </div>

        {/* Token Meter */}
        <TokenMeter />

        {/* Connections Status */}
        {connections.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Connected Accounts</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {connections.map((connection) => (
                  <div
                    key={connection.id}
                    className="flex items-center gap-3 p-3 border rounded-lg"
                  >
                    <div className="w-2 h-2 bg-green-500 rounded-full" />
                    <div>
                      <p className="font-medium capitalize">{connection.platform}</p>
                      <p className="text-sm text-muted-foreground">
                        {connection.platform_account_name}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Posts List */}
        <PostList posts={posts} onRefresh={loadData} />

        {/* New Post Modal */}
        <NewPostModal
          isOpen={isNewPostModalOpen}
          onClose={() => setIsNewPostModalOpen(false)}
          onSuccess={handlePostCreated}
          connections={connections}
        />
      </div>
    </div>
  );
};
