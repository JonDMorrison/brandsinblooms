import React, { useState, useEffect } from 'react';
import { Zap, Clock, Repeat, CheckCircle, Settings, Plus, Edit, Trash2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';

interface AutomationRule {
  id: string;
  name: string;
  type: 'auto_approve' | 'bulk_schedule' | 'recurring_template';
  isActive: boolean;
  conditions: {
    contentType?: string[];
    keywords?: string[];
    campaignType?: string;
    minimumScore?: number;
  };
  actions: {
    autoApprove?: boolean;
    scheduleTime?: string;
    platforms?: string[];
    template?: string;
    frequency?: 'daily' | 'weekly' | 'monthly';
  };
  createdAt: string;
  lastTriggered?: string;
  triggerCount: number;
}

interface WorkflowAutomationProps {
  onRuleUpdate: (rules: AutomationRule[]) => void;
}

export const WorkflowAutomation = ({ onRuleUpdate }: WorkflowAutomationProps) => {
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [editingRule, setEditingRule] = useState<AutomationRule | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  useEffect(() => {
    loadAutomationRules();
  }, []);

  const loadAutomationRules = () => {
    // Load from localStorage or API
    const savedRules = localStorage.getItem('automation_rules');
    if (savedRules) {
      setRules(JSON.parse(savedRules));
    } else {
      // Default rules
      const defaultRules: AutomationRule[] = [
        {
          id: '1',
          name: 'Auto-approve Facebook posts',
          type: 'auto_approve',
          isActive: false,
          conditions: {
            contentType: ['facebook'],
            minimumScore: 80
          },
          actions: {
            autoApprove: true,
            scheduleTime: '18:00'
          },
          createdAt: new Date().toISOString(),
          triggerCount: 0
        },
        {
          id: '2',
          name: 'Bulk schedule Instagram posts',
          type: 'bulk_schedule',
          isActive: false,
          conditions: {
            contentType: ['instagram'],
            campaignType: 'weekly'
          },
          actions: {
            scheduleTime: '12:00',
            platforms: ['instagram']
          },
          createdAt: new Date().toISOString(),
          triggerCount: 0
        }
      ];
      setRules(defaultRules);
    }
  };

  const saveRules = (updatedRules: AutomationRule[]) => {
    setRules(updatedRules);
    localStorage.setItem('automation_rules', JSON.stringify(updatedRules));
    onRuleUpdate(updatedRules);
  };

  const toggleRule = (ruleId: string) => {
    const updatedRules = rules.map(rule =>
      rule.id === ruleId ? { ...rule, isActive: !rule.isActive } : rule
    );
    saveRules(updatedRules);
    toast.success(`Rule ${updatedRules.find(r => r.id === ruleId)?.isActive ? 'enabled' : 'disabled'}`);
  };

  const deleteRule = (ruleId: string) => {
    const updatedRules = rules.filter(rule => rule.id !== ruleId);
    saveRules(updatedRules);
    toast.success('Rule deleted');
  };

  const openEditDialog = (rule?: AutomationRule) => {
    setEditingRule(rule || {
      id: Date.now().toString(),
      name: '',
      type: 'auto_approve',
      isActive: false,
      conditions: {},
      actions: {},
      createdAt: new Date().toISOString(),
      triggerCount: 0
    });
    setIsDialogOpen(true);
  };

  const saveRule = () => {
    if (!editingRule) return;

    const updatedRules = editingRule.id && rules.find(r => r.id === editingRule.id)
      ? rules.map(rule => rule.id === editingRule.id ? editingRule : rule)
      : [...rules, editingRule];

    saveRules(updatedRules);
    setIsDialogOpen(false);
    setEditingRule(null);
    toast.success('Rule saved');
  };

  const getRuleIcon = (type: string) => {
    switch (type) {
      case 'auto_approve': return <CheckCircle className="w-4 h-4" />;
      case 'bulk_schedule': return <Clock className="w-4 h-4" />;
      case 'recurring_template': return <Repeat className="w-4 h-4" />;
      default: return <Zap className="w-4 h-4" />;
    }
  };

  const getRuleTypeLabel = (type: string) => {
    switch (type) {
      case 'auto_approve': return 'Auto Approve';
      case 'bulk_schedule': return 'Bulk Schedule';
      case 'recurring_template': return 'Recurring Template';
      default: return 'Unknown';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-primary" />
              <CardTitle>Workflow Automation</CardTitle>
              <Badge variant="outline">{rules.filter(r => r.isActive).length} active</Badge>
            </div>
            
            <Button onClick={() => openEditDialog()}>
              <Plus className="w-4 h-4 mr-1" />
              New Rule
            </Button>
          </div>
        </CardHeader>
        
        <CardContent>
          <p className="text-sm text-gray-600 mb-4">
            Set up automated workflows to streamline your content publishing process.
          </p>
          
          {/* Quick Stats */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="text-center p-3 bg-blue-50 rounded-lg">
              <div className="text-2xl font-semibold text-blue-600">
                {rules.reduce((sum, rule) => sum + rule.triggerCount, 0)}
              </div>
              <div className="text-sm text-blue-600">Total Triggers</div>
            </div>
            <div className="text-center p-3 bg-green-50 rounded-lg">
              <div className="text-2xl font-semibold text-green-600">
                {rules.filter(r => r.isActive).length}
              </div>
              <div className="text-sm text-green-600">Active Rules</div>
            </div>
            <div className="text-center p-3 bg-purple-50 rounded-lg">
              <div className="text-2xl font-semibold text-purple-600">
                {Math.round(rules.reduce((sum, rule) => sum + rule.triggerCount, 0) / Math.max(rules.length, 1))}
              </div>
              <div className="text-sm text-purple-600">Avg per Rule</div>
            </div>
          </div>
          
          {/* Rules List */}
          <div className="space-y-3">
            {rules.map((rule) => (
              <div key={rule.id} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${rule.isActive ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'}`}>
                    {getRuleIcon(rule.type)}
                  </div>
                  
                  <div>
                    <div className="font-medium">{rule.name}</div>
                    <div className="text-sm text-gray-600 flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        {getRuleTypeLabel(rule.type)}
                      </Badge>
                      {rule.triggerCount > 0 && (
                        <span>• Triggered {rule.triggerCount} times</span>
                      )}
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <Switch
                    checked={rule.isActive}
                    onCheckedChange={() => toggleRule(rule.id)}
                  />
                  
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => openEditDialog(rule)}
                  >
                    <Edit className="w-4 h-4" />
                  </Button>
                  
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => deleteRule(rule.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
            
            {rules.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                <Zap className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No automation rules configured</p>
                <Button onClick={() => openEditDialog()} className="mt-3">
                  Create Your First Rule
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Edit Rule Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingRule?.id && rules.find(r => r.id === editingRule.id) ? 'Edit Rule' : 'Create New Rule'}
            </DialogTitle>
          </DialogHeader>
          
          {editingRule && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="rule-name">Rule Name</Label>
                <Input
                  id="rule-name"
                  value={editingRule.name}
                  onChange={(e) => setEditingRule({ ...editingRule, name: e.target.value })}
                  placeholder="Enter rule name"
                />
              </div>
              
              <div>
                <Label htmlFor="rule-type">Rule Type</Label>
                <Select
                  value={editingRule.type}
                  onValueChange={(value: any) => setEditingRule({ ...editingRule, type: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto_approve">Auto Approve Content</SelectItem>
                    <SelectItem value="bulk_schedule">Bulk Schedule Posts</SelectItem>
                    <SelectItem value="recurring_template">Recurring Template</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              {editingRule.type === 'auto_approve' && (
                <div>
                  <Label>Content Types</Label>
                  <div className="flex gap-2 mt-2">
                    {['facebook', 'instagram', 'newsletter'].map((type) => (
                      <div key={type} className="flex items-center space-x-2">
                        <Checkbox
                          id={type}
                          checked={editingRule.conditions.contentType?.includes(type)}
                          onCheckedChange={(checked) => {
                            const types = editingRule.conditions.contentType || [];
                            const updatedTypes = checked
                              ? [...types, type]
                              : types.filter(t => t !== type);
                            setEditingRule({
                              ...editingRule,
                              conditions: { ...editingRule.conditions, contentType: updatedTypes }
                            });
                          }}
                        />
                        <Label htmlFor={type} className="capitalize">{type}</Label>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {editingRule.type === 'bulk_schedule' && (
                <div>
                  <Label htmlFor="schedule-time">Default Schedule Time</Label>
                  <Input
                    id="schedule-time"
                    type="time"
                    value={editingRule.actions.scheduleTime || '12:00'}
                    onChange={(e) => setEditingRule({
                      ...editingRule,
                      actions: { ...editingRule.actions, scheduleTime: e.target.value }
                    })}
                  />
                </div>
              )}
              
              <div className="flex items-center space-x-2">
                <Switch
                  id="rule-active"
                  checked={editingRule.isActive}
                  onCheckedChange={(checked) => setEditingRule({ ...editingRule, isActive: checked })}
                />
                <Label htmlFor="rule-active">Enable this rule</Label>
              </div>
              
              <div className="flex gap-2 pt-4">
                <Button onClick={saveRule} className="flex-1">
                  Save Rule
                </Button>
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};