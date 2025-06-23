
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RefreshCw, Facebook, Instagram, ExternalLink } from 'lucide-react';
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

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Recent Posts</CardTitle>
          <Button variant="outline" size="sm" onClick={onRefresh}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {posts.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground">No posts yet</p>
            <p className="text-sm text-muted-foreground mt-1">
              Create your first post to get started
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {posts.map((post) => (
              <div
                key={post.id}
                className="border rounded-lg p-4 space-y-3"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    {getPlatformIcon(post.social_connections.platform)}
                    <span className="font-medium capitalize">
                      {post.social_connections.platform}
                    </span>
                    <span className="text-muted-foreground">
                      - {post.social_connections.platform_account_name}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={getStatusColor(post.status)}>
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
                      >
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
                
                <div className="space-y-2">
                  <p className="text-sm line-clamp-3">{post.content}</p>
                  {post.media_url && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span>📷 Image attached</span>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>
                    {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
                  </span>
                  {post.status === 'failed' && post.api_response?.error && (
                    <span className="text-red-600">
                      Error: {post.api_response.error.message}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
