import React, { useState, useEffect, useMemo } from 'react';
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
import { usePersonaCustomerCounts } from "@/hooks/usePersonaCustomerCounts";
import { toast } from "@/utils/toast";
import { useScrollGuard } from "@/hooks/useScrollGuard";

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
  maxPersonas = 10,
  maxSegments = 5,
  onClose
}: AudienceSelectorProps) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [showPersonaModal, setShowPersonaModal] = useState(false);
  const [showSegmentModal, setShowSegmentModal] = useState(false);
  const [isStableLoading, setIsStableLoading] = useState(true);
  const [fadeIn, setFadeIn] = useState(false);
  
  // Prevent scroll locks from persisting
  useScrollGuard();

  // Use existing hooks
  const { personas, loading: personasLoading } = useAllPersonas();
  const { segments, loading: segmentsLoading } = useAllSegments();
  const { counts: personaCounts, loading: personaCountsLoading } = usePersonaCustomerCounts();
  
  // Debug personas data
  console.log('🔍 AudienceSelector personas data:', { 
    totalPersonas: personas.length, 
    customPersonasCount: personas.filter(p => p.is_custom).length,
    selectedPersonas: selectedPersonas.map(p => ({ id: p.id, name: p.persona_name })),
    personaIds: personas.map(p => p.id).slice(0, 5) // Show first 5 IDs
  });

  // Stable loading state management
  const isDataLoading = personasLoading || segmentsLoading || personaCountsLoading;
  const hasData = personas.length >= 0 && segments.length >= 0;

  // Implement minimum loading duration and smooth transitions
  useEffect(() => {
    if (!isDataLoading && hasData) {
      // Add minimum loading time of 300ms to prevent flashing
      const timer = setTimeout(() => {
        setIsStableLoading(false);
        // Start fade-in after loading completes
        requestAnimationFrame(() => {
          setFadeIn(true);
        });
      }, 300);

      return () => clearTimeout(timer);
    }
  }, [isDataLoading, hasData]);

  const loading = isStableLoading;
  const dataReady = !loading && !isDataLoading && hasData;

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
    console.log('🔄 handlePersonaToggle called:', { 
      personaName: persona.persona_name, 
      personaId: persona.id,
      checked, 
      currentSelectedCount: selectedPersonas.length,
      maxPersonas 
    });
    
    if (checked) {
      if (selectedPersonas.length >= maxPersonas) {
        console.error('❌ Max personas reached:', { current: selectedPersonas.length, max: maxPersonas });
        toast.error(`You can select up to ${maxPersonas} personas`);
        return;
      }
      console.log('✅ Adding persona to selection');
      onPersonasChange([...selectedPersonas, persona]);
    } else {
      console.log('➖ Removing persona from selection');
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
    // Calculate total from segments
    const segmentTotal = selectedSegments.reduce((total, segment) => total + segment.customer_count, 0);
    
    // Calculate total from personas
    const personaTotal = selectedPersonas.reduce((total, persona) => {
      const count = personaCounts[persona.id] || 0;
      return total + count;
    }, 0);
    
    console.log('🔍 getTotalAudience calculation:', {
      segmentTotal,
      personaTotal,
      selectedSegments: selectedSegments.map(s => ({ name: s.name, count: s.customer_count })),
      selectedPersonas: selectedPersonas.map(p => ({ name: p.persona_name, count: personaCounts[p.id] || 0 })),
      personaCounts
    });
    
    return segmentTotal + personaTotal;
  };

  const isPersonaSelected = (personaId: string) => {
    const isSelected = selectedPersonas.some(p => p.id === personaId);
    console.log('🔍 Checking if persona is selected:', { 
      personaId, 
      selectedPersonas: selectedPersonas.map(p => ({ id: p.id, name: p.persona_name })),
      isSelected,
      totalAvailablePersonas: personas.length,
      maxPersonas,
      currentSelectedCount: selectedPersonas.length
    });
    return isSelected;
  };

  const isSegmentSelected = (segmentId: string) => {
    return selectedSegments.some(s => s.id === segmentId);
  };

  if (loading) {
    return (
      <div className="p-6 min-h-[600px] opacity-100 transition-opacity duration-300">
        <div className="animate-pulse space-y-6">
          {/* Search skeleton */}
          <div className="h-10 bg-muted rounded"></div>
          
          {/* Two column layout skeleton */}
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-3">
              <div className="h-6 bg-muted rounded w-1/3"></div>
              <div className="space-y-2">
                {[1, 2, 3].map(i => (
                  <div key={i} className="h-16 bg-muted rounded"></div>
                ))}
              </div>
            </div>
            <div className="space-y-3">
              <div className="h-6 bg-muted rounded w-1/3"></div>
              <div className="space-y-2">
                {[1, 2, 3].map(i => (
                  <div key={i} className="h-16 bg-muted rounded"></div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`p-6 space-y-6 min-h-0 transition-all duration-300 ${fadeIn ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}`}>
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
        <div className="p-4 bg-muted border-2 border-dashed border-muted-foreground/30 rounded-lg space-y-4">
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
      <div className="grid grid-cols-2 gap-6">
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
          
          <div className="space-y-2 max-h-80 overflow-y-auto scroll-container border border-border rounded-lg p-3">
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
          
          <div className="space-y-2 max-h-80 overflow-y-auto scroll-container border border-border rounded-lg p-3">
            {/* Add "All Contacts" Option */}
            <div
              className={`flex items-center space-x-3 p-3 rounded-lg border transition-colors ${
                selectedSegments.length === 0 && selectedPersonas.length === 0
                  ? 'border-brand-teal bg-brand-teal/5' 
                  : 'border-border hover:border-brand-teal/30 hover:bg-brand-teal/5'
              }`}
            >
              <Checkbox
                id="all-contacts"
                checked={selectedSegments.length === 0 && selectedPersonas.length === 0}
                onCheckedChange={(checked) => {
                  if (checked) {
                    onPersonasChange([]);
                    onSegmentsChange([]);
                  }
                }}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <label 
                    htmlFor="all-contacts"
                    className="font-medium cursor-pointer"
                  >
                    All Contacts
                  </label>
                  <Badge variant="outline" className="text-xs bg-green-100 text-green-800">
                    Entire List
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  Send to your entire contact database
                </p>
              </div>
            </div>
            
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