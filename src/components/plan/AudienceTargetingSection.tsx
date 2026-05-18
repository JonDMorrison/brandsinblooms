import React, { useMemo, useState } from "react";
import Alert from "@mui/joy/Alert";
import Box from "@mui/joy/Box";
import Button from "@mui/joy/Button";
import Card from "@mui/joy/Card";
import Chip from "@mui/joy/Chip";
import ChipDelete from "@mui/joy/ChipDelete";
import FormControl from "@mui/joy/FormControl";
import FormLabel from "@mui/joy/FormLabel";
import Radio from "@mui/joy/Radio";
import RadioGroup from "@mui/joy/RadioGroup";
import Sheet from "@mui/joy/Sheet";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { Globe, Target, Users } from "lucide-react";
import { SegmentSelectorModal } from "@/components/crm/SegmentSelectorModal";
import { PersonaSelectorModal } from "@/components/crm/PersonaSelectorModal";
import { usePersonaAwareGeneration } from "@/hooks/usePersonaAwareGeneration";
import { useSegmentSelector } from "@/hooks/useSegmentSelector";
import { PlanItem } from "./constants";
import { usePlanWizard } from "./PlanWizardContext";

type AudienceTarget = NonNullable<PlanItem["audienceTarget"]>;

interface AudienceTargetingSectionProps {
  onSelectionChange?: (selection: {
    target: AudienceTarget;
    segmentIds?: string[];
    personaIds?: string[];
  }) => void;
}

interface SegmentSelection {
  id: string;
  name: string;
  customer_count?: number;
  description?: string;
}

interface PersonaSelection {
  id: string;
  persona_name: string;
  persona_description?: string;
  is_custom: boolean;
}

const AUDIENCE_TARGETS: AudienceTarget[] = ["all", "segments", "personas"];

const isAudienceTarget = (value: string): value is AudienceTarget =>
  AUDIENCE_TARGETS.includes(value as AudienceTarget);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const normalizePersonaSelections = (personas: unknown[]): PersonaSelection[] =>
  personas.flatMap((persona) => {
    if (!isRecord(persona)) return [];
    const { id, persona_name, persona_description, is_custom } = persona;

    if (typeof id !== "string" || typeof persona_name !== "string") {
      return [];
    }

    return [
      {
        id,
        persona_name,
        persona_description:
          typeof persona_description === "string"
            ? persona_description
            : undefined,
        is_custom: typeof is_custom === "boolean" ? is_custom : false,
      },
    ];
  });

export const AudienceTargetingSection: React.FC<
  AudienceTargetingSectionProps
