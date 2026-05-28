import * as React from "react";
import Box from "@mui/joy/Box";
import Divider from "@mui/joy/Divider";
import Sheet from "@mui/joy/Sheet";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { Check, CornerDownLeft } from "lucide-react";
import { JoyButton } from "@/components/joy/JoyButton";
import { JoyCard } from "@/components/joy/JoyCard";
import { JoyChip } from "@/components/joy/JoyChip";
import { JoyInput } from "@/components/joy/JoyInput";
import { JoyTextarea } from "@/components/joy/JoyTextarea";
import {
  formatCurrencyValue,
  formatDateValue,
  formatLabel,
  formatNumberValue,
  isRecord,
  readBoolean,
  readNumber,
  readString,
} from "@/components/bloom/blocks/blockUtils";

export type InteractionType = "selection" | "options" | "input" | "diff";
type InlineInputType = "number" | "text" | "date" | "email" | "textarea";

export interface InteractionOption {
  value: string;
  label: string;
  description?: string;
  metadata?: Record<string, unknown>;
}

export interface InteractionBlockProps {
  interactionType: InteractionType;
  prompt: string;
  options: InteractionOption[];
  context?: Record<string, unknown>;
  onSelect: (selectedValue: string | string[]) => void;
}

const knownMetadataKeys = new Set([
  "className",
  "class_name",
  "context",
  "data",
  "description",
  "entity",
  "id",
  "label",
  "metadata",
  "name",
  "title",
  "value",
]);

const normalizeInteractionType = (value: unknown): InteractionType | null => {
  const type = readString(value)
    ?.toLowerCase()
    .replace(/[-\s]+/g, "_");
  if (
    type === "selection" ||
    type === "options" ||
    type === "input" ||
    type === "diff"
  ) {
    return type;
  }
  return null;
};

const normalizeInputType = (value: unknown): InlineInputType => {
  const type = readString(value)?.toLowerCase();
  if (
    type === "number" ||
    type === "date" ||
    type === "email" ||
    type === "textarea"
  ) {
    return type;
  }
  return "text";
};

const primitiveText = (value: unknown): string | null => {
  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return formatNumberValue(value);
  }
  return readString(value);
};

const metadataFromRecord = (
  record: Record<string, unknown>,
): Record<string, unknown> | undefined => {
  const metadata = isRecord(record.metadata) ? record.metadata : null;
  const entity = isRecord(record.entity) ? record.entity : null;
  const data = isRecord(record.data) ? record.data : null;
  const fallbackEntries = Object.entries(record).filter(
    ([key]) => !knownMetadataKeys.has(key),
  );
  const fallback =
    fallbackEntries.length > 0 ? Object.fromEntries(fallbackEntries) : null;
  return metadata ?? entity ?? data ?? fallback ?? undefined;
};

const normalizeOption = (
  value: unknown,
  index: number,
): InteractionOption | null => {
  if (typeof value === "string") {
    const label = value.trim();
    return label ? { label, value: label } : null;
  }

  if (!isRecord(value)) {
    return null;
  }

  const metadata = metadataFromRecord(value);
  const optionValue =
    readString(value.value) ??
    readString(value.id) ??
    readString(value.entity_id) ??
    readString(value.entityId) ??
    readString(metadata?.id) ??
    readString(metadata?.customer_id) ??
    `option-${index + 1}`;
  const label =
    readString(value.label) ??
    readString(value.name) ??
    readString(value.title) ??
    readString(metadata?.name) ??
    readString(metadata?.email) ??
    optionValue;
  const description =
    readString(value.description) ??
    readString(value.subtitle) ??
    readString(value.summary) ??
    readString(metadata?.description) ??
    readString(metadata?.email);

  return {
    value: optionValue,
    label,
    description: description ?? undefined,
    metadata,
  };
};

const normalizeOptions = (value: unknown): InteractionOption[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((entry, index) => {
    const option = normalizeOption(entry, index);
    return option ? [option] : [];
  });
};

const contextValue = (
  source: Record<string, unknown>,
  dataRecord: Record<string, unknown> | null,
  key: string,
) => source[key] ?? dataRecord?.[key];

