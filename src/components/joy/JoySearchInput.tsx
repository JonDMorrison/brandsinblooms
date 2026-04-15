import * as React from "react";
import Box from "@mui/joy/Box";
import IconButton from "@mui/joy/IconButton";
import type { SxProps } from "@mui/joy/styles/types";
import { Search, X } from "lucide-react";
import {
  JoyDebouncedInput,
  type JoyDebouncedInputProps,
} from "@/components/joy/JoyDebouncedInput";

export type JoySearchInputProps = JoyDebouncedInputProps & {
  clearable?: boolean;
  clearAriaLabel?: string;
  onClear?: () => void;
};

const mergeSx = (...values: Array<SxProps | undefined>) =>
  values.filter(Boolean) as SxProps[];

const coerceValue = (value: unknown) => {
  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "number") {
    return String(value);
  }

  return "";
};

const searchInputSx: SxProps = {
  borderRadius: "var(--joy-radius-xl)",
  backgroundColor: "background.body",
  "--Input-gap": "0.625rem",
  "&:hover:not([data-disabled='true'])": {
    backgroundColor: "background.surface",
  },
};

export const JoySearchInput = React.forwardRef<
  HTMLInputElement,
  JoySearchInputProps
>(
  (
    {
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
          startDecorator ?? <Search className="h-4 w-4" aria-hidden="true" />
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
        sx={mergeSx(searchInputSx, sx)}
      />
    );
  },
);

JoySearchInput.displayName = "JoySearchInput";
