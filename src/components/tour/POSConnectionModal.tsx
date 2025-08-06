import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ShoppingCart, CreditCard, Upload, Check, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useQuickTour } from '@/contexts/QuickTourContext';

interface POSConnectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

type Platform = 'shopify' | 'square' | 'csv';

interface PlatformConfig {
  title: string;
  description: string;
  icon: React.ReactNode;
  fields: {
    key: string;
    label: string;
    type: string;
    placeholder: string;
  }[];
}

const platformConfigs: Record<Platform, PlatformConfig> = {
  shopify: {
    title: 'Shopify',
    description: 'Connect your Shopify store to sync customers and orders automatically.',
    icon: <ShoppingCart className="h-6 w-6" />,
    fields: [
      {
        key: 'store_url',
        label: 'Store URL',
        type: 'text',
        placeholder: 'your-store.myshopify.com',
      },
      {
        key: 'access_token',
        label: 'Access Token',
        type: 'password',
        placeholder: 'shppa_xxxxxxxxxxxxxxxxxx',
      },
    ],
  },
  square: {
    title: 'Square',
    description: 'Link your Square account for seamless customer and transaction sync.',
    icon: <CreditCard className="h-6 w-6" />,
    fields: [
      {
        key: 'application_id',
        label: 'Application ID',
        type: 'text',
        placeholder: 'sq0idp-xxxxxxxxxx',
      },
      {
        key: 'access_token',
        label: 'Access Token',
        type: 'password',
        placeholder: 'EAAAxxxxxxxxxxxxxxxxxx',
      },
    ],
  },
  csv: {
    title: 'CSV Import',
    description: 'Upload customer data from your existing system via CSV file.',
    icon: <Upload className="h-6 w-6" />,
    fields: [
      {
        key: 'file',
        label: 'CSV File',
        type: 'file',
        placeholder: 'Select CSV file...',
      },
    ],
  },
};

export function POSConnectionModal({ isOpen, onClose, onSuccess }: POSConnectionModalProps) {
  const { user } = useAuth();
  const { nextStep } = useQuickTour();
  const { toast } = useToast();
  const [selectedPlatform, setSelectedPlatform] = useState<Platform>('shopify');
  const [connectionName, setConnectionName] = useState('');
  const [credentials, setCredentials] = useState<Record<string, string>>({});
  const [isConnecting, setIsConnecting] = useState(false);

  const handleConnect = async () => {
    if (!user) {
      toast({
        title: "Authentication required",
        description: "Please log in to connect your POS system.",
        variant: "destructive",
      });
      return;
    }

    if (!connectionName.trim()) {
      toast({
        title: "Connection name required",
        description: "Please enter a name for this connection.",
        variant: "destructive",
      });
      return;
    }

    const config = platformConfigs[selectedPlatform];
    const missingFields = config.fields.filter(field => !credentials[field.key]?.trim());
    
    if (missingFields.length > 0) {
      toast({
        title: "Missing credentials",
        description: `Please fill in: ${missingFields.map(f => f.label).join(', ')}`,
        variant: "destructive",
      });
      return;
    }

    setIsConnecting(true);

    try {
      // Insert POS connection
      const { data: connection, error: insertError } = await supabase
        .from('pos_connections')
        .insert({
          user_id: user.id,
          platform: selectedPlatform,
          name: connectionName.trim(),
          credentials: credentials,
          is_active: true,
        })
        .select()
        .single();

      if (insertError) {
        throw insertError;
      }

      // Test the connection (this would call a Supabase function in real implementation)
      console.log('Testing POS connection...', connection);
      
      // Simulate API test delay
      await new Promise(resolve => setTimeout(resolve, 2000));

      toast({
        title: "Successfully connected!",
        description: `Your ${config.title} integration is now active.`,
      });

      // Reset form
      setConnectionName('');
      setCredentials({});
      
      // Move to next tour step
      nextStep();
      onSuccess();

    } catch (error: any) {
      console.error('Error connecting POS:', error);
      toast({
        title: "Connection failed",
        description: error.message || "Please check your credentials and try again.",
        variant: "destructive",
      });
    } finally {
      setIsConnecting(false);
    }
  };

  const handleCredentialChange = (key: string, value: string) => {
    setCredentials(prev => ({ ...prev, [key]: value }));
  };

  const selectedConfig = platformConfigs[selectedPlatform];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Connect Your POS System</DialogTitle>
          <DialogDescription>
            Choose your platform to get started with automatic customer and order sync.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Connection Name */}
          <div className="space-y-2">
            <Label htmlFor="connection-name">Connection Name</Label>
            <Input
              id="connection-name"
              placeholder="e.g., Main Store"
              value={connectionName}
              onChange={(e) => setConnectionName(e.target.value)}
            />
          </div>

          {/* Platform Selection */}
          <Tabs value={selectedPlatform} onValueChange={(value) => setSelectedPlatform(value as Platform)}>
            <TabsList className="grid w-full grid-cols-3">
              {Object.entries(platformConfigs).map(([key, config]) => (
                <TabsTrigger key={key} value={key} className="flex items-center gap-2">
                  {config.icon}
                  {config.title}
                </TabsTrigger>
              ))}
            </TabsList>

            {Object.entries(platformConfigs).map(([key, config]) => (
              <TabsContent key={key} value={key}>
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      {config.icon}
                      {config.title}
                    </CardTitle>
                    <CardDescription>{config.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {config.fields.map((field) => (
                      <div key={field.key} className="space-y-2">
                        <Label htmlFor={field.key}>{field.label}</Label>
                        <Input
                          id={field.key}
                          type={field.type}
                          placeholder={field.placeholder}
                          value={credentials[field.key] || ''}
                          onChange={(e) => handleCredentialChange(field.key, e.target.value)}
                        />
                      </div>
                    ))}
                    
                    {key !== 'csv' && (
                      <div className="mt-4 p-3 bg-muted rounded-lg">
                        <p className="text-sm text-muted-foreground">
                          Need help? Check our{' '}
                          <a
                            href={`https://docs.example.com/pos/${key}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline"
                          >
                            {config.title} integration guide
                          </a>
                          {' '}for setup instructions.
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            ))}
          </Tabs>

          {/* Actions */}
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={onClose} disabled={isConnecting}>
              Cancel
            </Button>
            <Button onClick={handleConnect} disabled={isConnecting}>
              {isConnecting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Connecting...
                </>
              ) : (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  Connect
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}