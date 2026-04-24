import * as React from "react";
import { Check } from "lucide-react";
import { Input, type InputProps } from "@/components/ui-legacy/input";
import { cn } from "@/lib/utils";

// Reusable select-or-type input for CRM keys, tags, and other typed suggestion flows.

const DROPDOWN_TRANSITION_MS = 150;

export interface AutocompleteSuggestion {
  value: string;
  label?: string;
  description?: string;
  icon?: React.ReactNode;
  disabled?: boolean;
}

/**
 * @deprecated Use JoyAutocomplete from src/components/joy/JoyAutocomplete instead.
 */
export interface AutocompleteProps extends Omit<
  InputProps,
  | "className"
  | "disabled"
  | "helperText"
  | "label"
  | "leftIcon"
  | "onChange"
  | "placeholder"
  | "rightIcon"
  | "value"
  | "variant"
> {
  value: string;
  onChange: (value: string) => void;
  suggestions: readonly AutocompleteSuggestion[];
  placeholder?: string;
  description?: string;
  disabled?: boolean;
  className?: string;
  allowCustomValue?: boolean;
  suggestionsLabel?: string;
  emptyText?: string;
}

function normalizeSearchValue(value: string): string {
  return value.trim().toLowerCase();
}

function createOptionId(listboxId: string, value: string): string {
  const safeValue = value.replace(/[^a-zA-Z0-9_-]/g, "-");
  return `${listboxId}-${safeValue || "option"}`;
}

function isValidSuggestionValue(
  value: string,
  suggestions: readonly AutocompleteSuggestion[],
): boolean {
  return suggestions.some(
    (suggestion) => !suggestion.disabled && suggestion.value === value,
  );
}

/**
 * @deprecated Use JoyAutocomplete from src/components/joy/JoyAutocomplete instead.
 */
