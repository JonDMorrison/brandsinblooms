
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';

import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { SocialConnectionsSection } from './SocialConnectionsSection';
import { NewPostModal } from './NewPostModal';
import { PostList } from './PostList';
import { TokenMeter } from './TokenMeter';
import { SocialErrorBoundary } from './SocialErrorBoundary';

export const SocialPlannerPage = () => {
  const { user } = useAuth();
  const [featureEnabled, setFeatureEnabled] = useState(false);
  const [connections, setConnections] = useState([]);
  const [posts, setPosts] = useState([]);
  const [isNewPostModalOpen, setIsNewPostModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      checkFeatureFlag();
      loadData();
    }
  }, [user]);

  // Check for OAuth success message
  useEffect(() => {
    // Check for OAuth debug info (for development only)
    if (import.meta.env.DEV) {
      const debugInfo = localStorage.getItem('oauth_debug');
      if (debugInfo) {
        try {
          const debug = JSON.parse(debugInfo);
          console.log('🐛 OAuth Debug Info:', debug);
          // Only show debug toast in development
          
        } catch (error) {
          console.error('Error parsing debug info:', error);
        }
      }
    }

    const successData = sessionStorage.getItem('social_connection_success');
    if (successData) {
      try {
        const { message, timestamp } = JSON.parse(successData);
        // Only show if less than 30 seconds old
        if (Date.now() - timestamp < 30000) {
          
        }
        sessionStorage.removeItem('social_connection_success');
      } catch (error) {
        console.error('Error parsing success data:', error);
        sessionStorage.removeItem('social_connection_success');
      }
    }
  }, []);

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
      
    } finally {
      setLoading(false);
    }
  };

  const handleConnectionSuccess = () => {
    loadData();
    
  };

  const handlePostCreated = () => {
    loadData();
    setIsNewPostModalOpen(false);
    
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
          {/* Connections Section */}
          <SocialConnectionsSection 
            connections={connections}
            onConnectionSuccess={handleConnectionSuccess}
          />

          {/* Posts Section - Only show if there are connections */}
          {connections.length > 0 && (
            <div className="space-y-8">
              {/* Your Content Hero Section */}
              <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-50 via-white to-gray-50/30 border border-white/20 shadow-2xl backdrop-blur-sm">
                {/* Decorative Background Elements */}
                <div className="absolute inset-0 opacity-5">
                  <div className="absolute top-10 left-10 text-8xl">📱</div>
                  <div className="absolute top-20 right-20 text-6xl">✨</div>
                  <div className="absolute bottom-10 left-1/3 text-7xl">📊</div>
                  <div className="absolute bottom-20 right-10 text-5xl">🎯</div>
                </div>
                
                <div className="relative px-8 py-12">
                  <div className="flex items-center justify-between">
                    <div className="space-y-3">
                      <h2 className="text-4xl font-bold bg-gradient-to-r from-text-primary via-primary to-text-primary bg-clip-text text-transparent">
                        Your Content
                      </h2>
                      <p className="text-lg text-text-secondary max-w-2xl leading-relaxed">
                        Create engaging content, schedule posts across platforms, and track your social media performance
                      </p>
                      <div className="flex items-center gap-4 pt-2">
                        <div className="flex items-center gap-2 text-sm text-text-tertiary">
                          <div className="w-2 h-2 rounded-full bg-primary animate-pulse"></div>
                          <span>{posts.length} posts created</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-text-tertiary">
                          <div className="w-2 h-2 rounded-full bg-success"></div>
                          <span>{connections.length} platforms connected</span>
                        </div>
                      </div>
                    </div>
                    
                    {/* Floating Create Post Button */}
                    <Button 
                      onClick={() => setIsNewPostModalOpen(true)} 
                      size="lg"
                      className="relative group bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 border-0 px-8 py-6 text-base font-semibold"
                    >
                      <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                      <Plus className="h-5 w-5 mr-2 relative z-10" />
                      <span className="relative z-10">Create Post</span>
                    </Button>
                  </div>
                </div>
              </div>

              <PostList posts={posts} onRefresh={loadData} />
            </div>
          )}

          {/* Token Meter */}
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
