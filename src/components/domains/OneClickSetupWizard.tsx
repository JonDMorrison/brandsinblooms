import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Check, Clock, AlertCircle, Zap, Globe, Mail, Layers, Settings } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useMutation, useQuery } from '@tanstack/react-query';

interface OneClickSetupWizardProps {
  isOpen: boolean;
  onClose: () => void;
  domain: string;
  tenantId: string;
}

type SetupType = 'landing_page' | 'email_auth' | 'full_app' | 'custom';

interface SetupOption {
  id: SetupType;
  title: string;
  description: string;
  icon: React.ReactNode;
  features: string[];
  recordCount: number;
}

const SETUP_OPTIONS: SetupOption[] = [
  {
    id: 'landing_page',
    title: 'Landing Page',
    description: 'Basic website hosting with CDN',
    icon: <Globe className="h-5 w-5" />,
    features: ['A records for web hosting', 'WWW subdomain redirect', 'CDN-optimized'],
    recordCount: 5,
  },
  {
    id: 'email_auth',
    title: 'Email Authentication',
    description: 'Send transactional emails',
    icon: <Mail className="h-5 w-5" />,
    features: ['SPF record for email auth', 'DKIM signature', 'DMARC policy'],
    recordCount: 3,
  },
  {
    id: 'full_app',
    title: 'Full Application',
    description: 'Complete web app with email',
    icon: <Layers className="h-5 w-5" />,
    features: ['Web hosting + Email auth', 'API subdomain', 'Complete setup'],
    recordCount: 8,
  },
  {
    id: 'custom',
    title: 'Custom Setup',
    description: 'Configure your own DNS records',
    icon: <Settings className="h-5 w-5" />,
    features: ['Manual record configuration', 'Custom requirements', 'Advanced users'],
    recordCount: 0,
  },
];

