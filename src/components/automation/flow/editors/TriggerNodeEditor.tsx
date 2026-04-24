import React, { useEffect, useMemo, useState } from "react";
import CircularProgress from "@mui/joy/CircularProgress";
import Sheet from "@mui/joy/Sheet";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { Zap } from "lucide-react";
import { JoyButton } from "@/components/joy/JoyButton";
import { JoySelect } from "@/components/joy/JoySelect";
import { triggerCatalog } from "@/lib/automation/triggerCatalog";
import { supabase } from "@/integrations/supabase/client";
import { useAllPersonas } from "@/hooks/useAllPersonas";

interface TriggerNodeData {
  triggerType: string;
  label: string;
  conditions?: Record<string, any>;
  overlapBehavior?: string;
}

interface TriggerNodeEditorProps {
  data: TriggerNodeData;
  onSave: (data: TriggerNodeData) => void;
  onCancel: () => void;
}

export const TriggerNodeEditor: React.FC<TriggerNodeEditorProps> = ({
  data,
  onSave,
  onCancel,
}) => {
  const { personas } = useAllPersonas();
  const [triggerType, setTriggerType] = useState(
    data.triggerType || "loyalty_join",
  );
  const [selectedSegmentId, setSelectedSegmentId] = useState<string>(
    data.conditions?.segment_id || "",
  );
  const [selectedPersonaId, setSelectedPersonaId] = useState<string>(
    data.conditions?.persona_id || "",
  );
  const [selectedFormId, setSelectedFormId] = useState<string>(
    data.conditions?.form_id || "",
  );
  const [overlapBehavior, setOverlapBehavior] = useState<string>(
    data.overlapBehavior || "ignore",
  );
  const [segments, setSegments] = useState<Array<{ id: string; name: string }>>(
    [],
  );
  const [forms, setForms] = useState<Array<{ id: string; name: string }>>([]);
  const [isLoadingContext, setIsLoadingContext] = useState(false);

  useEffect(() => {
    setTriggerType(data.triggerType || "loyalty_join");
    setSelectedSegmentId(data.conditions?.segment_id || "");
    setSelectedPersonaId(data.conditions?.persona_id || "");
    setSelectedFormId(data.conditions?.form_id || "");
    setOverlapBehavior(data.overlapBehavior || "ignore");
  }, [data.conditions, data.overlapBehavior, data.triggerType]);

  useEffect(() => {
    let isActive = true;

    if (!["segment.added", "form_submitted"].includes(triggerType)) {
      return undefined;
    }

    setIsLoadingContext(true);

    Promise.all([
      triggerType === "segment.added"
        ? Promise.all([
            supabase.from("crm_segments").select("id, name").order("name"),
            supabase.from("custom_segments").select("id, name").order("name"),
          ])
        : Promise.resolve(null),
      triggerType === "form_submitted"
        ? supabase.from("forms").select("id, name").order("name")
        : Promise.resolve(null),
    ])
      .then(([segmentResults, formResult]) => {
        if (!isActive) {
          return;
        }

        if (segmentResults) {
          const [crmSegments, customSegments] = segmentResults;
          if (crmSegments.error) {
            throw crmSegments.error;
          }
          if (customSegments.error) {
            throw customSegments.error;
          }
          setSegments([
            ...(crmSegments.data ?? []).map((segment) => ({
              id: String(segment.id),
              name: String(segment.name),
            })),
            ...(customSegments.data ?? []).map((segment) => ({
              id: String(segment.id),
              name: String(segment.name),
            })),
          ]);
        }

        if (formResult) {
          if (formResult.error) {
            throw formResult.error;
          }
          setForms(
            (formResult.data ?? []).map((form) => ({
              id: String(form.id),
              name: String(form.name),
            })),
          );
        }
      })
      .catch((error) => {
        console.error("Failed to load trigger context:", error);
      })
      .finally(() => {
        if (isActive) {
          setIsLoadingContext(false);
        }
      });

    return () => {
      isActive = false;
    };
  }, [triggerType]);

  const handleSave = () => {
    const selectedTrigger = triggerCatalog.find(
      (trigger) => trigger.id === triggerType,
    );
    const conditions: Record<string, any> = {};

    if (triggerType === "segment.added" && selectedSegmentId) {
      conditions.segment_id = selectedSegmentId;
      conditions.segment_name = segments.find(
        (segment) => segment.id === selectedSegmentId,
      )?.name;
    }

    if (triggerType === "persona.assigned" && selectedPersonaId) {
      conditions.persona_id = selectedPersonaId;
      conditions.persona_name = personas.find(
        (persona) => persona.id === selectedPersonaId,
      )?.persona_name;
    }

    if (triggerType === "form_submitted" && selectedFormId) {
      conditions.form_id = selectedFormId;
      conditions.form_name = forms.find(
        (form) => form.id === selectedFormId,
      )?.name;
    }

    onSave({
      ...data,
      triggerType,
      label: selectedTrigger?.label || "Trigger",
      conditions,
      overlapBehavior,
    });
  };

  const selectedTrigger = triggerCatalog.find(
    (trigger) => trigger.id === triggerType,
  );
  const isSaveDisabled = useMemo(
    () =>
      (triggerType === "segment.added" && !selectedSegmentId) ||
      (triggerType === "persona.assigned" && !selectedPersonaId) ||
      (triggerType === "form_submitted" && !selectedFormId),
    [selectedFormId, selectedPersonaId, selectedSegmentId, triggerType],
  );

  return (
    <Stack spacing={2} sx={{ p: 2 }}>
      <Sheet variant="soft" color="neutral" sx={{ p: 1.5, borderRadius: "lg" }}>
        <Stack direction="row" spacing={1.25} alignItems="flex-start">
          <Zap size={16} />
          <Stack spacing={0.5}>
            <Typography level="title-sm">Trigger setup</Typography>
            <Typography level="body-sm" sx={{ color: "neutral.600" }}>
              Pick the event that starts this automation and add any required
              context like a specific segment, persona, or form.
            </Typography>
          </Stack>
        </Stack>
      </Sheet>

      <JoySelect
        label="Trigger type"
        value={triggerType}
        options={triggerCatalog.map((trigger) => ({
          value: trigger.id,
          label: trigger.label,
        }))}
        onChange={(_event, value) => {
          if (!value) {
            return;
          }

          setTriggerType(value);
          setSelectedSegmentId("");
          setSelectedPersonaId("");
          setSelectedFormId("");
        }}
      />

      {triggerType === "segment.added" ? (
        isLoadingContext ? (
          <Sheet
            variant="soft"
            color="neutral"
            sx={{ p: 1.25, borderRadius: "md" }}
          >
            <Stack direction="row" spacing={1} alignItems="center">
              <CircularProgress size="sm" />
              <Typography level="body-sm">Loading segments...</Typography>
            </Stack>
          </Sheet>
        ) : (
          <JoySelect
            label="Segment"
            value={selectedSegmentId}
            options={segments.map((segment) => ({
              value: segment.id,
              label: segment.name,
            }))}
            onChange={(_event, value) => setSelectedSegmentId(value ?? "")}
            helperText="This trigger only fires when a contact is added to the selected segment."
          />
        )
      ) : null}

      {triggerType === "persona.assigned" ? (
        <JoySelect
          label="Persona"
          value={selectedPersonaId}
          options={personas.map((persona) => ({
            value: persona.id,
            label: persona.persona_name,
          }))}
          onChange={(_event, value) => setSelectedPersonaId(value ?? "")}
          helperText="This trigger only fires when that persona is assigned to a contact."
        />
      ) : null}

      {triggerType === "form_submitted" ? (
        isLoadingContext ? (
          <Sheet
            variant="soft"
            color="neutral"
            sx={{ p: 1.25, borderRadius: "md" }}
          >
            <Stack direction="row" spacing={1} alignItems="center">
              <CircularProgress size="sm" />
              <Typography level="body-sm">Loading forms...</Typography>
            </Stack>
          </Sheet>
        ) : (
          <JoySelect
            label="Form"
            value={selectedFormId}
            options={forms.map((form) => ({
              value: form.id,
              label: form.name,
            }))}
            onChange={(_event, value) => setSelectedFormId(value ?? "")}
            helperText="Choose the form submission event that should start the automation."
          />
        )
      ) : null}

      <JoySelect
        label="When the customer is already in this automation"
        value={overlapBehavior}
        options={[
          { value: "ignore", label: "Ignore new trigger" },
          { value: "restart", label: "Restart from the beginning" },
          { value: "parallel", label: "Allow parallel runs" },
        ]}
        onChange={(_event, value) => setOverlapBehavior(value ?? "ignore")}
        helperText={
          overlapBehavior === "ignore"
            ? "New triggers are skipped if the customer is already active in this automation."
            : overlapBehavior === "restart"
              ? "The current run is replaced and the customer starts over at step 1."
              : "Multiple runs can execute simultaneously for the same customer."
        }
      />

      {selectedTrigger ? (
        <Sheet variant="outlined" sx={{ p: 1.5, borderRadius: "lg" }}>
          <Typography level="title-sm">{selectedTrigger.label}</Typography>
          <Typography level="body-sm" sx={{ mt: 0.5, color: "neutral.600" }}>
            {selectedTrigger.description}
          </Typography>
          <Typography level="body-xs" sx={{ mt: 0.75, color: "neutral.500" }}>
            {selectedTrigger.audienceType === "event"
              ? "This is an event trigger, so audience filters are optional."
              : "This is a batch trigger, so you should save audience filters before activation."}
          </Typography>
        </Sheet>
      ) : null}

      <Stack direction="row" spacing={1} justifyContent="flex-end">
        <JoyButton variant="outlined" color="neutral" onClick={onCancel}>
          Cancel
        </JoyButton>
        <JoyButton onClick={handleSave} disabled={isSaveDisabled}>
          Save changes
        </JoyButton>
      </Stack>
    </Stack>
  );
};
