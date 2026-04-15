import * as React from "react";
import type { AutocompleteValue } from "@mui/base/useAutocomplete";
import Autocomplete, {
  type AutocompleteProps as JoyBaseAutocompleteProps,
  type AutocompleteRenderGroupParams,
} from "@mui/joy/Autocomplete";
import FormControl from "@mui/joy/FormControl";
import FormHelperText from "@mui/joy/FormHelperText";
import FormLabel from "@mui/joy/FormLabel";
import List from "@mui/joy/List";
import ListItem from "@mui/joy/ListItem";
import ListSubheader from "@mui/joy/ListSubheader";
import type { SxProps } from "@mui/joy/styles/types";

export type JoyAutocompleteValue<
  T,
  Multiple extends boolean | undefined,
  DisableClearable extends boolean | undefined,
  FreeSolo extends boolean | undefined,
> = AutocompleteValue<T, Multiple, DisableClearable, FreeSolo>;

export type JoyAutocompleteProps<
  T,
  Multiple extends boolean | undefined = false,
  DisableClearable extends boolean | undefined = false,
  FreeSolo extends boolean | undefined = false,
> = JoyBaseAutocompleteProps<T, Multiple, DisableClearable, FreeSolo> & {
  label?: React.ReactNode;
  helperText?: React.ReactNode;
  errorMessage?: React.ReactNode;
  onValueChange?: (
    value: JoyAutocompleteValue<T, Multiple, DisableClearable, FreeSolo>,
  ) => void;
  formControlSx?: SxProps;
};

const mergeSx = (...values: Array<SxProps | undefined>) =>
  values.filter(Boolean) as SxProps[];

const createFocusShadow = (channel: string) =>
  `0 0 0 4px rgba(${channel} / 0.14)`;

const labelSx: SxProps = {
  color: "var(--joy-palette-brandNavy-800)",
  fontWeight: "var(--joy-fontWeight-md)",
};

const groupHeaderSx: SxProps = {
  px: 1.25,
  py: 0.75,
  color: "neutral.500",
  fontSize: "var(--joy-fontSize-xs)",
  fontWeight: "var(--joy-fontWeight-lg)",
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  lineHeight: 1.4,
  backgroundColor: "#FFFFFF",
};

const baseAutocompleteSx: SxProps = {
  width: "100%",
  minHeight: 40,
  borderRadius: "var(--joy-radius-lg)",
  boxShadow: "var(--joy-shadow-xs)",
  backgroundColor: "background.surface",
  transition:
    "border-color 0.2s ease, box-shadow 0.2s ease, background-color 0.2s ease",
  "--Input-paddingInline": "0.875rem",
  "--Input-gap": "0.625rem",
  "--Input-focusedThickness": "2px",
  "--Autocomplete-wrapperGap": "0.375rem",
  "--Chip-radius": "999px",
  "--Chip-gap": "0.25rem",
  "&:hover:not([data-disabled='true'])": {
    backgroundColor: "background.surface",
  },
  "&:focus-within, &.MuiAutocomplete-focused": {
    borderColor: "primary.500",
    boxShadow: createFocusShadow("var(--joy-palette-primary-mainChannel)"),
  },
  "& .MuiAutocomplete-input": {
    minWidth: 0,
  },
  "& .MuiChip-root": {
    minWidth: 0,
    fontWeight: "var(--joy-fontWeight-md)",
    backgroundColor: "neutral.100",
    color: "neutral.700",
  },
  "& .MuiChip-action": {
    minWidth: 0,
  },
  "& .MuiChipDelete-root": {
    color: "neutral.500",
  },
};

const baseListboxSx: SxProps = {
  p: 0.5,
  borderRadius: "var(--joy-radius-lg)",
  borderColor: "neutral.200",
  backgroundColor: "#FFFFFF",
  boxShadow: "var(--joy-shadow-lg)",
  zIndex: "var(--joy-zIndex-popup)",
  "--List-padding": "0px",
  "& [role='option']": {
    minHeight: 36,
    borderRadius: "var(--joy-radius-md)",
    px: 1.25,
    py: 0.875,
    alignItems: "flex-start",
    transition: "background-color 0.16s ease, color 0.16s ease",
  },
  "& [role='option']:hover": {
    backgroundColor: "neutral.100",
  },
  "& [role='option'][aria-selected='true']": {
    backgroundColor: "primary.50",
    color: "primary.700",
    fontWeight: "var(--joy-fontWeight-md)",
  },
  "& [role='option'][aria-selected='true']:hover": {
    backgroundColor: "primary.100",
  },
  "& .MuiListSubheader-root": groupHeaderSx,
  "& .MuiList-root": {
    "--List-padding": "0px",
    gap: 0.25,
  },
};

