import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Search, Users, Lightbulb, X, Plus } from "lucide-react";
import { PersonaTag } from "./PersonaTag";
import { SegmentChip } from "./SegmentChip";
import { CustomPersonaModal } from "./personas/CustomPersonaModal";
import { CustomSegmentModal } from "./segments/CustomSegmentModal";
import { useAllPersonas } from "@/hooks/useAllPersonas";
import { useAllSegments } from "@/hooks/useAllSegments";
import { toast } from "@/utils/toast";

interface Persona {
  id: string;
  persona_name: string;
  persona_description?: string;
  is_custom: boolean;
}

interface Segment {
  id: string;
  name: string;
  description?: string;
  customer_count: number;
  type: 'predefined' | 'custom';
  persona_id?: string;
}

interface AudienceSelectorProps {
  selectedPersonas: Persona[];
  selectedSegments: Segment[];
  onPersonasChange: (personas: Persona[]) => void;
  onSegmentsChange: (segments: Segment[]) => void;
  maxPersonas?: number;
  maxSegments?: number;
  onClose: () => void;
}

export const AudienceSelector = ({
  selectedPersonas,
  selectedSegments,
  onPersonasChange,
  onSegmentsChange,
  maxPersonas = 3,
  maxSegments = 5,
  onClose
}: AudienceSelectorProps) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [showPersonaModal, setShowPersonaModal] = useState(false);
  const [showSegmentModal, setShowSegmentModal] = useState(false);

  // Use existing hooks
  const { personas, loading: personasLoading } = useAllPersonas();
  const { segments, loading: segmentsLoading } = useAllSegments();

  const loading = personasLoading || segmentsLoading;

  // Filter options based on search
  const filteredPersonas = searchTerm 
    ? personas.filter(persona => 
        persona.persona_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        persona.persona_description?.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : personas;

  const filteredSegments = searchTerm 
    ? segments.filter(segment => 
        segment.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        segment.description?.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : segments;

  const handleCreatePersona = async (personaData: { name: string; description?: string }) => {
    // Handle persona creation - for now just close modal
    setShowPersonaModal(false);
    return true;
  };

  const handleCreateSegment = async (segmentData: { name: string; filters: any[] }) => {
    // Handle segment creation - for now just close modal
    setShowSegmentModal(false);
    return true;
  };

  const handlePersonaToggle = (persona: Persona, checked: boolean) => {
    if (checked) {
      if (selectedPersonas.length >= maxPersonas) {
        toast.error(`You can select up to ${maxPersonas} personas`);
        return;
      }
      onPersonasChange([...selectedPersonas, persona]);
    } else {
      onPersonasChange(selectedPersonas.filter(p => p.id !== persona.id));
    }
  };

  const handleSegmentToggle = (segment: Segment, checked: boolean) => {
    if (checked) {
      if (selectedSegments.length >= maxSegments) {
        toast.error(`You can select up to ${maxSegments} segments`);
        return;
      }
      onSegmentsChange([...selectedSegments, segment]);
    } else {
      onSegmentsChange(selectedSegments.filter(s => s.id !== segment.id));
    }
  };

  const removePersona = (personaId: string) => {
    onPersonasChange(selectedPersonas.filter(p => p.id !== personaId));
  };

  const removeSegment = (segmentId: string) => {
    onSegmentsChange(selectedSegments.filter(s => s.id !== segmentId));
  };

  const clearAll = () => {
    onPersonasChange([]);
    onSegmentsChange([]);
  };

  const getTotalAudience = () => {
    return selectedSegments.reduce((total, segment) => total + segment.customer_count, 0);
  };

  const isPersonaSelected = (personaId: string) => {
    return selectedPersonas.some(p => p.id === personaId);
  };

  const isSegmentSelected = (segmentId: string) => {
    return selectedSegments.some(s => s.id === segmentId);
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-muted rounded w-1/4"></div>
          <div className="space-y-2">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-12 bg-muted rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search personas and segments..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Selected Summary */}
      {(selectedPersonas.length > 0 || selectedSegments.length > 0) && (
        <div className="p-4 bg-accent/50 rounded-lg space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-medium">Selected Targeting</h3>
            <Button variant="ghost" size="sm" onClick={clearAll}>
              <X className="h-4 w-4 mr-1" />
              Clear All
            </Button>
          </div>
          
          {selectedPersonas.length > 0 && (
            <div>
              <div className="flex items-center gap-1 text-sm text-muted-foreground mb-2">
                <Lightbulb className="h-4 w-4 text-purple-500" />
                <span>Personas ({selectedPersonas.length}/{maxPersonas}):</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {selectedPersonas.map((persona) => (
                  <PersonaTag
                    key={persona.id}
                    persona={persona}
                    removable
                    onRemove={removePersona}
                    size="sm"
                  />
                ))}
              </div>
            </div>
          )}
          
          {selectedSegments.length > 0 && (
            <div>
              <div className="flex items-center gap-1 text-sm text-muted-foreground mb-2">
                <Users className="h-4 w-4 text-brand-teal" />
                <span>Segments ({selectedSegments.length}/{maxSegments}):</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {selectedSegments.map((segment) => (
                  <SegmentChip
                    key={segment.id}
                    segment={segment}
                    removable
                    onRemove={removeSegment}
                    size="sm"
                  />
                ))}
              </div>
            </div>
          )}
          
          {selectedSegments.length > 0 && (
            <>
              <Separator />
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">Total Audience Size:</span>
                <span className="font-bold text-primary">
                  {getTotalAudience().toLocaleString()} contacts
                </span>
              </div>
            </>
          )}
        </div>
      )}

      {/* Two-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Personas Column */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Lightbulb className="h-4 w-4 text-purple-500" />
              <h3 className="font-medium">Personas</h3>
              <Badge variant="outline" className="text-xs">
                {selectedPersonas.length}/{maxPersonas}
              </Badge>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowPersonaModal(true)}
              className="h-8"
            >
              <Plus className="h-4 w-4 mr-1" />
              Add New
            </Button>
          </div>
          
          <div className="space-y-2 max-h-80 overflow-y-auto border border-border rounded-lg p-3">
            {filteredPersonas.map((persona) => {
              const isSelected = isPersonaSelected(persona.id);
              const isDisabled = !isSelected && selectedPersonas.length >= maxPersonas;
              
              return (
                <div
                  key={persona.id}
                  className={`flex items-center space-x-3 p-3 rounded-lg border transition-colors ${
                    isSelected 
                      ? 'border-purple-500 bg-purple-50' 
                      : isDisabled 
                        ? 'border-muted bg-muted/50 opacity-50' 
                        : 'border-border hover:border-purple-300 hover:bg-purple-50/50'
                  }`}
                >
                  <Checkbox
                    id={persona.id}
                    checked={isSelected}
                    disabled={isDisabled}
                    onCheckedChange={(checked) => handlePersonaToggle(persona, checked as boolean)}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <label 
                        htmlFor={persona.id}
                        className={`font-medium cursor-pointer ${isDisabled ? 'cursor-not-allowed' : ''}`}
                      >
                        {persona.persona_name}
                      </label>
                      {persona.is_custom && (
                        <Badge 
                          variant="outline"
                          className="text-xs"
                        >
                          Custom
                        </Badge>
                      )}
                    </div>
                    {persona.persona_description && (
                      <p className="text-sm text-muted-foreground mt-1">
                        {persona.persona_description}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
            
            {filteredPersonas.length === 0 && (
              <div className="text-center py-6 text-muted-foreground">
                <Lightbulb className="h-6 w-6 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No personas found</p>
              </div>
            )}
          </div>
        </div>

        {/* Segments Column */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-brand-teal" />
              <h3 className="font-medium">Segments</h3>
              <Badge variant="outline" className="text-xs">
                {selectedSegments.length}/{maxSegments}
              </Badge>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowSegmentModal(true)}
              className="h-8"
            >
              <Plus className="h-4 w-4 mr-1" />
              Add New
            </Button>
          </div>
          
          <div className="space-y-2 max-h-80 overflow-y-auto border border-border rounded-lg p-3">
            {filteredSegments.map((segment) => {
              const mappedSegment: Segment = {
                id: segment.id,
                name: segment.name,
                description: segment.description,
                customer_count: segment.customer_count,
                type: 'predefined'
              };
              const isSelected = isSegmentSelected(segment.id);
              const isDisabled = !isSelected && selectedSegments.length >= maxSegments;
              
              return (
                <div
                  key={segment.id}
                  className={`flex items-center space-x-3 p-3 rounded-lg border transition-colors ${
                    isSelected 
                      ? 'border-brand-teal bg-brand-teal/5' 
                      : isDisabled 
                        ? 'border-muted bg-muted/50 opacity-50' 
                        : 'border-border hover:border-brand-teal/30 hover:bg-brand-teal/5'
                  }`}
                >
                  <Checkbox
                    id={segment.id}
                    checked={isSelected}
                    disabled={isDisabled}
                    onCheckedChange={(checked) => handleSegmentToggle(mappedSegment, checked as boolean)}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <label 
                        htmlFor={segment.id}
                        className={`font-medium cursor-pointer ${isDisabled ? 'cursor-not-allowed' : ''}`}
                      >
                        {segment.name}
                      </label>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">
                          {segment.customer_count.toLocaleString()}
                        </span>
                      </div>
                    </div>
                    {segment.description && (
                      <p className="text-sm text-muted-foreground mt-1">
                        {segment.description}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
            
            {filteredSegments.length === 0 && (
              <div className="text-center py-6 text-muted-foreground">
                <Users className="h-6 w-6 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No segments found</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-4 border-t">
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={onClose}>
          Apply Selection
        </Button>
      </div>

      {/* Modals */}
      <CustomPersonaModal
        open={showPersonaModal}
        onSave={handleCreatePersona}
        onCancel={() => setShowPersonaModal(false)}
      />
      
      <CustomSegmentModal
        open={showSegmentModal}
        onSave={handleCreateSegment}
        onCancel={() => setShowSegmentModal(false)}
      />
    </div>
  );
};