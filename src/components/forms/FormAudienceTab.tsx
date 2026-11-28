import * as React from "react";
import Alert from "@mui/joy/Alert";
import Box from "@mui/joy/Box";
import Button from "@mui/joy/Button";
import Sheet from "@mui/joy/Sheet";
import Skeleton from "@mui/joy/Skeleton";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { AlertTriangle, ArrowRight, RefreshCw, Users } from "lucide-react";
import { Link as RouterLink } from "react-router-dom";
import { JoyAutocomplete } from "@/components/joy/JoyAutocomplete";
import ChipDelete from "@mui/joy/ChipDelete";
import { JoyChip } from "@/components/joy/JoyChip";
import { useCRMPersonas } from "@/hooks/useCRMPersonas";
import { useCRMTags } from "@/hooks/useCRMTags";
import { useSegments, type SegmentListItem } from "@/hooks/useSegments";
import { segmentAssignmentProblem } from "@/lib/forms/audience";
import type { FormAudience } from "@/types/formBuilder";

interface FormAudienceTabProps {
  audience: FormAudience;
  onAudienceChange: (audience: FormAudience) => void;
}

interface SelectOption {
  value: string;
  label: string;
  description?: string | null;
  /** Shown in the list but cannot be chosen. */
  disabled?: boolean;
  /** A saved choice that submissions will skip. */
  problem?: string | null;
}

const SEGMENTS_PATH = "/crm/segments";

