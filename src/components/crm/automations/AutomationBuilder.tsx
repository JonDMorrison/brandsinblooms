import { useState, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/NativeSelect';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Plus, X, Mail, MessageSquare, Clock, ArrowLeft } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Automation {
  id: string;
  name: string;
  trigger_type: string;
  workflow_steps: any[];
  is_active: boolean;
  created_at: string;
  tenant_id: string;
  user_id: string;
  trigger_conditions: any;
}

interface Segment {
  id: string;
  name: string;
  customer_count: number;
}

interface WorkflowStep {
  id: string;
  type: 'email' | 'sms' | 'wait';
  delay?: string;
  subject?: string;
  content?: string;
  template_id?: string;
}

interface AutomationBuilderProps {
  automation?: Automation | null;
  segments: Segment[];
  onClose: () => void;
  onSave: () => void;
}

export function AutomationBuilder({ automation, segments, onClose, onSave }: AutomationBuilderProps) {
  const [name, setName] = useState(automation?.name || '');
  const [triggerType, setTriggerType] = useState(automation?.trigger_type || '');
  const [selectedSegment, setSelectedSegment] = useState('');
  const [workflowSteps, setWorkflowSteps] = useState<WorkflowStep[]>(
    automation?.workflow_steps || []
  );
  const [triggerConditions, setTriggerConditions] = useState(
    automation?.trigger_conditions || {}
  );
  
  const { toast } = useToast();

  const saveAutomation = useMutation({
    mutationFn: async () => {
      const data = {
        name,
        trigger_type: triggerType,
        workflow_steps: workflowSteps as any, // Convert to JSON
        trigger_conditions: triggerConditions as any, // Convert to JSON
        is_active: false,
      };

      if (automation) {
        const { error } = await supabase
          .from('crm_automations')
          .update(data)
          .eq('id', automation.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('crm_automations')
          .insert(data);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast({
        title: automation ? "Automation updated" : "Automation created",
        description: "Your automation has been saved successfully.",
      });
      onSave();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to save automation.",
        variant: "destructive",
      });
    },
  });

  const addStep = (type: WorkflowStep['type']) => {
    const newStep: WorkflowStep = {
      id: Date.now().toString(),
      type,
      delay: type === 'wait' ? '1d' : undefined,
      subject: type === 'email' ? '' : undefined,
      content: type !== 'wait' ? '' : undefined,
    };
    setWorkflowSteps([...workflowSteps, newStep]);
  };

  const updateStep = (stepId: string, updates: Partial<WorkflowStep>) => {
    setWorkflowSteps(steps =>
      steps.map(step => step.id === stepId ? { ...step, ...updates } : step)
    );
  };

  const removeStep = (stepId: string) => {
    setWorkflowSteps(steps => steps.filter(step => step.id !== stepId));
  };

  const getStepIcon = (type: WorkflowStep['type']) => {
    switch (type) {
      case 'email':
        return <Mail className="h-4 w-4" />;
      case 'sms':
        return <MessageSquare className="h-4 w-4" />;
      case 'wait':
        return <Clock className="h-4 w-4" />;
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="sm" onClick={onClose}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Automations
        </Button>
        <div>
          <h1 className="text-3xl font-bold">
            {automation ? 'Edit Automation' : 'Create Automation'}
          </h1>
          <p className="text-muted-foreground">
            Build an automated workflow to engage your customers
          </p>
        </div>
      </div>

      <div className="grid gap-6 max-w-4xl">
        {/* Basic Settings */}
        <Card>
          <CardHeader>
            <CardTitle>Automation Settings</CardTitle>
            <CardDescription>Configure the basic settings for your automation</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="name">Automation Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Welcome Series"
              />
            </div>
            
            <div>
              <Label htmlFor="trigger">Trigger Type</Label>
              <NativeSelect
                value={triggerType}
                onChange={(e) => setTriggerType(e.target.value)}
                options={[
                  { value: 'signup', label: 'New Customer Signup' },
                  { value: 'tag_added', label: 'Tag Added to Customer' },
                  { value: 'seasonal', label: 'Seasonal Campaign' },
                  { value: 'purchase', label: 'After Purchase' },
                  { value: 'persona_assigned', label: 'Persona Assigned' }
                ]}
                placeholder="Select trigger type"
              />
            </div>

            <div>
              <Label htmlFor="segment">Target Segment (Optional)</Label>
              <NativeSelect
                value={selectedSegment}
                onChange={(e) => setSelectedSegment(e.target.value)}
                options={[
                  { value: '', label: 'All customers' },
                  ...segments.map(segment => ({
                    value: segment.id,
                    label: `${segment.name} (${segment.customer_count} customers)`
                  }))
                ]}
                placeholder="Select target segment"
              />
            </div>
          </CardContent>
        </Card>

        {/* Workflow Steps */}
        <Card>
          <CardHeader>
            <CardTitle>Workflow Steps</CardTitle>
            <CardDescription>Add steps to define your automation workflow</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {workflowSteps.map((step, index) => (
              <Card key={step.id} className="border-dashed">
                <CardContent className="pt-4">
                  <div className="flex items-start gap-4">
                    <div className="flex items-center gap-2 min-w-0">
                      {getStepIcon(step.type)}
                      <Badge variant="outline">
                        Step {index + 1}: {step.type.toUpperCase()}
                      </Badge>
                    </div>
                    
                    <div className="flex-1 space-y-3">
                      {step.type === 'wait' ? (
                        <div>
                          <Label>Wait Duration</Label>
                          <NativeSelect
                            value={step.delay || ''}
                            onChange={(e) => updateStep(step.id, { delay: e.target.value })}
                            options={[
                              { value: '1h', label: '1 hour' },
                              { value: '6h', label: '6 hours' },
                              { value: '1d', label: '1 day' },
                              { value: '2d', label: '2 days' },
                              { value: '1w', label: '1 week' }
                            ]}
                            className="w-48"
                          />
                        </div>
                      ) : (
                        <>
                          {step.type === 'email' && (
                            <div>
                              <Label>Email Subject</Label>
                              <Input
                                value={step.subject || ''}
                                onChange={(e) => updateStep(step.id, { subject: e.target.value })}
                                placeholder="Enter email subject..."
                              />
                            </div>
                          )}
                          <div>
                            <Label>{step.type === 'email' ? 'Email Content' : 'SMS Message'}</Label>
                            <Textarea
                              value={step.content || ''}
                              onChange={(e) => updateStep(step.id, { content: e.target.value })}
                              placeholder={`Enter ${step.type} content...`}
                              rows={step.type === 'email' ? 4 : 2}
                            />
                          </div>
                        </>
                      )}
                    </div>
                    
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeStep(step.id)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => addStep('email')}
                className="flex items-center gap-2"
              >
                <Mail className="h-4 w-4" />
                Add Email
              </Button>
              <Button
                variant="outline"
                onClick={() => addStep('sms')}
                className="flex items-center gap-2"
              >
                <MessageSquare className="h-4 w-4" />
                Add SMS
              </Button>
              <Button
                variant="outline"
                onClick={() => addStep('wait')}
                className="flex items-center gap-2"
              >
                <Clock className="h-4 w-4" />
                Add Wait
              </Button>
            </div>

            {workflowSteps.length === 0 && (
              <div className="text-center py-8 border-2 border-dashed rounded-lg">
                <Plus className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                <p className="text-muted-foreground">No steps added yet</p>
                <p className="text-sm text-muted-foreground">
                  Add your first step to start building your automation
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Save Actions */}
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button 
            onClick={() => saveAutomation.mutate()}
            disabled={!name || !triggerType || workflowSteps.length === 0}
          >
            {automation ? 'Update Automation' : 'Create Automation'}
          </Button>
        </div>
      </div>
    </div>
  );
}