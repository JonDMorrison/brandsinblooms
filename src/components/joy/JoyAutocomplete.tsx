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
import { mergeSx } from "@/components/joy/mergeSx";

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

const labelSx: SxProps = {
  color: "var(--joy-palette-neutral-600)",
  fontSize: "0.8125rem",
  fontWeight: "var(--joy-fontWeight-medium)",
  lineHeight: 1.4,
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
  minHeight: 36,
  borderRadius: "var(--joy-radius-lg)",
  borderColor: "neutral.300",
  boxShadow: "none",
  backgroundColor: "#FFFFFF",
  color: "var(--joy-palette-neutral-800)",
  transition:
    "border-color 0.2s ease, box-shadow 0.2s ease, background-color 0.2s ease",
  "--Input-paddingInline": "0.75rem",
  "--Input-gap": "0.625rem",
  "--Input-focusedThickness": "0px",
  "--Input-placeholderColor": "var(--joy-palette-neutral-400)",
  "--Input-placeholderOpacity": "1",
  "--Input-decoratorColor": "var(--joy-palette-neutral-400)",
  "--Autocomplete-wrapperGap": "0.25rem",
  "&:hover:not([data-disabled='true'])": {
    backgroundColor: "#FFFFFF",
    borderColor: "neutral.400",
  },
  "&:focus-within, &.MuiAutocomplete-focused": {
    borderColor: "primary.400",
  },
  "&.Mui-focusVisible, &:focus-visible": {
    borderColor: "transparent",
  },
  "&[data-disabled='true'], &[aria-disabled='true']": {
    borderColor: "neutral.200",
    backgroundColor: "neutral.50",
    color: "neutral.400",
  },
  "& .MuiAutocomplete-input": {
    minWidth: 0,
    fontSize: "var(--joy-fontSize-sm)",
    fontWeight: "var(--joy-fontWeight-regular)",
    lineHeight: "var(--joy-lineHeight-md)",
    color: "var(--joy-palette-neutral-800)",
    "&::placeholder": {
      color: "var(--joy-palette-neutral-400)",
      opacity: 1,
    },
  },
  "& .MuiAutocomplete-startDecorator, & .MuiAutocomplete-endDecorator": {
    color: "neutral.400",
  },
  "& .MuiChip-root": {
    minHeight: 24,
    minWidth: 0,
    borderRadius: "999px",
    border: "1px solid",
    borderColor: "primary.100",
    fontSize: "var(--joy-fontSize-xs)",
    fontWeight: "var(--joy-fontWeight-medium)",
    backgroundColor: "primary.50",
    color: "primary.700",
  },
  "& .MuiChip-action": {
    minWidth: 0,
  },
  "& .MuiChipDelete-root": {
    color: "primary.500",
    "--Icon-fontSize": "16px",
  },
  "& .MuiAutocomplete-clearIndicator, & .MuiAutocomplete-popupIndicator": {
    color: "neutral.400",
    width: 24,
    height: 24,
    minWidth: 24,
    minHeight: 24,
    borderRadius: "999px",
    "--Icon-fontSize": "16px",
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
  const helperColor = error ? "danger.600" : "neutral.500";
  const stateSx: SxProps | undefined = error
    ? {
        borderColor: "danger.400",
        backgroundColor: "rgba(var(--joy-palette-danger-mainChannel) / 0.05)",
        "&:hover:not([data-disabled='true'])": {
          borderColor: "danger.400",
        },
        "&:focus-within, &.MuiAutocomplete-focused": {
          borderColor: "danger.400",
        },
        "&.Mui-focusVisible, &:focus-visible": {
          outline: "none",
          outlineOffset: 0,
        },
      }
    : undefined;

  const resolvedSlotProps = {
    ...slotProps,
    clearIndicator: mergeAutocompleteSlotProps(slotProps?.clearIndicator, {
      color: "neutral",
      size: "sm",
      variant: "plain",
    }),
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
    popupIndicator: mergeAutocompleteSlotProps(slotProps?.popupIndicator, {
      color: "neutral",
      size: "sm",
      variant: "plain",
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
      sx={mergeSx({ width: "100%", gap: 0.5 }, formControlSx)}
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
        <FormHelperText
          sx={{
            color: helperColor,
            minHeight: 18,
            fontSize: "var(--joy-fontSize-xs)",
            fontWeight: "var(--joy-fontWeight-regular)",
          }}
        >
          {helperContent}
        </FormHelperText>
      ) : null}
    </FormControl>
  );
}
