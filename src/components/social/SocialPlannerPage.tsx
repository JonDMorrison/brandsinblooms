
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { SocialConnectionsSection } from './SocialConnectionsSection';
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
      <div className="space-y-12">
        {/* Header */}
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-bold text-gray-900">Social Media Planner</h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Connect your Facebook and Instagram accounts to schedule posts, manage content, and grow your audience
          </p>
        </div>

        {/* Connections Section */}
        <SocialConnectionsSection 
          connections={connections}
          onConnectionSuccess={handleConnectionSuccess}
        />

        {/* Posts Section - Only show if there are connections */}
        {connections.length > 0 && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Your Content</h2>
                <p className="text-gray-600">Create, schedule, and manage your social media posts</p>
              </div>
              <Button onClick={() => setIsNewPostModalOpen(true)} size="lg">
                <Plus className="h-5 w-5 mr-2" />
                Create Post
              </Button>
            </div>

            <PostList posts={posts} onRefresh={loadData} />
          </div>
        )}

        {/* Token Meter - Moved to bottom */}
        <TokenMeter />

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
