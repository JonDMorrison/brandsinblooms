import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, RefreshCw, Loader2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import mailchimpLogo from "@/assets/logos/mailchimp-new.png";
import klaviyoLogo from "@/assets/logos/klaviyo.jpeg";
import constantContactLogo from "@/assets/logos/constant-contact.svg";
import { MailchimpStatusBadge } from "@/components/integrations/MailchimpStatusBadge";

export default function CRMIntegrationsPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  // IMPROVEMENT: Track provider connection status for Reconnect button
  const [connectionStatus, setConnectionStatus] = useState<Record<string, { status: string; metadata?: any }>>({});
  const [reconnecting, setReconnecting] = useState<string | null>(null);
  const popupRef = useRef<Window | null>(null);

  useEffect(() => {
    loadConnectionStatus();
  }, []);

  const loadConnectionStatus = async () => {
    try {
      const { data: connections } = await supabase
        .from('provider_connections')
        .select('provider, status, metadata')
        .in('provider', ['mailchimp', 'klaviyo', 'constant_contact']);
      if (connections) {
        const map: Record<string, { status: string; metadata?: any }> = {};
        for (const c of connections) {
          map[c.provider] = { status: c.status, metadata: c.metadata };
        }
        setConnectionStatus(map);
      }
    } catch (e) {
      console.error('Failed to load connection status:', e);
    }
  };

  // IMPROVEMENT: Reconnect button triggers OAuth popup directly without full wizard
  const handleReconnect = async (providerId: string) => {
    setReconnecting(providerId);
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.refreshSession();
      if (sessionError || !session) throw new Error('Session expired. Please refresh and log in again.');

      const { data, error } = await supabase.functions.invoke('oauth-authorize', {
        body: { provider: providerId }
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.message || 'OAuth configuration needed');

      const authUrl = data.authUrl;
      if (!authUrl) throw new Error('Failed to get authorization URL');

      const width = 520, height = 720;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2;
      popupRef.current = window.open(authUrl, `oauth_${providerId}`, `width=${width},height=${height},left=${left},top=${top}`);

      // Listen for postMessage from popup
      const onMsg = (e: MessageEvent) => {
        if (e.origin !== window.location.origin) return;
        const { type, provider } = e.data || {};
        if (provider !== providerId) return;
        window.removeEventListener('message', onMsg);
        setReconnecting(null);
        if (type === 'oauth-success') {
          toast({ title: 'Reconnected!', description: `${providerId} reconnected successfully` });
          loadConnectionStatus();
        } else if (type === 'oauth-error') {
          toast({ title: 'Reconnection Failed', description: e.data?.error || 'Failed', variant: 'destructive' });
        }
      };
      window.addEventListener('message', onMsg);

      // Monitor popup closure
      const interval = setInterval(() => {
        if (popupRef.current?.closed) {
          clearInterval(interval);
          setTimeout(() => {
            if (reconnecting === providerId) {
              setReconnecting(null);
              loadConnectionStatus();
            }
            window.removeEventListener('message', onMsg);
          }, 1500);
        }
      }, 500);
    } catch (error: any) {
      toast({ title: 'Reconnect Error', description: error.message, variant: 'destructive' });
      setReconnecting(null);
    }
  };

  const providers = [
    {
      id: "mailchimp",
      name: "Mailchimp",
      description: "Import contacts, segments, and tags from Mailchimp",
      logo: mailchimpLogo,
      hasStatusBadge: true,
    },
    {
      id: "klaviyo",
      name: "Klaviyo",
      description: "Import contacts, segments, and lists from Klaviyo",
      logo: klaviyoLogo,
      hasStatusBadge: false,
    },
    {
      id: "constant_contact",
      name: "Constant Contact",
      description: "Import contacts and lists from Constant Contact",
      logo: constantContactLogo,
      hasStatusBadge: false,
    },
  ];

  const handleStartMigration = (provider: string) => {
    if (provider === "mailchimp") {
      navigate("/integrations/mailchimp");
      return;
    }

    navigate(`/integrations/migrations?provider=${provider}`);
  };

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <Link
        to="/integrations"
        className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Integrations
      </Link>

      <div>
        <h1 className="text-2xl font-bold">Import Contacts</h1>
        <p className="text-muted-foreground">
          One-time import from your email marketing platform
        </p>
      </div>

      <div className="grid gap-4">
        {providers.map((provider) => (
          <Card
            key={provider.id}
            className="bg-card border border-border rounded-xl"
          >
            <CardContent className="p-4">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center overflow-hidden flex-shrink-0">
                  <img
                    src={provider.logo}
                    alt={`${provider.name} logo`}
                    className="w-8 h-8 object-contain"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold">{provider.name}</h3>
                  <p className="text-sm text-muted-foreground">
                    {provider.description}
                  </p>

                  {provider.hasStatusBadge && provider.id === "mailchimp" && (
                    <div className="mt-2">
                      <MailchimpStatusBadge
                        onRetry={() => handleStartMigration(provider.id)}
                      />
                    </div>
                  )}
                </div>
                {/* IMPROVEMENT: Show Reconnect button when provider_connection exists but not connected */}
                {connectionStatus[provider.id] && connectionStatus[provider.id].status !== 'connected' ? (
                  <Button
                    onClick={() => handleReconnect(provider.id)}
                    disabled={reconnecting === provider.id}
                    variant="outline"
                    className="flex-shrink-0"
                  >
                    {reconnecting === provider.id && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    Reconnect
                  </Button>
                ) : (
                  <Button
                    onClick={() => handleStartMigration(provider.id)}
                    className="flex-shrink-0"
                  >
                    Import
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <p className="text-xs text-muted-foreground text-center">
        Includes contacts, consent status, tags, and segments with AI-powered
        field mapping
      </p>
    </div>
  );
}
