import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { 
  Zap, 
  Plus, 
  Settings, 
  Clock, 
  Target, 
  TrendingUp, 
  Repeat,
  AlertCircle,
  Play,
  Pause,
  Trash2
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface AutomationRule {
  id: string;
  name: string;
  description: string;
  trigger: {
    type: 'time' | 'performance' | 'engagement' | 'content_generated';
    conditions: any;
  };
  actions: {
    type: 'repost' | 'generate_content' | 'send_notification' | 'webhook';
    config: any;
  }[];
  isActive: boolean;
  lastRun?: string;
  runCount: number;
  created_at: string;
}

export const AutomationRules = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [loading, setLoading] = useState(true);

  // Form state
  const [ruleName, setRuleName] = useState('');
  const [ruleDescription, setRuleDescription] = useState('');
  const [triggerType, setTriggerType] = useState<string>('');
  const [actionType, setActionType] = useState<string>('');

  const fetchAutomationRules = async () => {
    if (!user) return;

    try {
      // TODO: Replace with actual database call once migration is applied
      // For now, using empty array to prevent TypeScript errors
      setRules([]);
    } catch (error) {
      console.error('Error fetching automation rules:', error);
      toast({
        title: "Error",
        description: "Failed to load automation rules",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRule = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!ruleName || !triggerType || !actionType) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    // TODO: Replace with actual database call once migration is applied
    toast({
      title: "Coming Soon",
      description: "Automation rules will be available once database setup is complete",
    });
    setRuleName('');
    setRuleDescription('');
    setTriggerType('');
    setActionType('');
    setIsCreating(false);
  };

  const getTriggerConditions = (type: string) => {
    switch (type) {
      case 'time':
        return { schedule: 'daily', time: '09:00' };
      case 'performance':
        return { metric: 'engagement_rate', threshold: 5.0, operator: 'greater_than' };
      case 'engagement':
        return { likes_threshold: 50, timeframe: '24_hours' };
      case 'content_generated':
        return { post_type: 'any' };
      default:
        return {};
    }
  };

  const getActionConfig = (type: string) => {
    switch (type) {
      case 'repost':
        return { platforms: ['facebook', 'instagram'], delay_hours: 24 };
      case 'generate_content':
        return { content_type: 'facebook', theme: 'seasonal' };
      case 'send_notification':
        return { method: 'email', template: 'performance_alert' };
      case 'webhook':
        return { url: '', payload_template: '{}' };
      default:
        return {};
    }
  };

  const handleToggleRule = async (ruleId: string, isActive: boolean) => {
    // TODO: Replace with actual database call once migration is applied
    toast({
      title: "Coming Soon",
      description: "Automation rules will be available once database setup is complete",
    });
  };

  const handleDeleteRule = async (ruleId: string) => {
    // TODO: Replace with actual database call once migration is applied
    toast({
      title: "Coming Soon",
      description: "Automation rules will be available once database setup is complete",
    });
  };

  const getTriggerIcon = (type: string) => {
    switch (type) {
      case 'time': return <Clock className="w-4 h-4" />;
      case 'performance': return <TrendingUp className="w-4 h-4" />;
      case 'engagement': return <Target className="w-4 h-4" />;
      default: return <Zap className="w-4 h-4" />;
    }
  };

  const getActionIcon = (type: string) => {
    switch (type) {
      case 'repost': return <Repeat className="w-4 h-4" />;
      case 'generate_content': return <Plus className="w-4 h-4" />;
      case 'send_notification': return <AlertCircle className="w-4 h-4" />;
      default: return <Settings className="w-4 h-4" />;
    }
  };

  useEffect(() => {
    fetchAutomationRules();
  }, [user]);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-32 bg-gray-100 animate-pulse rounded-lg"></div>
        <div className="h-64 bg-gray-100 animate-pulse rounded-lg"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <div className="flex items-center justify-center gap-3 mb-4">
          <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
            <Zap className="w-6 h-6 text-purple-600" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900">Automation Rules</h1>
        </div>
        <p className="text-gray-600 max-w-2xl mx-auto">
          Create intelligent automation rules to streamline your content workflow. 
          Automatically repost high-performing content, generate new posts, and more.
        </p>
      </div>

      {/* Create New Rule */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Your Automation Rules</CardTitle>
            <Button onClick={() => setIsCreating(!isCreating)}>
              <Plus className="w-4 h-4 mr-2" />
              Create Rule
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isCreating && (
            <form onSubmit={handleCreateRule} className="space-y-4 mb-6 p-4 border rounded-lg">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="ruleName">Rule Name *</Label>
                  <Input
                    id="ruleName"
                    value={ruleName}
                    onChange={(e) => setRuleName(e.target.value)}
                    placeholder="e.g., Repost Top Performers"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="ruleDescription">Description</Label>
                  <Input
                    id="ruleDescription"
                    value={ruleDescription}
                    onChange={(e) => setRuleDescription(e.target.value)}
                    placeholder="What does this rule do?"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Trigger When *</Label>
                  <Select value={triggerType} onValueChange={setTriggerType}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select trigger" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="time">
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4" />
                          Scheduled Time
                        </div>
                      </SelectItem>
                      <SelectItem value="performance">
                        <div className="flex items-center gap-2">
                          <TrendingUp className="w-4 h-4" />
                          Performance Threshold
                        </div>
                      </SelectItem>
                      <SelectItem value="engagement">
                        <div className="flex items-center gap-2">
                          <Target className="w-4 h-4" />
                          Engagement Level
                        </div>
                      </SelectItem>
                      <SelectItem value="content_generated">
                        <div className="flex items-center gap-2">
                          <Plus className="w-4 h-4" />
                          Content Generated
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Action *</Label>
                  <Select value={actionType} onValueChange={setActionType}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select action" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="repost">
                        <div className="flex items-center gap-2">
                          <Repeat className="w-4 h-4" />
                          Repost Content
                        </div>
                      </SelectItem>
                      <SelectItem value="generate_content">
                        <div className="flex items-center gap-2">
                          <Plus className="w-4 h-4" />
                          Generate New Content
                        </div>
                      </SelectItem>
                      <SelectItem value="send_notification">
                        <div className="flex items-center gap-2">
                          <AlertCircle className="w-4 h-4" />
                          Send Notification
                        </div>
                      </SelectItem>
                      <SelectItem value="webhook">
                        <div className="flex items-center gap-2">
                          <Settings className="w-4 h-4" />
                          Trigger Webhook
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex gap-2">
                <Button type="submit">Create Rule</Button>
                <Button type="button" variant="outline" onClick={() => setIsCreating(false)}>
                  Cancel
                </Button>
              </div>
            </form>
          )}

          {/* Rules List */}
          <div className="space-y-4">
            {rules.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Zap className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No automation rules created yet</p>
                <p className="text-sm">Create your first rule to start automating!</p>
              </div>
            ) : (
              rules.map((rule) => (
                <Card key={rule.id} className={`border ${rule.isActive ? 'border-green-200 bg-green-50' : 'border-gray-200'}`}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="font-medium">{rule.name}</h3>
                          <Badge variant={rule.isActive ? 'default' : 'secondary'}>
                            {rule.isActive ? 'Active' : 'Inactive'}
                          </Badge>
                        </div>
                        
                        {rule.description && (
                          <p className="text-sm text-gray-600 mb-3">{rule.description}</p>
                        )}
                        
                        <div className="flex items-center gap-4 text-sm">
                          <div className="flex items-center gap-2">
                            <span className="text-gray-500">Trigger:</span>
                            <div className="flex items-center gap-1">
                              {getTriggerIcon(rule.trigger.type)}
                              <span className="capitalize">{rule.trigger.type.replace('_', ' ')}</span>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            <span className="text-gray-500">Action:</span>
                            <div className="flex items-center gap-1">
                              {getActionIcon(rule.actions[0]?.type)}
                              <span className="capitalize">{rule.actions[0]?.type.replace('_', ' ')}</span>
                            </div>
                          </div>
                          
                          <div className="text-gray-500">
                            Runs: {rule.runCount}
                          </div>
                          
                          {rule.lastRun && (
                            <div className="text-gray-500">
                              Last: {new Date(rule.lastRun).toLocaleDateString()}
                            </div>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2 ml-4">
                        <Switch
                          checked={rule.isActive}
                          onCheckedChange={() => handleToggleRule(rule.id, rule.isActive)}
                        />
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDeleteRule(rule.id)}
                        >
                          <Trash2 className="w-4 h-4" />
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

      {/* Coming Soon Features */}
      <Card className="bg-gray-50">
        <CardHeader>
          <CardTitle className="text-gray-700">Advanced Automation (Coming Soon)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 border rounded-lg bg-white">
              <h4 className="font-medium mb-2">AI-Powered Optimization</h4>
              <p className="text-sm text-gray-600">
                Automatically optimize posting times based on your audience engagement patterns
              </p>
            </div>
            <div className="p-4 border rounded-lg bg-white">
              <h4 className="font-medium mb-2">Smart Content Recycling</h4>
              <p className="text-sm text-gray-600">
                Intelligently repost your best content at optimal intervals
              </p>
            </div>
            <div className="p-4 border rounded-lg bg-white">
              <h4 className="font-medium mb-2">Competitor Analysis</h4>
              <p className="text-sm text-gray-600">
                Automatically generate content based on competitor performance
              </p>
            </div>
            <div className="p-4 border rounded-lg bg-white">
              <h4 className="font-medium mb-2">Multi-Channel Automation</h4>
              <p className="text-sm text-gray-600">
                Cross-platform content adaptation and posting
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};