const normalizeContext = (
  source: Record<string, unknown>,
  dataRecord: Record<string, unknown> | null,
): Record<string, unknown> => {
  const baseContext = isRecord(source.context)
    ? source.context
    : isRecord(dataRecord?.context)
      ? dataRecord.context
      : {};
  const context: Record<string, unknown> = { ...baseContext };

  for (const key of [
    "current",
    "currentLabel",
    "current_label",
    "defaultValue",
    "default_value",
    "inputType",
    "input_type",
    "multiline",
    "overlap",
    "overlap_count",
    "proposed",
    "proposedLabel",
    "proposed_label",
    "suffix",
    "suggestedValue",
    "suggested_value",
    "suggestion",
    "unit",
  ]) {
    const value = contextValue(source, dataRecord, key);
    if (value !== undefined && context[key] === undefined) {
      context[key] = value;
    }
  }

  return context;
};

export function normalizeInteractionPayload(
  payload: unknown,
): Omit<InteractionBlockProps, "onSelect"> | null {
  const source = isRecord(payload) ? payload : {};
  const dataRecord = isRecord(source.data) ? source.data : null;
  const context = normalizeContext(source, dataRecord);
  const options = normalizeOptions(
    source.options ??
      dataRecord?.options ??
      source.choices ??
      dataRecord?.choices ??
      source.actions ??
      dataRecord?.actions,
  );
  const type =
    normalizeInteractionType(
      source.interactionType ??
        source.interaction_type ??
        dataRecord?.interactionType ??
        dataRecord?.interaction_type,
    ) ??
    (isRecord(context.current) || isRecord(context.proposed)
      ? "diff"
      : options.length > 0
        ? options.length <= 6
          ? "options"
          : "selection"
        : "input");
  const prompt =
    readString(source.prompt) ??
    readString(dataRecord?.prompt) ??
    readString(source.question) ??
    readString(dataRecord?.question) ??
    readString(source.instruction) ??
    readString(dataRecord?.instruction) ??
    (type === "input" ? "Please provide a value." : "Choose an option.");

  if (type !== "input" && type !== "diff" && options.length === 0) {
    return null;
  }

  return {
    context,
    interactionType: type,
    options,
    prompt,
  };
}

const isCustomOption = (option: InteractionOption) => {
  const value = `${option.value} ${option.label}`.toLowerCase();
  return value.includes("custom") || value.includes("other");
};

const keyActivation = (event: React.KeyboardEvent, callback: () => void) => {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    callback();
  }
};

function useResolvedSelection(onSelect: InteractionBlockProps["onSelect"]) {
  const [selectedValue, setSelectedValue] = React.useState<string | null>(null);
  const selectedValueRef = React.useRef<string | null>(null);

  const selectValue = React.useCallback(
    (value: string) => {
      if (selectedValueRef.current) {
        return;
      }
      selectedValueRef.current = value;
      setSelectedValue(value);
      onSelect(value);
    },
    [onSelect],
  );

  return { selectedValue, selectValue };
}

const lineItem = (label: string, value: unknown): string | null => {
  const text = primitiveText(value);
  return text ? `${label}: ${text}` : null;
};

const selectionDetails = (option: InteractionOption): string[] => {
  const metadata = option.metadata ?? {};
  const spent =
    metadata.total_spent ?? metadata.spent ?? metadata.lifetime_value;
  const lastOrder =
    metadata.last_order ??
    metadata.last_order_date ??
    metadata.last_purchase_date ??
    metadata.last_activity;
  const orderCount = metadata.order_count ?? metadata.orders_count;
  const memberCount = metadata.member_count ?? metadata.members;
  const details = [
    option.description,
    lineItem("Email", metadata.email ?? metadata.customer_email),
    lineItem("Phone", metadata.phone),
    spent !== undefined ? `Spent: ${formatCurrencyValue(spent)}` : null,
    lastOrder !== undefined
      ? `Last order: ${formatDateValue(lastOrder)}`
      : null,
    orderCount !== undefined
      ? `Orders: ${formatNumberValue(orderCount)}`
      : null,
    memberCount !== undefined
      ? `Members: ${formatNumberValue(memberCount)}`
      : null,
  ].filter((detail): detail is string => Boolean(detail));

  return Array.from(new Set(details)).slice(0, 5);
};

