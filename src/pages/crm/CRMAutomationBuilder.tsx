import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Plus, Trash2, ArrowUp, ArrowDown, Mail, MessageSquare, Save, ArrowLeft, Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { useTwilioSetup } from "@/components/dashboard/TwilioSetupChecker";

interface WorkflowStep {
  id: string;
  type: 'email' | 'sms';
  delay: number;
  subject?: string;
  content: string;
  template_id?: string;
}

interface TriggerConditions {
  delay_days?: number;
  segment_id?: string;
  [key: string]: any;
}

const CRMAutomationBuilder = () => {
  const [name, setName] = useState("");
  const [triggerType, setTriggerType] = useState("");
  const [triggerConditions, setTriggerConditions] = useState<TriggerConditions>({});
  const [workflowSteps, setWorkflowSteps] = useState<WorkflowStep[]>([]);
  const [isActive, setIsActive] = useState(false);
  const [saving, setSaving] = useState(false);
  const [segments, setSegments] = useState<any[]>([]);
  
  const { toast } = useToast();
  const navigate = useNavigate();
  const { data: twilioStatus, isLoading: twilioLoading } = useTwilioSetup();

  // Dynamic trigger types based on Twilio setup
  const triggerTypes = useMemo(() => {
    const baseTriggers = [
      { value: 'welcome', label: 'Welcome', description: 'Triggers when a new customer signs up' },
      { value: 'segment_joined', label: 'Segment Joined', description: 'Triggers when a customer joins a specific segment' },
      { value: 'manual', label: 'Manual', description: 'Triggers when manually activated' }
    ];

    if (twilioStatus?.isSetup) {
      return [
        ...baseTriggers,
        { value: 'purchase_delay', label: 'Purchase Delay', description: 'Triggers X days after last purchase' },
        { value: 'seasonal', label: 'Seasonal Reminder', description: 'Triggers based on seasonal timing' }
      ];
    }

    return baseTriggers;
  }, [twilioStatus?.isSetup]);

  const isSingleOption = triggerTypes.length === 1;

  useEffect(() => {
    fetchSegments();
  }, []);

  const fetchSegments = async () => {
    try {
      const { data, error } = await supabase
        .from('crm_segments')
        .select('id, name')
        .order('name');

      if (error) throw error;
      setSegments(data || []);
    } catch (error) {
      console.error('Error fetching segments:', error);
    }
  };

  const generateId = () => Math.random().toString(36).substr(2, 9);

  const addWorkflowStep = () => {
    const newStep: WorkflowStep = {
      id: generateId(),
      type: 'email',
      delay: 0,
      content: ''
    };
    setWorkflowSteps([...workflowSteps, newStep]);
  };

  const updateWorkflowStep = (id: string, updates: Partial<WorkflowStep>) => {
    setWorkflowSteps(prev => prev.map(step => 
      step.id === id ? { ...step, ...updates } : step
    ));
  };

  const removeWorkflowStep = (id: string) => {
    setWorkflowSteps(prev => prev.filter(step => step.id !== id));
  };

  const moveStep = (id: string, direction: 'up' | 'down') => {
    const index = workflowSteps.findIndex(step => step.id === id);
    if ((direction === 'up' && index === 0) || (direction === 'down' && index === workflowSteps.length - 1)) {
      return;
    }

    const newSteps = [...workflowSteps];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    [newSteps[index], newSteps[targetIndex]] = [newSteps[targetIndex], newSteps[index]];
    setWorkflowSteps(newSteps);
  };

  const saveAutomation = async () => {
    if (!name.trim() || !triggerType || workflowSteps.length === 0) {
      toast({
        title: "Error",
        description: "Please fill in all required fields and add at least one workflow step",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('crm_automations')
        .insert({
          name: name.trim(),
          trigger_type: triggerType,
          trigger_conditions: triggerConditions as any,
          workflow_steps: workflowSteps as any,
          is_active: isActive
        });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Automation created successfully",
      });

      navigate('/crm/automations');
    } catch (error) {
      console.error('Error saving automation:', error);
      toast({
        title: "Error",
        description: "Failed to save automation",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const getTriggerDescription = () => {
    const selectedTrigger = triggerTypes.find(t => t.value === triggerType);
    if (selectedTrigger) {
      if (triggerType === 'purchase_delay') {
        return `Triggers ${triggerConditions.delay_days || 0} days after last purchase`;
      }
      return selectedTrigger.description;
    }
    return isSingleOption ? triggerTypes[0]?.description : 'Select a trigger type to see description';
  };

  const getStepTypeIcon = (type: string) => {
    return type === 'email' ? Mail : MessageSquare;
  };

  return (
    <div className="p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-4">
            <Button variant="ghost" onClick={() => navigate('/crm/automations')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Create Automation</h1>
              <p className="text-muted-foreground">
                Build automated workflows to engage your customers
              </p>
            </div>
          </div>
          <Button onClick={saveAutomation} disabled={saving}>
            <Save className="h-4 w-4 mr-2" />
            {saving ? 'Saving...' : 'Save Automation'}
          </Button>
        </div>

        {/* Step 1: Name & Trigger */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Step 1: Name & Trigger</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="name">Automation Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Welcome New Customers"
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="trigger">Trigger Type</Label>
              {isSingleOption ? (
                <div className="mt-1">
                  <div className="flex items-center justify-between p-3 border rounded-md bg-muted/50">
                    <div className="flex items-center space-x-2">
                      <Badge variant="outline">{triggerTypes[0].label}</Badge>
                      <span className="text-sm">{triggerTypes[0].label}</span>
                    </div>
                    <div className="flex items-center space-x-2 text-muted-foreground">
                      <Lock className="h-4 w-4" />
                      <span className="text-xs">More options with SMS setup</span>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    {triggerTypes[0].description}
                  </p>
                </div>
              ) : (
                <>
                  <Select 
                    value={triggerType} 
                    onValueChange={setTriggerType}
                    onOpenChange={(open) => {
                      if (open && triggerTypes.length === 1) return false;
                    }}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="— Select —" />
                    </SelectTrigger>
                    <SelectContent>
                      {triggerTypes.map((trigger) => (
                        <SelectItem key={trigger.value} value={trigger.value}>
                          {trigger.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-sm text-muted-foreground mt-1">
                    {getTriggerDescription()}
                  </p>
                </>
              )}
              {!twilioStatus?.isSetup && !twilioLoading && (
                <p className="text-sm text-orange-600 mt-1">
                  💡 Set up SMS to unlock more trigger options like Purchase Delay and Seasonal campaigns
                </p>
              )}
            </div>

            {/* Conditional trigger settings */}
            {triggerType === 'segment_joined' && (
              <div>
                <Label htmlFor="segment">Target Segment</Label>
                <Select 
                  value={triggerConditions.segment_id || ''} 
                  onValueChange={(value) => setTriggerConditions({...triggerConditions, segment_id: value})}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select segment" />
                  </SelectTrigger>
                  <SelectContent>
                    {segments.map((segment) => (
                      <SelectItem key={segment.id} value={segment.id}>
                        {segment.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {triggerType === 'purchase_delay' && (
              <div>
                <Label htmlFor="delay">Days after last purchase</Label>
                <Input
                  id="delay"
                  type="number"
                  value={triggerConditions.delay_days || ''}
                  onChange={(e) => setTriggerConditions({...triggerConditions, delay_days: parseInt(e.target.value) || 0})}
                  placeholder="7"
                  className="mt-1"
                />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Step 2: Workflow Builder */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              Step 2: Workflow Steps
              <Button onClick={addWorkflowStep} size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Add Step
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {workflowSteps.length === 0 ? (
              <div className="text-center py-8">
                <MessageSquare className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium text-foreground mb-2">
                  No workflow steps yet
                </h3>
                <p className="text-muted-foreground mb-4">
                  Add your first step to start building your automation
                </p>
                <Button onClick={addWorkflowStep}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add First Step
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {workflowSteps.map((step, index) => {
                  const StepIcon = getStepTypeIcon(step.type);
                  return (
                    <Card key={step.id} className="border-l-4 border-l-garden-green">
                      <CardContent className="pt-4">
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex items-center space-x-2">
                            <StepIcon className="h-5 w-5 text-garden-green" />
                            <Badge variant="outline">Step {index + 1}</Badge>
                            <Badge variant={step.type === 'email' ? 'default' : 'secondary'}>
                              {step.type.toUpperCase()}
                            </Badge>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => moveStep(step.id, 'up')}
                              disabled={index === 0}
                            >
                              <ArrowUp className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => moveStep(step.id, 'down')}
                              disabled={index === workflowSteps.length - 1}
                            >
                              <ArrowDown className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => removeWorkflowStep(step.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                          <div>
                            <Label htmlFor={`type-${step.id}`}>Step Type</Label>
                            <Select 
                              value={step.type} 
                              onValueChange={(value: 'email' | 'sms') => updateWorkflowStep(step.id, { type: value })}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="email">Email</SelectItem>
                                <SelectItem value="sms">SMS</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label htmlFor={`delay-${step.id}`}>Delay (days after trigger)</Label>
                            <Input
                              id={`delay-${step.id}`}
                              type="number"
                              value={step.delay}
                              onChange={(e) => updateWorkflowStep(step.id, { delay: parseInt(e.target.value) || 0 })}
                              min="0"
                            />
                          </div>
                        </div>

                        {step.type === 'email' && (
                          <div className="mb-4">
                            <Label htmlFor={`subject-${step.id}`}>Email Subject</Label>
                            <Input
                              id={`subject-${step.id}`}
                              value={step.subject || ''}
                              onChange={(e) => updateWorkflowStep(step.id, { subject: e.target.value })}
                              placeholder="Welcome to our garden community!"
                            />
                          </div>
                        )}

                        <div>
                          <Label htmlFor={`content-${step.id}`}>
                            {step.type === 'email' ? 'Email Content' : 'SMS Message'}
                          </Label>
                          <Textarea
                            id={`content-${step.id}`}
                            value={step.content}
                            onChange={(e) => updateWorkflowStep(step.id, { content: e.target.value })}
                            placeholder={
                              step.type === 'email' 
                                ? "Welcome to our garden center! We're excited to help you grow..."
                                : "Welcome! Get 20% off your first purchase with code WELCOME20"
                            }
                            rows={step.type === 'email' ? 6 : 3}
                          />
                          {step.type === 'sms' && (
                            <p className="text-sm text-muted-foreground mt-1">
                              {step.content.length}/160 characters
                            </p>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Step 3: Activation */}
        <Card>
          <CardHeader>
            <CardTitle>Step 3: Activation</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-2">
              <Switch
                id="active"
                checked={isActive}
                onCheckedChange={setIsActive}
              />
              <Label htmlFor="active">Activate Automation</Label>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              {isActive 
                ? "This automation will start running immediately after saving"
                : "Save as draft - you can activate it later"
              }
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default CRMAutomationBuilder;