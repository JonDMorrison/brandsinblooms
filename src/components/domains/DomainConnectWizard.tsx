import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { CheckCircle, ExternalLink, AlertCircle, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface DomainConnectWizardProps {
  domain: string;
  onComplete?: () => void;
}

interface Step {
  id: string;
  title: string;
  description: string;
  status: 'pending' | 'in-progress' | 'completed' | 'error';
}

export const DomainConnectWizard: React.FC<DomainConnectWizardProps> = ({ 
  domain, 
  onComplete 
}) => {
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState(0);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const [steps, setSteps] = useState<Step[]>([
    {
      id: 'detect',
      title: 'Detect Registrar',
      description: 'Checking if your registrar supports Domain Connect',
      status: 'pending'
    },
    {
      id: 'setup',
      title: 'Setup DNS Records',
      description: 'Configuring DNS records automatically',
      status: 'pending'
    },
    {
      id: 'verify',
      title: 'Verify Configuration',
      description: 'Confirming DNS propagation and TLS certificate',
      status: 'pending'
    }
  ]);

  const updateStepStatus = (stepId: string, status: Step['status']) => {
    setSteps(prev => prev.map(step => 
      step.id === stepId ? { ...step, status } : step
    ));
  };

  const startDomainConnect = async () => {
    setIsProcessing(true);
    
    try {
      // Step 1: Detect registrar and check Domain Connect support
      updateStepStatus('detect', 'in-progress');
      setCurrentStep(0);

      const { data, error } = await supabase.functions.invoke('domain-connect', {
        body: {
          domain,
          templateId: 'landing_page',
          params: {
            host: '@',
            target: 'pages.bloomsuite.app'
          }
        }
      });

      if (error) throw error;

      if (!data.success) {
        updateStepStatus('detect', 'error');
        
        // Fallback to manual setup
        toast({
          title: 'Domain Connect Not Supported',
          description: data.error || 'Manual DNS setup required.',
          variant: 'destructive',
        });
        return;
      }

      updateStepStatus('detect', 'completed');
      setSessionToken(data.sessionToken);

      // Step 2: Redirect to Domain Connect
      if (data.redirectUrl) {
        updateStepStatus('setup', 'in-progress');
        setCurrentStep(1);

        // Open Domain Connect URL
        const connectWindow = window.open(
          data.redirectUrl, 
          'domain-connect',
          'width=800,height=600,scrollbars=yes,resizable=yes'
        );

        // Poll for completion
        const pollInterval = setInterval(async () => {
          try {
            const { data: statusData, error: statusError } = await supabase.functions.invoke(
              'domain-connect',
              {
                body: { method: 'GET' },
                headers: { 'X-Session-Token': data.sessionToken }
              }
            );

            if (statusError) throw statusError;

            if (statusData.status === 'completed') {
              clearInterval(pollInterval);
              connectWindow?.close();
              
              updateStepStatus('setup', 'completed');
              
              // Step 3: Verify configuration
              await verifyConfiguration();
            } else if (statusData.status === 'failed') {
              clearInterval(pollInterval);
              connectWindow?.close();
              updateStepStatus('setup', 'error');
            }

          } catch (error) {
            console.error('Polling error:', error);
          }
        }, 3000);

        // Stop polling after 10 minutes
        setTimeout(() => {
          clearInterval(pollInterval);
          connectWindow?.close();
        }, 600000);
      }

    } catch (error: any) {
      console.error('Domain Connect error:', error);
      updateStepStatus(steps[currentStep]?.id || 'detect', 'error');
      
      toast({
        title: 'Setup Failed',
        description: error.message || 'Failed to setup domain connection.',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const verifyConfiguration = async () => {
    updateStepStatus('verify', 'in-progress');
    setCurrentStep(2);

    try {
      // Trigger health check
      const { data, error } = await supabase.functions.invoke('domain-health-check', {
        body: {
          domain,
          checkTypes: ['dns', 'tls', 'http']
        }
      });

      if (error) throw error;

      const allHealthy = Object.values(data.results.checks).every(
        (check: any) => check.status === 'healthy'
      );

      if (allHealthy) {
        updateStepStatus('verify', 'completed');
        toast({
          title: 'Domain Setup Complete!',
          description: 'Your domain is ready to use.',
        });
        onComplete?.();
      } else {
        updateStepStatus('verify', 'error');
        toast({
          title: 'Verification Issues',
          description: 'Some checks failed. DNS may need more time to propagate.',
          variant: 'destructive',
        });
      }

    } catch (error: any) {
      updateStepStatus('verify', 'error');
      toast({
        title: 'Verification Failed',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const getStepIcon = (status: Step['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'in-progress':
        return <Loader2 className="h-5 w-5 animate-spin text-blue-500" />;
      case 'error':
        return <AlertCircle className="h-5 w-5 text-red-500" />;
      default:
        return <div className="h-5 w-5 rounded-full border-2 border-gray-300" />;
    }
  };

  const progressPercentage = (steps.filter(s => s.status === 'completed').length / steps.length) * 100;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          One-Click Domain Setup
          <Badge variant="secondary">Domain Connect</Badge>
        </CardTitle>
        <CardDescription>
          Automatically configure DNS records with your registrar
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Progress Bar */}
        <div>
          <div className="flex justify-between text-sm mb-2">
            <span>Setup Progress</span>
            <span>{Math.round(progressPercentage)}%</span>
          </div>
          <Progress value={progressPercentage} className="w-full" />
        </div>

        {/* Steps */}
        <div className="space-y-4">
          {steps.map((step, index) => (
            <div 
              key={step.id} 
              className={`flex items-start gap-3 p-3 rounded-lg border ${
                step.status === 'in-progress' ? 'bg-blue-50 border-blue-200' :
                step.status === 'completed' ? 'bg-green-50 border-green-200' :
                step.status === 'error' ? 'bg-red-50 border-red-200' :
                'bg-gray-50 border-gray-200'
              }`}
            >
              {getStepIcon(step.status)}
              <div className="flex-1">
                <h4 className="font-medium">{step.title}</h4>
                <p className="text-sm text-muted-foreground">{step.description}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Action Button */}
        <div className="flex gap-2">
          <Button 
            onClick={startDomainConnect}
            disabled={isProcessing || steps[0].status === 'completed'}
            className="flex-1"
          >
            {isProcessing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Setting up...
              </>
            ) : (
              'Start Automatic Setup'
            )}
          </Button>
          
          <Button variant="outline" asChild>
            <a 
              href="https://domainconnect.org/supported-providers/" 
              target="_blank" 
              rel="noopener noreferrer"
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              Supported Registrars
            </a>
          </Button>
        </div>

        {/* Help Text */}
        <div className="text-sm text-muted-foreground">
          <p className="mb-2">
            <strong>What is Domain Connect?</strong> It's a standard that allows automatic DNS configuration 
            with supported registrars like GoDaddy, Namecheap, and Google Domains.
          </p>
          <p>
            If your registrar doesn't support Domain Connect, you'll need to manually add the DNS records.
          </p>
        </div>
      </CardContent>
    </Card>
  );
};