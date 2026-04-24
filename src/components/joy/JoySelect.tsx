import * as React from "react";
import FormControl from "@mui/joy/FormControl";
import FormHelperText from "@mui/joy/FormHelperText";
import FormLabel from "@mui/joy/FormLabel";
import ListSubheader, { type ListSubheaderProps } from "@mui/joy/ListSubheader";
import Option from "@mui/joy/Option";
import JoyBaseSelect, {
  type SelectProps as JoyBaseSelectProps,
} from "@mui/joy/Select";
import type { SxProps } from "@mui/joy/styles/types";
import { ChevronDown } from "lucide-react";
import { mergeSx } from "@/components/joy/mergeSx";

export type JoySelectOption = {
  value: string;
  label: React.ReactNode;
  disabled?: boolean;
};

export type JoySelectProps = Omit<
  JoyBaseSelectProps<string, false>,
  "multiple"
> & {
  label?: React.ReactNode;
  helperText?: React.ReactNode;
  error?: boolean;
  errorMessage?: React.ReactNode;
  options?: JoySelectOption[];
  onValueChange?: (value: string) => void;
  formControlSx?: SxProps;
};

const labelSx: SxProps = {
  color: "var(--joy-palette-neutral-600)",
  fontSize: "0.8125rem",
  fontWeight: "var(--joy-fontWeight-medium)",
  lineHeight: 1.4,
};

const baseButtonSx: SxProps = {
  minHeight: 36,
  borderRadius: "var(--joy-radius-lg)",
  borderColor: "neutral.300",
  backgroundColor: "background.surface",
  boxShadow: "none",
  "--Select-focusedThickness": "0px",
  "--Select-placeholderOpacity": "1",
  "--Select-indicatorColor": "var(--joy-palette-neutral-400)",
  px: 1.5,
  fontSize: "var(--joy-fontSize-sm)",
  fontWeight: "var(--joy-fontWeight-regular)",
  lineHeight: "var(--joy-lineHeight-md)",
  color: "var(--joy-palette-neutral-800)",
  "--Select-decoratorColor": "var(--joy-palette-neutral-400)",
  transition:
    "background-color 150ms ease, border-color 150ms ease, box-shadow 150ms ease, color 150ms ease",
  "&:hover:not([aria-disabled='true'])": {
    backgroundColor: "background.surface",
    borderColor: "neutral.400",
  },
  "&:focus-within": {
    borderColor: "primary.400",
  },
  "&.Mui-focusVisible, &:focus-visible": {
    borderColor: "transparent",
  },
  "&[aria-disabled='true']": {
    borderColor: "neutral.200",
    backgroundColor: "neutral.50",
    color: "neutral.400",
  },
  "& .MuiSelect-indicator": {
    color: "neutral.400",
    fontSize: "16px",
    transition: "transform 0.2s ease",
  },
  "&[aria-expanded='true'] .MuiSelect-indicator": {
    transform: "rotate(180deg)",
  },
};

const baseListboxSx: SxProps = {
  p: 0.5,
  borderRadius: "var(--joy-radius-lg)",
  borderColor: "neutral.200",
  backgroundColor: "background.popup",
  boxShadow: "var(--joy-shadow-lg)",
  zIndex: "var(--joy-zIndex-popup)",
  "--List-padding": "0px",
  "& [role='option']": {
    minHeight: 36,
    borderRadius: "var(--joy-radius-md)",
    px: 1.25,
    py: 0.875,
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
};

export const JoySelectGroupHeader = React.forwardRef<
  HTMLLIElement,
  ListSubheaderProps
>(({ sx, sticky = false, ...props }, ref) => (
  <ListSubheader
    ref={ref}
    sticky={sticky}
    sx={mergeSx(groupHeaderSx, sx)}
    {...props}
  />
));

JoySelectGroupHeader.displayName = "JoySelectGroupHeader";

export { Option as JoySelectOptionItem };

export const JoySelect = React.forwardRef<HTMLButtonElement, JoySelectProps>(
  (
    {
      id,
      label,
      helperText,
      error = false,
      errorMessage,
      options,
      children,
      color,
      fullWidth,
      required,
      indicator,
      onChange,
      onValueChange,
      formControlSx,
      slotProps,
      sx,
      disabled,
      ...props
    },
    ref,
  ) => {
    const generatedId = React.useId();
    const selectId = id ?? generatedId;
    const helperContent = errorMessage ?? helperText;
    const helperColor = error ? "danger.600" : "neutral.500";
    const isEmptyValue =
      props.value === undefined || props.value === null || props.value === "";
    const buttonSlotProps =
      slotProps && typeof slotProps.button === "object"
        ? slotProps.button
        : undefined;
    const listboxSlotProps =
      slotProps && typeof slotProps.listbox === "object"
        ? slotProps.listbox
        : undefined;
    const resolvedButtonSx = error
      ? {
          borderColor: "danger.400",
          backgroundColor: "rgba(var(--joy-palette-danger-mainChannel) / 0.05)",
          color: "var(--joy-palette-neutral-800)",
          "&:hover:not([aria-disabled='true'])": {
            borderColor: "danger.400",
          },
          "&:focus-within": {
            borderColor: "danger.400",
          },
          "&.Mui-focusVisible, &:focus-visible": {
            borderColor: "danger.400",
            outline: "none",
            outlineOffset: 0,
          },
        }
      : {
          color: isEmptyValue
            ? "var(--joy-palette-neutral-400)"
            : "var(--joy-palette-neutral-800)",
        };

    return (
      <FormControl
        required={required}
        error={error}
        disabled={disabled}
        sx={mergeSx(
          { width: fullWidth === false ? undefined : "100%", gap: 0.75 },
          formControlSx,
        )}
      >
        {label ? (
          <FormLabel htmlFor={selectId} sx={labelSx}>
            {label}
          </FormLabel>
        ) : null}
        <JoyBaseSelect<string, false>
          {...props}
          ref={ref}
          disabled={disabled}
          color={error ? "danger" : (color ?? "neutral")}
          indicator={indicator ?? <ChevronDown size={16} strokeWidth={1.9} />}
          onChange={(event, newValue) => {
            onValueChange?.(newValue ?? "");
            onChange?.(event, newValue);
          }}
          slotProps={{
            ...slotProps,
            button: {
              ...(buttonSlotProps ?? {}),
              id: selectId,
              sx: mergeSx(baseButtonSx, resolvedButtonSx, buttonSlotProps?.sx),
            },
            listbox: {
              ...(listboxSlotProps ?? {}),
              sx: mergeSx(baseListboxSx, listboxSlotProps?.sx),
            },
          }}
          sx={sx}
        >
          {options
            ? options.map((option) => (
                <Option
                  key={option.value}
                  value={option.value}
                  disabled={option.disabled}
                >
                  {option.label}
                </Option>
              ))
            : children}
        </JoyBaseSelect>
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
  },
);

JoySelect.displayName = "JoySelect";
