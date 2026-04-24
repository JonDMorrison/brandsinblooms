import { useState, useMemo } from "react";
import { useAllPersonas } from "@/hooks/useAllPersonas";
import { useCustomerPersonas } from "@/hooks/useCustomerPersonas";
import { Button } from "@/components/ui-legacy/button";
import { Badge } from "@/components/ui-legacy/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui-legacy/card";
import { Label } from "@/components/ui-legacy/label";
import { Checkbox } from "@/components/ui-legacy/checkbox";
import { ScrollArea } from "@/components/ui-legacy/scroll-area";
import { Input } from "@/components/ui-legacy/input";
import { Textarea } from "@/components/ui-legacy/textarea";
import { User, X, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface CustomerPersonaSelectorProps {
  customerId: string;
  value?: string | null;
  onChange?: (personaIds: string[]) => void;
}

export const CustomerPersonaSelector = ({
  customerId,
  value, // Legacy prop - ignored in multi-select
  onChange,
}: CustomerPersonaSelectorProps) => {
  const [showAllPersonas, setShowAllPersonas] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newPersonaName, setNewPersonaName] = useState("");
  const [newPersonaDesc, setNewPersonaDesc] = useState("");
  const [creating, setCreating] = useState(false);
  const { toast } = useToast();

  const {
    personas,
    loading: personasLoading,
    createPersona,
  } = useAllPersonas();
  const {
    assignments,
    assignedPersonaIds,
    isLoading: assignmentsLoading,
    assignPersona,
    unassignPersona,
    isPersonaAssigned,
    refetch: refetchAssignments,
  } = useCustomerPersonas(customerId);

  // Get assigned personas for display
  const assignedPersonas = useMemo(() => {
    return personas.filter((persona) => isPersonaAssigned(persona.id));
  }, [isPersonaAssigned, personas]);

  const handlePersonaToggle = async (personaId: string, isCustom: boolean) => {
    if (isUpdating) return;

    setIsUpdating(true);

    try {
      const isCurrentlyAssigned = isPersonaAssigned(personaId);
      let success = false;

      if (isCurrentlyAssigned) {
        success = await unassignPersona(personaId, isCustom);
        if (success) {
          const personaName = personas.find(
            (p) => p.id === personaId,
          )?.persona_name;
          toast({
            title: "Persona removed",
            description: `Removed "${personaName}" from customer.`,
          });
        }
      } else {
        success = await assignPersona(personaId, isCustom);
        if (success) {
          const personaName = personas.find(
            (p) => p.id === personaId,
          )?.persona_name;
          toast({
            title: "Persona assigned",
            description: `Assigned "${personaName}" to customer.`,
          });
        }
      }

      if (success && onChange) {
        // Refresh the assignments data
        await refetchAssignments();

        // Calculate new persona IDs directly (since state won't update immediately)
        let newPersonaIds = [...assignedPersonaIds];
        if (isCurrentlyAssigned) {
          // Remove the persona
          newPersonaIds = newPersonaIds.filter((id) => id !== personaId);
        } else {
          // Add the persona if not already present
          if (!newPersonaIds.includes(personaId)) {
            newPersonaIds.push(personaId);
          }
        }

        onChange(newPersonaIds);
      }
    } catch (error) {
      console.error("❌ Error updating persona:", error);
      toast({
        title: "Error",
        description: "Failed to update persona assignment.",
        variant: "destructive",
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleRemovePersona = async (personaId: string, isCustom: boolean) => {
    await handlePersonaToggle(personaId, isCustom);
  };

  const handleCreatePersona = async () => {
    if (!newPersonaName.trim()) return;

    setCreating(true);
    try {
      const createdPersona = await createPersona({
        name: newPersonaName.trim(),
        description: newPersonaDesc || null,
      });

      if (!createdPersona) {
        throw new Error("Failed to create persona.");
      }

      // Assign newly created persona to this customer
      await handlePersonaToggle(createdPersona.id, true);

      toast({
        title: "Persona created",
        description: `"${newPersonaName}" added and assigned.`,
      });
      setShowCreateForm(false);
      setNewPersonaName("");
      setNewPersonaDesc("");
    } catch (e) {
      console.error("Error creating persona", e);
      toast({
        title: "Error",
        description: "Failed to create persona.",
        variant: "destructive",
      });
    } finally {
      setCreating(false);
    }
  };

  const assignedCount = assignedPersonas.length;
  const totalCount = personas.length;
  const isLoading = personasLoading || assignmentsLoading;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">
          Personas ({assignedCount}/{totalCount})
        </Label>
      </div>

      {/* Display assigned personas as badges */}
      {assignedPersonas.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {assignedPersonas.map((persona) => {
            const actualIsCustom = persona.is_custom;

            return (
              <Badge
                key={persona.id}
                variant="outline"
                className="inline-flex items-center gap-1.5 bg-brand-teal/10 border-brand-teal/20 text-brand-teal"
              >
                <User className="h-3 w-3" />
                <span className="font-medium">{persona.persona_name}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-4 w-4 p-0 hover:bg-transparent"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemovePersona(persona.id, actualIsCustom);
                  }}
                  disabled={isUpdating}
                >
                  <X className="h-3 w-3" />
                </Button>
              </Badge>
            );
          })}
        </div>
      )}

      {/* All personas list with multi-select checkboxes */}
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
                {showCreateForm ? "Close" : "New"}
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
                  <Button
                    variant="outline"
                    onClick={() => setShowCreateForm(false)}
                    disabled={creating}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleCreatePersona}
                    disabled={creating || !newPersonaName.trim()}
                  >
                    {creating ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      "Create & Assign"
                    )}
                  </Button>
                </div>
              </div>
            )}
            {isLoading ? (
              <div className="text-sm text-muted-foreground py-4">
                Loading personas...
              </div>
            ) : personas.length > 0 ? (
              <ScrollArea className="h-64">
                <div className="space-y-2 pr-4">
                  {personas.map((persona) => {
                    const isSelected = isPersonaAssigned(persona.id);
                    const isCustom = persona.is_custom;

                    return (
                      <div
                        key={persona.id}
                        className="flex items-start space-x-3 p-3 hover:bg-muted/50 rounded-md border border-transparent hover:border-border/50 transition-colors"
                      >
                        <div className="flex items-center justify-center w-5 h-5 mt-0.5">
                          {isUpdating ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Checkbox
                              id={persona.id}
                              checked={isSelected}
                              onCheckedChange={() =>
                                handlePersonaToggle(persona.id, isCustom)
                              }
                              disabled={isUpdating}
                            />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <label
                            htmlFor={persona.id}
                            className="cursor-pointer"
                          >
                            <div className="flex items-center gap-2">
                              <span
                                className={`font-medium text-sm ${isSelected ? "text-brand-teal" : ""}`}
                              >
                                {persona.persona_name}
                              </span>
                              {isSelected && (
                                <Badge
                                  variant="outline"
                                  className="text-xs bg-brand-teal/10 border-brand-teal/20 text-brand-teal"
                                >
                                  Assigned
                                </Badge>
                              )}
                              {isCustom && (
                                <Badge variant="outline" className="text-xs">
                                  Custom
                                </Badge>
                              )}
                            </div>
                            {persona.persona_description && (
                              <p className="text-xs text-muted-foreground mt-1">
                                {persona.persona_description}
                              </p>
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
          Show All Personas ({totalCount} available)
        </Button>
      )}
    </div>
  );
};
