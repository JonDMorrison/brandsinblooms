import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Play, Pause, Edit, Copy, Trash2, Users, Mail, MessageSquare, Clock } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { AutomationBuilder } from '@/components/crm/automations/AutomationBuilder';
import { AutomationStats } from '@/components/crm/automations/AutomationStats';
import { AIAutomationDesigner } from '@/components/automation/AIAutomationDesigner';
import { useNavigate, Link } from 'react-router-dom';

interface Automation {
  id: string;
  name: string;
  trigger_type: string;
  workflow_steps: any;
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

export default function Automations() {
  const [isBuilderOpen, setIsBuilderOpen] = useState(false);
  const [editingAutomation, setEditingAutomation] = useState<Automation | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  // Fetch automations
  const { data: automations, isLoading } = useQuery({
    queryKey: ['crm-automations'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('crm_automations')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as Automation[];
    },
  });

  // Fetch segments for automation builder
  const { data: segments } = useQuery({
    queryKey: ['crm-segments'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('crm_segments')
        .select('id, name, customer_count')
        .order('name');
      
      if (error) throw error;
      return data as Segment[];
    },
  });

  // Toggle automation status
  const toggleAutomation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const { error } = await supabase
        .from('crm_automations')
        .update({ is_active: !isActive })
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm-automations'] });
      toast({
        title: "Automation updated",
        description: "Automation status has been changed successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to update automation status.",
        variant: "destructive",
      });
    },
  });

  // Delete automation
  const deleteAutomation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('crm_automations')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm-automations'] });
      toast({
        title: "Automation deleted",
        description: "Automation has been deleted successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to delete automation.",
        variant: "destructive",
      });
    },
  });

  // Duplicate automation
  const duplicateAutomation = useMutation({
    mutationFn: async (automation: Automation) => {
      const { error } = await supabase
        .from('crm_automations')
        .insert({
          name: `${automation.name} (Copy)`,
          trigger_type: automation.trigger_type,
          workflow_steps: automation.workflow_steps,
          trigger_conditions: automation.trigger_conditions,
          is_active: false,
        });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm-automations'] });
      toast({
        title: "Automation duplicated",
        description: "Automation has been duplicated successfully.",
      });
    },
  });

  const getTriggerIcon = (triggerType: string) => {
    switch (triggerType) {
      case 'signup':
        return <Users className="h-4 w-4" />;
      case 'tag_added':
        return <Badge className="h-4 w-4" />;
      case 'seasonal':
        return <Clock className="h-4 w-4" />;
      default:
        return <Play className="h-4 w-4" />;
    }
  };

  const getStepsSummary = (steps: any[]) => {
    if (!steps || steps.length === 0) return 'No steps';
    
    const emailSteps = steps.filter(step => step.type === 'email').length;
    const smsSteps = steps.filter(step => step.type === 'sms').length;
    const waitSteps = steps.filter(step => step.type === 'wait').length;
    
    const summary = [];
    if (emailSteps > 0) summary.push(`${emailSteps} email${emailSteps > 1 ? 's' : ''}`);
    if (smsSteps > 0) summary.push(`${smsSteps} SMS`);
    if (waitSteps > 0) summary.push(`${waitSteps} wait${waitSteps > 1 ? 's' : ''}`);
    
    return summary.join(', ') || 'No steps';
  };

  const handleCreateNew = () => {
    setEditingAutomation(null);
    setIsBuilderOpen(true);
  };

  const handleEdit = (automation: Automation) => {
    setEditingAutomation(automation);
    setIsBuilderOpen(true);
  };

  const handleAutomationGenerated = (automation: any) => {
    queryClient.invalidateQueries({ queryKey: ['crm-automations'] });
    // Navigate to the canvas page for the generated automation
    navigate(`/crm/automations/${automation.id}`);
  };

  if (isBuilderOpen) {
    return (
      <AutomationBuilder
        automation={editingAutomation}
        segments={segments || []}
        onClose={() => {
          setIsBuilderOpen(false);
          setEditingAutomation(null);
        }}
        onSave={() => {
          setIsBuilderOpen(false);
          setEditingAutomation(null);
          queryClient.invalidateQueries({ queryKey: ['crm-automations'] });
        }}
      />
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Automations</h1>
          <p className="text-muted-foreground">
            Create automated email and SMS campaigns to engage your customers
          </p>
        </div>
        <div className="flex items-center gap-3">
          <AIAutomationDesigner onAutomationGenerated={handleAutomationGenerated} />
          <Link to="/crm/automations/new/guide">
            <Button variant="outline" className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Browse Presets
            </Button>
          </Link>
          <Button onClick={handleCreateNew} className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Create Custom
          </Button>
        </div>
      </div>

      {/* Stats Overview */}
      <AutomationStats automations={automations || []} />

      {/* Automations List */}
      <div className="grid gap-4">
        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : automations && automations.length > 0 ? (
          automations.map((automation) => (
            <Card key={automation.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {getTriggerIcon(automation.trigger_type)}
                    <div>
                      <CardTitle className="text-lg">{automation.name}</CardTitle>
                      <CardDescription className="flex items-center gap-2 mt-1">
                        Trigger: {automation.trigger_type.replace('_', ' ')} • 
                        Steps: {getStepsSummary(automation.workflow_steps)}
                      </CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={automation.is_active ? "default" : "secondary"}>
                      {automation.is_active ? "Active" : "Paused"}
                    </Badge>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleAutomation.mutate({ 
                          id: automation.id, 
                          isActive: automation.is_active 
                        })}
                      >
                        {automation.is_active ? (
                          <Pause className="h-4 w-4" />
                        ) : (
                          <Play className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(automation)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => duplicateAutomation.mutate(automation)}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteAutomation.mutate(automation.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span>Created {new Date(automation.created_at).toLocaleDateString()}</span>
                  {automation.workflow_steps?.length > 0 && (
                    <span>
                      {automation.workflow_steps.filter(step => step.type === 'email').length > 0 && (
                        <span className="flex items-center gap-1">
                          <Mail className="h-3 w-3" />
                          Email
                        </span>
                      )}
                      {automation.workflow_steps.filter(step => step.type === 'sms').length > 0 && (
                        <span className="flex items-center gap-1 ml-2">
                          <MessageSquare className="h-3 w-3" />
                          SMS
                        </span>
                      )}
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <Card>
            <CardContent className="text-center py-12">
              <div className="mx-auto w-12 h-12 bg-muted rounded-full flex items-center justify-center mb-4">
                <Plus className="h-6 w-6 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-medium mb-2">No automations yet</h3>
              <p className="text-muted-foreground mb-4">
                Create your first automation to start engaging customers automatically. 
                Browse our preset templates or build a custom flow from scratch.
              </p>
              <div className="flex items-center gap-3 justify-center">
                <Link to="/crm/automations/new/guide">
                  <Button variant="outline">Browse Presets</Button>
                </Link>
                <Button onClick={handleCreateNew}>
                  Create Custom Automation
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}