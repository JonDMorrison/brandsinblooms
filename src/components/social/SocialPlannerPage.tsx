
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
import { SocialErrorBoundary } from './SocialErrorBoundary';
import { ProfileCleanupUtility } from '@/components/admin/ProfileCleanupUtility';

export const SocialPlannerPage = () => {
  const { user } = useAuth();
  const [featureEnabled, setFeatureEnabled] = useState(false);
  const [connections, setConnections] = useState([]);
  const [posts, setPosts] = useState([]);
  const [isNewPostModalOpen, setIsNewPostModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCleanup, setShowCleanup] = useState(false);

  useEffect(() => {
    if (user) {
      checkFeatureFlag();
      loadData();
    }
  }, [user]);

  const checkFeatureFlag = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase.rpc('feature_enabled', {
        feature_name: 'social_posting_v1'
      });
      
      if (error) {
        console.error('Error checking feature flag:', error);
        // Default to true if we can't check the flag
        setFeatureEnabled(true);
      } else {
        setFeatureEnabled(data);
      }
    } catch (error) {
      console.error('Error checking feature flag:', error);
      setFeatureEnabled(true); // Default to enabled
    }
  };

  const loadData = async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      setError(null);
      
      // Check for duplicate profiles first
      const { data: profiles, error: profilesError } = await supabase
        .from('company_profiles')
        .select('id')
        .eq('user_id', user.id);
      
      if (profilesError) {
        console.error('Error checking profiles:', profilesError);
      } else if (profiles && profiles.length > 1) {
        console.warn(`Found ${profiles.length} profiles for user - showing cleanup utility`);
        setShowCleanup(true);
      }
      
      // Load connections
      const { data: connectionsData, error: connectionsError } = await supabase
        .from('social_connections')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true);
      
      if (connectionsError) {
        console.error('Error loading connections:', connectionsError);
        throw connectionsError;
      }
      
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
      
      if (postsError) {
        console.error('Error loading posts:', postsError);
        throw postsError;
      }
      
      setPosts(postsData || []);
    } catch (error) {
      console.error('Error loading data:', error);
      setError('Failed to load social media data. Please try refreshing the page.');
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

  if (!user) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <div className="text-center">
              <h2 className="text-2xl font-bold mb-2">Authentication Required</h2>
              <p className="text-muted-foreground">
                Please log in to access your social media settings.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

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

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-6 text-center">
            <h2 className="text-xl font-semibold text-red-700 mb-2">Error Loading Social Media</h2>
            <p className="text-red-600 mb-4">{error}</p>
            <Button onClick={loadData} variant="outline">
              Try Again
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <SocialErrorBoundary>
      <div className="container mx-auto px-4 py-8">
        <div className="space-y-12">
          {/* Show cleanup utility if needed */}
          {showCleanup && (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-orange-700">Account Cleanup Required</h2>
              <ProfileCleanupUtility />
            </div>
          )}

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
    </SocialErrorBoundary>
  );
};
