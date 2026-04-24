import React, { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui-legacy/button";
import { Badge } from "@/components/ui-legacy/badge";
import { Checkbox } from "@/components/ui-legacy/checkbox";
import { Input } from "@/components/ui-legacy/input";
import { Separator } from "@/components/ui-legacy/separator";
import { Search, Users, Lightbulb, X, Plus, Check, Lock } from "lucide-react";
import { PersonaTag } from "./PersonaTag";
import { SegmentChip } from "./SegmentChip";
import { SegmentPicker } from "./segments/SegmentPicker";
import { CustomPersonaModal } from "./personas/CustomPersonaModal";
import { CustomSegmentModal } from "./segments/CustomSegmentModal";
import { useAllPersonas } from "@/hooks/useAllPersonas";
import { useSegments } from "@/hooks/useSegments";
import { usePersonaCustomerCounts } from "@/hooks/usePersonaCustomerCounts";
import { useTenant } from "@/hooks/useTenant";
import { toast } from "@/utils/toast";
import { useScrollGuard } from "@/hooks/useScrollGuard";
import { useNavigate } from "react-router-dom";
import { computeAudienceRecipientCount } from "@/lib/computeAudienceRecipientCount";

const AUDIENCE_RECALC_MS = 300;

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
  type: "predefined" | "custom";
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
  lockedSegmentIds?: string[];
}