> = ({ onSelectionChange }) => {
  const { state, updateItem } = usePlanWizard();
  const allEmailItems = useMemo(
    () => state.items.filter((item) => item.type === "email"),
    [state.items],
  );
  const enabledEmailCount = allEmailItems.filter((item) => item.enabled).length;
  const initialTarget =
    allEmailItems.find((item) => item.audienceTarget)?.audienceTarget || "all";
  const [targetType, setTargetType] = useState<AudienceTarget>(initialTarget);
  const [selectedSegments, setSelectedSegments] = useState<SegmentSelection[]>(
    [],
  );
  const [personaModalOpen, setPersonaModalOpen] = useState(false);
  const { selectedPersonas, setSelectedPersonas } = usePersonaAwareGeneration();

  const applySelection = (
    target: AudienceTarget,
    segmentIds: string[] = [],
    personaIds: string[] = [],
  ) => {
    setTargetType(target);

    allEmailItems.forEach((item) => {
      updateItem(item.id, {
        audienceTarget: target,
        selectedSegmentIds: segmentIds,
        selectedPersonaIds: personaIds,
      });
    });

    onSelectionChange?.({ target, segmentIds, personaIds });
  };

  const selectedSegmentIds = selectedSegments.map((segment) => segment.id);
  const selectedPersonaIds = selectedPersonas.map((persona) => persona.id);

  const {
    isOpen: segmentModalOpen,
    openModal: openSegmentModal,
    closeModal: closeSegmentModal,
    handleSegmentsSelected,
  } = useSegmentSelector({
    onSegmentsSelected: (segments) => {
      setSelectedSegments(segments);
      applySelection(
        "segments",
        segments.map((segment) => segment.id),
        [],
      );
    },
  });

  const handleTargetTypeChange = (value: string) => {
    if (!isAudienceTarget(value)) return;

    if (value === "all") {
      setSelectedSegments([]);
      setSelectedPersonas([]);
      applySelection("all", [], []);
      return;
    }

    if (value === "segments") {
      applySelection("segments", selectedSegmentIds, []);
      return;
    }

    applySelection("personas", [], selectedPersonaIds);
  };

  const handleSegmentDelete = (segmentId: string) => {
    const nextSegments = selectedSegments.filter(
      (segment) => segment.id !== segmentId,
    );
    setSelectedSegments(nextSegments);
    applySelection(
      "segments",
      nextSegments.map((segment) => segment.id),
      [],
    );
  };

  const handlePersonaSelection = (personas: unknown[]) => {
    const normalizedPersonas = normalizePersonaSelections(personas);
    setSelectedPersonas(normalizedPersonas);
    applySelection(
      "personas",
      [],
      normalizedPersonas.map((persona) => persona.id),
    );
  };

  const handlePersonaDelete = (personaId: string) => {
    const nextPersonas = selectedPersonas.filter(
      (persona) => persona.id !== personaId,
    );
    setSelectedPersonas(nextPersonas);
    applySelection(
      "personas",
      [],
      nextPersonas.map((persona) => persona.id),
    );
  };

  const renderOptionCard = (
    value: AudienceTarget,
    label: string,
    description: string,
    icon: React.ReactNode,
    children?: React.ReactNode,
  ) => {
    const selected = targetType === value;

    return (
      <Sheet
        key={value}
        variant="outlined"
        sx={{
          borderColor: selected ? "primary.outlinedBorder" : "divider",
          borderRadius: "md",
          p: 1.5,
        }}
      >
        <Stack spacing={1.25}>
          <Stack direction="row" spacing={1.25} alignItems="flex-start">
            <Radio
              checked={selected}
              value={value}
              slotProps={{ input: { "aria-label": label } }}
            />
            <Box
              sx={{
                color: selected ? "primary.500" : "neutral.500",
                lineHeight: 0,
                mt: "0.2rem",
              }}
            >
              {icon}
            </Box>
            <Stack spacing={0.25} sx={{ minWidth: 0 }}>
              <Typography level="title-sm">{label}</Typography>
              <Typography color="neutral" level="body-sm">
                {description}
              </Typography>
            </Stack>
          </Stack>
          {selected ? children : null}
        </Stack>
      </Sheet>
    );
  };

  return (
    <>
      <Card variant="outlined" sx={{ p: { xs: 2, sm: 2.5 } }}>
        <Stack spacing={2.25}>
          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={1.5}
            justifyContent="space-between"
          >
            <Stack spacing={0.5}>
              <Typography level="title-lg">Audience Targeting</Typography>
              <Typography color="neutral" level="body-sm">
                Choose who receives the email items in this plan.
              </Typography>
            </Stack>
            <Chip color="neutral" variant="soft">
              {enabledEmailCount} enabled email
              {enabledEmailCount === 1 ? "" : "s"}
            </Chip>
          </Stack>

          {allEmailItems.length === 0 ? (
            <Alert color="neutral" variant="soft">
              No email items are included, so audience targeting is not needed
              for this plan.
            </Alert>
          ) : (
            <FormControl>
              <FormLabel>Target audience</FormLabel>
              <RadioGroup
                value={targetType}
                onChange={(event) => handleTargetTypeChange(event.target.value)}
              >
                <Stack spacing={1.25}>
                  {renderOptionCard(
                    "all",
                    "All Customers",
                    "Send email campaigns to your full eligible customer list.",
                    <Globe aria-hidden="true" size={16} />,
                  )}

                  {renderOptionCard(
                    "segments",
                    "Customer Segments",
                    "Narrow delivery to saved or predefined customer segments.",
                    <Users aria-hidden="true" size={16} />,
                    <Stack spacing={1} sx={{ pl: { xs: 0, sm: 4.25 } }}>
                      <Button
                        color="neutral"
                        onClick={openSegmentModal}
                        size="sm"
                        variant="outlined"
                      >
                        {selectedSegments.length
                          ? "Change Segments"
                          : "Select Segments"}
                      </Button>
                      {selectedSegments.length ? (
                        <Stack
                          direction="row"
                          spacing={0.75}
                          sx={{ flexWrap: "wrap" }}
                          useFlexGap
                        >
                          {selectedSegments.map((segment) => (
                            <Chip
                              color="neutral"
                              endDecorator={
                                <ChipDelete
                                  aria-label={`Remove ${segment.name}`}
                                  onDelete={() =>
                                    handleSegmentDelete(segment.id)
                                  }
                                />
                              }
                              key={segment.id}
                              size="sm"
                              variant="soft"
                            >
                              {segment.name}
                            </Chip>
                          ))}
                        </Stack>
                      ) : (
                        <Typography color="neutral" level="body-xs">
                          No segments selected.
                        </Typography>
                      )}
                    </Stack>,
                  )}

                  {renderOptionCard(
                    "personas",
                    "Customer Personas",
                    "Target customers that match selected persona profiles.",
                    <Target aria-hidden="true" size={16} />,
                    <Stack spacing={1} sx={{ pl: { xs: 0, sm: 4.25 } }}>
                      <Button
                        color="neutral"
                        onClick={() => setPersonaModalOpen(true)}
                        size="sm"
                        variant="outlined"
                      >
                        {selectedPersonas.length
                          ? "Change Personas"
                          : "Select Personas"}
                      </Button>
                      {selectedPersonas.length ? (
                        <Stack
                          direction="row"
                          spacing={0.75}
                          sx={{ flexWrap: "wrap" }}
                          useFlexGap
                        >
                          {selectedPersonas.map((persona) => (
                            <Chip
                              color="neutral"
                              endDecorator={
                                <ChipDelete
                                  aria-label={`Remove ${persona.persona_name}`}
                                  onDelete={() =>
                                    handlePersonaDelete(persona.id)
                                  }
                                />
                              }
                              key={persona.id}
                              size="sm"
                              variant="soft"
                            >
                              {persona.persona_name}
                            </Chip>
                          ))}
                        </Stack>
                      ) : (
                        <Typography color="neutral" level="body-xs">
                          No personas selected.
                        </Typography>
                      )}
                    </Stack>,
                  )}
                </Stack>
              </RadioGroup>
            </FormControl>
          )}

          {allEmailItems.length > 0 ? (
            <Sheet variant="outlined" sx={{ borderRadius: "md", p: 1.5 }}>
              <Typography color="neutral" level="body-sm">
                Target: {targetType === "all" ? "All customers" : null}
                {targetType === "segments"
                  ? selectedSegments.length
                    ? `${selectedSegments.length} segment${selectedSegments.length === 1 ? "" : "s"}`
                    : "No segments selected"
                  : null}
                {targetType === "personas"
                  ? selectedPersonas.length
                    ? `${selectedPersonas.length} persona${selectedPersonas.length === 1 ? "" : "s"}`
                    : "No personas selected"
                  : null}
              </Typography>
            </Sheet>
          ) : null}
        </Stack>
      </Card>

      <SegmentSelectorModal
        open={segmentModalOpen}
        onClose={closeSegmentModal}
        onSegmentsSelected={handleSegmentsSelected}
        selectedSegmentIds={selectedSegmentIds}
        title="Select Target Segments"
        description="Choose the customer segments that should receive these email campaigns."
      />

      <PersonaSelectorModal
        open={personaModalOpen}
        onClose={() => setPersonaModalOpen(false)}
        onPersonasSelected={handlePersonaSelection}
        selectedPersonaIds={selectedPersonaIds}
        title="Select Target Personas"
        description="Choose the persona profiles that should receive these email campaigns."
      />
    </>
  );
};
