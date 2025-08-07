import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Search, Users, Lightbulb, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PersonaTag } from "./PersonaTag";
import { SegmentChip } from "./SegmentChip";
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
  const [availablePersonas, setAvailablePersonas] = useState<Persona[]>([]);
  const [availableSegments, setAvailableSegments] = useState<Segment[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);

  // Combine and filter all audience options
  const allOptions: Array<{ type: 'persona'; data: Persona } | { type: 'segment'; data: Segment }> = [
    ...availablePersonas.map(p => ({ type: 'persona' as const, data: p })),
    ...availableSegments.map(s => ({ type: 'segment' as const, data: s }))
  ];

  const filteredOptions = searchTerm 
    ? allOptions.filter(option => {
        const name = option.type === 'persona' ? option.data.persona_name : option.data.name;
        const description = option.type === 'persona' ? option.data.persona_description : option.data.description;
        return name.toLowerCase().includes(searchTerm.toLowerCase()) ||
               (description && description.toLowerCase().includes(searchTerm.toLowerCase()));
      })
    : allOptions;

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Fetch personas
      const { data: personas, error: personasError } = await supabase
        .from('crm_personas')
        .select('*')
        .order('persona_name');

      if (personasError) throw personasError;

      // Fetch predefined segments
      const { data: predefinedSegments, error: predefinedError } = await supabase
        .from('crm_segments')
        .select('*')
        .order('name');

      if (predefinedError) throw predefinedError;

      // Fetch custom segments
      const { data: customSegments, error: customError } = await supabase
        .from('custom_segments')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (customError) throw customError;

      const allSegments: Segment[] = [
        ...(predefinedSegments || []).map(seg => ({
          id: seg.id,
          name: seg.name,
          description: seg.description,
          customer_count: seg.customer_count || 0,
          type: 'predefined' as const,
          persona_id: seg.persona_id
        })),
        ...(customSegments || []).map(seg => ({
          id: seg.id,
          name: seg.name,
          description: undefined,
          customer_count: seg.customer_count || 0,
          type: 'custom' as const
        }))
      ];

      setAvailablePersonas(personas || []);
      setAvailableSegments(allSegments);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
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

      {/* Options List */}
      <div className="space-y-2 max-h-96 overflow-y-auto">
        {filteredOptions.map((option, index) => {
          if (option.type === 'persona') {
            const persona = option.data;
            const isSelected = isPersonaSelected(persona.id);
            const isDisabled = !isSelected && selectedPersonas.length >= maxPersonas;
            
            return (
              <div
                key={`persona-${persona.id}`}
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
                <Lightbulb className="h-4 w-4 text-purple-500 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <label 
                      htmlFor={persona.id}
                      className={`font-medium cursor-pointer ${isDisabled ? 'cursor-not-allowed' : ''}`}
                    >
                      {persona.persona_name}
                    </label>
                    <Badge 
                      variant={persona.is_custom ? 'outline' : 'default'}
                      className="text-xs"
                    >
                      {persona.is_custom ? 'Custom' : 'Smart'}
                    </Badge>
                  </div>
                  {persona.persona_description && (
                    <p className="text-sm text-muted-foreground mt-1">
                      {persona.persona_description}
                    </p>
                  )}
                </div>
              </div>
            );
          } else {
            const segment = option.data;
            const isSelected = isSegmentSelected(segment.id);
            const isDisabled = !isSelected && selectedSegments.length >= maxSegments;
            
            return (
              <div
                key={`segment-${segment.id}`}
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
                  onCheckedChange={(checked) => handleSegmentToggle(segment, checked as boolean)}
                />
                <Users className="h-4 w-4 text-brand-teal flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <label 
                      htmlFor={segment.id}
                      className={`font-medium cursor-pointer ${isDisabled ? 'cursor-not-allowed' : ''}`}
                    >
                      {segment.name}
                    </label>
                    <div className="flex items-center gap-2">
                      <Badge 
                        variant={segment.type === 'predefined' ? 'default' : 'outline'}
                        className="text-xs"
                      >
                        {segment.type === 'predefined' ? 'Smart' : 'Custom'}
                      </Badge>
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
          }
        })}
        
        {filteredOptions.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No audience options found matching your search</p>
          </div>
        )}
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
    </div>
  );
};