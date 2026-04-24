import * as React from "react";
import Box from "@mui/joy/Box";
import IconButton from "@mui/joy/IconButton";
import type { SxProps } from "@mui/joy/styles/types";
import { Search, X } from "lucide-react";
import { mergeSx } from "@/components/joy/mergeSx";
import {
  JoyDebouncedInput,
  type JoyDebouncedInputProps,
} from "@/components/joy/JoyDebouncedInput";

export type JoySearchInputProps = JoyDebouncedInputProps & {
  appearance?: "page" | "topbar";
  clearable?: boolean;
  clearAriaLabel?: string;
  onClear?: () => void;
};

const coerceValue = (value: unknown) => {
  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "number") {
    return String(value);
  }

  return "";
};

const getSearchInputSx = (appearance: "page" | "topbar"): SxProps => {
  if (appearance === "topbar") {
    return {
      borderRadius: "var(--joy-radius-lg)",
      borderColor: "transparent",
      backgroundColor: "neutral.100",
      "--Input-gap": "0.625rem",
      "--Input-decoratorColor": "var(--joy-palette-neutral-400)",
      transition:
        "background-color 150ms ease, border-color 150ms ease, box-shadow 150ms ease",
      "&:hover:not([data-disabled='true'])": {
        borderColor: "transparent",
        backgroundColor: "neutral.100",
      },
      "&:focus-within": {
        borderColor: "primary.400",
        backgroundColor: "neutral.100",
        boxShadow:
          "0 0 0 2px rgba(var(--joy-palette-primary-mainChannel) / 0.18)",
      },
      "&.Mui-focusVisible, &:focus-visible": {
        borderColor: "primary.400",
      },
      "& .MuiInput-input": {
        fontSize: "14px",
      },
    };
  }

  return {
    borderRadius: "var(--joy-radius-lg)",
    "--Input-gap": "0.625rem",
  };
};

export const JoySearchInput = React.forwardRef<
  HTMLInputElement,
  JoySearchInputProps
>(
  (
    {
      appearance = "page",
      value,
      defaultValue,
      onChange,
      onValueChange,
      onDebouncedChange,
      onClear,
      clearable = true,
      clearAriaLabel = "Clear search",
      placeholder = "Search...",
      startDecorator,
      endDecorator,
      sx,
      ...props
    },
    ref,
  ) => {
    const [searchValue, setSearchValue] = React.useState(() =>
      coerceValue(value ?? defaultValue),
    );

    React.useEffect(() => {
      if (value !== undefined) {
        setSearchValue(coerceValue(value));
      }
    }, [value]);

    const handleClear = () => {
      setSearchValue("");
      onValueChange?.("");
      onDebouncedChange?.("");
      onClear?.();
    };

    return (
      <JoyDebouncedInput
        {...props}
        ref={ref}
        type="search"
        value={searchValue}
        placeholder={placeholder}
        startDecorator={
          startDecorator ?? (
            <Search aria-hidden="true" size={18} strokeWidth={1.9} />
          )
        }
        endDecorator={
          clearable && searchValue ? (
            <Box
              sx={{ display: "inline-flex", alignItems: "center", gap: 0.5 }}
            >
              {endDecorator}
              <IconButton
                size="sm"
                variant="plain"
                color="neutral"
                aria-label={clearAriaLabel}
                onClick={handleClear}
                onMouseDown={(event) => event.preventDefault()}
                sx={{
                  borderRadius: "999px",
                  width: 24,
                  height: 24,
                  color: "neutral.400",
                }}
              >
                <X className="h-4 w-4" />
              </IconButton>
            </Box>
          ) : (
            endDecorator
          )
        }
        onDebouncedChange={onDebouncedChange}
        onChange={(event) => {
          const nextValue = event.target.value;
          setSearchValue(nextValue);
          onValueChange?.(nextValue);
          onChange?.(event);
        }}
        sx={mergeSx(getSearchInputSx(appearance), sx)}
      />
    );
  },
);

JoySearchInput.displayName = "JoySearchInput";
