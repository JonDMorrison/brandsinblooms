import * as React from "react";
import Box from "@mui/joy/Box";
import FormControl from "@mui/joy/FormControl";
import FormHelperText from "@mui/joy/FormHelperText";
import FormLabel from "@mui/joy/FormLabel";
import JoyBaseInput, {
  type InputProps as JoyBaseInputProps,
} from "@mui/joy/Input";
import type { SxProps } from "@mui/joy/styles/types";
import { AlertCircle, Check } from "lucide-react";

type NativeJoyVariant = NonNullable<JoyBaseInputProps["variant"]>;
type LegacyInputVariant = "default" | "success" | "error";

export type JoyInputProps = Omit<JoyBaseInputProps, "variant"> & {
  variant?: NativeJoyVariant | LegacyInputVariant;
  label?: React.ReactNode;
  helperText?: React.ReactNode;
  errorMessage?: React.ReactNode;
  success?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  leadingIcon?: React.ReactNode;
  trailingIcon?: React.ReactNode;
  onValueChange?: (value: string) => void;
  formControlSx?: SxProps;
};

const mergeSx = (...values: Array<SxProps | undefined>) =>
  values.filter(Boolean) as SxProps[];

const assignRef = <T,>(ref: React.Ref<T> | undefined, value: T | null) => {
  if (typeof ref === "function") {
    ref(value);
    return;
  }

  if (ref) {
    (ref as React.MutableRefObject<T | null>).current = value;
  }
};

const mergeRefs = <T,>(...refs: Array<React.Ref<T> | undefined>) => {
  return (value: T | null) => {
    refs.forEach((ref) => assignRef(ref, value));
  };
};

const decoratorSx: SxProps = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  color: "inherit",
  "& > .lucide": {
    width: "18px",
    height: "18px",
  },
  "& > .MuiSvgIcon-root": {
    fontSize: "18px",
  },
  "& > *": {
    flexShrink: 0,
  },
};

const normalizeDecorator = (decorator: React.ReactNode) => {
  if (!decorator) {
    return undefined;
  }

  return <Box sx={decoratorSx}>{decorator}</Box>;
};

const resolveNativeVariant = (
  variant: JoyInputProps["variant"],
): NativeJoyVariant => {
  if (
    !variant ||
    variant === "default" ||
    variant === "success" ||
    variant === "error"
  ) {
    return "outlined";
  }

  return variant;
};

const createFocusShadow = (channel: string) =>
  `0 0 0 4px rgba(${channel} / 0.14)`;

const baseInputSx: SxProps = {
  minHeight: 40,
  borderRadius: "var(--joy-radius-lg)",
  boxShadow: "var(--joy-shadow-xs)",
  backgroundColor: "background.surface",
  transition:
    "border-color 0.2s ease, box-shadow 0.2s ease, background-color 0.2s ease",
  "--Input-paddingInline": "0.875rem",
  "--Input-gap": "0.625rem",
  "--Input-focusedThickness": "2px",
  "&:hover:not([data-disabled='true'])": {
    backgroundColor: "background.surface",
  },
  "&:focus-within": {
    borderColor: "primary.500",
    boxShadow: createFocusShadow("var(--joy-palette-primary-mainChannel)"),
  },
  "& .MuiInput-input": {
    minWidth: 0,
  },
};

const labelSx: SxProps = {
  color: "var(--joy-palette-brandNavy-800)",
  fontWeight: "var(--joy-fontWeight-md)",
};

const getStatusDecorator = (isError: boolean, isSuccess: boolean) => {
  if (isError) {
    return <AlertCircle aria-hidden="true" />;
  }

  if (isSuccess) {
    return <Check aria-hidden="true" />;
  }

  return undefined;
};

export const JoyInput = React.forwardRef<HTMLInputElement, JoyInputProps>(
  (
    {
      id,
      label,
      helperText,
      error,
      errorMessage,
      success = false,
      leftIcon,
      rightIcon,
      leadingIcon,
      trailingIcon,
      startDecorator,
      endDecorator,
      onChange,
      onValueChange,
      color,
      fullWidth,
      required,
      slotProps,
      sx,
      formControlSx,
      variant,
      disabled,
      ...props
    },
    ref,
  ) => {
    const generatedId = React.useId();
    const inputId = id ?? generatedId;

    const isError = Boolean(error || errorMessage || variant === "error");
    const isSuccess = !isError && (success || variant === "success");
    const resolvedColor = isError
      ? "danger"
      : isSuccess
        ? "success"
        : (color ?? "neutral");
    const resolvedVariant = resolveNativeVariant(variant);
    const resolvedStartDecorator = normalizeDecorator(
      startDecorator ?? leadingIcon ?? leftIcon,
    );
    const resolvedEndDecorator = normalizeDecorator(
      getStatusDecorator(isError, isSuccess) ??
        endDecorator ??
        trailingIcon ??
        rightIcon,
    );
    const helperContent = errorMessage ?? helperText;
    const helperColor = isError
      ? "danger.600"
      : isSuccess
        ? "success.600"
        : "neutral.600";
    const stateSx: SxProps | undefined = isError
      ? {
          borderColor: "danger.300",
          backgroundColor: "rgba(var(--joy-palette-danger-mainChannel) / 0.05)",
          "&:focus-within": {
            borderColor: "danger.500",
            boxShadow: createFocusShadow(
              "var(--joy-palette-danger-mainChannel)",
            ),
          },
        }
      : isSuccess
        ? {
            borderColor: "success.300",
            backgroundColor:
              "rgba(var(--joy-palette-success-mainChannel) / 0.05)",
            "&:focus-within": {
              borderColor: "success.500",
              boxShadow: createFocusShadow(
                "var(--joy-palette-success-mainChannel)",
              ),
            },
          }
        : undefined;

    const inputSlotProps = slotProps?.input;
    const resolvedInputSlotProps =
      typeof inputSlotProps === "function"
        ? (ownerState: unknown) => {
            const currentSlotProps = inputSlotProps(ownerState as never);
            return {
              ...currentSlotProps,
              id: inputId,
              ref: mergeRefs(currentSlotProps?.ref, ref),
            };
          }
        : {
            ...(inputSlotProps ?? {}),
            id: inputId,
            ref: mergeRefs(
              (
                inputSlotProps as
                  | { ref?: React.Ref<HTMLInputElement> }
                  | undefined
              )?.ref,
              ref,
            ),
          };

    return (
      <FormControl
        required={required}
        error={isError}
        disabled={disabled}
        sx={mergeSx({ width: "100%", gap: 0.75 }, formControlSx)}
      >
        {label ? (
          <FormLabel htmlFor={inputId} sx={labelSx}>
            {label}
          </FormLabel>
        ) : null}
        <JoyBaseInput
          {...props}
          id={inputId}
          color={resolvedColor}
          variant={resolvedVariant}
          disabled={disabled}
          fullWidth={fullWidth ?? true}
          startDecorator={resolvedStartDecorator}
          endDecorator={resolvedEndDecorator}
          onChange={(event) => {
            onValueChange?.(event.target.value);
            onChange?.(event);
          }}
          slotProps={{
            ...slotProps,
            input: resolvedInputSlotProps,
          }}
          sx={mergeSx(baseInputSx, stateSx, sx)}
        />
        {helperContent ? (
          <FormHelperText sx={{ color: helperColor, minHeight: 20 }}>
            {helperContent}
          </FormHelperText>
        ) : null}
      </FormControl>
    );
  },
);

JoyInput.displayName = "JoyInput";
