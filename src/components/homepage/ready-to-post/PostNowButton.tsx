
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Facebook, Instagram, Send, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface PostNowButtonProps {
  task: any;
  platform: 'facebook' | 'instagram';
  onSuccess?: () => void;
}

export const PostNowButton: React.FC<PostNowButtonProps> = ({
  task,
  platform,
  onSuccess
}) => {
  const [isPosting, setIsPosting] = useState(false);

  const handlePost = async () => {
    setIsPosting(true);
    
    try {
      // TODO: Implement actual posting logic
      // This would connect to your social media posting service
      
      // Simulate posting delay
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      toast.success(`Posted to ${platform === 'facebook' ? 'Facebook' : 'Instagram'}!`);
      
      if (onSuccess) {
        onSuccess();
      }
    } catch (error) {
      console.error('Error posting:', error);
      toast.error(`Failed to post to ${platform}`);
    } finally {
      setIsPosting(false);
    }
  };

  const PlatformIcon = platform === 'facebook' ? Facebook : Instagram;
  const platformName = platform === 'facebook' ? 'Facebook' : 'Instagram';

  return (
    <Button
      onClick={handlePost}
      disabled={isPosting}
      className={`
        flex items-center gap-2 font-medium transition-all duration-200
        ${platform === 'facebook' 
          ? 'bg-blue-600 hover:bg-blue-700 text-white' 
          : 'bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white'
        }
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
  );
};
