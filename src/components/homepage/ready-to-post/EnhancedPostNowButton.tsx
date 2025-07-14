
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Facebook, Instagram, Send, Loader2, AlertTriangle, RefreshCw, ExternalLink } from 'lucide-react';
// Removed sonner import - using global toast replacement
import { supabase } from '@/integrations/supabase/client';
import { SmartPostComposer } from '@/components/social/SmartPostComposer';

interface EnhancedPostNowButtonProps {
  task: any;
  platform: 'facebook' | 'instagram';
  onSuccess?: () => void;
  socialConnections: any[];
}

export const EnhancedPostNowButton: React.FC<EnhancedPostNowButtonProps> = ({
  task,
  platform,
  onSuccess,
  socialConnections
}) => {
  const [isPosting, setIsPosting] = useState(false);
  const [showComposer, setShowComposer] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const connection = socialConnections.find(conn => conn.platform === platform);
  const isDisabled = task.posting_disabled_at || !connection;
  const hasRecentError = task.last_posting_error && task.posting_attempts >= 3;
  const isAlreadyPosted = task.platform_post_url;

  const handleRetry = async () => {
    setError(null);
    await supabase
      .from('content_tasks')
      .update({ 
        posting_disabled_at: null,
        last_posting_error: null
      })
      .eq('id', task.id);
    
    if (onSuccess) onSuccess(); // Refresh the data
  };

  const PlatformIcon = platform === 'facebook' ? Facebook : Instagram;
  const platformName = platform === 'facebook' ? 'Facebook' : 'Instagram';

  if (!connection) {
    return (
      <Button disabled size="sm" variant="outline">
        <PlatformIcon className="w-4 h-4 mr-2" />
        Connect {platformName}
      </Button>
    );
  }

  if (isAlreadyPosted) {
    return (
      <Button 
        size="sm" 
        variant="outline"
        onClick={() => window.open(task.platform_post_url, '_blank')}
        className="text-green-600 border-green-200 hover:bg-green-50"
      >
        <ExternalLink className="w-4 h-4 mr-2" />
        View on {platformName}
      </Button>
    );
  }

  return (
    <>
      <div className="space-y-2">
        <Button
          onClick={() => setShowComposer(true)}
          disabled={isPosting || isDisabled}
          size="sm"
          className={`
            flex items-center gap-2 font-medium transition-all duration-200
            ${platform === 'facebook' 
              ? 'bg-blue-600 hover:bg-blue-700 text-white' 
              : 'bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white'
            }
            ${isPosting ? 'opacity-50' : ''}
            ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}
          `}
        >
          {isPosting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Posting...
            </>
          ) : (
            <>
              <PlatformIcon className="w-4 h-4" />
              <Send className="w-3 h-3" />
              Post to {platformName}
            </>
          )}
        </Button>

        {error && (
          <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 p-2 rounded">
            <AlertTriangle className="w-4 h-4" />
            <span className="flex-1">{error}</span>
            {!isDisabled && (
              <Button
                size="sm"
                variant="ghost"
                onClick={handleRetry}
                className="text-red-600 hover:text-red-700 p-1 h-auto"
              >
                <RefreshCw className="w-3 h-3 mr-1" />
                Retry
              </Button>
            )}
          </div>
        )}

        {hasRecentError && (
          <div className="text-xs text-orange-600 bg-orange-50 p-2 rounded">
            <div className="flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" />
              Posting disabled after {task.posting_attempts} failed attempts
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={handleRetry}
              className="text-orange-600 hover:text-orange-700 p-0 h-auto text-xs mt-1"
            >
              Re-enable posting
            </Button>
          </div>
        )}
      </div>

      <SmartPostComposer
        isOpen={showComposer}
        onClose={() => setShowComposer(false)}
        task={task}
        platform={platform}
        onSuccess={() => {
          setShowComposer(false);
          if (onSuccess) onSuccess();
        }}
        onPostingStart={() => setIsPosting(true)}
      />
    </>
  );
};
