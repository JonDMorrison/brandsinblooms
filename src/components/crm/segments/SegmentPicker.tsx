import { useMemo } from "react";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { JoyAutocomplete } from "@/components/joy/JoyAutocomplete";
import {
  useSegments,
  type SegmentKind,
  type SegmentStatus,
} from "@/hooks/useSegments";

interface SegmentPickerOption {
  id: string;
  label: string;
  description: string;
  type: SegmentKind;
  status: SegmentStatus;
}

export interface SegmentPickerProps {
  value: string[];
  onChange: (segmentIds: string[]) => void;
  label?: string;
  placeholder?: string;
  helperText?: string;
  typeFilter?: "all" | SegmentKind;
  statuses?: SegmentStatus[];
  excludeSegmentIds?: string[];
  disabled?: boolean;
}

export function SegmentPicker({
  value,
  onChange,
  label,
  placeholder = "Select segments",
  helperText,
  typeFilter = "all",
  statuses = ["active", "draft", "paused"],
  excludeSegmentIds = [],
  disabled = false,
}: SegmentPickerProps) {
  const { allSegments, isLoading } = useSegments();

  const options = useMemo<SegmentPickerOption[]>(() => {
    const excluded = new Set(excludeSegmentIds);
    const statusSet = new Set(statuses);

    return allSegments
      .filter((segment) => !excluded.has(segment.id))
      .filter((segment) =>
        typeFilter === "all" ? true : segment.type === typeFilter,
      )
      .filter((segment) => statusSet.has(segment.status))
      .map((segment) => ({
        id: segment.id,
        label: segment.name,
        description: `${segment.memberCount.toLocaleString()} members`,
        type: segment.type,
        status: segment.status,
      }));
  }, [allSegments, excludeSegmentIds, statuses, typeFilter]);

  const selectedOptions = options.filter((option) => value.includes(option.id));

  return (
    <JoyAutocomplete<SegmentPickerOption, true, false, false>
      disabled={disabled}
      getOptionLabel={(option) => option.label}
      helperText={helperText}
      isOptionEqualToValue={(option, current) => option.id === current.id}
      label={label}
      loading={isLoading}
      multiple
      onValueChange={(nextValue) =>
        onChange((nextValue ?? []).map((option) => option.id))
      }
      options={options}
      placeholder={placeholder}
      renderOption={(props, option) => (
        <li {...props} key={option.id}>
          <Stack spacing={0.25}>
            <Typography level="body-sm">{option.label}</Typography>
            <Typography level="body-xs" color="neutral">
              {option.description}
            </Typography>
          </Stack>
        </li>
      )}
      value={selectedOptions}
    />
  );
}
