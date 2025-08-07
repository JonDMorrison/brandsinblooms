import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { AutomationFlowCanvas } from '@/components/automation/flow/AutomationFlowCanvas';
import { TemplateGalleryEnhanced } from '@/components/automation/TemplateGalleryEnhanced';
import { GuidedAutomationBuilder } from '@/components/automation/GuidedAutomationBuilder';
import { AudienceTargetingButton } from '@/components/crm/AudienceTargetingButton';
import { Save, Palette, Zap } from 'lucide-react';

export const CRMAutomationBuilder = () => {
  const { id: automationId } = useParams();
  const [searchParams] = useSearchParams();
  const mode = searchParams.get('mode') || 'canvas';
  
  const [automationName, setAutomationName] = useState('');
  const [automationDescription, setAutomationDescription] = useState('');
  const [currentFlowState, setCurrentFlowState] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(!!automationId);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState(mode === 'quick' ? 'templates' : 'canvas');
  const [showGuidedBuilder, setShowGuidedBuilder] = useState(false);
  
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
    setActiveTab('canvas');
    
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
    setActiveTab('canvas');
    
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

      {/* Automation Details */}
      <Card>
        <CardHeader>
          <CardTitle>Automation Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="automation-name">Automation Name *</Label>
              <Input
                id="automation-name"
                value={automationName}
                onChange={(e) => setAutomationName(e.target.value)}
                placeholder="e.g., Welcome Series"
              />
            </div>
            <div>
              <Label htmlFor="automation-description">Description</Label>
              <Input
                id="automation-description"
                value={automationDescription}
                onChange={(e) => setAutomationDescription(e.target.value)}
                placeholder="Brief description of this automation"
              />
            </div>
          </div>
        </CardContent>
      </Card>


      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="canvas" className="gap-2">
            <Palette className="w-4 h-4" />
            Visual Canvas
          </TabsTrigger>
          <TabsTrigger value="templates" className="gap-2">
            <Zap className="w-4 h-4" />
            Templates
          </TabsTrigger>
        </TabsList>

        <TabsContent value="canvas" className="space-y-4">
          {/* Audience Targeting - Compact placement */}
          <AudienceTargetingButton
            selectedPersonas={selectedPersonas}
            selectedSegments={selectedSegments}
            onPersonasChange={setSelectedPersonas}
            onSegmentsChange={setSelectedSegments}
            maxPersonas={3}
            maxSegments={5}
          />
          
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
        </TabsContent>

        <TabsContent value="templates" className="space-y-4">
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
        </TabsContent>
      </Tabs>
    </div>
  );
};