const selectionChips = (option: InteractionOption): string[] => {
  const metadata = option.metadata ?? {};
  return [
    readString(metadata.customer_type) ?? readString(metadata.type),
    readString(metadata.status),
    readString(metadata.segment),
    readString(metadata.persona),
  ]
    .filter((chip): chip is string => Boolean(chip))
    .slice(0, 3);
};

function SelectionCards({
  options,
  selectedValue,
  selectValue,
}: {
  options: InteractionOption[];
  selectedValue: string | null;
  selectValue: (value: string) => void;
}) {
  return (
    <Box
      sx={{
        display: "grid",
        gap: 1,
        gridTemplateColumns: { xs: "1fr", md: "repeat(2, minmax(0, 1fr))" },
      }}
    >
      {options.slice(0, 5).map((option) => {
        const isSelected = selectedValue === option.value;
        const isResolved = selectedValue !== null;
        const details = selectionDetails(option);
        const chips = selectionChips(option);

        return (
          <JoyCard
            key={option.value}
            interactive={!isResolved}
            role="button"
            tabIndex={isResolved ? -1 : 0}
            variant="outlined"
            onClick={() => {
              if (!isResolved) {
                selectValue(option.value);
              }
            }}
            onKeyDown={(event) =>
              keyActivation(event, () => {
                if (!isResolved) {
                  selectValue(option.value);
                }
              })
            }
            sx={{
              p: 1.5,
              opacity: isResolved && !isSelected ? 0.45 : 1,
              borderColor: isSelected ? "primary.400" : "neutral.200",
              backgroundColor: isSelected ? "primary.50" : "background.surface",
              transition:
                "opacity 200ms ease, border-color 200ms ease, background-color 200ms ease, transform 200ms ease",
              "&:hover": isResolved
                ? undefined
                : { borderColor: "primary.300" },
              "&:focus-visible": {
                outline: "2px solid var(--joy-palette-primary-500)",
                outlineOffset: 2,
              },
            }}
          >
            <Stack spacing={1} sx={{ minHeight: "100%" }}>
              <Stack
                direction="row"
                spacing={1}
                justifyContent="space-between"
                alignItems="flex-start"
              >
                <Stack spacing={0.35} sx={{ minWidth: 0 }}>
                  <Typography
                    level="title-sm"
                    sx={{ color: "neutral.900", overflowWrap: "anywhere" }}
                  >
                    {option.label}
                  </Typography>
                  {details.slice(0, 2).map((detail) => (
                    <Typography
                      key={detail}
                      level="body-xs"
                      sx={{ color: "neutral.500", overflowWrap: "anywhere" }}
                    >
                      {detail}
                    </Typography>
                  ))}
                </Stack>
                {isSelected ? (
                  <JoyChip
                    color="primary"
                    size="sm"
                    variant="soft"
                    startDecorator={<Check size={13} strokeWidth={1.9} />}
                  >
                    Selected
                  </JoyChip>
                ) : null}
              </Stack>

              {details.length > 2 ? (
                <Stack spacing={0.25}>
                  {details.slice(2).map((detail) => (
                    <Typography
                      key={detail}
                      level="body-xs"
                      sx={{ color: "neutral.600", overflowWrap: "anywhere" }}
                    >
                      {detail}
                    </Typography>
                  ))}
                </Stack>
              ) : null}

              {chips.length > 0 ? (
                <Stack
                  direction="row"
                  spacing={0.5}
                  useFlexGap
                  sx={{ flexWrap: "wrap" }}
                >
                  {chips.map((chip) => (
                    <JoyChip
                      key={chip}
                      color="neutral"
                      size="sm"
                      variant="soft"
                    >
                      {formatLabel(chip)}
                    </JoyChip>
                  ))}
                </Stack>
              ) : null}

              <Box
                sx={{ display: "flex", justifyContent: "flex-end", mt: "auto" }}
              >
                <JoyButton
                  color={isSelected ? "primary" : "neutral"}
                  disabled={isResolved && !isSelected}
                  size="sm"
                  variant={isSelected ? "solid" : "outlined"}
                  startDecorator={
                    isSelected ? (
                      <Check size={14} strokeWidth={1.9} />
                    ) : undefined
                  }
                  onClick={(event) => {
                    event.stopPropagation();
                    if (!isResolved) {
                      selectValue(option.value);
                    }
                  }}
                >
                  {isSelected ? "Selected" : "Select"}
                </JoyButton>
              </Box>
            </Stack>
          </JoyCard>
        );
      })}
    </Box>
  );
}

