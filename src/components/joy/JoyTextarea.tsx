import * as React from "react";
import FormControl from "@mui/joy/FormControl";
import FormHelperText from "@mui/joy/FormHelperText";
import FormLabel from "@mui/joy/FormLabel";
import JoyBaseTextarea, {
  type TextareaProps as JoyBaseTextareaProps,
} from "@mui/joy/Textarea";
import type { SxProps } from "@mui/joy/styles/types";
import { mergeSx } from "@/components/joy/mergeSx";

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

const baseTextareaSx: SxProps = {
  minHeight: 80,
  borderColor: "neutral.300",
  borderRadius: "var(--joy-radius-lg)",
  boxShadow: "none",
  backgroundColor: "#FFFFFF",
  color: "var(--joy-palette-neutral-800)",
  transition:
    "border-color 0.2s ease, box-shadow 0.2s ease, background-color 0.2s ease",
  "--Textarea-paddingBlock": "0.625rem",
  "--Textarea-paddingInline": "0.75rem",
  "--Textarea-focusedThickness": "0px",
  "--Textarea-placeholderColor": "var(--joy-palette-neutral-400)",
  "--Textarea-placeholderOpacity": "1",
  "--Textarea-decoratorColor": "var(--joy-palette-neutral-400)",
  "&:hover:not([data-disabled='true'])": {
    backgroundColor: "#FFFFFF",
    borderColor: "neutral.400",
  },
  "&:focus-within": {
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
  "& .MuiTextarea-textarea": {
    fontSize: "var(--joy-fontSize-sm)",
    fontWeight: "var(--joy-fontWeight-regular)",
    lineHeight: "var(--joy-lineHeight-md)",
    color: "var(--joy-palette-neutral-800)",
    minHeight: 80,
    resize: "vertical",
    "&::placeholder": {
      color: "var(--joy-palette-neutral-400)",
      opacity: 1,
    },
  },
};

const labelSx: SxProps = {
  color: "var(--joy-palette-neutral-600)",
  fontSize: "0.8125rem",
  fontWeight: "var(--joy-fontWeight-medium)",
  lineHeight: 1.4,
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
        : "neutral.500";
    const stateSx: SxProps | undefined = isError
      ? {
          borderColor: "danger.400",
          backgroundColor: "rgba(var(--joy-palette-danger-mainChannel) / 0.05)",
          "&:hover:not([data-disabled='true'])": {
            borderColor: "danger.400",
          },
          "&:focus-within": {
            borderColor: "danger.400",
          },
          "&.Mui-focusVisible, &:focus-visible": {
            outline: "none",
            outlineOffset: 0,
          },
        }
      : isSuccess
        ? {
            borderColor: "success.300",
            backgroundColor:
              "rgba(var(--joy-palette-success-mainChannel) / 0.05)",
            "&:hover:not([data-disabled='true'])": {
              borderColor: "success.400",
            },
            "&:focus-within": {
              borderColor: "success.400",
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
        sx={mergeSx(
          { width: fullWidth === false ? undefined : "100%", gap: 0.5 },
          formControlSx,
        )}
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

JoyTextarea.displayName = "JoyTextarea";
