import * as React from "react";
import FormControl from "@mui/joy/FormControl";
import FormHelperText from "@mui/joy/FormHelperText";
import FormLabel from "@mui/joy/FormLabel";
import JoyBaseTextarea, {
  type TextareaProps as JoyBaseTextareaProps,
} from "@mui/joy/Textarea";
import type { SxProps } from "@mui/joy/styles/types";

type NativeJoyVariant = NonNullable<JoyBaseTextareaProps["variant"]>;
type LegacyTextareaVariant = "default" | "success" | "error";

export type JoyTextareaProps = Omit<JoyBaseTextareaProps, "variant"> & {
  variant?: NativeJoyVariant | LegacyTextareaVariant;
  label?: React.ReactNode;
  helperText?: React.ReactNode;
  errorMessage?: React.ReactNode;
  success?: boolean;
  rows?: number;
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

const resolveNativeVariant = (
  variant: JoyTextareaProps["variant"],
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

const baseTextareaSx: SxProps = {
  borderRadius: "var(--joy-radius-lg)",
  boxShadow: "var(--joy-shadow-xs)",
  backgroundColor: "background.surface",
  transition:
    "border-color 0.2s ease, box-shadow 0.2s ease, background-color 0.2s ease",
  "--Textarea-paddingBlock": "0.75rem",
  "--Textarea-paddingInline": "0.875rem",
  "--Textarea-focusedThickness": "2px",
  "&:hover:not([data-disabled='true'])": {
    backgroundColor: "background.surface",
  },
  "&:focus-within": {
    borderColor: "primary.500",
    boxShadow: createFocusShadow("var(--joy-palette-primary-mainChannel)"),
  },
};

const labelSx: SxProps = {
  color: "var(--joy-palette-brandNavy-800)",
  fontWeight: "var(--joy-fontWeight-md)",
};

export const JoyTextarea = React.forwardRef<
  HTMLTextAreaElement,
  JoyTextareaProps
>(
  (
    {
      id,
      label,
      helperText,
      error,
      errorMessage,
      success = false,
      color,
      fullWidth,
      required,
      rows,
      minRows,
      slotProps,
      sx,
      formControlSx,
      variant,
      disabled,
      onChange,
      onValueChange,
      ...props
    },
    ref,
  ) => {
    const generatedId = React.useId();
    const textareaId = id ?? generatedId;
    const isError = Boolean(error || errorMessage || variant === "error");
    const isSuccess = !isError && (success || variant === "success");
    const resolvedColor = isError
      ? "danger"
      : isSuccess
        ? "success"
        : (color ?? "neutral");
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

    const textareaSlotProps = slotProps?.textarea;
    const resolvedTextareaSlotProps =
      typeof textareaSlotProps === "function"
        ? (ownerState: unknown) => {
            const currentSlotProps = textareaSlotProps(ownerState as never);
            return {
              ...currentSlotProps,
              id: textareaId,
              ref: mergeRefs(currentSlotProps?.ref, ref),
            };
          }
        : {
            ...(textareaSlotProps ?? {}),
            id: textareaId,
            ref: mergeRefs(
              (
                textareaSlotProps as
                  | { ref?: React.Ref<HTMLTextAreaElement> }
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
          <FormLabel htmlFor={textareaId} sx={labelSx}>
            {label}
          </FormLabel>
        ) : null}
        <JoyBaseTextarea
          {...props}
          id={textareaId}
          color={resolvedColor}
          variant={resolveNativeVariant(variant)}
          disabled={disabled}
          fullWidth={fullWidth ?? true}
          minRows={minRows ?? rows ?? 3}
          onChange={(event) => {
            onValueChange?.(event.target.value);
            onChange?.(event);
          }}
          slotProps={{
            ...slotProps,
            textarea: resolvedTextareaSlotProps,
          }}
          sx={mergeSx(baseTextareaSx, stateSx, sx)}
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

JoyTextarea.displayName = "JoyTextarea";