function InlineInput({
  context,
  prompt,
  selectedValue,
  selectValue,
}: {
  context: Record<string, unknown>;
  prompt: string;
  selectedValue: string | null;
  selectValue: (value: string) => void;
}) {
  const inputType = normalizeInputType(context.inputType ?? context.input_type);
  const suffix = readString(context.suffix) ?? readString(context.unit);
  const suggestion =
    readString(context.suggestion) ??
    readString(context.suggestedValue) ??
    readString(context.suggested_value) ??
    readString(context.defaultValue) ??
    readString(context.default_value) ??
    "";
  const [value, setValue] = React.useState(suggestion);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const textareaRef = React.useRef<HTMLTextAreaElement | null>(null);
  const isResolved = selectedValue !== null;
  const inputKind =
    inputType === "textarea" || readBoolean(context.multiline)
      ? "textarea"
      : "input";

  React.useEffect(() => {
    if (!suggestion || isResolved) {
      return;
    }

    const animationFrame = window.requestAnimationFrame(() => {
      const field =
        inputKind === "textarea" ? textareaRef.current : inputRef.current;
      field?.focus();
      field?.select();
    });

    return () => window.cancelAnimationFrame(animationFrame);
  }, [inputKind, isResolved, suggestion]);

  const submitValue = () => {
    const trimmedValue = value.trim();
    if (!trimmedValue) {
      setErrorMessage("Enter a value to continue.");
      return;
    }
    if (
      inputType === "email" &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedValue)
    ) {
      setErrorMessage("Enter a valid email address.");
      return;
    }
    if (inputType === "number" && Number.isNaN(Number(trimmedValue))) {
      setErrorMessage("Enter a valid number.");
      return;
    }
    setErrorMessage(null);
    selectValue(trimmedValue);
  };

  const submitOnEnter = (
    event: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      submitValue();
    }
  };

  return (
    <Stack spacing={1}>
      {inputKind === "textarea" ? (
        <JoyTextarea
          ref={textareaRef}
          disabled={isResolved}
          error={Boolean(errorMessage)}
          errorMessage={errorMessage}
          minRows={3}
          placeholder={prompt}
          value={value}
          onKeyDown={submitOnEnter}
          onValueChange={setValue}
        />
      ) : (
        <JoyInput
          ref={inputRef}
          disabled={isResolved}
          endDecorator={
            suffix ? (
              <Typography level="body-xs" sx={{ color: "neutral.500" }}>
                {suffix}
              </Typography>
            ) : undefined
          }
          error={Boolean(errorMessage)}
          errorMessage={errorMessage}
          placeholder={prompt}
          type={inputType === "textarea" ? "text" : inputType}
          value={value}
          onKeyDown={submitOnEnter}
          onValueChange={setValue}
        />
      )}
      <Stack
        direction="row"
        spacing={0.75}
        alignItems="center"
        justifyContent="space-between"
      >
        {isResolved ? (
          <JoyChip
            color="primary"
            size="sm"
            variant="soft"
            startDecorator={<Check size={13} strokeWidth={1.9} />}
          >
            Submitted
          </JoyChip>
        ) : (
          <Box />
        )}
        <JoyButton
          color="primary"
          disabled={isResolved}
          size="sm"
          variant="solid"
          startDecorator={<CornerDownLeft size={14} strokeWidth={1.9} />}
          onClick={submitValue}
        >
          Apply
        </JoyButton>
      </Stack>
    </Stack>
  );
}