export const OneClickSetupWizard: React.FC<OneClickSetupWizardProps> = ({
  isOpen,
  onClose,
  domain,
  tenantId,
}) => {
  const { toast } = useToast();
  const [selectedSetup, setSelectedSetup] = useState<SetupType>('landing_page');
  const [setupProgress, setSetupProgress] = useState<{
    isRunning: boolean;
    progress: number;
    results?: any;
    sessionId?: string;
  }>({ isRunning: false, progress: 0 });

  // Fetch available integrations
  const { data: integrations = [] } = useQuery({
    queryKey: ['domain-provider-integrations', tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('domain_provider_integrations')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('is_active', true);

      if (error) throw error;
      return data;
    },
    enabled: !!tenantId && isOpen,
  });

  // Run setup mutation
  const runSetupMutation = useMutation({
    mutationFn: async (setupType: SetupType) => {
      const { data, error } = await supabase.functions.invoke('one-click-setup', {
        body: {
          domain,
          setupType,
          integrationId: integrations[0]?.id,
        }
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      setSetupProgress({
        isRunning: false,
        progress: data.summary.progress,
        results: data.results,
        sessionId: data.sessionId,
      });

      if (data.summary.progress === 100) {
        toast({
          title: 'Setup Complete!',
          description: `Successfully configured ${data.summary.success} DNS records for ${domain}`,
        });
      } else {
        toast({
          title: 'Setup Partially Complete',
          description: `${data.summary.success}/${data.summary.total} records configured. Check results for details.`,
          variant: 'destructive',
        });
      }
    },
    onError: (error: any) => {
      setSetupProgress({
        isRunning: false,
        progress: 0,
      });
      
      toast({
        title: 'Setup Failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const handleRunSetup = async () => {
    if (integrations.length === 0) {
      toast({
        title: 'No DNS Provider Connected',
        description: 'Please connect a DNS provider first in the DNS Providers tab.',
        variant: 'destructive',
      });
      return;
    }

    setSetupProgress({ isRunning: true, progress: 0 });
    runSetupMutation.mutate(selectedSetup);
  };

  const handleClose = () => {
    if (!setupProgress.isRunning) {
      onClose();
      setSetupProgress({ isRunning: false, progress: 0 });
    }
  };

  if (integrations.length === 0 && isOpen) {
    return (
      <Dialog open={isOpen} onOpenChange={handleClose}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-amber-500" />
              DNS Provider Required
            </DialogTitle>
            <DialogDescription>
              You need to connect a DNS provider before using one-click setup.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Go to the "DNS Providers" tab to connect Cloudflare, Route53, or another supported provider.
            </p>
            
            <div className="flex gap-2">
              <Button onClick={handleClose} className="flex-1">
                Connect Provider
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" />
            One-Click DNS Setup
          </DialogTitle>
          <DialogDescription>
            Automatically configure DNS records for {domain} based on your needs
          </DialogDescription>
        </DialogHeader>

        {setupProgress.isRunning ? (
          <div className="space-y-6">
            <div className="text-center space-y-2">
              <Clock className="h-12 w-12 text-primary mx-auto animate-spin" />
              <h3 className="text-lg font-semibold">Setting up DNS records...</h3>
              <p className="text-sm text-muted-foreground">
                This may take a few moments while we configure your domain
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Configuration Progress</span>
                <span>{setupProgress.progress}%</span>
              </div>
              <Progress value={setupProgress.progress} className="h-2" />
            </div>
          </div>
        ) : setupProgress.results ? (
          <div className="space-y-4">
            <div className="text-center space-y-2">
              <div className={`h-12 w-12 mx-auto rounded-full flex items-center justify-center ${
                setupProgress.progress === 100 ? 'bg-green-100 text-green-600' : 'bg-amber-100 text-amber-600'
              }`}>
                {setupProgress.progress === 100 ? (
                  <Check className="h-6 w-6" />
                ) : (
                  <AlertCircle className="h-6 w-6" />
                )}
              </div>
              <h3 className="text-lg font-semibold">
                {setupProgress.progress === 100 ? 'Setup Complete!' : 'Setup Partially Complete'}
              </h3>
            </div>

            <div className="space-y-2 max-h-48 overflow-y-auto">
              {setupProgress.results.map((result: any, index: number) => (
                <div key={index} className="flex items-center gap-3 p-3 rounded-lg border">
                  <div className={`w-2 h-2 rounded-full ${
                    result.success ? 'bg-green-500' : 'bg-red-500'
                  }`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        {result.record.type}
                      </Badge>
                      <span className="font-mono text-sm truncate">
                        {result.record.name}
                      </span>
                    </div>
                    {result.error && (
                      <p className="text-xs text-red-600 mt-1">{result.error}</p>
                    )}
                  </div>
                  {result.success ? (
                    <Check className="h-4 w-4 text-green-500 flex-shrink-0" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
                  )}
                </div>
              ))}
            </div>

            <Button onClick={handleClose} className="w-full">
              Done
            </Button>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="space-y-4">
              <h3 className="font-semibold">Choose Setup Type</h3>
              
              <RadioGroup 
                value={selectedSetup} 
                onValueChange={(value) => setSelectedSetup(value as SetupType)}
              >
                <div className="grid gap-3">
                  {SETUP_OPTIONS.map((option) => (
                    <div key={option.id}>
                      <Label
                        htmlFor={option.id}
                        className="flex cursor-pointer"
                      >
                        <RadioGroupItem value={option.id} id={option.id} className="mt-1" />
                        <Card className="flex-1 ml-3 hover:bg-muted/50 transition-colors">
                          <CardContent className="p-4">
                            <div className="flex items-start gap-3">
                              <div className="mt-1 text-primary">
                                {option.icon}
                              </div>
                              
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <h4 className="font-semibold">{option.title}</h4>
                                  <Badge variant="secondary" className="text-xs">
                                    {option.recordCount > 0 ? `${option.recordCount} records` : 'Custom'}
                                  </Badge>
                                </div>
                                
                                <p className="text-sm text-muted-foreground mb-2">
                                  {option.description}
                                </p>
                                
                                <div className="space-y-1">
                                  {option.features.map((feature, index) => (
                                    <div key={index} className="flex items-center gap-2 text-xs text-muted-foreground">
                                      <div className="w-1 h-1 rounded-full bg-current" />
                                      {feature}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      </Label>
                    </div>
                  ))}
                </div>
              </RadioGroup>
            </div>

            <div className="flex items-center justify-between p-4 rounded-lg border bg-blue-50 dark:bg-blue-950/20">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-green-500" />
                <span className="text-sm font-medium">
                  {integrations[0]?.provider_type} Connected
                </span>
              </div>
              <Badge variant="outline">Ready</Badge>
            </div>

            <div className="flex gap-2">
              <Button onClick={handleClose} variant="outline" className="flex-1">
                Cancel
              </Button>
              <Button 
                onClick={handleRunSetup} 
                className="flex-1"
                disabled={selectedSetup === 'custom'}
              >
                <Zap className="h-4 w-4 mr-2" />
                Start Setup
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};