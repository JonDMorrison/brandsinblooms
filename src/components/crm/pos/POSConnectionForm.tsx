import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ExternalLink, Key, Store } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface POSConnectionFormProps {
  platform: string;
  onSuccess: () => void;
  onCancel: () => void;
}

export const POSConnectionForm: React.FC<POSConnectionFormProps> = ({
  platform,
  onSuccess,
  onCancel,
}) => {
  const [credentials, setCredentials] = useState<Record<string, string>>({});
  const [connectionName, setConnectionName] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const { toast } = useToast();

  const platformConfig = {
    shopify: {
      title: 'Connect Shopify',
      description: 'Connect your Shopify store to sync customer and order data.',
      fields: [
        { key: 'shop_domain', label: 'Shop Domain', placeholder: 'your-shop.myshopify.com', type: 'text' },
        { key: 'access_token', label: 'Private App Access Token', placeholder: 'shpat_...', type: 'password' },
      ],
      helpLink: 'https://help.shopify.com/en/manual/apps/private-apps',
      helpText: 'Create a private app in your Shopify admin to get the access token.',
    },
    square: {
      title: 'Connect Square',
      description: 'Connect your Square POS to sync customer and transaction data.',
      fields: [
        { key: 'application_id', label: 'Application ID', placeholder: 'sandbox-sq0idb-...', type: 'text' },
        { key: 'access_token', label: 'Access Token', placeholder: 'EAAAEOurQbdhG8Q...', type: 'password' },
        { key: 'environment', label: 'Environment', placeholder: 'sandbox or production', type: 'text' },
      ],
      helpLink: 'https://developer.squareup.com/docs/build-basics/access-tokens',
      helpText: 'Get your application credentials from the Square Developer Dashboard.',
    },
  };

  const config = platformConfig[platform as keyof typeof platformConfig];

  const handleConnect = async () => {
    if (!connectionName.trim()) {
      toast({
        title: "Connection Name Required",
        description: "Please enter a name for this connection.",
        variant: "destructive",
      });
      return;
    }

    // Validate required fields
    const missingFields = config.fields.filter(field => !credentials[field.key]?.trim());
    if (missingFields.length > 0) {
      toast({
        title: "Missing Credentials",
        description: `Please fill in: ${missingFields.map(f => f.label).join(', ')}`,
        variant: "destructive",
      });
      return;
    }

    setIsConnecting(true);
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // Create POS connection
      const { data, error } = await supabase
        .from('pos_connections')
        .insert({
          name: connectionName,
          platform,
          credentials_encrypted: JSON.stringify(credentials), // In production, this should be encrypted
          settings: {},
          is_active: true,
          user_id: user.id,
        })
        .select()
        .single();

      if (error) throw error;

      // Test the connection
      const { error: testError } = await supabase.functions.invoke(`${platform}-sync`, {
        body: { 
          connection_id: data.id,
          test_only: true 
        }
      });

      if (testError) {
        // Delete the connection if test fails
        await supabase.from('pos_connections').delete().eq('id', data.id);
        throw new Error(`Connection test failed: ${testError.message}`);
      }

      onSuccess();
    } catch (error) {
      console.error('Connection error:', error);
      toast({
        title: "Connection Failed",
        description: error instanceof Error ? error.message : "Failed to connect to POS system.",
        variant: "destructive",
      });
    } finally {
      setIsConnecting(false);
    }
  };

  if (!config) return null;

  return (
    <Dialog open={true} onOpenChange={onCancel}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Store className="h-5 w-5" />
            {config.title}
          </DialogTitle>
          <DialogDescription>
            {config.description}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Connection Name */}
          <div className="space-y-2">
            <Label htmlFor="connection-name">Connection Name</Label>
            <Input
              id="connection-name"
              placeholder="My Store Connection"
              value={connectionName}
              onChange={(e) => setConnectionName(e.target.value)}
            />
          </div>

          {/* Platform Credentials */}
          {config.fields.map((field) => (
            <div key={field.key} className="space-y-2">
              <Label htmlFor={field.key}>
                {field.label}
                {field.type === 'password' && <Key className="inline h-3 w-3 ml-1" />}
              </Label>
              <Input
                id={field.key}
                type={field.type}
                placeholder={field.placeholder}
                value={credentials[field.key] || ''}
                onChange={(e) => setCredentials(prev => ({
                  ...prev,
                  [field.key]: e.target.value
                }))}
              />
            </div>
          ))}

          {/* Help Card */}
          <Card className="bg-muted/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Need Help?</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <CardDescription className="text-xs">
                {config.helpText}
              </CardDescription>
              <Button variant="outline" size="sm" asChild>
                <a href={config.helpLink} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1">
                  <ExternalLink className="h-3 w-3" />
                  View Documentation
                </a>
              </Button>
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <Button variant="outline" onClick={onCancel} className="flex-1">
              Cancel
            </Button>
            <Button 
              onClick={handleConnect} 
              disabled={isConnecting}
              className="flex-1"
            >
              {isConnecting ? 'Connecting...' : 'Connect'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};