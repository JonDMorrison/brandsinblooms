import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Facebook, Instagram, Send, Loader2, CheckCircle, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface PostToSocialButtonProps {
  task: any;
  onSuccess?: () => void;
  className?: string;
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'sm' | 'default' | 'lg';
}

interface SocialConnection {
  id: string;
  platform: 'facebook' | 'instagram';
  platform_account_name: string;
  is_active: boolean;
}

// Type guard to ensure platform is valid
const isValidPlatform = (platform: string): platform is 'facebook' | 'instagram' => {
  return platform === 'facebook' || platform === 'instagram';
};

export const PostToSocialButton: React.FC<PostToSocialButtonProps> = ({
  task,
  onSuccess,
  className = '',
  variant = 'default',
  size = 'default'
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [connections, setConnections] = useState<SocialConnection[]>([]);
  const [posting, setPosting] = useState<Record<string, boolean>>({});
  const [posted, setPosted] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);

  // Fetch social connections
  useEffect(() => {
    const fetchConnections = async () => {
      if (!isOpen) return;
      
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('social_connections')
          .select('id, platform, platform_account_name, is_active')
          .eq('is_active', true)
          .in('platform', ['facebook', 'instagram']);

        if (error) throw error;
        
        // Filter and type-check the data to ensure platform is valid
        const validConnections = (data || [])
          .filter((connection): connection is SocialConnection => 
            isValidPlatform(connection.platform)
          );
        
        setConnections(validConnections);
      } catch (error) {
        console.error('Error fetching social connections:', error);
        toast.error('Failed to load social media connections');
      } finally {
        setLoading(false);
      }
    };

    fetchConnections();
  }, [isOpen]);

  // Smart content processing
  const processContentForPlatform = (content: string, platform: 'facebook' | 'instagram') => {
    const cleanContent = content.replace(/<[^>]*>/g, '').trim();
    
    // Extract hashtags
    const hashtagMatch = cleanContent.match(/#\w+/g);
    const hashtags = hashtagMatch ? hashtagMatch.join(' ') : '';
    const textWithoutHashtags = cleanContent.replace(/#\w+/g, '').trim();
    
    // Platform-specific limits
    const limits = {
      facebook: { text: 63206, hashtags: 30 },
      instagram: { text: 2200, hashtags: 30 }
    };
    
    const limit = limits[platform];
    let finalText = textWithoutHashtags;
    let finalHashtags = hashtags;
    
    // Truncate if necessary
    if (finalText.length > limit.text) {
      finalText = finalText.substring(0, limit.text - 3) + '...';
    }
    
    // Limit hashtags
    const hashtagArray = finalHashtags.split(' ').filter(tag => tag.trim().startsWith('#'));
    if (hashtagArray.length > limit.hashtags) {
      finalHashtags = hashtagArray.slice(0, limit.hashtags).join(' ');
    }
    
    return {
      text: finalText,
      hashtags: finalHashtags,
      fullContent: finalHashtags ? `${finalText}\n\n${finalHashtags}` : finalText
    };
  };

  const handlePost = async (platform: 'facebook' | 'instagram') => {
    setPosting(prev => ({ ...prev, [platform]: true }));
    
    try {
      // Get session for authentication
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !sessionData.session) {
        toast.error('Authentication session expired. Please refresh the page and try again.');
        return;
      }

      const token = sessionData.session.access_token;
      if (!token) {
        toast.error('No authentication token found. Please refresh the page and try again.');
        return;
      }

      const processedContent = processContentForPlatform(task.ai_output, platform);
      
      // Update the task with the processed content and ensure it's approved
      await supabase
        .from('content_tasks')
        .update({ 
          ai_output: processedContent.fullContent,
          status: 'approved' // Ensure task is approved for posting
        })
        .eq('id', task.id);
      
      // Call the unified publish-task edge function
      const functionResponse = await supabase.functions.invoke('publish-task', {
        headers: {
          Authorization: `Bearer ${token}`
        },
        body: {
          taskId: task.id,
          platforms: [platform]
        }
      });
        
      const { data: responseData, error } = functionResponse;

      if (error) {
        throw new Error(error.message || `Edge function error: ${JSON.stringify(error)}`);
      }

      if (responseData?.success) {
        const result = responseData.results?.[0];
        if (result?.success) {
          setPosted(prev => ({ ...prev, [platform]: true }));
          toast.success(`Successfully posted to ${platform === 'facebook' ? 'Facebook' : 'Instagram'}!`);
          
          if (onSuccess) {
            onSuccess();
          }
        } else {
          throw new Error(result?.error || `Failed to post to ${platform}`);
        }
      } else {
        throw new Error(responseData?.message || `Failed to post to ${platform}`);
      }
    } catch (error: any) {
      console.error(`Error posting to ${platform}:`, error);
      toast.error(error.message || `Failed to post to ${platform}`);
    } finally {
      setPosting(prev => ({ ...prev, [platform]: false }));
    }
  };

  const getContentPreview = () => {
    if (!task.ai_output) return 'No content available';
    const preview = task.ai_output.replace(/<[^>]*>/g, '').trim();
    return preview.length > 100 ? `${preview.substring(0, 100)}...` : preview;
  };

  const canPost = task.ai_output && task.status === 'approved';

  const getTooltipMessage = () => {
    if (!task.ai_output) {
      return 'Content must be generated first before posting to social media';
    }
    if (task.status !== 'approved') {
      return 'Content must be approved before posting to social media';
    }
    return 'Connect your social media accounts in Settings to post content directly';
  };

  if (!canPost) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              disabled
              variant={variant}
              size={size}
              className={`${className} opacity-50`}
            >
              <Send className="w-4 h-4 mr-2" />
              Post to Social
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>{getTooltipMessage()}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <>
      <Button
        onClick={() => setIsOpen(true)}
        variant={variant}
        size={size}
        className={`${className} bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white`}
      >
        <Send className="w-4 h-4 mr-2" />
        Post to Social
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="w-5 h-5" />
              Post to Social Media
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            {/* Content Preview */}
            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="font-medium text-gray-900 mb-2">Content Preview</h3>
              <p className="text-gray-700 text-sm leading-relaxed">
                {getContentPreview()}
              </p>
              <Badge variant="outline" className="mt-2 capitalize">
                {task.post_type}
              </Badge>
            </div>

            {/* Platform Selection */}
            <div className="space-y-4">
              <h3 className="font-medium text-gray-900">Choose Platform(s)</h3>
              
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                  <span className="ml-2 text-gray-500">Loading connections...</span>
                </div>
              ) : connections.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <p>No social media accounts connected.</p>
                  <p className="text-sm mt-1">Connect your accounts in Settings to post content.</p>
                </div>
              ) : (
                <div className="grid gap-3">
                  {connections.map((connection) => {
                    const PlatformIcon = connection.platform === 'facebook' ? Facebook : Instagram;
                    const platformName = connection.platform === 'facebook' ? 'Facebook' : 'Instagram';
                    const isPosting = posting[connection.platform];
                    const isPosted = posted[connection.platform];
                    
                    const processedContent = processContentForPlatform(task.ai_output, connection.platform);
                    
                    return (
                      <div key={connection.id} className="border rounded-lg p-4">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <PlatformIcon className={`w-5 h-5 ${connection.platform === 'facebook' ? 'text-blue-600' : 'text-pink-500'}`} />
                            <div>
                              <h4 className="font-medium">{platformName}</h4>
                              <p className="text-sm text-gray-500">{connection.platform_account_name}</p>
                            </div>
                          </div>
                          
                          {isPosted ? (
                            <Button disabled className="bg-green-100 text-green-700">
                              <CheckCircle className="w-4 h-4 mr-2" />
                              Posted
                            </Button>
                          ) : (
                            <Button
                              onClick={() => handlePost(connection.platform)}
                              disabled={isPosting}
                              className={connection.platform === 'facebook' 
                                ? 'bg-blue-600 hover:bg-blue-700' 
                                : 'bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600'
                              }
                            >
                              {isPosting ? (
                                <>
                                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                  Posting...
                                </>
                              ) : (
                                <>
                                  <Send className="w-4 h-4 mr-2" />
                                  Post Now
                                </>
                              )}
                            </Button>
                          )}
                        </div>
                        
                        {/* Content preview for this platform */}
                        <div className="bg-gray-50 rounded p-3 text-sm">
                          <p className="text-gray-700 mb-2">{processedContent.text}</p>
                          {processedContent.hashtags && (
                            <p className="text-blue-600">{processedContent.hashtags}</p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
