import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ExternalLink, Shield, Zap } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useMutation } from '@tanstack/react-query';

interface OAuthProviderCardProps {
  provider: {
    id: string;
    name: string;
    description: string;
    icon: React.ReactNode;
    supported: boolean;
    oauthAvailable: boolean;
  };
  tenantId: string;
  onSuccess?: (integrationId: string) => void;
}

export const OAuthProviderCard: React.FC<OAuthProviderCardProps> = ({
  provider,
  tenantId,
  onSuccess,
}) => {
  const { toast } = useToast();

  const oauthMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('cloudflare-oauth', {
        body: {
          action: 'authorize',
          tenantId,
        }
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      // Redirect to OAuth provider
      window.location.href = data.authUrl;
    },
    onError: (error: any) => {
      toast({
        title: 'OAuth Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const handleOAuthConnect = () => {
    if (provider.id === 'cloudflare') {
      oauthMutation.mutate();
    } else {
      toast({
        title: 'Coming Soon',
        description: `OAuth for ${provider.name} is not available yet.`,
      });
    }
  };

  return (
    <Card className={`transition-all duration-200 ${
      provider.supported ? 'hover:shadow-md' : 'opacity-60'
    }`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="text-primary">
              {provider.icon}
            </div>
            <div>
              <CardTitle className="text-lg">{provider.name}</CardTitle>
              <CardDescription className="text-sm">
                {provider.description}
              </CardDescription>
            </div>
          </div>
          
          <div className="flex flex-col gap-1">
            {provider.supported && (
              <Badge variant="secondary" className="text-xs">
                Supported
              </Badge>
            )}
            {provider.oauthAvailable && (
              <Badge variant="outline" className="text-xs">
                <Shield className="h-3 w-3 mr-1" />
                OAuth
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Zap className="h-4 w-4" />
          <span>One-click DNS record management</span>
        </div>

        {provider.supported ? (
          <div className="space-y-2">
            {provider.oauthAvailable ? (
              <Button
                onClick={handleOAuthConnect}
                className="w-full"
                disabled={oauthMutation.isPending}
              >
                <Shield className="h-4 w-4 mr-2" />
                {oauthMutation.isPending ? 'Connecting...' : `Connect with ${provider.name}`}
              </Button>
            ) : (
              <Button
                variant="outline"
                className="w-full"
                disabled
              >
                Manual Setup Only
              </Button>
            )}
            
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-xs"
              asChild
            >
              <a
                href={getProviderDocsUrl(provider.id)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1"
              >
                <ExternalLink className="h-3 w-3" />
                Setup Guide
              </a>
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            <Button variant="outline" className="w-full" disabled>
              Coming Soon
            </Button>
            <p className="text-xs text-muted-foreground text-center">
              This provider will be supported in a future update
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

function getProviderDocsUrl(providerId: string): string {
  const urls: Record<string, string> = {
    cloudflare: 'https://developers.cloudflare.com/fundamentals/api/get-started/',
    route53: 'https://docs.aws.amazon.com/Route53/latest/DeveloperGuide/getting-started.html',
    digitalocean: 'https://docs.digitalocean.com/reference/api/create-personal-access-token/',
    namecheap: 'https://www.namecheap.com/support/api/',
    godaddy: 'https://developer.godaddy.com/getstarted',
  };
  
  return urls[providerId] || '#';
}