export const AudienceSelector = ({
  selectedPersonas,
  selectedSegments,
  onPersonasChange,
  onSegmentsChange,
  maxPersonas = 10,
  maxSegments = 5,
  onClose,
  lockedSegmentIds = [],
}: AudienceSelectorProps) => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [showPersonaModal, setShowPersonaModal] = useState(false);
  const [showSegmentModal, setShowSegmentModal] = useState(false);
  const [isStableLoading, setIsStableLoading] = useState(true);
  const [fadeIn, setFadeIn] = useState(false);
  const [totalAudienceCount, setTotalAudienceCount] = useState(0);

  // Prevent scroll locks from persisting
  useScrollGuard();

  // Use existing hooks
  const {
    personas,
    loading: personasLoading,
    createPersona,
  } = useAllPersonas();
  const { allSegments, isLoading: segmentsLoading } = useSegments();
  const {
    counts: personaCounts,
    summary,
    loading: personaCountsLoading,
  } = usePersonaCustomerCounts();
  const { tenant } = useTenant();

  // Stable loading state management
  const isDataLoading =
    personasLoading || segmentsLoading || personaCountsLoading;
  const hasData = personas.length >= 0 && allSegments.length >= 0;

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
    ? personas.filter(
        (persona) =>
          persona.persona_name
            .toLowerCase()
            .includes(searchTerm.toLowerCase()) ||
          persona.persona_description
            ?.toLowerCase()
            .includes(searchTerm.toLowerCase()),
      )
    : personas;

  const availableSegments = useMemo(
    () =>
      allSegments.map((segment) => ({
        id: segment.id,
        name: segment.name,
        description: segment.description,
        customer_count: segment.memberCount,
        type: segment.isSystemSegment
          ? ("predefined" as const)
          : ("custom" as const),
        persona_id: segment.personaId ?? undefined,
      })),
    [allSegments],
  );

  const segmentRegistry = useMemo(
    () =>
      new Map(
        [...selectedSegments, ...availableSegments].map((segment) => [
          segment.id,
          segment,
        ]),
      ),
    [availableSegments, selectedSegments],
  );

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const run = async () => {
      if (!tenant?.id) {
        if (!cancelled) {
          setTotalAudienceCount(0);
        }
        return;
      }

      if (selectedSegments.length === 0 && selectedPersonas.length === 0) {
        if (!cancelled) {
          setTotalAudienceCount(0);
        }
        return;
      }

      try {
        const count = await computeAudienceRecipientCount({
          tenantId: tenant.id,
          totalCustomerCount: summary.totalCustomers,
          segmentIds: selectedSegments.map((segment) => segment.id),
          personaIds: selectedPersonas.map((persona) => persona.id),
        });

        if (!cancelled) {
          setTotalAudienceCount(count);
        }
      } catch (error) {
        console.error("Failed to calculate exact audience size:", error);
        if (!cancelled) {
          setTotalAudienceCount(0);
        }
      }
    };

    timer = setTimeout(() => {
      void run();
    }, AUDIENCE_RECALC_MS);

    return () => {
      cancelled = true;
      if (timer) {
        clearTimeout(timer);
      }
    };
  }, [selectedPersonas, selectedSegments, summary.totalCustomers, tenant?.id]);

  const handleCreatePersona = async (personaData: {
    name: string;
    description?: string | null;
    metadata?: any;
  }) => {
    const createdPersona = await createPersona(personaData);

    if (!createdPersona) {
      return null;
    }

    setShowPersonaModal(false);

    if (selectedPersonas.length < maxPersonas) {
      onPersonasChange([...selectedPersonas, createdPersona]);
    }

    return createdPersona;
  };

  const handleCreateSegment = async (segmentData: {
    name: string;
    filters: any[];
  }) => {
    void segmentData;
    setShowSegmentModal(false);
    onClose();
    navigate("/crm/segments/new");
    return true;
  };

  const handlePersonaToggle = (persona: Persona, checked: boolean) => {
    if (checked) {
      if (selectedPersonas.length >= maxPersonas) {
        console.error("❌ Max personas reached:", {
          current: selectedPersonas.length,
          max: maxPersonas,
        });
        toast.error(`You can select up to ${maxPersonas} personas`);
        return;
      }
      onPersonasChange([...selectedPersonas, persona]);
    } else {
      onPersonasChange(selectedPersonas.filter((p) => p.id !== persona.id));
    }
  };

  const handleSegmentToggle = (segment: Segment, checked: boolean) => {
    // Prevent toggling off locked segments
    if (!checked && lockedSegmentIds.includes(segment.id)) return;
    if (checked) {
      if (selectedSegments.length >= maxSegments) {
        toast.error(`You can select up to ${maxSegments} segments`);
        return;
      }
      onSegmentsChange([...selectedSegments, segment]);
    } else {
      onSegmentsChange(selectedSegments.filter((s) => s.id !== segment.id));
    }
  };

  const handleSegmentIdsChange = (segmentIds: string[]) => {
    const lockedSelection = lockedSegmentIds.filter((segmentId) =>
      selectedSegments.some((segment) => segment.id === segmentId),
    );
    const mergedIds = Array.from(new Set([...segmentIds, ...lockedSelection]));

    if (mergedIds.length > maxSegments) {
      toast.error(`You can select up to ${maxSegments} segments`);
      return;
    }

    const nextSegments = mergedIds
      .map((segmentId) => segmentRegistry.get(segmentId))
      .filter(Boolean) as Segment[];

    onSegmentsChange(nextSegments);
  };

  const removePersona = (personaId: string) => {
    onPersonasChange(selectedPersonas.filter((p) => p.id !== personaId));
  };

  const removeSegment = (segmentId: string) => {
    if (lockedSegmentIds.includes(segmentId)) return;
    onSegmentsChange(selectedSegments.filter((s) => s.id !== segmentId));
  };

  const clearAll = () => {
    onPersonasChange([]);
    onSegmentsChange([]);
  };

  const getTotalAudience = () => {
    return totalAudienceCount;
  };

  const isPersonaSelected = (personaId: string) => {
    const isSelected = selectedPersonas.some((p) => p.id === personaId);
    return isSelected;
  };

  const isSegmentSelected = (segmentId: string) => {
    return selectedSegments.some((s) => s.id === segmentId);
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
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-16 bg-muted rounded"></div>
                ))}
              </div>
            </div>
            <div className="space-y-3">
              <div className="h-6 bg-muted rounded w-1/3"></div>
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
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
    <div
      className={`p-6 space-y-6 min-h-0 flex flex-col transition-all duration-300 ${fadeIn ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"}`}
    >
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
                <span>
                  Personas ({selectedPersonas.length}/{maxPersonas}):
                </span>
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
                <span>
                  Segments ({selectedSegments.length}/{maxSegments}):
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {selectedSegments.map((segment) => (
                  <SegmentChip
                    key={segment.id}
                    segment={segment}
                    removable={!lockedSegmentIds.includes(segment.id)}
                    onRemove={removeSegment}
                    size="sm"
                    locked={lockedSegmentIds.includes(segment.id)}
                  />
                ))}
              </div>
            </div>
          )}

          {(selectedSegments.length > 0 || selectedPersonas.length > 0) && (
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

          <div className="space-y-2 max-h-96 overflow-y-auto scroll-container border border-border rounded-lg p-3">
            {filteredPersonas.map((persona) => {
              const isSelected = isPersonaSelected(persona.id);
              const isDisabled =
                !isSelected && selectedPersonas.length >= maxPersonas;

              return (
                <div
                  key={persona.id}
                  className={`flex items-center space-x-3 p-3 rounded-lg border transition-colors ${
                    isSelected
                      ? "border-purple-500 bg-purple-50"
                      : isDisabled
                        ? "border-muted bg-muted/50 opacity-50"
                        : "border-border hover:border-purple-300 hover:bg-purple-50/50"
                  }`}
                >
                  <Checkbox
                    id={persona.id}
                    checked={isSelected}
                    disabled={isDisabled}
                    onCheckedChange={(checked) =>
                      handlePersonaToggle(persona, checked as boolean)
                    }
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <label
                        htmlFor={persona.id}
                        className={`font-medium cursor-pointer ${isDisabled ? "cursor-not-allowed" : ""}`}
                      >
                        {persona.persona_name}
                      </label>
                      {persona.is_custom && (
                        <Badge variant="outline" className="text-xs">
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

          <div className="space-y-2 max-h-96 overflow-y-auto scroll-container border border-border rounded-lg p-3">
            <div
              className={`flex items-center space-x-3 p-3 rounded-lg border transition-colors ${
                selectedSegments.length === 0 && selectedPersonas.length === 0
                  ? "border-brand-teal bg-brand-teal/5"
                  : "border-border hover:border-brand-teal/30 hover:bg-brand-teal/5"
              }`}
            >
              <Checkbox
                id="all-contacts"
                checked={
                  selectedSegments.length === 0 && selectedPersonas.length === 0
                }
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
                  <Badge
                    variant="outline"
                    className="text-xs bg-green-100 text-green-800"
                  >
                    Entire List
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  Send to your entire contact database
                </p>
              </div>
            </div>

            <div className="rounded-lg border border-border bg-background p-3">
              <SegmentPicker
                onChange={handleSegmentIdsChange}
                statuses={["active", "draft", "paused"]}
                value={selectedSegments.map((segment) => segment.id)}
              />
              <p className="mt-2 text-sm text-muted-foreground">
                Use the shared segment picker so campaigns and automations
                target the same tenant-scoped audiences as the new segments
                workspace.
              </p>
            </div>

            {selectedSegments.length > 0 ? (
              <div className="space-y-2">
                {selectedSegments.map((segment) => (
                  <div
                    key={segment.id}
                    className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="font-medium">{segment.name}</div>
                      {segment.description ? (
                        <p className="text-sm text-muted-foreground">
                          {segment.description}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span>{segment.customer_count.toLocaleString()}</span>
                      {lockedSegmentIds.includes(segment.id) ? (
                        <Lock className="h-4 w-4" />
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {/* Save & Close Button */}
      <div className="flex justify-end pt-4 border-t flex-shrink-0">
        <Button onClick={onClose} className="gap-2">
          <Check className="h-4 w-4" />
          Save & Close
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