function OptionChips({
  context,
  options,
  prompt,
  selectedValue,
  selectValue,
}: {
  context: Record<string, unknown>;
  options: InteractionOption[];
  prompt: string;
  selectedValue: string | null;
  selectValue: (value: string) => void;
}) {
  const [customInputOpen, setCustomInputOpen] = React.useState(false);
  const isResolved = selectedValue !== null;

  if (customInputOpen && !isResolved) {
    return (
      <InlineInput
        context={context}
        prompt={prompt}
        selectedValue={selectedValue}
        selectValue={selectValue}
      />
    );
  }

  return (
    <Stack direction="row" spacing={0.75} useFlexGap sx={{ flexWrap: "wrap" }}>
      {options.slice(0, 6).map((option) => {
        const isSelected = selectedValue === option.value;
        return (
          <JoyChip
            key={option.value}
            color="primary"
            role="button"
            size="md"
            tabIndex={isResolved ? -1 : 0}
            variant={isSelected ? "solid" : "outlined"}
            onClick={() => {
              if (isResolved) {
                return;
              }
              if (isCustomOption(option)) {
                setCustomInputOpen(true);
                return;
              }
              selectValue(option.value);
            }}
            onKeyDown={(event) =>
              keyActivation(event, () => {
                if (isResolved) {
                  return;
                }
                if (isCustomOption(option)) {
                  setCustomInputOpen(true);
                  return;
                }
                selectValue(option.value);
              })
            }
            startDecorator={
              isSelected ? <Check size={13} strokeWidth={1.9} /> : undefined
            }
            sx={{
              cursor: isResolved ? "default" : "pointer",
              opacity: isResolved && !isSelected ? 0.45 : 1,
              transition:
                "opacity 200ms ease, background-color 200ms ease, border-color 200ms ease",
            }}
          >
            {option.label}
          </JoyChip>
        );
      })}
    </Stack>
  );
}

const diffValue = (key: string, value: unknown): string | null => {
  if (key.toLowerCase().includes("date") || key.toLowerCase().endsWith("_at")) {
    return formatDateValue(value);
  }
  if (
    key.toLowerCase().includes("spent") ||
    key.toLowerCase().includes("amount") ||
    key.toLowerCase().includes("price")
  ) {
    return formatCurrencyValue(value);
  }
  return primitiveText(value);
};

const diffRows = (
  current: Record<string, unknown>,
  proposed: Record<string, unknown>,
) => {
  const keys = Array.from(
    new Set([...Object.keys(current), ...Object.keys(proposed)]),
  )
    .filter((key) => !["id", "created_at", "updated_at"].includes(key))
    .filter(
      (key) =>
        !isRecord(current[key]) &&
        !Array.isArray(current[key]) &&
        !isRecord(proposed[key]) &&
        !Array.isArray(proposed[key]),
    )
    .slice(0, 7);

  return keys.map((key) => {
    const currentValue = diffValue(key, current[key]);
    const proposedValue = diffValue(key, proposed[key]);
    return {
      differs: currentValue !== proposedValue,
      key,
      label: formatLabel(key),
      currentValue: currentValue ?? "Not set",
      proposedValue: proposedValue ?? "Not set",
    };
  });
};

function DiffPanel({
  label,
  rows,
  side,
}: {
  label: string;
  rows: ReturnType<typeof diffRows>;
  side: "current" | "proposed";
}) {
  return (
    <Sheet
      color="neutral"
      variant="soft"
      sx={{
        flex: 1,
        minWidth: 0,
        borderRadius: "var(--joy-radius-md)",
        backgroundColor: "background.level1",
        p: 1.5,
      }}
    >
      <Stack spacing={1}>
        <Typography level="title-sm" sx={{ color: "neutral.800" }}>
          {label}
        </Typography>
        <Stack spacing={0.5}>
          {rows.map((row) => (
            <Box
              key={`${side}-${row.key}`}
              sx={{
                borderRadius: "var(--joy-radius-sm)",
                backgroundColor: row.differs ? "primary.50" : "transparent",
                px: row.differs ? 0.75 : 0,
                py: 0.5,
              }}
            >
              <Typography level="body-xs" sx={{ color: "neutral.500" }}>
                {row.label}
              </Typography>
              <Typography
                level="body-xs"
                sx={{ color: "neutral.800", overflowWrap: "anywhere" }}
              >
                {side === "current" ? row.currentValue : row.proposedValue}
              </Typography>
            </Box>
          ))}
        </Stack>
      </Stack>
    </Sheet>
  );
}

