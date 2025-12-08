import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Zap, Webhook, Smartphone, Plus } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

export default function AutomationsIntegrationsPage() {
  const { toast } = useToast();

  const handleComingSoon = (name: string) => {
    toast({
      title: "Coming Soon",
      description: `${name} integration coming soon!`,
    });
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <Link 
        to="/integrations" 
        className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Integrations
      </Link>

      <div className="flex items-center gap-3">
        <div className="p-3 rounded-lg bg-primary/10 text-primary">
          <Zap className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Automations</h1>
          <p className="text-muted-foreground">
            Automate tasks and connect to thousands of apps
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Zapier */}
        <Card className="bg-card border border-border rounded-xl">
          <CardHeader className="pb-2">
            <div className="flex items-start gap-3">
              <Zap className="w-6 h-6 text-orange-600" />
              <CardTitle className="text-base">Zapier</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Connect to 6000+ apps with automated workflows
            </p>
            <Button variant="outline" className="w-full" onClick={() => handleComingSoon('Zapier')}>
              <Plus className="w-4 h-4 mr-2" />
              Connect
            </Button>
          </CardContent>
        </Card>

        {/* Custom Webhooks */}
        <Card className="bg-card border border-border rounded-xl">
          <CardHeader className="pb-2">
            <div className="flex items-start gap-3">
              <Webhook className="w-6 h-6 text-purple-600" />
              <CardTitle className="text-base">Custom Webhooks</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Create custom webhook endpoints for any integration
            </p>
            <Button variant="outline" className="w-full" onClick={() => handleComingSoon('Custom Webhooks')}>
              <Plus className="w-4 h-4 mr-2" />
              Connect
            </Button>
          </CardContent>
        </Card>

        {/* Slack */}
        <Card className="bg-card border border-border rounded-xl">
          <CardHeader className="pb-2">
            <div className="flex items-start gap-3">
              <Smartphone className="w-6 h-6 text-purple-500" />
              <CardTitle className="text-base">Slack</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Get notifications and manage content in Slack
            </p>
            <Button variant="outline" className="w-full" onClick={() => handleComingSoon('Slack')}>
              <Plus className="w-4 h-4 mr-2" />
              Connect
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
