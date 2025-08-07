import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';

import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { AutomationFlowCanvas } from '@/components/automation/flow/AutomationFlowCanvas';
import { TemplateGalleryEnhanced } from '@/components/automation/TemplateGalleryEnhanced';
import { GuidedAutomationBuilder } from '@/components/automation/GuidedAutomationBuilder';
import { AudienceTargetingButton } from '@/components/crm/AudienceTargetingButton';
import { Save } from 'lucide-react';

export const CRMAutomationBuilder = () => {
  const { id: automationId } = useParams();
  const [searchParams] = useSearchParams();
  const mode = searchParams.get('mode') || 'canvas';
  
  const [automationName, setAutomationName] = useState('');
  const [automationDescription, setAutomationDescription] = useState('');
  const [currentFlowState, setCurrentFlowState] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(!!automationId);
  const [isSaving, setIsSaving] = useState(false);
  const [showGuidedBuilder, setShowGuidedBuilder] = useState(false);
  const [showChooseStartingPoint, setShowChooseStartingPoint] = useState(!automationId && !currentFlowState);
  
  // Audience targeting state
  const [selectedPersonas, setSelectedPersonas] = useState<any[]>([]);
  const [selectedSegments, setSelectedSegments] = useState<any[]>([]);
  
  const { toast } = useToast();

  // Load existing automation if editing
  useEffect(() => {
    if (automationId) {
      loadAutomation();
    }
  }, [automationId]);

  const loadAutomation = async () => {
    if (!automationId) return;

    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('crm_automations')
        .select('*')
        .eq('id', automationId)
        .single();

      if (error) throw error;

      setAutomationName(data.name || '');
      // TODO: Add description field to database
      setAutomationDescription('');
      // TODO: Use flow_state once column is available
      setCurrentFlowState({ nodes: [], edges: [] });
    } catch (error) {
      console.error('Error loading automation:', error);
      toast({
        title: 'Error',
        description: 'Failed to load automation details.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveAutomation = async () => {
    if (!automationName.trim()) {
      toast({
        title: 'Missing Information',
        description: 'Please provide an automation name.',
        variant: 'destructive',
      });
      return;
    }

    if (!currentFlowState || currentFlowState.nodes.length === 0) {
      toast({
        title: 'Missing Workflow',
        description: 'Please create at least one step in your automation.',
        variant: 'destructive',
      });
      return;
    }

    try {
      setIsSaving(true);
      
      const automationData = {
        name: automationName,
        is_active: false, // Start as draft
        trigger_type: currentFlowState.nodes.find((n: any) => n.type === 'trigger')?.data.triggerType || 'manual',
        trigger_conditions: {},
        workflow_steps: [], // Legacy field, keeping for compatibility
      };

      if (automationId) {
        // Update existing automation
        const { error } = await supabase
          .from('crm_automations')
          .update(automationData)
          .eq('id', automationId);

        if (error) throw error;

        toast({
          title: 'Success',
          description: 'Automation updated successfully!',
        });
      } else {
        // Create new automation
        const { data, error } = await supabase
          .from('crm_automations')
          .insert(automationData)
          .select()
          .single();

        if (error) throw error;

        toast({
          title: 'Success',
          description: 'Automation created successfully!',
        });

        // Redirect to edit mode
        window.history.replaceState({}, '', `/crm/automations/${data.id}`);
      }
    } catch (error) {
      console.error('Error saving automation:', error);
      toast({
        title: 'Error',
        description: 'Failed to save automation. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleTemplateSelect = (template: any) => {
    setCurrentFlowState(template.flow_data);
    setAutomationName(template.name);
    setAutomationDescription(template.description);
    setShowGuidedBuilder(false);
    setShowChooseStartingPoint(false);
    
    toast({
      title: 'Template Applied',
      description: 'Template has been loaded into the canvas. You can now customize it.',
    });
  };

  const handleStartFromScratch = () => {
    setShowGuidedBuilder(true);
  };

  const handleGuidedBuilderComplete = (automationConfig: any) => {
    setCurrentFlowState(automationConfig.flow_data);
    setAutomationName(automationConfig.name);
    setAutomationDescription(automationConfig.description);
    setShowGuidedBuilder(false);
    setShowChooseStartingPoint(false);
    
    toast({
      title: 'Automation Created',
      description: 'Your custom automation has been set up. Customize it further in the canvas.',
    });
  };

  const handleBackToTemplates = () => {
    setShowGuidedBuilder(false);
  };

  const handleFlowChange = (flowState: any) => {
    setCurrentFlowState(flowState);
  };

  if (isLoading) {
    return (
      <div className="p-6 max-w-6xl mx-auto">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">
            {automationId ? 'Edit Automation' : 'Create Automation'}
          </h1>
          <p className="text-muted-foreground">
            Design visual automation workflows to engage your customers
          </p>
        </div>
        <Button 
          onClick={handleSaveAutomation}
          disabled={!automationName.trim() || isSaving}
          className="gap-2"
        >
          <Save className="w-4 h-4" />
          {isSaving ? 'Saving...' : 'Save Automation'}
        </Button>
      </div>

      {/* Choose Your Starting Point - For New Automations */}
      {showChooseStartingPoint && (
        <Card>
          <CardHeader>
            <CardTitle>Choose Your Starting Point</CardTitle>
            <p className="text-muted-foreground">
              Select a template or build from scratch to get started with your automation
            </p>
          </CardHeader>
          <CardContent>
            {showGuidedBuilder ? (
              <GuidedAutomationBuilder
                onComplete={handleGuidedBuilderComplete}
                onBack={handleBackToTemplates}
              />
            ) : (
              <TemplateGalleryEnhanced
                onSelectTemplate={handleTemplateSelect}
                onStartFromScratch={handleStartFromScratch}
              />
            )}
          </CardContent>
        </Card>
      )}

      {/* Automation Canvas - Show when template selected or editing existing */}
      {!showChooseStartingPoint && (
        <div className="space-y-4">
          {/* Inline Name Field and Audience Targeting */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
                <div className="flex-1 max-w-md">
                  <Label htmlFor="automation-name" className="text-sm font-medium">
                    Automation Name *
                  </Label>
                  <Input
                    id="automation-name"
                    value={automationName}
                    onChange={(e) => setAutomationName(e.target.value)}
                    placeholder="e.g., Welcome Series"
                    className="mt-1"
                  />
                </div>
                <AudienceTargetingButton
                  selectedPersonas={selectedPersonas}
                  selectedSegments={selectedSegments}
                  onPersonasChange={setSelectedPersonas}
                  onSegmentsChange={setSelectedSegments}
                  maxPersonas={3}
                  maxSegments={5}
                />
              </div>
            </CardContent>
          </Card>
          
          {/* Flow Canvas */}
          <Card className="h-[600px]">
            <CardHeader>
              <CardTitle>Automation Flow Canvas</CardTitle>
              <p className="text-sm text-muted-foreground">
                Drag and drop nodes to build your automation workflow. Connect them to define the customer journey.
              </p>
            </CardHeader>
            <CardContent className="h-[500px] p-0">
              <AutomationFlowCanvas
                automationId={automationId}
                initialFlowState={currentFlowState}
                onSave={handleFlowChange}
                className="h-full w-full"
              />
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};