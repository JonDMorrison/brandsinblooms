import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Plus, Trash2, Mail, MessageSquare, Clock, ArrowRight, ChevronDown } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { TRIGGERS, getTriggerById, type Trigger } from '@/lib/triggerCatalog';
import { TemplateSelector } from '@/components/automation/TemplateSelector';
import { type Step } from '@/lib/campaignTemplates';

export const CRMAutomationBuilder = () => {
  const [automationName, setAutomationName] = useState('');
  const [triggerType, setTriggerType] = useState('');
  const [steps, setSteps] = useState<Step[]>([]);
  const [showTemplateSelector, setShowTemplateSelector] = useState(false);
  const [isGeneratingTemplate, setIsGeneratingTemplate] = useState(false);
  const [triggerPopoverOpen, setTriggerPopoverOpen] = useState(false);
  const { toast } = useToast();

  const selectedTrigger = getTriggerById(triggerType);

  const handleTriggerSelect = (trigger: Trigger) => {
    setTriggerType(trigger.id);
    setTriggerPopoverOpen(false);
    setShowTemplateSelector(true);
  };

  const handleSelectTemplate = (templateSteps: Step[]) => {
    setSteps(templateSteps);
    setShowTemplateSelector(false);
    toast({
      title: "Template Applied",
      description: `${templateSteps.length} step${templateSteps.length > 1 ? 's' : ''} added to your automation.`,
    });
  };

  const handleStartFromScratch = () => {
    setSteps([]);
    setShowTemplateSelector(false);
  };

  const handleGenerateWithAI = async () => {
    setIsGeneratingTemplate(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-automation-template', {
        body: {
          trigger: triggerType,
          businessName: 'Bloom Gardens'
        }
      });

      if (error) throw error;

      if (data && data.steps) {
        setSteps(data.steps);
        setShowTemplateSelector(false);
        toast({
          title: "AI Template Generated",
          description: `Created ${data.steps.length} step${data.steps.length > 1 ? 's' : ''} for your automation.`,
        });
      }
    } catch (error) {
      console.error('Error generating template:', error);
      toast({
        title: "Generation Failed",
        description: "Unable to generate template. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingTemplate(false);
    }
  };

  const addStep = (type: 'email' | 'sms') => {
    const newStep: Step = {
      delayHours: 0,
      channel: type,
      body: '',
      template_id: `custom-${Date.now()}`
    };
    setSteps([...steps, newStep]);
  };

  const removeStep = (index: number) => {
    setSteps(steps.filter((_, i) => i !== index));
  };

  const updateStep = (index: number, field: keyof Step, value: string | number) => {
    setSteps(steps.map((step, i) => 
      i === index ? { ...step, [field]: value } : step
    ));
  };

  const saveAutomation = async () => {
    if (!automationName.trim() || !triggerType) {
      toast({
        title: "Missing Information",
        description: "Please provide automation name and trigger type.",
        variant: "destructive",
      });
      return;
    }

    try {
      const { data, error } = await supabase
        .from('crm_automations')
        .insert({
          name: automationName,
          trigger_type: triggerType,
          trigger_conditions: { event: triggerType },
          workflow_steps: steps as any,
          is_active: true,
          template_source: steps.some(s => s.template_id?.startsWith('ai-')) ? 'ai_generated' : 'template_library'
        })
        .select()
        .single();

      if (error) throw error;

      toast({
        title: "Success",
        description: "Automation saved successfully!",
      });

      // Reset form
      setAutomationName('');
      setTriggerType('');
      setSteps([]);
      setShowTemplateSelector(false);
    } catch (error) {
      console.error('Error saving automation:', error);
      toast({
        title: "Error",
        description: "Failed to save automation. Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Create Automation</h1>
          <p className="text-muted-foreground">Build automated workflows to engage your customers</p>
        </div>
        <Button 
          onClick={saveAutomation}
          disabled={!automationName.trim() || !triggerType || steps.length === 0}
        >
          Save Automation
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Automation Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="automation-name">Automation Name</Label>
            <Input
              id="automation-name"
              value={automationName}
              onChange={(e) => setAutomationName(e.target.value)}
              placeholder="Enter automation name"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Trigger Configuration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="trigger-type">Trigger Type</Label>
            <Popover open={triggerPopoverOpen} onOpenChange={setTriggerPopoverOpen}>
              <PopoverTrigger asChild>
                <Button 
                  variant="outline" 
                  className="w-full justify-between"
                  disabled={!!triggerType}
                >
                  {selectedTrigger ? (
                    <div className="flex items-center gap-2">
                      <selectedTrigger.icon className="w-4 h-4" />
                      {selectedTrigger.label}
                    </div>
                  ) : (
                    "Select trigger type"
                  )}
                  <ChevronDown className="w-4 h-4 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-full p-0 z-[1000010]" align="start">
                <div className="max-h-80 overflow-y-auto">
                  {TRIGGERS.map((trigger) => (
                    <button
                      key={trigger.id}
                      onClick={() => handleTriggerSelect(trigger)}
                      className="w-full p-3 text-left hover:bg-accent transition-colors border-b border-border last:border-0"
                    >
                      <div className="flex items-start gap-3">
                        <trigger.icon className="w-5 h-5 mt-0.5 text-primary" />
                        <div className="flex-1 min-w-0">
                          <div className="font-medium">{trigger.label}</div>
                          <div className="text-sm text-muted-foreground">{trigger.description}</div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </CardContent>
      </Card>

      {showTemplateSelector && triggerType && (
        <Card>
          <CardHeader>
            <CardTitle>Template Selection</CardTitle>
          </CardHeader>
          <CardContent>
            <TemplateSelector
              triggerId={triggerType}
              onSelectTemplate={handleSelectTemplate}
              onStartFromScratch={handleStartFromScratch}
              onGenerateWithAI={handleGenerateWithAI}
              isGenerating={isGeneratingTemplate}
            />
          </CardContent>
        </Card>
      )}

      {!showTemplateSelector && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              Automation Steps
              {steps.length > 0 && (
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => addStep('email')}
                    className="gap-2"
                  >
                    <Mail className="w-4 h-4" />
                    Add Email
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => addStep('sms')}
                    className="gap-2"
                  >
                    <MessageSquare className="w-4 h-4" />
                    Add SMS
                  </Button>
                </div>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {steps.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {triggerType ? "Select a template above to get started." : "Select a trigger to configure automation steps."}
              </div>
            ) : (
              <div className="space-y-4">
                {steps.map((step, index) => (
                  <Card key={index} className="relative">
                    <CardContent className="pt-6">
                      <div className="flex items-start gap-4">
                        <div className="flex flex-col items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                            {step.channel === 'email' && <Mail className="w-4 h-4" />}
                            {step.channel === 'sms' && <MessageSquare className="w-4 h-4" />}
                          </div>
                          {index < steps.length - 1 && (
                            <ArrowRight className="w-4 h-4 text-muted-foreground rotate-90" />
                          )}
                        </div>
                        
                        <div className="flex-1 space-y-3">
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary">
                              {step.channel.toUpperCase()}
                            </Badge>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => removeStep(index)}
                              className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                            <div>
                              <Label htmlFor={`delay-${index}`}>Delay (hours)</Label>
                              <Input
                                id={`delay-${index}`}
                                type="number"
                                min="0"
                                value={step.delayHours}
                                onChange={(e) => updateStep(index, 'delayHours', parseInt(e.target.value))}
                                placeholder="0"
                              />
                            </div>
                          </div>

                          <div>
                            <Label htmlFor={`content-${index}`}>
                              {step.channel === 'email' ? 'Email Content' : 'SMS Message'}
                            </Label>
                            <Textarea
                              id={`content-${index}`}
                              value={step.body}
                              onChange={(e) => updateStep(index, 'body', e.target.value)}
                              placeholder={
                                step.channel === 'email' 
                                  ? "Enter email content (HTML supported)" 
                                  : "Enter SMS message (160 chars recommended)"
                              }
                              rows={step.channel === 'email' ? 4 : 2}
                            />
                            {step.channel === 'sms' && step.body && (
                              <div className="text-xs text-muted-foreground mt-1">
                                {step.body.length}/160 characters
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};