export function Autocomplete({
  value,
  onChange,
  suggestions,
  placeholder,
  description,
  disabled = false,
  className,
  allowCustomValue = true,
  suggestionsLabel,
  emptyText,
  autoComplete: browserAutoComplete = "off",
  id,
  name,
  onBlur,
  onFocus,
  onKeyDown,
  ...inputProps
}: AutocompleteProps) {
  const rootRef = React.useRef<HTMLDivElement | null>(null);
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const blurTimeoutRef = React.useRef<number | null>(null);
  const optionRefs = React.useRef(new Map<string, HTMLDivElement | null>());
  const listboxId = React.useId();
  const descriptionId = React.useId();
  const liveRegionId = React.useId();
  const [isOpen, setIsOpen] = React.useState(false);
  const [shouldRenderDropdown, setShouldRenderDropdown] = React.useState(false);
  const [inputValue, setInputValue] = React.useState(value);
  const [highlightedValue, setHighlightedValue] = React.useState<string | null>(
    null,
  );
  const lastValidValueRef = React.useRef(value);

  const resolvedEmptyText =
    emptyText ??
    (allowCustomValue
      ? "No matches. Your custom value will be used."
      : "No matches found.");

  const filteredSuggestions = React.useMemo(() => {
    const query = normalizeSearchValue(inputValue);

    if (!query) {
      return suggestions;
    }

    return suggestions.filter((suggestion) => {
      const suggestionLabel = suggestion.label ?? suggestion.value;
      const haystack = `${suggestion.value} ${suggestionLabel}`.toLowerCase();
      return haystack.includes(query);
    });
  }, [inputValue, suggestions]);

  const selectableSuggestions = React.useMemo(
    () => filteredSuggestions.filter((suggestion) => !suggestion.disabled),
    [filteredSuggestions],
  );

  const highlightedSuggestion = React.useMemo(
    () =>
      highlightedValue
        ? (selectableSuggestions.find(
            (suggestion) => suggestion.value === highlightedValue,
          ) ?? null)
        : null,
    [highlightedValue, selectableSuggestions],
  );

  const announcement = React.useMemo(() => {
    if (!isOpen) {
      return "";
    }

    if (filteredSuggestions.length === 0) {
      return resolvedEmptyText;
    }

    return `${filteredSuggestions.length} suggestion${filteredSuggestions.length === 1 ? "" : "s"} available.`;
  }, [filteredSuggestions.length, isOpen, resolvedEmptyText]);

  const clearBlurTimeout = React.useCallback(() => {
    if (blurTimeoutRef.current !== null) {
      window.clearTimeout(blurTimeoutRef.current);
      blurTimeoutRef.current = null;
    }
  }, []);

  const closeDropdown = React.useCallback(() => {
    clearBlurTimeout();
    setIsOpen(false);
  }, [clearBlurTimeout]);

  const openDropdown = React.useCallback(() => {
    if (!disabled) {
      clearBlurTimeout();
      setIsOpen(true);
    }
  }, [clearBlurTimeout, disabled]);

  const commitValue = React.useCallback(
    (nextValue: string) => {
      setInputValue(nextValue);
      onChange(nextValue);

      if (isValidSuggestionValue(nextValue, suggestions)) {
        lastValidValueRef.current = nextValue;
      }
    },
    [onChange, suggestions],
  );

  const restoreLastValidValue = React.useCallback(() => {
    const fallbackValue = lastValidValueRef.current;
    setInputValue(fallbackValue);
    onChange(fallbackValue);
  }, [onChange]);

  const selectSuggestion = React.useCallback(
    (suggestion: AutocompleteSuggestion) => {
      if (suggestion.disabled) {
        return;
      }

      commitValue(suggestion.value);
      setHighlightedValue(suggestion.value);
      closeDropdown();
      inputRef.current?.focus();
    },
    [closeDropdown, commitValue],
  );

  const moveHighlight = React.useCallback(
    (direction: 1 | -1) => {
      if (selectableSuggestions.length === 0) {
        return;
      }

      setHighlightedValue((currentValue) => {
        const currentIndex = currentValue
          ? selectableSuggestions.findIndex(
              (suggestion) => suggestion.value === currentValue,
            )
          : -1;

        const nextIndex =
          currentIndex === -1
            ? direction === 1
              ? 0
              : selectableSuggestions.length - 1
            : (currentIndex + direction + selectableSuggestions.length) %
              selectableSuggestions.length;

        return selectableSuggestions[nextIndex]?.value ?? null;
      });
    },
    [selectableSuggestions],
  );

  React.useEffect(() => {
    setInputValue(value);

    if (isValidSuggestionValue(value, suggestions)) {
      lastValidValueRef.current = value;
    }
  }, [suggestions, value]);

  React.useEffect(() => {
    if (disabled) {
      closeDropdown();
    }
  }, [closeDropdown, disabled]);

  React.useEffect(() => {
    if (isOpen) {
      setShouldRenderDropdown(true);
      return;
    }

    if (!shouldRenderDropdown) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setShouldRenderDropdown(false);
    }, DROPDOWN_TRANSITION_MS);

    return () => window.clearTimeout(timeoutId);
  }, [isOpen, shouldRenderDropdown]);

  React.useEffect(() => {
    if (!isOpen) {
      setHighlightedValue(null);
      return;
    }

    if (selectableSuggestions.length === 0) {
      setHighlightedValue(null);
      return;
    }

    setHighlightedValue((currentValue) => {
      if (
        currentValue &&
        selectableSuggestions.some(
          (suggestion) => suggestion.value === currentValue,
        )
      ) {
        return currentValue;
      }

      const exactMatch = selectableSuggestions.find(
        (suggestion) => suggestion.value === inputValue,
      );

      return exactMatch?.value ?? selectableSuggestions[0]?.value ?? null;
    });
  }, [inputValue, isOpen, selectableSuggestions]);

  React.useEffect(() => {
    if (!highlightedValue) {
      return;
    }

    const optionNode = optionRefs.current.get(highlightedValue);
    optionNode?.scrollIntoView({ block: "nearest" });
  }, [highlightedValue]);

  React.useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handleMouseDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        closeDropdown();
      }
    };

    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, [closeDropdown, isOpen]);

  React.useEffect(() => {
    return () => {
      clearBlurTimeout();
    };
  }, [clearBlurTimeout]);

  return (
    <div className={cn("w-full", className)}>
      <div ref={rootRef} className="relative">
        <Input
          {...inputProps}
          ref={inputRef}
          id={id}
          name={name}
          value={inputValue}
          placeholder={placeholder}
          disabled={disabled}
          autoComplete={browserAutoComplete}
          role="combobox"
          aria-autocomplete="list"
          aria-controls={listboxId}
          aria-describedby={description ? descriptionId : undefined}
          aria-expanded={isOpen}
          aria-haspopup="listbox"
          aria-activedescendant={
            highlightedSuggestion
              ? createOptionId(listboxId, highlightedSuggestion.value)
              : undefined
          }
          onFocus={(event) => {
            onFocus?.(event);

            if (!event.defaultPrevented) {
              openDropdown();
            }
          }}
          onBlur={(event) => {
            onBlur?.(event);

            if (event.defaultPrevented) {
              return;
            }

            const nextFocusedNode = event.relatedTarget as Node | null;
            if (nextFocusedNode && rootRef.current?.contains(nextFocusedNode)) {
              return;
            }

            clearBlurTimeout();
            blurTimeoutRef.current = window.setTimeout(() => {
              if (
                !allowCustomValue &&
                !isValidSuggestionValue(inputValue, suggestions)
              ) {
                restoreLastValidValue();
              }

              closeDropdown();
            }, DROPDOWN_TRANSITION_MS);
          }}
          onChange={(event) => {
            const nextValue = event.target.value;
            setInputValue(nextValue);
            onChange(nextValue);

            if (isValidSuggestionValue(nextValue, suggestions)) {
              lastValidValueRef.current = nextValue;
            }

            openDropdown();
          }}
          onKeyDown={(event) => {
            onKeyDown?.(event);

            if (event.defaultPrevented || disabled) {
              return;
            }

            if (event.key === "ArrowDown") {
              event.preventDefault();

              if (!isOpen) {
                openDropdown();
                return;
              }

              moveHighlight(1);
              return;
            }

            if (event.key === "ArrowUp") {
              event.preventDefault();

              if (!isOpen) {
                openDropdown();
                return;
              }

              moveHighlight(-1);
              return;
            }

            if (event.key === "Enter" && isOpen) {
              if (highlightedSuggestion) {
                event.preventDefault();
                selectSuggestion(highlightedSuggestion);
                return;
              }

              if (allowCustomValue) {
                closeDropdown();
              }

              return;
            }

            if (event.key === "Escape" && isOpen) {
              event.preventDefault();
              closeDropdown();
            }
          }}
        />

        {shouldRenderDropdown ? (
          <div
            className={cn(
              "absolute left-0 top-full z-50 mt-1 w-full origin-top rounded-lg border border-border bg-popover py-1 shadow-lg transition-[opacity,transform] duration-150 ease-out",
              isOpen
                ? "pointer-events-auto scale-100 opacity-100"
                : "pointer-events-none scale-95 opacity-0",
            )}
          >
            {suggestionsLabel ? (
              <div className="px-3 py-2 text-xs font-medium text-muted-foreground">
                {suggestionsLabel}
              </div>
            ) : null}

            <div
              id={listboxId}
              role="listbox"
              className="max-h-60 overflow-y-auto"
            >
              {filteredSuggestions.length > 0 ? (
                filteredSuggestions.map((suggestion) => {
                  const suggestionLabel = suggestion.label ?? suggestion.value;
                  const isHighlighted = highlightedValue === suggestion.value;
                  const isSelected = inputValue === suggestion.value;

                  return (
                    <div
                      key={suggestion.value}
                      id={createOptionId(listboxId, suggestion.value)}
                      ref={(node) => {
                        optionRefs.current.set(suggestion.value, node);
                      }}
                      role="option"
                      aria-selected={isSelected}
                      tabIndex={-1}
                      className={cn(
                        "flex items-start gap-3 px-3 py-2 text-left transition-colors",
                        suggestion.disabled
                          ? "cursor-not-allowed opacity-50"
                          : "cursor-pointer hover:bg-muted",
                        isHighlighted && "bg-muted",
                      )}
                      onMouseEnter={() => {
                        if (!suggestion.disabled) {
                          setHighlightedValue(suggestion.value);
                        }
                      }}
                      onMouseDown={(event) => {
                        event.preventDefault();

                        if (!suggestion.disabled) {
                          selectSuggestion(suggestion);
                        }
                      }}
                    >
                      {suggestion.icon ? (
                        <div className="mt-0.5 shrink-0 text-muted-foreground">
                          {suggestion.icon}
                        </div>
                      ) : null}

                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium text-foreground">
                          {suggestionLabel}
                        </div>
                        {suggestion.description ? (
                          <div className="text-xs text-muted-foreground">
                            {suggestion.description}
                          </div>
                        ) : null}
                      </div>

                      <Check
                        className={cn(
                          "mt-0.5 h-4 w-4 shrink-0 text-primary transition-opacity",
                          isSelected ? "opacity-100" : "opacity-0",
                        )}
                      />
                    </div>
                  );
                })
              ) : (
                <div className="px-3 py-2 text-sm italic text-muted-foreground">
                  {resolvedEmptyText}
                </div>
              )}
            </div>
          </div>
        ) : null}
      </div>

      {description ? (
        <p id={descriptionId} className="mt-2 text-xs text-muted-foreground">
          {description}
        </p>
      ) : null}

      <div id={liveRegionId} aria-live="polite" className="sr-only">
        {announcement}
      </div>
    </div>
  );
}
