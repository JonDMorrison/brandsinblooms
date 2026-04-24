import * as React from "react";
import Avatar from "@mui/joy/Avatar";
import Box from "@mui/joy/Box";
import Sheet from "@mui/joy/Sheet";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { ArrowRight, Tag, Users } from "lucide-react";
import { JoyAutocomplete } from "@/components/joy/JoyAutocomplete";
import {
  JoyCard,
  JoyCardContent,
  JoyCardHeader,
} from "@/components/joy/JoyCard";
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

function AudienceSelectionCard({
  title,
  description,
  emptyMessage,
  helperText,
  icon,
  loading,
  options,
  value,
  onChange,
}: {
  title: string;
  description: string;
  emptyMessage: string;
  helperText: string;
  icon: React.ReactNode;
  loading: boolean;
  options: SelectOption[];
  value: string[];
  onChange: (nextValue: string[]) => void;
}) {
  const selectedOptions = options.filter((option) =>
    value.includes(option.value),
  );

  return (
    <JoyCard>
      <JoyCardHeader
        startDecorator={
          <Avatar size="sm" variant="soft" color="neutral">
            {icon}
          </Avatar>
        }
        title={title}
        description={description}
        actions={
          <JoyChip size="sm" variant="soft" color="neutral">
            {selectedOptions.length} selected
          </JoyChip>
        }
      />
      <JoyCardContent sx={{ pt: 3, gap: 2.5 }}>
        <JoyAutocomplete<SelectOption, true, false, false>
          multiple
          options={options}
          loading={loading}
          value={selectedOptions}
          getOptionLabel={(option) => option.label}
          isOptionEqualToValue={(option, selected) =>
            option.value === selected.value
          }
          placeholder={loading ? "Loading options..." : emptyMessage}
          noOptionsText={emptyMessage}
          onValueChange={(nextValue) =>
            onChange((nextValue ?? []).map((option) => option.value))
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
          helperText={helperText}
        />

        {selectedOptions.length > 0 ? (
          <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
            {selectedOptions.map((option) => (
              <JoyChip
                key={option.value}
                size="sm"
                variant="soft"
                color="primary"
                onClick={() =>
                  onChange(value.filter((item) => item !== option.value))
                }
              >
                {option.label}
              </JoyChip>
            ))}
          </Stack>
        ) : (
          <Sheet
            variant="soft"
            sx={{
              borderRadius: "lg",
              px: 2,
              py: 2,
            }}
          >
            <Typography level="body-sm" color="neutral">
              No selections yet.
            </Typography>
          </Sheet>
        )}
      </JoyCardContent>
    </JoyCard>
  );
}

export function FormAudienceTab({
  audience,
  onAudienceChange,
}: FormAudienceTabProps) {
  const { personas, loading: personasLoading } = useCRMPersonas();
  const { tags, loading: tagsLoading } = useCRMTags();

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
          description: "Apply this CRM tag after a successful submission.",
        })),
    [tags],
  );

  return (
    <Stack spacing={3}>
      <AudienceSelectionCard
        title="Assign CRM personas"
        description="Attach personas to customers who submit this form so downstream workflows start with richer context."
        emptyMessage="No personas found yet"
        helperText="Selected personas are added automatically after a successful submission."
        icon={<Users size={18} />}
        loading={personasLoading}
        options={personaOptions}
        value={audience.assign_personas || []}
        onChange={(assign_personas) =>
          onAudienceChange({
            ...audience,
            assign_personas,
          })
        }
      />

      <AudienceSelectionCard
        title="Assign CRM tags"
        description="Pre-tag contacts captured through this form so reporting and follow-up sequences start in the right lane."
        emptyMessage="No tags found yet"
        helperText="Tags are stored in the form configuration today; downstream write behavior is still evolving."
        icon={<Tag size={18} />}
        loading={tagsLoading}
        options={tagOptions}
        value={audience.assign_tags || []}
        onChange={(assign_tags) =>
          onAudienceChange({
            ...audience,
            assign_tags,
          })
        }
      />

      <JoyCard>
        <JoyCardHeader
          startDecorator={
            <Avatar size="sm" variant="soft" color="primary">
              <ArrowRight size={18} />
            </Avatar>
          }
          title="Segment evaluation stays on"
          description="Every accepted submission is still evaluated against active segments. There is no separate switch for that in this form workspace."
        />
        <JoyCardContent sx={{ pt: 2 }}>
          <Typography level="body-sm" color="neutral">
            Use personas and tags here to enrich the customer record
            immediately. Segment qualification continues automatically in the
            submission pipeline.
          </Typography>
        </JoyCardContent>
      </JoyCard>
    </Stack>
  );
}
