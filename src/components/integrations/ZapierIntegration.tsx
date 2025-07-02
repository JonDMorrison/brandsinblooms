import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { 
  Zap, 
  Plus, 
  Send, 
  ExternalLink, 
  Check, 
  AlertCircle,
  Copy,
  TestTube,
  Settings
} from 'lucide-react';
import { toast } from 'sonner';

interface ZapierWebhook {
  id: string;
  name: string;
  webhookUrl: string;
  description: string;
  isActive: boolean;
  lastTriggered?: string;
  triggerCount: number;
}

export const ZapierIntegration = () => {
  const { user } = useAuth();
  const [webhooks, setWebhooks] = useState<ZapierWebhook[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [testingWebhook, setTestingWebhook] = useState<string | null>(null);
  
  // Form state
  const [webhookName, setWebhookName] = useState('');
  const [webhookUrl, setWebhookUrl] = useState('');
  const [webhookDescription, setWebhookDescription] = useState('');

  const fetchZapierWebhooks = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('user_integrations')
        .select('*')
        .eq('user_id', user.id)
        .eq('provider', 'zapier')
        .eq('is_active', true);

      if (error) throw error;

      // Transform data to webhook format
      const transformedWebhooks = (data || []).map(item => ({
        id: item.id,
        name: item.configuration?.name || 'Unnamed Webhook',
        webhookUrl: item.configuration?.webhook_url || '',
        description: item.configuration?.description || '',
        isActive: item.is_active,
        lastTriggered: item.configuration?.last_triggered,
        triggerCount: item.configuration?.trigger_count || 0
      }));

      setWebhooks(transformedWebhooks);
    } catch (error) {
      console.error('Error fetching Zapier webhooks:', error);
      toast.error('Failed to load webhooks');
    }
  };

  const handleCreateWebhook = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!webhookName || !webhookUrl) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      const configuration = {
        name: webhookName,
        webhook_url: webhookUrl,
        description: webhookDescription,
        trigger_count: 0,
        created_at: new Date().toISOString()
      };

      const { error } = await supabase
        .from('user_integrations')
        .insert({
          user_id: user?.id,
          integration_type: 'webhook',
          provider: 'zapier',
          configuration,
          is_active: true
        });

      if (error) throw error;

      toast.success('Zapier webhook created successfully!');
      setWebhookName('');
      setWebhookUrl('');
      setWebhookDescription('');
      setIsCreating(false);
      fetchZapierWebhooks();
    } catch (error) {
      console.error('Error creating webhook:', error);
      toast.error('Failed to create webhook');
    }
  };

  const handleTestWebhook = async (webhook: ZapierWebhook) => {
    setTestingWebhook(webhook.id);

    try {
      const testPayload = {
        timestamp: new Date().toISOString(),
        triggered_from: window.location.origin,
        event_type: 'test',
        user_id: user?.id,
        test_data: {
          content_generated: 1,
          post_type: 'facebook',
          message: 'This is a test trigger from BloomSuite'
        }
      };

      const response = await fetch(webhook.webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        mode: 'no-cors',
        body: JSON.stringify(testPayload),
      });

      // Update trigger count
      await supabase
        .from('user_integrations')
        .update({
          configuration: {
            ...webhooks.find(w => w.id === webhook.id),
            trigger_count: webhook.triggerCount + 1,
            last_triggered: new Date().toISOString()
          }
        })
        .eq('id', webhook.id);

      toast.success('Test webhook sent! Check your Zap history to confirm it was received.');
      fetchZapierWebhooks();
    } catch (error) {
      console.error('Error testing webhook:', error);
      toast.error('Failed to test webhook. Please check the URL and try again.');
    } finally {
      setTestingWebhook(null);
    }
  };

  const handleDeleteWebhook = async (webhookId: string) => {
    try {
      const { error } = await supabase
        .from('user_integrations')
        .update({ is_active: false })
        .eq('id', webhookId);

      if (error) throw error;

      toast.success('Webhook deleted successfully');
      fetchZapierWebhooks();
    } catch (error) {
      console.error('Error deleting webhook:', error);
      toast.error('Failed to delete webhook');
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  useEffect(() => {
    fetchZapierWebhooks();
  }, [user]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <div className="flex items-center justify-center gap-3 mb-4">
          <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
            <Zap className="w-6 h-6 text-orange-600" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900">Zapier Integration</h1>
        </div>
        <p className="text-gray-600 max-w-2xl mx-auto">
          Connect BloomSuite to 6000+ apps with Zapier. Create automated workflows 
          that trigger when you generate content, publish posts, or reach milestones.
        </p>
      </div>

      {/* Setup Instructions */}
      <Card className="bg-blue-50 border-blue-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-blue-900">
            <AlertCircle className="w-5 h-5" />
            How to Set Up Zapier Integration
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="space-y-2 text-sm text-blue-800">
            <li className="flex items-start gap-2">
              <span className="font-semibold">1.</span>
              Go to <a href="https://zapier.com" target="_blank" rel="noopener noreferrer" 
                className="text-blue-600 hover:underline inline-flex items-center gap-1">
                Zapier.com <ExternalLink className="w-3 h-3" />
              </a> and create a new Zap
            </li>
            <li className="flex items-start gap-2">
              <span className="font-semibold">2.</span>
              Choose "Webhooks by Zapier" as your trigger app
            </li>
            <li className="flex items-start gap-2">
              <span className="font-semibold">3.</span>
              Select "Catch Hook" as the trigger event
            </li>
            <li className="flex items-start gap-2">
              <span className="font-semibold">4.</span>
              Copy the webhook URL provided by Zapier and paste it below
            </li>
            <li className="flex items-start gap-2">
              <span className="font-semibold">5.</span>
              Choose your action app (Gmail, Slack, Google Sheets, etc.)
            </li>
          </ol>
        </CardContent>
      </Card>

      {/* Create New Webhook */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Your Zapier Webhooks</CardTitle>
            <Button onClick={() => setIsCreating(!isCreating)}>
              <Plus className="w-4 h-4 mr-2" />
              Add Webhook
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isCreating && (
            <form onSubmit={handleCreateWebhook} className="space-y-4 mb-6 p-4 border rounded-lg">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="webhookName">Webhook Name *</Label>
                  <Input
                    id="webhookName"
                    value={webhookName}
                    onChange={(e) => setWebhookName(e.target.value)}
                    placeholder="e.g., Content Generated Alert"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="webhookUrl">Zapier Webhook URL *</Label>
                  <Input
                    id="webhookUrl"
                    type="url"
                    value={webhookUrl}
                    onChange={(e) => setWebhookUrl(e.target.value)}
                    placeholder="https://hooks.zapier.com/hooks/catch/..."
                    required
                  />
                </div>
              </div>
              
              <div>
                <Label htmlFor="webhookDescription">Description</Label>
                <Textarea
                  id="webhookDescription"
                  value={webhookDescription}
                  onChange={(e) => setWebhookDescription(e.target.value)}
                  placeholder="What does this webhook do?"
                  rows={2}
                />
              </div>

              <div className="flex gap-2">
                <Button type="submit">
                  <Check className="w-4 h-4 mr-2" />
                  Create Webhook
                </Button>
                <Button type="button" variant="outline" onClick={() => setIsCreating(false)}>
                  Cancel
                </Button>
              </div>
            </form>
          )}

          {/* Webhooks List */}
          <div className="space-y-4">
            {webhooks.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Zap className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No Zapier webhooks configured yet</p>
                <p className="text-sm">Create your first webhook to start automating!</p>
              </div>
            ) : (
              webhooks.map((webhook) => (
                <Card key={webhook.id} className="border">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="font-medium">{webhook.name}</h3>
                          <Badge variant={webhook.isActive ? 'default' : 'secondary'}>
                            {webhook.isActive ? 'Active' : 'Inactive'}
                          </Badge>
                        </div>
                        
                        {webhook.description && (
                          <p className="text-sm text-gray-600 mb-2">{webhook.description}</p>
                        )}
                        
                        <div className="text-xs text-gray-500 space-y-1">
                          <div className="flex items-center gap-4">
                            <span>Triggers: {webhook.triggerCount}</span>
                            {webhook.lastTriggered && (
                              <span>
                                Last: {new Date(webhook.lastTriggered).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <code className="text-xs bg-gray-100 px-2 py-1 rounded truncate max-w-xs">
                              {webhook.webhookUrl}
                            </code>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => copyToClipboard(webhook.webhookUrl)}
                            >
                              <Copy className="w-3 h-3" />
                            </Button>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex gap-2 ml-4">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleTestWebhook(webhook)}
                          disabled={testingWebhook === webhook.id}
                        >
                          {testingWebhook === webhook.id ? (
                            'Testing...'
                          ) : (
                            <>
                              <TestTube className="w-4 h-4 mr-1" />
                              Test
                            </>
                          )}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDeleteWebhook(webhook.id)}
                        >
                          Delete
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Webhook Events Documentation */}
      <Card>
        <CardHeader>
          <CardTitle>Available Webhook Events</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 border rounded-lg">
                <h4 className="font-medium mb-2">content.generated</h4>
                <p className="text-sm text-gray-600 mb-2">
                  Triggered when new content is generated
                </p>
                <code className="text-xs bg-gray-100 p-2 block rounded">
                  {JSON.stringify({
                    event: 'content.generated',
                    content_id: 'uuid',
                    post_type: 'facebook',
                    campaign_id: 'uuid'
                  }, null, 2)}
                </code>
              </div>
              
              <div className="p-4 border rounded-lg">
                <h4 className="font-medium mb-2">content.published</h4>
                <p className="text-sm text-gray-600 mb-2">
                  Triggered when content is published to social media
                </p>
                <code className="text-xs bg-gray-100 p-2 block rounded">
                  {JSON.stringify({
                    event: 'content.published',
                    content_id: 'uuid',
                    platform: 'facebook',
                    post_url: 'https://...'
                  }, null, 2)}
                </code>
              </div>
            </div>
            
            <p className="text-sm text-gray-500">
              More webhook events coming soon! We'll automatically send data to your configured webhooks when these events occur.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};