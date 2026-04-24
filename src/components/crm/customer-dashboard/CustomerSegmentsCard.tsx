import * as React from "react";
import Box from "@mui/joy/Box";
import CircularProgress from "@mui/joy/CircularProgress";
import Divider from "@mui/joy/Divider";
import IconButton from "@mui/joy/IconButton";
import Option from "@mui/joy/Option";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { Plus, Sparkles, X } from "lucide-react";
import { SegmentPicker } from "@/components/crm/segments/SegmentPicker";
import { JoyButton } from "@/components/joy/JoyButton";
import {
  JoyCard,
  JoyCardContent,
  JoyCardHeader,
} from "@/components/joy/JoyCard";
import { JoyChip } from "@/components/joy/JoyChip";
import { JoySelect } from "@/components/joy/JoySelect";
import { useAllPersonas } from "@/hooks/useAllPersonas";
import { useCustomerPersonas } from "@/hooks/useCustomerPersonas";
import { useCustomerSegments } from "@/hooks/useCustomerSegments";

interface CustomerSegmentsCardProps {
  customerId: string;
}

const segmentBadgeSx = {
  alignSelf: "center",
  flexShrink: 0,
  whiteSpace: "nowrap",
  borderRadius: "999px",
  px: 1.5,
  py: 0.25,
  minWidth: "fit-content",
  "--Chip-minHeight": "24px",
};

