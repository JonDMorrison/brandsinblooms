
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RefreshCw, Facebook, Instagram, ExternalLink, Plus } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface PostListProps {
  posts: any[];
  onRefresh: () => void;
}

export const PostList: React.FC<PostListProps> = ({ posts, onRefresh }) => {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'published':
        return 'bg-green-100 text-green-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
      case 'queued':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getPlatformIcon = (platform: string) => {
    return platform === 'facebook' ? 
      <Facebook className="h-4 w-4" /> : 
      <Instagram className="h-4 w-4" />;
  };

  const getPlatformGradient = (platform: string) => {
    return platform === 'facebook' 
      ? 'from-blue-500/10 to-blue-600/5 border-blue-200/30' 
      : 'from-purple-500/10 via-pink-500/10 to-orange-500/10 border-purple-200/30';
  };

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-white to-gray-50/50 border border-white/20 shadow-lg backdrop-blur-sm p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xl font-semibold bg-gradient-to-r from-text-primary to-text-secondary bg-clip-text text-transparent">
              Recent Posts
            </h3>
            <p className="text-sm text-text-tertiary mt-1">
              Track your published content and engagement
            </p>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={onRefresh}
            className="relative group hover:shadow-lg transition-all duration-200 border-primary/20 hover:border-primary/40 hover:-translate-y-0.5"
          >
            <RefreshCw className="h-4 w-4 mr-2 group-hover:rotate-180 transition-transform duration-500" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Posts Content */}
      {posts.length === 0 ? (
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-50 to-white border border-gray-200/50 shadow-lg backdrop-blur-sm">
          <div className="absolute inset-0 opacity-5">
            <div className="absolute top-8 left-8 text-6xl">📝</div>
            <div className="absolute top-12 right-12 text-4xl">✨</div>
            <div className="absolute bottom-8 left-1/2 text-5xl">🚀</div>
          </div>
          <div className="relative text-center py-16 px-8">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center mx-auto mb-4">
              <Plus className="h-8 w-8 text-primary" />
            </div>
            <h4 className="text-lg font-semibold text-text-primary mb-2">No posts yet</h4>
            <p className="text-text-secondary">
              Create your first post to start building your social media presence
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {posts.map((post) => (
            <div
              key={post.id}
              className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${getPlatformGradient(post.social_connections.platform)} border backdrop-blur-sm shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1 group`}
            >
              <div className="absolute inset-0 bg-white/40 group-hover:bg-white/30 transition-colors duration-300"></div>
              <div className="relative p-6 space-y-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-white/50 backdrop-blur-sm shadow-sm">
                      {getPlatformIcon(post.social_connections.platform)}
                    </div>
                    <div>
                      <span className="font-semibold text-text-primary capitalize">
                        {post.social_connections.platform}
                      </span>
                      <p className="text-sm text-text-secondary">
                        {post.social_connections.platform_account_name}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={`${getStatusColor(post.status)} border-0 shadow-sm font-medium`}>
                      {post.status}
                    </Badge>
                    {post.status === 'published' && post.api_response?.id && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          const url = post.social_connections.platform === 'facebook'
                            ? `https://facebook.com/${post.api_response.id}`
                            : `https://instagram.com/p/${post.api_response.id}`;
                          window.open(url, '_blank');
                        }}
                        className="hover:bg-white/50 hover:shadow-md transition-all duration-200"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
                
                <div className="space-y-3">
                  <p className="text-sm text-text-primary line-clamp-3 leading-relaxed">{post.content}</p>
                  {post.media_url && (
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/50 text-sm text-text-secondary backdrop-blur-sm">
                      <span>📷</span>
                      <span>Image attached</span>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between text-xs pt-2 border-t border-white/30">
                  <span className="text-text-tertiary font-medium">
                    {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
                  </span>
                  {post.status === 'failed' && post.api_response?.error && (
                    <span className="text-red-600 font-medium bg-red-50 px-2 py-1 rounded-md">
                      Error: {post.api_response.error.message}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