const baseStatusItemSx: SxProps = {
  px: 1.25,
  py: 1,
  color: "neutral.600",
};

const limitTagSx: SxProps = {
  marginInlineStart: 0.25,
  marginBlockStart: 0.25,
  color: "neutral.600",
  fontWeight: "var(--joy-fontWeight-md)",
};

const renderDefaultGroup = (params: AutocompleteRenderGroupParams) => (
  <ListItem
    key={params.key}
    nested
    sx={{ "--ListItem-paddingX": "0px", "--ListItem-paddingY": "0px" }}
  >
    <ListSubheader sticky sx={groupHeaderSx}>
      {params.group}
    </ListSubheader>
    <List sx={{ "--List-padding": "0px", gap: 0.25 }}>{params.children}</List>
  </ListItem>
);

function mergeAutocompleteSlotProps(
  slotProp: unknown,
  overrides: { sx?: SxProps } & Record<string, unknown>,
) {
  const { sx: overrideSx, ...overrideProps } = overrides;

  if (typeof slotProp === "function") {
    return (ownerState: unknown) => {
      const resolved = slotProp(ownerState) as { sx?: SxProps } | undefined;

      return {
        ...(resolved ?? {}),
        ...overrideProps,
        sx: mergeSx(overrideSx, resolved?.sx),
      };
    };
  }

  const resolved = slotProp as { sx?: SxProps } | undefined;

  return {
    ...(resolved ?? {}),
    ...overrideProps,
    sx: mergeSx(overrideSx, resolved?.sx),
  };
}

export function JoyAutocomplete<
  T,
  Multiple extends boolean | undefined = false,
  DisableClearable extends boolean | undefined = false,
  FreeSolo extends boolean | undefined = false,
>({
  id,
  label,
  helperText,
  error = false,
  errorMessage,
  onChange,
  onValueChange,
  color,
  required,
  disabled,
  renderGroup,
  groupBy,
  slotProps,
  sx,
  formControlSx,
  ...props
}: JoyAutocompleteProps<T, Multiple, DisableClearable, FreeSolo>) {
  const generatedId = React.useId();
  const autocompleteId = id ?? generatedId;
  const helperContent = errorMessage ?? helperText;
  const helperColor = error ? "danger.600" : "neutral.600";
  const stateSx: SxProps | undefined = error
    ? {
        borderColor: "danger.300",
        backgroundColor: "rgba(var(--joy-palette-danger-mainChannel) / 0.05)",
        "&:focus-within, &.MuiAutocomplete-focused": {
          borderColor: "danger.500",
          boxShadow: createFocusShadow("var(--joy-palette-danger-mainChannel)"),
        },
      }
    : undefined;

  const resolvedSlotProps = {
    ...slotProps,
    listbox: mergeAutocompleteSlotProps(slotProps?.listbox, {
      sx: baseListboxSx,
    }),
    loading: mergeAutocompleteSlotProps(slotProps?.loading, {
      sx: baseStatusItemSx,
    }),
    noOptions: mergeAutocompleteSlotProps(slotProps?.noOptions, {
      sx: baseStatusItemSx,
    }),
    limitTag: mergeAutocompleteSlotProps(slotProps?.limitTag, {
      sx: limitTagSx,
    }),
  } as JoyBaseAutocompleteProps<
    T,
    Multiple,
    DisableClearable,
    FreeSolo
  >["slotProps"];

  return (
    <FormControl
      required={required}
      error={error}
      disabled={disabled}
      sx={mergeSx({ width: "100%", gap: 0.75 }, formControlSx)}
    >
      {label ? (
        <FormLabel htmlFor={autocompleteId} sx={labelSx}>
          {label}
        </FormLabel>
      ) : null}
      <Autocomplete<T, Multiple, DisableClearable, FreeSolo>
        {...props}
        id={autocompleteId}
        disabled={disabled}
        error={error}
        color={error ? "danger" : (color ?? "neutral")}
        renderGroup={
          groupBy ? (renderGroup ?? renderDefaultGroup) : renderGroup
        }
        groupBy={groupBy}
        onChange={(event, newValue, reason, details) => {
          onValueChange?.(newValue);
          onChange?.(event, newValue, reason, details);
        }}
        slotProps={resolvedSlotProps}
        sx={mergeSx(baseAutocompleteSx, stateSx, sx)}
      />
      {helperContent ? (
        <FormHelperText sx={{ color: helperColor, minHeight: 20 }}>
          {helperContent}
        </FormHelperText>
      ) : null}
    </FormControl>
  );
}