export function CustomerSegmentsCard({
  customerId,
}: CustomerSegmentsCardProps) {
  const {
    customerSegments,
    addSegments,
    removeSegment,
    isAddingSegments,
    isLoading,
    isRemovingSegment,
  } = useCustomerSegments(customerId);
  const { personas: allPersonas, loading: personasLoading } = useAllPersonas();
  const {
    assignments,
    assignPersona,
    unassignPersona,
    isLoading: assignedPersonasLoading,
  } = useCustomerPersonas(customerId);

  const [segmentPickerOpen, setSegmentPickerOpen] = React.useState(false);
  const [pendingSegmentIds, setPendingSegmentIds] = React.useState<string[]>(
    [],
  );
  const [personaSelection, setPersonaSelection] = React.useState("");
  const [personaSavingId, setPersonaSavingId] = React.useState<string | null>(
    null,
  );

  const assignedSegmentIds = React.useMemo(
    () => customerSegments.map((assignment) => assignment.segment_id),
    [customerSegments],
  );

  const assignedPersonas = React.useMemo(() => {
    return assignments
      .map((assignment) => {
        const personaId =
          assignment.predefined_persona_id || assignment.persona_id;
        if (!personaId) return null;

        const match = allPersonas.find((persona) => persona.id === personaId);
        return {
          id: personaId,
          label: match?.persona_name || personaId,
          isCustom: Boolean(assignment.persona_id),
        };
      })
      .filter(Boolean) as Array<{
      id: string;
      label: string;
      isCustom: boolean;
    }>;
  }, [allPersonas, assignments]);

  const handlePersonaAssign = async (personaId: string) => {
    const selectedPersona = allPersonas.find(
      (persona) => persona.id === personaId,
    );
    if (!selectedPersona) return;

    setPersonaSavingId(personaId);
    try {
      await assignPersona(selectedPersona.id, selectedPersona.is_custom);
      setPersonaSelection("");
    } finally {
      setPersonaSavingId(null);
    }
  };

  const handlePersonaRemove = async (personaId: string, isCustom: boolean) => {
    setPersonaSavingId(personaId);
    try {
      await unassignPersona(personaId, isCustom);
    } finally {
      setPersonaSavingId(null);
    }
  };

  const handleAssignSegments = async () => {
    if (!pendingSegmentIds.length) {
      return;
    }

    await addSegments(pendingSegmentIds);
    setPendingSegmentIds([]);
    setSegmentPickerOpen(false);
  };

  return (
    <JoyCard variant="outlined">
      <JoyCardHeader
        description="Manage manual segment membership and persona labels tied to this customer record."
        title="Segments & personas"
      />
      <JoyCardContent>
        <Stack spacing={2.5}>
          <Stack spacing={1.25}>
            <Stack
              direction="row"
              justifyContent="space-between"
              alignItems="center"
            >
              <Box>
                <Typography level="title-sm">Segments</Typography>
                <Typography level="body-xs" color="neutral">
                  Static segments can be assigned here. Dynamic segments update
                  automatically from their rules.
                </Typography>
              </Box>
              {segmentPickerOpen ? null : (
                <JoyButton
                  color="primary"
                  variant="plain"
                  size="sm"
                  startDecorator={<Plus size={14} />}
                  onClick={() => setSegmentPickerOpen(true)}
                >
                  Add static segment
                </JoyButton>
              )}
            </Stack>

            {segmentPickerOpen ? (
              <Stack spacing={1.25}>
                <SegmentPicker
                  excludeSegmentIds={assignedSegmentIds}
                  helperText="Only static segments can be manually attached to a customer."
                  onChange={setPendingSegmentIds}
                  typeFilter="static"
                  value={pendingSegmentIds}
                />
                <Stack direction="row" spacing={1}>
                  <JoyButton
                    disabled={!pendingSegmentIds.length || isAddingSegments}
                    loading={isAddingSegments}
                    onClick={() => void handleAssignSegments()}
                  >
                    Assign selected
                  </JoyButton>
                  <JoyButton
                    bloomVariant="ghost"
                    onClick={() => {
                      setPendingSegmentIds([]);
                      setSegmentPickerOpen(false);
                    }}
                  >
                    Cancel
                  </JoyButton>
                </Stack>
              </Stack>
            ) : null}

            {isLoading ? (
              <Stack direction="row" spacing={1} alignItems="center">
                <CircularProgress size="sm" />
                <Typography level="body-sm" color="neutral">
                  Loading segments…
                </Typography>
              </Stack>
            ) : customerSegments.length > 0 ? (
              <Stack spacing={1}>
                {customerSegments.map((assignment) => (
                  <Stack
                    key={assignment.segment_id}
                    direction="row"
                    justifyContent="space-between"
                    alignItems="center"
                    spacing={2}
                    sx={{
                      borderRadius: "var(--joy-radius-md)",
                      border: "1px solid",
                      borderColor: "neutral.200",
                      px: 1.5,
                      py: 1.25,
                    }}
                  >
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Stack
                        direction="row"
                        spacing={1}
                        alignItems="center"
                        useFlexGap
                        flexWrap="wrap"
                      >
                        <Typography level="body-sm">
                          {assignment.segment.name}
                        </Typography>
                        <JoyChip
                          color={
                            assignment.segment.type === "dynamic"
                              ? "primary"
                              : "neutral"
                          }
                          size="sm"
                          variant={
                            assignment.segment.type === "dynamic"
                              ? "soft"
                              : "outlined"
                          }
                          sx={segmentBadgeSx}
                        >
                          {assignment.segment.type === "dynamic"
                            ? "Auto"
                            : "Static"}
                        </JoyChip>
                      </Stack>
                      <Typography level="body-xs" color="neutral">
                        {assignment.segment.type === "dynamic"
                          ? "Rule-based membership. Remove by editing the segment rules."
                          : "Manual membership. You can remove this customer directly from here."}
                      </Typography>
                    </Box>
                    {assignment.segment.type === "static" ? (
                      <IconButton
                        size="sm"
                        variant="plain"
                        color="neutral"
                        disabled={isRemovingSegment}
                        onClick={() =>
                          void removeSegment(assignment.segment_id)
                        }
                        sx={{
                          width: 28,
                          height: 28,
                          minWidth: 28,
                          minHeight: 28,
                        }}
                      >
                        <X size={14} />
                      </IconButton>
                    ) : (
                      <JoyChip
                        color="primary"
                        size="sm"
                        startDecorator={<Sparkles size={12} />}
                        variant="soft"
                        sx={{
                          ...segmentBadgeSx,
                          "& .MuiChip-startDecorator": {
                            marginInlineStart: 0,
                            marginInlineEnd: "4px",
                          },
                        }}
                      >
                        Dynamic
                      </JoyChip>
                    )}
                  </Stack>
                ))}
              </Stack>
            ) : (
              <Typography level="body-xs" color="neutral">
                Not assigned to any segments.
              </Typography>
            )}
          </Stack>

          <Divider />

          <Stack spacing={1.25}>
            <Typography level="title-sm">Personas</Typography>
            {assignedPersonasLoading ? (
              <Stack direction="row" spacing={1} alignItems="center">
                <CircularProgress size="sm" />
                <Typography level="body-sm" color="neutral">
                  Loading personas…
                </Typography>
              </Stack>
            ) : assignedPersonas.length > 0 ? (
              <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                {assignedPersonas.map((persona) => (
                  <JoyChip
                    key={persona.id}
                    color="primary"
                    variant="soft"
                    size="sm"
                    endDecorator={
                      <IconButton
                        size="sm"
                        variant="plain"
                        color="primary"
                        disabled={personaSavingId === persona.id}
                        onClick={() => {
                          void handlePersonaRemove(
                            persona.id,
                            persona.isCustom,
                          );
                        }}
                        sx={{
                          width: 18,
                          height: 18,
                          minWidth: 18,
                          minHeight: 18,
                        }}
                      >
                        {personaSavingId === persona.id ? (
                          <CircularProgress size="sm" />
                        ) : (
                          <X size={12} />
                        )}
                      </IconButton>
                    }
                  >
                    {persona.label}
                  </JoyChip>
                ))}
              </Stack>
            ) : (
              <Typography level="body-xs" color="neutral">
                No persona assigned yet.
              </Typography>
            )}

            <JoySelect
              value={personaSelection}
              placeholder={
                personasLoading ? "Loading personas…" : "Assign a persona"
              }
              disabled={personasLoading || Boolean(personaSavingId)}
              onChange={(_event, value) => {
                const nextValue = value ?? "";
                setPersonaSelection(nextValue);
                if (nextValue) {
                  void handlePersonaAssign(nextValue);
                }
              }}
            >
              {allPersonas.map((persona) => (
                <Option key={persona.id} value={persona.id}>
                  <Stack spacing={0.25}>
                    <Typography level="body-sm">
                      {persona.persona_name}
                    </Typography>
                    {persona.persona_description ? (
                      <Typography level="body-xs" color="neutral">
                        {persona.persona_description}
                      </Typography>
                    ) : null}
                  </Stack>
                </Option>
              ))}
            </JoySelect>
          </Stack>

          {isAddingSegments || Boolean(personaSavingId) ? (
            <Typography level="body-xs" color="neutral">
              Updating assignments…
            </Typography>
          ) : null}
        </Stack>
      </JoyCardContent>
    </JoyCard>
  );
}
