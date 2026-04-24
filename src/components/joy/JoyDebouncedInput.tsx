import * as React from "react";
import { JoyInput, type JoyInputProps } from "@/components/joy/JoyInput";
import { useDebounce } from "@/hooks/useDebounce";

export type JoyDebouncedInputProps = JoyInputProps & {
  debounceMs?: number;
  onDebouncedChange?: (value: string) => void;
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

export const JoyDebouncedInput = React.forwardRef<
  HTMLInputElement,
  JoyDebouncedInputProps
>(
  (
    {
      value,
      defaultValue,
      onChange,
      onValueChange,
      onDebouncedChange,
      debounceMs = 300,
      ...props
    },
    ref,
  ) => {
    const isControlled = value !== undefined;
    const [inputValue, setInputValue] = React.useState(() =>
      coerceValue(value ?? defaultValue),
    );
    const debouncedValue = useDebounce(inputValue, debounceMs);
    const hasMountedRef = React.useRef(false);
    const onDebouncedChangeRef = React.useRef(onDebouncedChange);

    React.useEffect(() => {
      onDebouncedChangeRef.current = onDebouncedChange;
    }, [onDebouncedChange]);

    React.useEffect(() => {
      if (isControlled) {
        setInputValue(coerceValue(value));
      }
    }, [isControlled, value]);

    React.useEffect(() => {
      if (!hasMountedRef.current) {
        hasMountedRef.current = true;
        return;
      }

      onDebouncedChangeRef.current?.(debouncedValue);
    }, [debouncedValue]);

    return (
      <JoyInput
        {...props}
        ref={ref}
        value={inputValue}
        onChange={(event) => {
          const nextValue = event.target.value;
          setInputValue(nextValue);
          onValueChange?.(nextValue);
          onChange?.(event);
        }}
      />
    );
  },
);

JoyDebouncedInput.displayName = "JoyDebouncedInput";
