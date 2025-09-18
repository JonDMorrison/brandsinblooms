import { useState, useMemo } from "react";
import { useTenant } from "@/hooks/useTenant";
import { useCRMPersonas } from "@/hooks/useCRMPersonas";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { User, X, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";

interface CustomerPersonaSelectorProps {
  customerId: string;
  value?: string | null;
  onChange?: (personaId: string | null) => void;
}

export const CustomerPersonaSelector = ({ 
  customerId, 
  value, 
  onChange 
}: CustomerPersonaSelectorProps) => {
  const [showAllPersonas, setShowAllPersonas] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newPersonaName, setNewPersonaName] = useState("");
  const [newPersonaDesc, setNewPersonaDesc] = useState("");
  const [creating, setCreating] = useState(false);
  const { toast } = useToast();
  const { tenant } = useTenant();
  const { user } = useAuth();
const { personas: customPersonas, loading: personasLoading, fetchPersonas } = useCRMPersonas();

// Predefined personas available to every tenant
const predefinedPersonas = [
  {
    id: 'plant-killer-pam',
    persona_name: 'Plant-Killer Pam',
    persona_description: 'Customers who struggle with keeping plants alive and need low-maintenance options',
    is_custom: false,
  },
  {
    id: 'pet-friendly-hannah',
    persona_name: 'Pet-Friendly Hannah',
    persona_description: 'Pet owners looking for safe, non-toxic plants and garden solutions',
    is_custom: false,
  },
  {
    id: 'vegetable-garden-veronica',
    persona_name: 'Vegetable Garden Veronica',
    persona_description: 'Customers focused on growing their own food and organic gardening',
    is_custom: false,
  },
  {
    id: 'sustainable-susie',
    persona_name: 'Sustainable Susie',
    persona_description: 'Environmentally conscious gardeners seeking eco-friendly solutions',
    is_custom: false,
  },
  {
    id: 'patio-gardener-gail',
    persona_name: 'Patio Gardener Gail',
    persona_description: 'Urban gardeners with limited space focusing on container gardening',
    is_custom: false,
  },
  {
    id: 'pollinator-paula',
    persona_name: 'Pollinator Paula',
    persona_description: 'Customers interested in attracting bees, butterflies, and beneficial insects',
    is_custom: false,
  },
  {
    id: 'curb-appeal-ashley',
    persona_name: 'Curb Appeal Ashley',
    persona_description: 'Homeowners focused on front yard landscaping and property aesthetics',
    is_custom: false,
  },
  {
    id: 'diy-dana',
    persona_name: 'DIY Dana',
    persona_description: 'Hands-on gardeners who love projects and building garden features',
    is_custom: false,
  },
  {
    id: 'wellness-whitney',
    persona_name: 'Wellness Whitney',
    persona_description: 'Customers interested in therapeutic gardening and mental health',
    is_custom: false,
  },
];

const personas = useMemo(() => [...predefinedPersonas, ...customPersonas], [customPersonas]);

  // Find the selected persona by ID (UUID) - now using unified approach
  const selectedPersona = personas.find(p => p.id === value);

  // Check if persona is selected
  const isPersonaSelected = (personaId: string) => value === personaId;

  const handlePersonaToggle = async (personaId: string) => {
    if (isUpdating) return;
    
    setIsUpdating(true);
    
    try {
      const newPersonaId = value === personaId ? null : personaId;
      
      // Update in database
      const { data, error } = await supabase
        .from('crm_customers')
        .update({ 
          persona_id: newPersonaId,
          persona: null // Clear legacy field
        })
        .eq('id', customerId)
        .select();

      if (error) {
        throw error;
      }

      // Call onChange to update parent state with new persona ID
      onChange?.(newPersonaId);
      
      const selectedPersonaName = personas.find(p => p.id === newPersonaId)?.persona_name;
      if (newPersonaId) {
        toast({
          title: "Persona assigned",
          description: `Assigned "${selectedPersonaName}" to customer.`
        });
      } else {
        toast({
          title: "Persona removed", 
          description: "Removed persona assignment from customer."
        });
      }
    } catch (error) {
      console.error('❌ Error updating persona:', error);
      toast({
        title: "Error",
        description: "Failed to update persona assignment.",
        variant: "destructive"
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleRemovePersona = async () => {
    if (!value) return;
    
    setIsUpdating(true);
    
    try {
      // Clear both persona_id and persona fields completely
      const { error } = await supabase
        .from('crm_customers')
        .update({ persona_id: null, persona: null })
        .eq('id', customerId);

      if (error) throw error;

      // Call onChange to update parent state
      onChange?.(null);
      
      toast({
        title: "Persona removed",
        description: "Removed persona assignment from customer."
      });
    } catch (error) {
      console.error('Error removing persona:', error);
      toast({
        title: "Error",
        description: "Failed to remove persona assignment.",
        variant: "destructive"
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleCreatePersona = async () => {
    if (!tenant?.id || !user) {
      toast({ title: "Missing context", description: "Please sign in and select a workspace.", variant: "destructive" });
      return;
    }
    if (!newPersonaName.trim()) return;

    setCreating(true);
    try {
      const { data, error } = await supabase
        .from('crm_personas')
        .insert({
          persona_name: newPersonaName.trim(),
          persona_description: newPersonaDesc || null,
          tenant_id: tenant.id,
          user_id: user.id,
          is_custom: true
        })
        .select('id, persona_name, persona_description')
        .single();

      if (error) throw error;

      // Refresh list
      await fetchPersonas();

      // Assign newly created persona to this customer
      if (data?.id) {
        await handlePersonaToggle(data.id);
      }

      toast({ title: 'Persona created', description: `"${newPersonaName}" added.` });
      setShowCreateForm(false);
      setNewPersonaName('');
      setNewPersonaDesc('');
    } catch (e) {
      console.error('Error creating persona', e);
      toast({ title: 'Error', description: 'Failed to create persona.', variant: 'destructive' });
    } finally {
      setCreating(false);
    }
  };

  const assignedCount = selectedPersona ? 1 : 0;
  const totalCount = personas.length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">
          Persona ({assignedCount}/{totalCount})
        </Label>
      </div>

      {/* Display assigned persona as badge */}
      {value && !selectedPersona && (
        <div className="flex flex-wrap gap-2">
          <Badge 
            variant="outline" 
            className="inline-flex items-center gap-1.5 bg-destructive/10 border-destructive/20 text-destructive"
          >
            <User className="h-3 w-3" />
            <span className="font-medium">Invalid Persona</span>
            <Button
              variant="ghost"
              size="sm"
              className="h-4 w-4 p-0 hover:bg-transparent"
              onClick={handleRemovePersona}
              disabled={isUpdating}
            >
              <X className="h-3 w-3" />
            </Button>
          </Badge>
        </div>
      )}
      {selectedPersona && (
        <div className="flex flex-wrap gap-2">
          <Badge 
            variant="outline" 
            className="inline-flex items-center gap-1.5 bg-brand-teal/10 border-brand-teal/20 text-brand-teal"
          >
            <User className="h-3 w-3" />
            <span className="font-medium">{selectedPersona.persona_name}</span>
            <Button
              variant="ghost"
              size="sm"
              className="h-4 w-4 p-0 hover:bg-transparent"
              onClick={handleRemovePersona}
              disabled={isUpdating}
            >
              <X className="h-3 w-3" />
            </Button>
          </Badge>
        </div>
      )}

      {/* All personas list with single-select toggle */}
      {showAllPersonas ? (
        <Card>
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <CardTitle className="text-base">All Personas</CardTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowCreateForm((v) => !v)}
              >
                {showCreateForm ? 'Close' : 'New'}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
                onClick={() => setShowAllPersonas(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {showCreateForm && (
              <div className="mb-4 space-y-3">
                <Input
                  placeholder="Persona name"
                  value={newPersonaName}
                  onChange={(e) => setNewPersonaName(e.target.value)}
                />
                <Textarea
                  placeholder="Description (optional)"
                  value={newPersonaDesc}
                  onChange={(e) => setNewPersonaDesc(e.target.value)}
                />
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setShowCreateForm(false)} disabled={creating}>Cancel</Button>
                  <Button onClick={handleCreatePersona} disabled={creating || !newPersonaName.trim()}>
                    {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Create & Assign'}
                  </Button>
                </div>
              </div>
            )}
            {personasLoading ? (
              <div className="text-sm text-muted-foreground py-4">Loading personas...</div>
            ) : personas.length > 0 ? (
              <ScrollArea className="h-64">
                <div className="space-y-2 pr-4">
                  {personas.map((persona) => {
                    const isSelected = value === persona.id;
                    
                    return (
                      <div key={persona.id} className="flex items-start space-x-3 p-3 hover:bg-muted/50 rounded-md border border-transparent hover:border-border/50 transition-colors">
                        <div className="flex items-center justify-center w-5 h-5 mt-0.5">
                          {isUpdating ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Checkbox
                              id={persona.id}
                              checked={isSelected}
                              onCheckedChange={() => handlePersonaToggle(persona.id)}
                              disabled={isUpdating}
                            />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <label htmlFor={persona.id} className="cursor-pointer">
                            <div className="flex items-center gap-2">
                              <span className={`font-medium text-sm ${isSelected ? 'text-brand-teal' : ''}`}>
                                {persona.persona_name}
                              </span>
                              {isSelected && <Badge variant="outline" className="text-xs bg-brand-teal/10 border-brand-teal/20 text-brand-teal">Assigned</Badge>}
                            </div>
                              {persona.persona_description && (
                                <p className="text-xs text-muted-foreground mt-1">{persona.persona_description}</p>
                              )}
                          </label>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            ) : (
              <div className="text-sm text-muted-foreground text-center py-8">
                No personas available
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <Button
          variant="outline"
          onClick={() => setShowAllPersonas(true)}
          className="w-full justify-center"
        >
          Show All Personas
        </Button>
      )}
    </div>
  );
};