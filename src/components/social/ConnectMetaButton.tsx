
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Facebook, Instagram } from 'lucide-react';

interface ConnectMetaButtonProps {
  onSuccess: () => void;
}

export const ConnectMetaButton: React.FC<ConnectMetaButtonProps> = ({ onSuccess }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [platform, setPlatform] = useState<'facebook' | 'instagram'>('facebook');
  const [accessToken, setAccessToken] = useState('');
  const [pageId, setPageId] = useState('');

  const handleConnect = async () => {
    if (!accessToken || !pageId) {
      toast.error('Please fill in all fields');
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('connect-meta', {
        body: {
          access_token: accessToken,
          platform,
          page_id: pageId
        }
      });

      if (error) {
        throw new Error(error.message);
      }

      if (data.success) {
        onSuccess();
        setIsOpen(false);
        setAccessToken('');
        setPageId('');
      } else {
        throw new Error(data.error || 'Failed to connect');
      }
    } catch (error) {
      console.error('Connection error:', error);
      toast.error(`Failed to connect: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Facebook className="h-4 w-4 mr-2" />
          Connect Meta
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Connect to Meta Platform</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="platform">Platform</Label>
            <Select value={platform} onValueChange={(value: 'facebook' | 'instagram') => setPlatform(value)}>
              <SelectTrigger>
                <SelectValue placeholder="Select platform" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="facebook">
                  <div className="flex items-center gap-2">
                    <Facebook className="h-4 w-4" />
                    Facebook Page
                  </div>
                </SelectItem>
                <SelectItem value="instagram">
                  <div className="flex items-center gap-2">
                    <Instagram className="h-4 w-4" />
                    Instagram Business
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="page-id">
              {platform === 'facebook' ? 'Facebook Page ID' : 'Instagram Business Account ID'}
            </Label>
            <Input
              id="page-id"
              value={pageId}
              onChange={(e) => setPageId(e.target.value)}
              placeholder={platform === 'facebook' ? 'Your Facebook Page ID' : 'Your Instagram Business Account ID'}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="access-token">Access Token</Label>
            <Input
              id="access-token"
              type="password"
              value={accessToken}
              onChange={(e) => setAccessToken(e.target.value)}
              placeholder="Your Meta access token"
            />
          </div>
          <div className="text-sm text-muted-foreground">
            <p>To get your access token and page ID:</p>
            <ol className="list-decimal list-inside mt-2 space-y-1">
              <li>Visit the Meta for Developers website</li>
              <li>Create an app and get your access token</li>
              <li>Find your Page/Account ID in your platform settings</li>
            </ol>
          </div>
        </div>
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={() => setIsOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleConnect} disabled={loading}>
            {loading ? 'Connecting...' : 'Connect'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
