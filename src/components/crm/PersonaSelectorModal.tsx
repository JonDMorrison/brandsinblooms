import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui-legacy/dialog";
import { Button } from "@/components/ui-legacy/button";
import { Input } from "@/components/ui-legacy/input";
import { Label } from "@/components/ui-legacy/label";
import { Checkbox } from "@/components/ui-legacy/checkbox";
import { Textarea } from "@/components/ui-legacy/textarea";
import { X, Plus, Users2, Sparkles } from "lucide-react";
import { PersonaTag } from "./PersonaTag";
import { useToast } from "@/hooks/use-toast";
import { ConceptTooltip } from "./ConceptTooltip";
import { PersonaVsSegmentExplainer } from "./PersonaVsSegmentExplainer";
import { getPersonaEmoji } from "@/config/systemPersonas";
import { useAllPersonas } from "@/hooks/useAllPersonas";

interface PersonaSelectorModalProps {
  open: boolean;
  onClose: () => void;
  onPersonasSelected: (personas: any[]) => void;
  selectedPersonaIds?: string[];
  title?: string;
  description?: string;
}

export const PersonaSelectorModal = ({
  open,
  onClose,
  onPersonasSelected,
  selectedPersonaIds = [],
  title = "Select Your Customer Personas",
  description = "Choose personas that represent your ideal customers",
}: PersonaSelectorModalProps) => {
  const [selectedPredefined, setSelectedPredefined] =
    useState<string[]>(selectedPersonaIds);
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [customPersona, setCustomPersona] = useState({
    persona_name: "",
    persona_description: "",
  });
  const [creating, setCreating] = useState(false);
  const { toast } = useToast();
  const { personas, loading, createPersona } = useAllPersonas();

  const predefinedPersonas = personas.filter((persona) => !persona.is_custom);
  const savedPersonas = personas.filter((persona) => persona.is_custom);

  useEffect(() => {
    if (open) {
      setSelectedPredefined(selectedPersonaIds);
    }
  }, [open, selectedPersonaIds]);

  const handlePredefinedToggle = (personaId: string) => {
    setSelectedPredefined((prev) =>
      prev.includes(personaId)
        ? prev.filter((id) => id !== personaId)
        : [...prev, personaId],
    );
  };

  const createCustomPersona = async () => {
    if (!customPersona.persona_name.trim()) {
      toast({
        title: "Error",
        description: "Please enter a persona name",
        variant: "destructive",
      });
      return;
    }

    // Check for duplicate names
    const existingNames = [
      ...predefinedPersonas.map((p) => p.persona_name.toLowerCase()),
      ...savedPersonas.map((p) => p.persona_name.toLowerCase()),
    ];

    if (existingNames.includes(customPersona.persona_name.toLowerCase())) {
      toast({
        title: "Error",
        description: "A persona with this name already exists",
        variant: "destructive",
      });
      return;
    }

    setCreating(true);
    try {
      const createdPersona = await createPersona({
        name: customPersona.persona_name,
        description: customPersona.persona_description,
      });

      if (!createdPersona) {
        throw new Error("Failed to create persona.");
      }

      toast({
        title: "Success",
        description: "Custom persona created successfully",
      });

      setSelectedPredefined((prev) => [...prev, createdPersona.id]);

      // Reset form
      setCustomPersona({ persona_name: "", persona_description: "" });
      setShowCustomForm(false);
    } catch (error) {
      console.error("Error creating persona:", error);
      toast({
        title: "Error",
        description: "Failed to create custom persona",
        variant: "destructive",
      });
    } finally {
      setCreating(false);
    }
  };

  const handleConfirm = () => {
    const selectedPersonas = personas.filter((persona) =>
      selectedPredefined.includes(persona.id),
    );

    onPersonasSelected(selectedPersonas);
    onClose();
  };

  const handleClose = () => {
    setShowCustomForm(false);
    setCustomPersona({ persona_name: "", persona_description: "" });
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent
        className="max-w-3xl max-h-[80vh] overflow-y-auto"
        aria-describedby="persona-selector-desc"
      >
        <p id="persona-selector-desc" className="sr-only">
          Select target customer personas based on gardening experience levels
          to define your campaign audience.
        </p>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users2 className="h-5 w-5 text-purple-600" />
            <ConceptTooltip type="persona">{title}</ConceptTooltip>
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Predefined Personas */}
          <div>
            <h3 className="text-lg font-semibold mb-4">
              Choose from Popular Personas
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {predefinedPersonas.map((persona) => (
                <div
                  key={persona.id}
                  className="p-4 border rounded-xl hover:bg-purple-50 hover:border-purple-200 cursor-pointer transition-colors"
                  onClick={() => handlePredefinedToggle(persona.id)}
                >
                  <div className="flex items-start space-x-3">
                    <Checkbox
                      id={persona.id}
                      checked={selectedPredefined.includes(persona.id)}
                      onCheckedChange={() => handlePredefinedToggle(persona.id)}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-lg">
                          {getPersonaEmoji(persona)}
                        </span>
                        <Label
                          htmlFor={persona.id}
                          className="text-sm font-medium cursor-pointer"
                        >
                          {persona.persona_name}
                        </Label>
                      </div>
                      <p className="text-xs text-gray-600 leading-relaxed">
                        {persona.persona_description}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Existing Custom Personas */}
          {savedPersonas.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold mb-4">
                Your Custom Personas
              </h3>
              <div className="space-y-2">
                {savedPersonas.map((persona) => (
                  <div
                    key={persona.id}
                    className="flex items-center space-x-3 p-3 border rounded-lg"
                  >
                    <Checkbox
                      id={persona.id}
                      checked={selectedPredefined.includes(persona.id)}
                      onCheckedChange={() => handlePredefinedToggle(persona.id)}
                    />
                    <div className="flex-1">
                      <Label
                        htmlFor={persona.id}
                        className="text-sm font-medium cursor-pointer flex items-center gap-2"
                      >
                        <span>{getPersonaEmoji(persona)}</span>
                        {persona.persona_name}
                      </Label>
                      {persona.persona_description && (
                        <p className="text-xs text-gray-600 mt-1">
                          {persona.persona_description}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Custom Persona Creation */}
          <div>
            {!showCustomForm ? (
              <Button
                variant="outline"
                onClick={() => setShowCustomForm(true)}
                className="w-full border-dashed border-2 hover:border-purple-300 hover:bg-purple-50 rounded-xl"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Your Own Persona
              </Button>
            ) : (
              <div className="border rounded-xl p-4 bg-purple-50">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-semibold">Create Custom Persona</h4>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowCustomForm(false)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>

                <div className="space-y-4">
                  <div>
                    <Label htmlFor="persona-name">Persona Name *</Label>
                    <Input
                      id="persona-name"
                      value={customPersona.persona_name}
                      onChange={(e) =>
                        setCustomPersona((prev) => ({
                          ...prev,
                          persona_name: e.target.value,
                        }))
                      }
                      placeholder="e.g., Succulent Sam"
                      maxLength={50}
                    />
                  </div>

                  <div>
                    <Label htmlFor="persona-description">Description</Label>
                    <Textarea
                      id="persona-description"
                      value={customPersona.persona_description}
                      onChange={(e) =>
                        setCustomPersona((prev) => ({
                          ...prev,
                          persona_description: e.target.value,
                        }))
                      }
                      placeholder="Describe this customer persona..."
                      rows={3}
                      maxLength={250}
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      {customPersona.persona_description.length}/250 characters
                    </p>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      onClick={createCustomPersona}
                      disabled={creating}
                      className="bg-purple-600 hover:bg-purple-700"
                    >
                      {creating ? "Creating..." : "Create Persona"}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setShowCustomForm(false)}
                      disabled={creating}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Selected Preview */}
          {selectedPredefined.length > 0 && (
            <div className="bg-gray-50 rounded-xl p-4">
              <h4 className="font-medium mb-3">
                Selected Personas ({selectedPredefined.length})
              </h4>
              <div className="flex flex-wrap gap-2">
                {selectedPredefined.map((personaId) => {
                  const persona = personas.find(
                    (item) => item.id === personaId,
                  );
                  return persona ? (
                    <PersonaTag key={personaId} persona={persona} size="sm" />
                  ) : null;
                })}
              </div>
            </div>
          )}

          {/* Persona vs Segment Explainer */}
          <PersonaVsSegmentExplainer />
        </div>

        {/* Footer */}
        <div className="flex justify-between items-center pt-4 border-t">
          <p className="text-sm text-gray-600">
            {selectedPredefined.length === 0
              ? "No personas selected yet."
              : `${selectedPredefined.length} persona${selectedPredefined.length !== 1 ? "s" : ""} selected`}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button
              onClick={handleConfirm}
              className="bg-purple-600 hover:bg-purple-700"
            >
              Save Selection
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
