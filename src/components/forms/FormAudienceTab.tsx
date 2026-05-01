import * as React from "react";
import Alert from "@mui/joy/Alert";
import Box from "@mui/joy/Box";
import Button from "@mui/joy/Button";
import Sheet from "@mui/joy/Sheet";
import Skeleton from "@mui/joy/Skeleton";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { AlertTriangle, ArrowRight, RefreshCw, Tag } from "lucide-react";
import { JoyAutocomplete } from "@/components/joy/JoyAutocomplete";
import { JoyChip } from "@/components/joy/JoyChip";
import { useCRMPersonas } from "@/hooks/useCRMPersonas";
import { useCRMTags } from "@/hooks/useCRMTags";

interface FormAudienceTabProps {
  audience: {
    assign_personas: string[];
    assign_tags: string[];
  };
  onAudienceChange: (audience: {
    assign_personas: string[];
    assign_tags: string[];
  }) => void;
}

interface SelectOption {
  value: string;
  label: string;
  description?: string | null;
}

function AudienceSection(props: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Sheet
      variant="outlined"
      sx={{
        borderRadius: "var(--joy-radius-lg)",
        borderColor: "neutral.200",
        backgroundColor: "background.surface",
        p: { xs: 2, md: 2.5 },
      }}
    >
      <Stack spacing={2}>
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={1.25}
          justifyContent="space-between"
          alignItems={{ xs: "flex-start", sm: "center" }}
        >
          <Stack spacing={0.35}>
            <Typography level="title-md">{props.title}</Typography>
            {props.description ? (
              <Typography level="body-sm" color="neutral">
                {props.description}
              </Typography>
            ) : null}
          </Stack>
          {props.actions}
        </Stack>
        {props.children}
      </Stack>
    </Sheet>
  );
}

function SelectionSkeleton() {
  return (
    <Stack spacing={1.25}>
      <Skeleton variant="text" width={140} height={18} animation="wave" />
      <Skeleton
        variant="rectangular"
        height={40}
        animation="wave"
        sx={{ borderRadius: "16px" }}
      />
      <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
        {Array.from({ length: 7 }).map((_, index) => (
          <Skeleton
            key={index}
            variant="rectangular"
            width={index % 2 === 0 ? 104 : 82}
            height={28}
            animation="wave"
            sx={{ borderRadius: 999 }}
          />
        ))}
      </Stack>
    </Stack>
  );
}

function AssignmentPicker(props: {
  label: string;
  helperText: string;
  emptyMessage: string;
  searchPlaceholder: string;
  loading: boolean;
  error: Error | null;
  options: SelectOption[];
  value: string[];
  onRetry: () => void;
  onChange: (nextValue: string[]) => void;
  statusAlert?: React.ReactNode;
}) {
  const selectedOptions = React.useMemo(() => {
    const optionMap = new Map(
      props.options.map((option) => [option.value, option]),
    );

    return props.value.map((value) => {
      const matched = optionMap.get(value);

      return (
        matched || {
          value,
          label: "Unavailable selection",
          description: "This item is no longer available in CRM.",
        }
      );
    });
  }, [props.options, props.value]);

  return (
    <Stack spacing={1.25}>
      <Stack spacing={0.35}>
        <Typography level="title-sm">{props.label}</Typography>
        <Typography level="body-sm" color="neutral">
          {props.helperText}
        </Typography>
      </Stack>

      {props.statusAlert}

      {props.loading ? (
        <SelectionSkeleton />
      ) : props.error ? (
        <Alert
          size="sm"
          color="danger"
          variant="soft"
          startDecorator={<AlertTriangle size={16} />}
          endDecorator={
            <Button
              size="sm"
              variant="plain"
              color="danger"
              startDecorator={<RefreshCw size={14} />}
              onClick={props.onRetry}
            >
              Retry
            </Button>
          }
        >
          {props.error.message ||
            `Could not load ${props.label.toLowerCase()}.`}
        </Alert>
      ) : props.options.length === 0 ? (
        <Sheet
          variant="soft"
          sx={{
            borderRadius: "var(--joy-radius-lg)",
            px: 1.75,
            py: 1.5,
          }}
        >
          <Typography level="body-sm" color="neutral">
            {props.emptyMessage}
          </Typography>
        </Sheet>
      ) : (
        <JoyAutocomplete<SelectOption, true, false, false>
          multiple
          label={props.label}
          options={props.options}
          value={selectedOptions}
          disableCloseOnSelect
          renderTags={() => null}
          placeholder={props.searchPlaceholder}
          noOptionsText={props.emptyMessage}
          getOptionLabel={(option) => option.label}
          isOptionEqualToValue={(option, selected) =>
            option.value === selected.value
          }
          onValueChange={(nextValue) =>
            props.onChange((nextValue ?? []).map((option) => option.value))
          }
          renderOption={(renderProps, option) => (
            <Box component="li" {...renderProps}>
              <Stack spacing={0.25} sx={{ minWidth: 0 }}>
                <Typography level="body-sm" sx={{ fontWeight: 600 }}>
                  {option.label}
                </Typography>
                {option.description ? (
                  <Typography level="body-xs" color="neutral">
                    {option.description}
                  </Typography>
                ) : null}
              </Stack>
            </Box>
          )}
        />
      )}

      {selectedOptions.length > 0 ? (
        <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
          {selectedOptions.map((option) => (
            <JoyChip
              key={option.value}
              size="sm"
              variant="soft"
              color="primary"
              onDelete={() =>
                props.onChange(
                  props.value.filter((item) => item !== option.value),
                )
              }
            >
              {option.label}
            </JoyChip>
          ))}
        </Stack>
      ) : null}
    </Stack>
  );
}

