
import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CheckCircle, RefreshCw } from 'lucide-react';
import { CompactImageCarousel } from '@/components/homepage/ready-to-post/CompactImageCarousel';

interface GeneratedTask {
  id: string;
  post_type: string;
  ai_output: string;
  status: string;
  campaign_id?: string;
  // Add other properties as needed
}

interface FivePostModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  posts: GeneratedTask[];
  onApprove?: (postIds: string[]) => void;
  onRegenerate?: () => void;
  campaignTheme?: string;
}

export const FivePostModal = ({
  isOpen,
  onClose,
  title,
  posts,
  onApprove,
  onRegenerate,
  campaignTheme
}: FivePostModalProps) => {
  const handleApprove = () => {
    if (onApprove) {
      const postIds = posts.map(post => post.id);
      onApprove(postIds);
    }
  };

  const getPostTypeBadge = (postType: string) => {
    const typeMap: Record<string, { label: string; color: string }> = {
      'facebook': { label: 'Facebook', color: 'bg-blue-100 text-blue-800' },
      'instagram': { label: 'Instagram', color: 'bg-pink-100 text-pink-800' },
      'blog': { label: 'Blog', color: 'bg-green-100 text-green-800' },
      'video': { label: 'Video', color: 'bg-purple-100 text-purple-800' },
      'newsletter': { label: 'Newsletter', color: 'bg-orange-100 text-orange-800' }
    };

    const config = typeMap[postType] || { label: postType, color: 'bg-gray-100 text-gray-800' };
    return (
      <Badge className={`${config.color} font-medium`}>
        {config.label}
      </Badge>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-semibold text-[#3E5A6B] text-xl">
            {title}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <div className="text-sm text-gray-600">
            Generated {posts.length} content pieces ready for review
          </div>

          {posts.map((post, index) => (
            <div key={post.id} className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  {getPostTypeBadge(post.post_type)}
                  <span className="text-sm text-gray-500">#{index + 1}</span>
                </div>
                <div className="flex items-center gap-1 text-green-600 text-sm">
                  <CheckCircle className="w-4 h-4" />
                  Ready
                </div>
              </div>
              
              <div className="prose prose-sm max-w-none mb-4">
                <div className="text-gray-800 leading-relaxed">
                  {post.ai_output ? (
                    <div dangerouslySetInnerHTML={{ __html: post.ai_output.replace(/\n/g, '<br>') }} />
                  ) : (
                    <p className="text-gray-500 italic">Content preview unavailable</p>
                  )}
                </div>
              </div>

              {/* Image Section */}
              <div className="mt-4 pt-4 border-t border-gray-100">
                <CompactImageCarousel 
                  task={post} 
                  campaignTheme={campaignTheme || title}
                />
              </div>
            </div>
          ))}

          <div className="flex justify-between items-center pt-4 border-t border-gray-200">
            <Button
              variant="outline"
              onClick={onRegenerate}
              disabled={!onRegenerate}
              className="flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Regenerate All
            </Button>
            
            <Button
              onClick={handleApprove}
              disabled={!onApprove}
              className="bg-[#68BEB9] hover:bg-[#56a7a1] text-white"
            >
              <CheckCircle className="w-4 h-4 mr-2" />
              Approve All Content
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
