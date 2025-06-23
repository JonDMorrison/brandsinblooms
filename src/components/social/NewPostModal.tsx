
import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Facebook, Instagram, Image, Send } from 'lucide-react';

interface NewPostModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  connections: any[];
}

export const NewPostModal: React.FC<NewPostModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  connections
}) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [content, setContent] = useState('');
  const [mediaUrl, setMediaUrl] = useState('');
  const [selectedConnection, setSelectedConnection] = useState('');

  const handleSubmit = async () => {
    if (!content.trim()) {
      toast.error('Please enter post content');
      return;
    }

    if (!selectedConnection) {
      toast.error('Please select a platform');
      return;
    }

    const connection = connections.find(c => c.id === selectedConnection);
    if (!connection) {
      toast.error('Invalid connection selected');
      return;
    }

    // Instagram requires an image
    if (connection.platform === 'instagram' && !mediaUrl.trim()) {
      toast.error('Instagram posts require an image URL');
      return;
    }

    setLoading(true);
    try {
      // Check token balance first
      const { data: profile } = await supabase
        .from('company_profiles')
        .select('tokens_balance')
        .eq('user_id', user.id)
        .single();

      if (!profile || profile.tokens_balance <= 0) {
        toast.error('Insufficient post credits. Please upgrade your plan.');
        return;
      }

      // Create the social post
      const { data: post, error: postError } = await supabase
        .from('social_posts')
        .insert({
          user_id: user.id,
          social_connection_id: selectedConnection,
          content: content.trim(),
          media_url: mediaUrl.trim() || null,
          status: 'queued'
        })
        .select()
        .single();

      if (postError) throw postError;

      // Deduct token
      const { error: tokenError } = await supabase.rpc('spend_tokens', {
        p_user_id: user.id,
        p_tokens: 1,
        p_action_type: 'social_post',
        p_content_type: connection.platform
      });

      if (tokenError) throw tokenError;

      // Call the appropriate posting function
      const functionName = connection.platform === 'facebook' 
        ? 'post-to-facebook' 
        : 'post-to-instagram';

      const { error: postingError } = await supabase.functions.invoke(functionName, {
        body: { post_id: post.id }
      });

      if (postingError) {
        console.error('Posting error:', postingError);
        // Update post status to failed
        await supabase
          .from('social_posts')
          .update({ status: 'failed' })
          .eq('id', post.id);
        
        toast.error('Failed to publish post. Please try again.');
        return;
      }

      // Reset form
      setContent('');
      setMediaUrl('');
      setSelectedConnection('');
      onSuccess();
    } catch (error) {
      console.error('Error creating post:', error);
      toast.error('Failed to create post');
    } finally {
      setLoading(false);
    }
  };

  const selectedConn = connections.find(c => c.id === selectedConnection);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Create New Post</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="platform">Platform</Label>
            <Select value={selectedConnection} onValueChange={setSelectedConnection}>
              <SelectTrigger>
                <SelectValue placeholder="Select a connected account" />
              </SelectTrigger>
              <SelectContent>
                {connections.map((connection) => (
                  <SelectItem key={connection.id} value={connection.id}>
                    <div className="flex items-center gap-2">
                      {connection.platform === 'facebook' ? 
                        <Facebook className="h-4 w-4" /> : 
                        <Instagram className="h-4 w-4" />
                      }
                      <span className="capitalize">{connection.platform}</span>
                      <span className="text-muted-foreground">
                        - {connection.platform_account_name}
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {connections.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No connected accounts. Please connect a Facebook or Instagram account first.
              </p>
            )}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="content">Post Content</Label>
            <Textarea
              id="content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="What would you like to share?"
              rows={4}
              maxLength={2200}
            />
            <div className="text-xs text-muted-foreground text-right">
              {content.length}/2200
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="media-url" className="flex items-center gap-2">
              <Image className="h-4 w-4" />
              Image URL {selectedConn?.platform === 'instagram' && (
                <span className="text-red-500 text-xs">(Required for Instagram)</span>
              )}
            </Label>
            <Input
              id="media-url"
              value={mediaUrl}
              onChange={(e) => setMediaUrl(e.target.value)}
              placeholder="https://example.com/image.jpg"
              type="url"
            />
          </div>

          {selectedConn && (
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-sm font-medium">Posting to:</p>
              <div className="flex items-center gap-2 mt-1">
                {selectedConn.platform === 'facebook' ? 
                  <Facebook className="h-4 w-4" /> : 
                  <Instagram className="h-4 w-4" />
                }
                <span className="capitalize">{selectedConn.platform}</span>
                <span className="text-muted-foreground">
                  - {selectedConn.platform_account_name}
                </span>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={loading || !content.trim() || !selectedConnection}
          >
            {loading ? (
              'Publishing...'
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Publish Now
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