export function FormAudienceTab({
  audience,
  onAudienceChange,
}: FormAudienceTabProps) {
  const {
    personas,
    loading: personasLoading,
    error: personasError,
    fetchPersonas,
  } = useCRMPersonas();
  const {
    tags,
    loading: tagsLoading,
    error: tagsError,
    fetchTags,
  } = useCRMTags();

  const personaOptions = React.useMemo<SelectOption[]>(
    () =>
      [...personas]
        .sort((left, right) =>
          left.persona_name.localeCompare(right.persona_name),
        )
        .map((persona) => ({
          value: persona.id,
          label: persona.persona_name,
          description: persona.persona_description,
        })),
    [personas],
  );

  const tagOptions = React.useMemo<SelectOption[]>(
    () =>
      [...tags]
        .sort((left, right) => left.name.localeCompare(right.name))
        .map((tag) => ({
          value: tag.id,
          label: tag.name,
          description:
            "Stored on this form configuration for downstream CRM automation.",
        })),
    [tags],
  );

  return (
    <Stack spacing={3}>
      <AudienceSection
        title="Automatic CRM assignments"
        description="When a visitor submits this form, their CRM profile is automatically updated with the following assignments."
      >
        <Stack spacing={2.5}>
          <AssignmentPicker
            label="Assign personas"
            helperText="Selected personas will be automatically assigned to the customer's CRM profile on submission."
            emptyMessage="No personas configured. Create personas in CRM → Personas to use them here."
            searchPlaceholder="Search personas"
            loading={personasLoading}
            error={personasError}
            options={personaOptions}
            value={audience.assign_personas || []}
            onRetry={() => {
              void fetchPersonas();
            }}
            onChange={(assign_personas) =>
              onAudienceChange({
                ...audience,
                assign_personas,
              })
            }
          />

          <AssignmentPicker
            label="Assign tags"
            helperText="Selected tags are stored on the form configuration for CRM assignment workflows."
            emptyMessage="No CRM tags configured yet. Create tags in CRM to use them here."
            searchPlaceholder="Search tags"
            loading={tagsLoading}
            error={tagsError}
            options={tagOptions}
            value={audience.assign_tags || []}
            onRetry={() => {
              void fetchTags();
            }}
            onChange={(assign_tags) =>
              onAudienceChange({
                ...audience,
                assign_tags,
              })
            }
            statusAlert={
              <Alert
                size="sm"
                color="warning"
                variant="soft"
                startDecorator={<Tag size={16} />}
              >
                Selected tags are stored on the form configuration. Tag write
                behavior is being finalized — tags may not yet be applied
                automatically on submission.
              </Alert>
            }
          />
        </Stack>
      </AudienceSection>

      <AudienceSection
        title="Segment evaluation"
        description="Segment membership is automatically re-evaluated for every customer after form submission. This is always active and cannot be disabled."
        actions={
          <JoyChip size="sm" variant="soft" color="success">
            Always active
          </JoyChip>
        }
      >
        <Stack direction="row" spacing={1.25} alignItems="flex-start">
          <Box
            sx={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 36,
              height: 36,
              borderRadius: 999,
              backgroundColor: "primary.50",
              color: "primary.600",
              flexShrink: 0,
            }}
          >
            <ArrowRight size={18} />
          </Box>
          <Stack spacing={0.5}>
            <Typography level="body-sm" sx={{ fontWeight: 600 }}>
              Automatic evaluation stays in the submission pipeline.
            </Typography>
            <Typography level="body-sm" color="neutral">
              Personas and tags selected above enrich the CRM profile
              immediately. Segment qualification continues automatically after
              each submission without any additional toggle in this workspace.
            </Typography>
          </Stack>
        </Stack>
      </AudienceSection>
    </Stack>
  );
}
