import * as React from "react";
import { createFilterOptions } from "@mui/joy/Autocomplete";
import AutocompleteOption from "@mui/joy/AutocompleteOption";
import Chip from "@mui/joy/Chip";
import ChipDelete from "@mui/joy/ChipDelete";
import ListItemContent from "@mui/joy/ListItemContent";
import ListItemDecorator from "@mui/joy/ListItemDecorator";
import Typography from "@mui/joy/Typography";
import { Users, X } from "lucide-react";
import { JoyAutocomplete } from "@/components/joy/JoyAutocomplete";
import {
  ALL_CONTACTS_SEGMENT_OPTION,
  isAllContactsSegmentOption,
} from "@/components/crm/campaign-editor/segmentsAudienceConstants";
import type { CampaignSegmentSummary } from "@/lib/crm/campaignEditor";

const segmentSearchFilter = createFilterOptions<CampaignSegmentSummary>({
  stringify: (option) => option.name,
});

export type SegmentsAudienceChange = {
  selectedSegments?: CampaignSegmentSummary[];
  includeAllCustomers?: boolean;
};

export interface SegmentsAudienceSelectProps {
  segments: CampaignSegmentSummary[];
  selectedSegments: CampaignSegmentSummary[];
  includeAllCustomers: boolean;
  disabled?: boolean;
  loading?: boolean;
  onChange: (next: SegmentsAudienceChange) => void;
}

export function SegmentsAudienceSelect({
  segments,
  selectedSegments,
  includeAllCustomers,
  disabled = false,
  loading = false,
  onChange,
}: SegmentsAudienceSelectProps) {
  const options = React.useMemo<CampaignSegmentSummary[]>(
    () => [ALL_CONTACTS_SEGMENT_OPTION, ...segments],
    [segments],
  );

  const value = React.useMemo<CampaignSegmentSummary[]>(
    () =>
      includeAllCustomers ? [ALL_CONTACTS_SEGMENT_OPTION] : selectedSegments,
    [includeAllCustomers, selectedSegments],
  );

  const handleChange = React.useCallback(
    (next: readonly CampaignSegmentSummary[] | null) => {
      const incoming = (next ?? []) as CampaignSegmentSummary[];
      const wantsAll = incoming.some(isAllContactsSegmentOption);
      const realSegments = incoming.filter(
        (option) => !isAllContactsSegmentOption(option),
      );

      if (wantsAll) {
        onChange({ selectedSegments: [], includeAllCustomers: true });
        return;
      }

      if (includeAllCustomers && !wantsAll) {
        onChange({
          selectedSegments: realSegments,
          includeAllCustomers: false,
        });
        return;
      }

      onChange({ selectedSegments: realSegments });
    },
    [includeAllCustomers, onChange],
  );

  return (
    <JoyAutocomplete<CampaignSegmentSummary, true, false, false>
      multiple
      label="Segments"
      disabled={disabled}
      loading={loading}
      options={options}
      value={value}
      placeholder={
        includeAllCustomers ? "All contacts selected" : "All contacts"
      }
      getOptionLabel={(option) => option.name}
      isOptionEqualToValue={(option, candidate) => option.id === candidate.id}
      filterOptions={(opts, state) => {
        const filtered = segmentSearchFilter(
          opts.filter((option) => !isAllContactsSegmentOption(option)),
          state,
        );
        return [ALL_CONTACTS_SEGMENT_OPTION, ...filtered];
      }}
      getOptionDisabled={(option) =>
        includeAllCustomers && !isAllContactsSegmentOption(option)
      }
      renderOption={(optionProps, option) => {
        const { key, ...liProps } = optionProps as React.HTMLAttributes<
          HTMLLIElement
        > & { key?: React.Key };
        if (isAllContactsSegmentOption(option)) {
          return (
            <AutocompleteOption
              {...liProps}
              key={key ?? option.id}
              data-testid="segment-option-all-contacts"
              sx={{
                backgroundColor: "primary.50",
                borderRadius: "var(--joy-radius-md)",
                "&:hover": { backgroundColor: "primary.100" },
                "&[aria-selected='true']": {
                  backgroundColor: "primary.100",
                },
              }}
            >
              <ListItemDecorator sx={{ color: "primary.600" }}>
                <Users size={16} />
              </ListItemDecorator>
              <ListItemContent>
                <Typography
                  level="body-sm"
                  fontWeight="lg"
                  sx={{ color: "primary.700" }}
                >
                  All Contacts
                </Typography>
                <Typography level="body-xs" sx={{ color: "neutral.600" }}>
                  Send to every customer in this tenant
                </Typography>
              </ListItemContent>
            </AutocompleteOption>
          );
        }
        const disabledByAll = includeAllCustomers;
        return (
          <AutocompleteOption
            {...liProps}
            key={key ?? option.id}
            title={
              disabledByAll
                ? "Deselect All Contacts first to pick specific segments"
                : undefined
            }
            sx={
              disabledByAll
                ? { opacity: 0.45, cursor: "not-allowed" }
                : undefined
            }
          >
            {option.name}
          </AutocompleteOption>
        );
      }}
      renderTags={(tagValue, getTagProps) =>
        tagValue.map((option, index) => {
          const tagProps = getTagProps({ index }) as {
            key?: React.Key;
            onClick?: (event: React.SyntheticEvent) => void;
            "data-tag-index"?: number;
            tabIndex?: number;
            disabled?: boolean;
            size?: "sm" | "md" | "lg";
          };
          const { key, onClick, ...deleteAttrs } = tagProps;
          const removeLabel = isAllContactsSegmentOption(option)
            ? "Remove All Contacts"
            : `Remove ${option.name}`;
          return (
            <Chip
              key={key ?? option.id}
              variant={isAllContactsSegmentOption(option) ? "solid" : "soft"}
              color="primary"
              size="sm"
              data-testid={
                isAllContactsSegmentOption(option)
                  ? "segment-pill-all-contacts"
                  : `segment-pill-${option.id}`
              }
              startDecorator={
                isAllContactsSegmentOption(option) ? <Users size={12} /> : null
              }
              endDecorator={
                <ChipDelete
                  {...deleteAttrs}
                  aria-label={removeLabel}
                  variant={
                    isAllContactsSegmentOption(option) ? "solid" : "plain"
                  }
                  color="primary"
                  onClick={onClick}
                >
                  <X size={12} />
                </ChipDelete>
              }
            >
              {isAllContactsSegmentOption(option) ? "All Contacts" : option.name}
            </Chip>
          );
        })
      }
      onValueChange={handleChange}
    />
  );
}