function DiffView({
  context,
  options,
  selectedValue,
  selectValue,
}: {
  context: Record<string, unknown>;
  options: InteractionOption[];
  selectedValue: string | null;
  selectValue: (value: string) => void;
}) {
  const current = isRecord(context.current) ? context.current : {};
  const proposed = isRecord(context.proposed) ? context.proposed : {};
  const rows = diffRows(current, proposed);
  const currentLabel =
    readString(context.currentLabel) ??
    readString(context.current_label) ??
    "Current";
  const proposedLabel =
    readString(context.proposedLabel) ??
    readString(context.proposed_label) ??
    "Proposed";
  const overlap =
    readNumber(context.overlap_count) ?? readNumber(context.overlap);
  const isResolved = selectedValue !== null;

  return (
    <Stack spacing={1.25}>
      <Stack
        direction={{ xs: "column", md: "row" }}
        spacing={1}
        alignItems="stretch"
      >
        <DiffPanel label={currentLabel} rows={rows} side="current" />
        <DiffPanel label={proposedLabel} rows={rows} side="proposed" />
      </Stack>
      {overlap !== null ? (
        <Typography level="body-xs" sx={{ color: "warning.600" }}>
          {formatNumberValue(overlap)} members overlap
        </Typography>
      ) : null}
      <Stack
        direction="row"
        spacing={0.75}
        useFlexGap
        sx={{ flexWrap: "wrap" }}
      >
        {options.map((option, index) => {
          const isSelected = selectedValue === option.value;
          const isRecommended =
            readBoolean(option.metadata?.recommended) ?? index === 0;
          return (
            <JoyButton
              key={option.value}
              color={isSelected || isRecommended ? "primary" : "neutral"}
              disabled={isResolved && !isSelected}
              size="sm"
              variant={isSelected || isRecommended ? "solid" : "outlined"}
              startDecorator={
                isSelected ? <Check size={14} strokeWidth={1.9} /> : undefined
              }
              sx={{ opacity: isResolved && !isSelected ? 0.45 : 1 }}
              onClick={() => {
                if (!isResolved) {
                  selectValue(option.value);
                }
              }}
            >
              {option.label}
            </JoyButton>
          );
        })}
      </Stack>
    </Stack>
  );
}

export function InteractionBlock({
  context = {},
  interactionType,
  onSelect,
  options,
  prompt,
}: InteractionBlockProps) {
  const { selectedValue, selectValue } = useResolvedSelection(onSelect);

  return (
    <Stack spacing={1.25} sx={{ minWidth: 0 }}>
      <Typography
        level="body-sm"
        sx={{ color: "neutral.800", lineHeight: 1.6, overflowWrap: "anywhere" }}
      >
        {prompt}
      </Typography>

      {interactionType === "selection" ? (
        <SelectionCards
          options={options}
          selectedValue={selectedValue}
          selectValue={selectValue}
        />
      ) : null}

      {interactionType === "options" ? (
        <OptionChips
          context={context}
          options={options}
          prompt={prompt}
          selectedValue={selectedValue}
          selectValue={selectValue}
        />
      ) : null}

      {interactionType === "input" ? (
        <InlineInput
          context={context}
          prompt={prompt}
          selectedValue={selectedValue}
          selectValue={selectValue}
        />
      ) : null}

      {interactionType === "diff" ? (
        <DiffView
          context={context}
          options={options}
          selectedValue={selectedValue}
          selectValue={selectValue}
        />
      ) : null}

      {selectedValue ? (
        <>
          <Divider
            sx={{ "--Divider-lineColor": "var(--joy-palette-neutral-100)" }}
          />
          <JoyChip
            color="primary"
            size="sm"
            variant="soft"
            startDecorator={<Check size={13} strokeWidth={1.9} />}
          >
            Selection sent
          </JoyChip>
        </>
      ) : null}
    </Stack>
  );
}