function memberCountLabel(count: number): string {
  return `${count.toLocaleString()} ${count === 1 ? "contact" : "contacts"}`;
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
  /** Shown under the picker and under the empty state. */
  footer?: React.ReactNode;
  /** Options that can be chosen. Defaults to every option. */
  selectableCount?: number;
  unavailableLabel?: string;
  unavailableDescription?: string;
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
          label: props.unavailableLabel ?? "Unavailable selection",
          description:
            props.unavailableDescription ??
            "This item is no longer available in CRM.",
          problem: props.unavailableDescription ?? null,
        }
      );
    });
  }, [
    props.options,
    props.value,
    props.unavailableLabel,
    props.unavailableDescription,
  ]);

  // A saved choice that no longer exists still needs a matching option, so
  // the picker can show it as selected.
  const pickerOptions = React.useMemo(() => {
    const known = new Set(props.options.map((option) => option.value));
    return [
      ...props.options,
      ...selectedOptions
        .filter((option) => !known.has(option.value))
        .map((option) => ({ ...option, disabled: true })),
    ];
  }, [props.options, selectedOptions]);

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
      ) : (props.selectableCount ?? props.options.length) === 0 ? (
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
          options={pickerOptions}
          value={selectedOptions}
          disableCloseOnSelect
          renderTags={() => null}
          placeholder={props.searchPlaceholder}
          noOptionsText={props.emptyMessage}
          getOptionLabel={(option) => option.label}
          isOptionEqualToValue={(option, selected) =>
            option.value === selected.value
          }
          getOptionDisabled={(option) => Boolean(option.disabled)}
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
              color={option.problem ? "warning" : "primary"}
              title={option.problem ?? undefined}
              endDecorator={
                <ChipDelete
                  aria-label={`Remove ${option.label}`}
                  onDelete={() =>
                    props.onChange(
                      props.value.filter((item) => item !== option.value),
                    )
                  }
                />
              }
            >
              {option.label}
            </JoyChip>
          ))}
        </Stack>
      ) : null}

      {selectedOptions.some((option) => option.problem) ? (
        <Alert
          size="sm"
          color="warning"
          variant="soft"
          startDecorator={<AlertTriangle size={16} />}
        >
          <Stack spacing={0.25}>
            {selectedOptions
              .filter((option) => option.problem)
              .map((option) => (
                <Typography key={option.value} level="body-sm">
                  <strong>{option.label}:</strong> {option.problem}
                </Typography>
              ))}
          </Stack>
        </Alert>
      ) : null}

      {props.footer}
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

  const segmentsQuery = useSegments();
  const allSegments = segmentsQuery.allSegments;
  const selectedSegmentIds = React.useMemo(
    () => audience.segment_ids ?? [],
    [audience.segment_ids],
  );

  const segmentOptions = React.useMemo<SelectOption[]>(() => {
    const selected = new Set(selectedSegmentIds);
    const byName = (left: SegmentListItem, right: SegmentListItem) =>
      left.name.localeCompare(right.name);

    const fixedLists = allSegments
      .filter((segment) => segmentAssignmentProblem(segment) === null)
      .sort(byName)
      .map((segment) => ({
        value: segment.id,
        label: segment.name,
        description: `Fixed list · ${memberCountLabel(segment.memberCount)}`,
      }));

    // Rule-based segments stay visible so the difference is clear, but they
    // cannot be chosen. A saved choice that stopped being usable is kept in
    // the list so its chip can explain what to do.
    const others = allSegments
      .filter((segment) => segmentAssignmentProblem(segment) !== null)
      .filter(
        (segment) =>
          selected.has(segment.id) ||
          (segment.type === "dynamic" && segment.status === "active"),
      )
      .sort(byName)
      .map((segment) => ({
        value: segment.id,
        label: segment.name,
        description:
          segment.type === "dynamic"
            ? "Rule-based · people join when they match its rules"
            : "Not active",
        disabled: true,
        problem: selected.has(segment.id)
          ? segmentAssignmentProblem(segment)
          : null,
      }));

    return [...fixedLists, ...others];
  }, [allSegments, selectedSegmentIds]);

  const selectableSegmentCount = React.useMemo(
    () => segmentOptions.filter((option) => !option.disabled).length,
    [segmentOptions],
  );
  const hasRuleBasedSegments = allSegments.some(
    (segment) => segment.type === "dynamic" && segment.status === "active",
  );

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
          description: "Added to the contact when they submit this form.",
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
            label="Automatically add to segments"
            helperText="Everyone who submits this form will automatically be added to the selected segments. This selection is not visible to the customer."
            emptyMessage="You have no fixed-list segments yet. Create one in Segments, then come back and choose it here."
            searchPlaceholder="Search segments"
            loading={segmentsQuery.isLoading}
            error={segmentsQuery.error ?? null}
            options={segmentOptions}
            selectableCount={selectableSegmentCount + selectedSegmentIds.length}
            value={selectedSegmentIds}
            unavailableLabel="Deleted segment"
            unavailableDescription="This segment was deleted. Remove it from this form."
            onRetry={() => {
              void segmentsQuery.refetch();
            }}
            onChange={(segment_ids) =>
              onAudienceChange({
                ...audience,
                segment_ids,
              })
            }
            footer={
              <Stack spacing={1.25}>
                {hasRuleBasedSegments ? (
                  <Typography level="body-xs" color="neutral">
                    Rule-based segments cannot be chosen here. They add and
                    remove people by their own rules. To get someone into one,
                    collect the matching detail on this form, or assign a tag or
                    persona below that the segment looks for.
                  </Typography>
                ) : null}
                <Typography level="body-xs" color="neutral">
                  Joining a segment does not give permission to email or text
                  someone. Permission comes only from the consent boxes on the
                  form. People who unsubscribed stay unsubscribed.
                </Typography>
                <Box>
                  <Button
                    component={RouterLink}
                    to={SEGMENTS_PATH}
                    size="sm"
                    variant="plain"
                    startDecorator={<Users size={14} />}
                  >
                    Manage segments
                  </Button>
                </Box>
              </Stack>
            }
          />

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
            helperText="Selected tags are added to the customer's CRM profile on submission."
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
          />
        </Stack>
      </AudienceSection>

      <AudienceSection
        title="Two ways to put people in segments"
        description="Use either one, or both on the same form."
      >
        <Stack spacing={1.5}>
          <Stack spacing={0.35}>
            <Typography level="body-sm" sx={{ fontWeight: 600 }}>
              Automatic: you choose, the customer does not see it
            </Typography>
            <Typography level="body-sm" color="neutral">
              Pick the segments above. Every person who submits this form joins
              them. Use this for a form with one clear purpose, such as a
              Wholesale signup form.
            </Typography>
          </Stack>
          <Stack spacing={0.35}>
            <Typography level="body-sm" sx={{ fontWeight: 600 }}>
              Segment Opt-In field: the customer chooses
            </Typography>
            <Typography level="body-sm" color="neutral">
              Add a Segment Opt-In field on the Build tab. The customer ticks
              the interests they want, and joins only those segments.
            </Typography>
          </Stack>
        </Stack>
      </AudienceSection>

      <AudienceSection
        title="Rule-based segments"
        description="After every submission, BloomSuite checks the contact against your rule-based segments. This is always on."
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
          <Typography level="body-sm" color="neutral">
            A contact joins a rule-based segment when they match its rules, and
            leaves when they stop matching. This check does not remove anyone
            from the fixed-list segments you chose above.
          </Typography>
        </Stack>
      </AudienceSection>
    </Stack>
  );
}
