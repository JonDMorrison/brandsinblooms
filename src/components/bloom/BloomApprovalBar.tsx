import * as React from "react";
import Box from "@mui/joy/Box";
import Checkbox from "@mui/joy/Checkbox";
import IconButton from "@mui/joy/IconButton";
import Input from "@mui/joy/Input";
import Option from "@mui/joy/Option";
import Select from "@mui/joy/Select";
import Stack from "@mui/joy/Stack";
import Switch from "@mui/joy/Switch";
import Textarea from "@mui/joy/Textarea";
import Typography from "@mui/joy/Typography";
import {
  AlertTriangle,
  Calendar,
  Check,
  MessageCircle,
  Pencil,
  Plus,
  Send,
  Shield,
  Tag,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { JoyButton } from "@/components/joy/JoyButton";
import { JoyChip } from "@/components/joy/JoyChip";
import { useBloom } from "@/components/bloom/BloomContext";
import { useBloomReducedMotion } from "@/components/bloom/BloomMotionContext";
import { initialsFor } from "@/components/bloom/content/cards/cardUtils";
import {
  resolveApproval,
  type ResolvedApproval,
} from "@/components/bloom/utils/resolveApprovalData";
import {
  getFormSchema,
  transformFormValues,
  type ResourceFormSchema,
} from "@/components/bloom/utils/resourceFormRegistry";
import type { DetectedFormField } from "@/components/bloom/utils/contentGate";
import type {
  BloomTaskPlan,
  BloomTaskPlanAction,
  BloomTaskPlanItem,
  BloomTaskRiskLevel,
} from "@/hooks/bloom/taskPlanTypes";

const DISCUSS_PROMPT = "I'd like to discuss this plan before approving.";

const actionIcons: Record<BloomTaskPlanAction, typeof Plus> = {
  create: Plus,
  update: Pencil,
  delete: Trash2,
  send: Send,
  schedule: Calendar,
  assign: Users,
  tag: Tag,
  consent_change: Shield,
};

const riskColor: Record<
  BloomTaskRiskLevel,
  "success" | "primary" | "warning" | "danger"
> = {
  safe: "success",
  low: "primary",
  medium: "warning",
  high: "danger",
};

const riskLabel: Record<BloomTaskRiskLevel, string> = {
  safe: "Safe",
  low: "Low risk",
  medium: "Medium risk",
  high: "High risk",
};

const taskHasBlockingError = (task: BloomTaskPlanItem) =>
  task.validationAnnotations.some((annotation) => annotation.type === "error");

const MAX_PREVIEW_ROWS = 5;

// Small initials avatar matching the customer result card treatment.
function InitialsAvatar({ name }: { name: string }) {
  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: 28,
        height: 28,
        borderRadius: "50%",
        flexShrink: 0,
        fontSize: "11px",
        fontWeight: 600,
        color: "neutral.700",
        backgroundColor: "neutral.100",
      }}
      aria-hidden
    >
      {initialsFor(name)}
    </Box>
  );
}

// Renders resolved, human-readable records for a task. Never shows raw UUIDs,
// JSON arrays, or tool parameter names.
function ResolvedRecordsPreview({ resolved }: { resolved: ResolvedApproval }) {
  const customers = resolved.customers ?? [];
  const visibleCustomers = customers.slice(0, MAX_PREVIEW_ROWS);
  const customerOverflow = customers.length - visibleCustomers.length;
  const segment = resolved.segments?.[0];
  const products = resolved.products ?? [];
  const visibleProducts = products.slice(0, MAX_PREVIEW_ROWS);
  const productOverflow = products.length - visibleProducts.length;
  const campaign = resolved.campaigns?.[0];
  const tag = resolved.tags?.[0];

  const hasContent =
    visibleCustomers.length > 0 ||
    Boolean(segment) ||
    visibleProducts.length > 0 ||
    Boolean(campaign) ||
    Boolean(tag);

  if (!hasContent) {
    return null;
  }

  return (
    <Stack spacing={0.75} sx={{ mt: 1, pl: 4.25 }}>
      {visibleCustomers.length > 0 ? (
        <Stack spacing={0.5}>
          {visibleCustomers.map((customer) => (
            <Stack
              key={customer.id}
              direction="row"
              spacing={1}
              alignItems="center"
              sx={{ minWidth: 0 }}
            >
              <InitialsAvatar name={customer.name} />
              <Box sx={{ minWidth: 0, flex: 1 }}>
                <Typography
                  level="body-xs"
                  sx={{
                    fontWeight: 500,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {customer.name}
                </Typography>
                {customer.email ? (
                  <Typography
                    level="body-xs"
                    sx={{
                      color: "text.tertiary",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      maxWidth: 180,
                    }}
                  >
                    {customer.email}
                  </Typography>
                ) : null}
              </Box>
              {customer.totalSpent ? (
                <Typography
                  level="body-xs"
                  sx={{ fontWeight: 600, flexShrink: 0 }}
                >
                  {customer.totalSpent}
                </Typography>
              ) : null}
            </Stack>
          ))}
          {customerOverflow > 0 ? (
            <Typography level="body-xs" sx={{ color: "text.tertiary" }}>
              +{customerOverflow} more{" "}
              {customerOverflow === 1 ? "customer" : "customers"}
            </Typography>
          ) : null}
        </Stack>
      ) : null}

      {segment ? (
        <JoyChip
          size="sm"
          variant="soft"
          color="primary"
          startDecorator={<Users size={13} aria-hidden />}
          sx={{ alignSelf: "flex-start" }}
        >
          {segment.name}
          {segment.type ? ` · ${segment.type}` : ""}
          {typeof segment.customerCount === "number"
            ? ` · ${segment.customerCount} members`
            : ""}
        </JoyChip>
      ) : null}

      {tag ? (
        <JoyChip
          size="sm"
          variant="soft"
          color="primary"
          startDecorator={<Tag size={13} aria-hidden />}
          sx={{ alignSelf: "flex-start" }}
        >
          {tag.name}
        </JoyChip>
      ) : null}

      {visibleProducts.length > 0 ? (
        <Stack spacing={0.5}>
          {visibleProducts.map((product) => (
            <Stack
              key={product.id}
              direction="row"
              spacing={1}
              alignItems="center"
              sx={{ minWidth: 0 }}
            >
              <Typography
                level="body-xs"
                sx={{
                  flex: 1,
                  minWidth: 0,
                  fontWeight: 500,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {product.name}
                {product.sku ? (
                  <Typography
                    component="span"
                    level="body-xs"
                    sx={{ color: "text.tertiary", ml: 0.5 }}
                  >
                    {product.sku}
                  </Typography>
                ) : null}
              </Typography>
              {product.price ? (
                <Typography
                  level="body-xs"
                  sx={{ fontWeight: 600, flexShrink: 0 }}
                >
                  {product.price}
                </Typography>
              ) : null}
            </Stack>
          ))}
          {productOverflow > 0 ? (
            <Typography level="body-xs" sx={{ color: "text.tertiary" }}>
              +{productOverflow} more{" "}
              {productOverflow === 1 ? "product" : "products"}
            </Typography>
          ) : null}
        </Stack>
      ) : null}

      {campaign ? (
        <Stack direction="row" spacing={1} alignItems="center">
          <Send size={13} aria-hidden />
          <Typography level="body-xs" sx={{ fontWeight: 500 }}>
            {campaign.name}
          </Typography>
          {campaign.status ? (
            <JoyChip size="sm" variant="soft" color="neutral">
              {campaign.status}
            </JoyChip>
          ) : null}
        </Stack>
      ) : null}
    </Stack>
  );
}

interface ApprovalTaskRowProps {
  task: BloomTaskPlanItem;
  resolved: ResolvedApproval;
  selected: boolean;
  disabled: boolean;
  onToggleSelected: () => void;
}

function ApprovalTaskRow({
  task,
  resolved,
  selected,
  disabled,
  onToggleSelected,
}: ApprovalTaskRowProps) {
  const ActionIcon = actionIcons[task.action];
  const warnings = task.validationAnnotations.filter(
    (annotation) =>
      annotation.type === "warning" || annotation.type === "error",
  );
  const showRiskBanner =
    resolved.riskLevel === "high" || resolved.riskLevel === "medium";

  return (
    <Box
      sx={{
        borderRadius: "sm",
        border: "1px solid",
        borderColor: "neutral.100",
        backgroundColor: "neutral.50",
        px: 1.25,
        py: 1,
        transition: "border-color 120ms ease, background-color 120ms ease",
      }}
    >
      <Stack
        direction="row"
        spacing={1}
        alignItems="center"
        sx={{ minWidth: 0 }}
      >
        <Checkbox
          size="sm"
          checked={selected}
          disabled={disabled}
          onChange={onToggleSelected}
          slotProps={{
            input: { "aria-label": `Select task ${resolved.title}` },
          }}
        />
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 24,
            height: 24,
            borderRadius: "sm",
            flexShrink: 0,
            color: `${riskColor[task.riskLevel]}.plainColor`,
            backgroundColor: `${riskColor[task.riskLevel]}.softBg`,
          }}
        >
          <ActionIcon size={14} aria-hidden />
        </Box>
        <Typography
          level="body-sm"
          sx={{
            flex: 1,
            minWidth: 0,
            fontWeight: 600,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {resolved.title}
        </Typography>
        <JoyChip size="sm" variant="soft" color={riskColor[task.riskLevel]}>
          {riskLabel[task.riskLevel]}
        </JoyChip>
      </Stack>

      {resolved.description ? (
        <Typography
          level="body-xs"
          sx={{ mt: 0.5, pl: 4.25, color: "text.tertiary" }}
        >
          {resolved.description}
        </Typography>
      ) : null}

      <ResolvedRecordsPreview resolved={resolved} />

      {showRiskBanner && resolved.riskMessage ? (
        <Stack
          direction="row"
          spacing={0.75}
          alignItems="flex-start"
          sx={{
            mt: 1,
            ml: 4.25,
            px: 1,
            py: 0.75,
            borderRadius: "sm",
            backgroundColor:
              resolved.riskLevel === "high"
                ? "danger.softBg"
                : "warning.softBg",
            color:
              resolved.riskLevel === "high"
                ? "danger.plainColor"
                : "warning.plainColor",
          }}
        >
          <AlertTriangle
            size={13}
            aria-hidden
            style={{ marginTop: 2, flexShrink: 0 }}
          />
          <Typography level="body-xs" sx={{ color: "inherit" }}>
            {resolved.riskMessage}
          </Typography>
        </Stack>
      ) : null}

      {warnings.length > 0 ? (
        <Stack spacing={0.5} sx={{ mt: 0.75, pl: 4.25 }}>
          {warnings.map((annotation, index) => (
            <Stack
              key={`${task.taskId}-warning-${index}`}
              direction="row"
              spacing={0.75}
              alignItems="flex-start"
              sx={{
                color:
                  annotation.type === "error"
                    ? "danger.plainColor"
                    : "warning.plainColor",
              }}
            >
              <AlertTriangle
                size={13}
                aria-hidden
                style={{ marginTop: 2, flexShrink: 0 }}
              />
              <Typography level="body-xs" sx={{ color: "inherit" }}>
                {annotation.message}
              </Typography>
            </Stack>
          ))}
        </Stack>
      ) : null}
    </Box>
  );
}

function FieldRow({
  field,
  index,
  value,
  error,
  isFocused,
  onChange,
  onFocus,
  onBlur,
  isLast,
}: {
  field: DetectedFormField;
  index: number;
  value: string;
  error?: string;
  isFocused: boolean;
  onChange: (value: string) => void;
  onFocus: () => void;
  onBlur: () => void;
  isLast: boolean;
}) {
  const isTextarea = field.type === "textarea";
  // Labels are visual-only Typography, so expose the field name to assistive
  // tech directly on each control.
  const ariaLabel = field.required ? `${field.label}, required` : field.label;

  const focusControl = React.useCallback(() => {
    const control = document.querySelector<HTMLElement>(
      `[data-field-id="${field.name}"]`,
    );
    control?.focus();
  }, [field.name]);

  let control: React.ReactNode;
  if (field.type === "boolean") {
    control = (
      <Switch
        size="sm"
        checked={value === "true" || value === "yes"}
        onChange={(event) => onChange(event.target.checked ? "true" : "false")}
        onFocus={onFocus}
        onBlur={onBlur}
        slotProps={{
          input: { "aria-label": ariaLabel, "data-field-id": field.name },
        }}
        sx={{ alignSelf: "flex-end" }}
      />
    );
  } else if (field.type === "select") {
    control = (
      <Select
        size="sm"
        variant="plain"
        placeholder="Select…"
        value={value || null}
        onChange={(_event, next) => onChange((next as string) ?? "")}
        onFocus={onFocus}
        onBlur={onBlur}
        slotProps={{
          button: { "aria-label": ariaLabel, "data-field-id": field.name },
        }}
        sx={{
          width: "100%",
          fontSize: "13px",
          minHeight: 30,
          bgcolor: "transparent",
          "--Select-focusedHighlight": "transparent",
        }}
      >
        {(field.options ?? []).map((option) => (
          <Option key={option} value={option}>
            {option}
          </Option>
        ))}
      </Select>
    );
  } else if (isTextarea) {
    control = (
      <Textarea
        size="sm"
        variant="plain"
        placeholder={field.placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onFocus={onFocus}
        onBlur={onBlur}
        minRows={1}
        maxRows={3}
        slotProps={{
          textarea: { "aria-label": ariaLabel, "data-field-id": field.name },
        }}
        sx={{
          width: "100%",
          fontSize: "13px",
          "--Textarea-focusedHighlight": "transparent",
          bgcolor: "transparent",
          p: 0,
        }}
      />
    );
  } else {
    control = (
      <Input
        size="sm"
        variant="plain"
        type={
          field.type === "email"
            ? "email"
            : field.type === "phone"
              ? "tel"
              : "text"
        }
        placeholder={field.placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onFocus={onFocus}
        onBlur={onBlur}
        slotProps={{
          input: { "aria-label": ariaLabel, "data-field-id": field.name },
        }}
        sx={{
          width: "100%",
          fontSize: "13px",
          minHeight: 30,
          bgcolor: "transparent",
          "--Input-focusedHighlight": "transparent",
          "& input": { p: 0 },
        }}
      />
    );
  }

  return (
    <Box
      onClick={focusControl}
      sx={{
        display: "flex",
        alignItems: isTextarea ? "flex-start" : "center",
        minHeight: 48,
        px: "14px",
        py: "6px",
        gap: "12px",
        cursor: "text",
        borderBottom: isLast ? "none" : "1px solid",
        borderColor: "neutral.outlinedBorder",
        transition: "background-color 120ms ease",
        ...(isFocused
          ? {
              borderLeft: "3px solid",
              borderLeftColor: "primary.500",
              pl: "11px",
              bgcolor: (theme) =>
                theme.palette.mode === "dark"
                  ? "rgba(255,255,255,0.03)"
                  : "rgba(0,0,0,0.015)",
            }
          : {
              borderLeft: "3px solid transparent",
              bgcolor: "transparent",
              "&:hover": {
                bgcolor: (theme) =>
                  theme.palette.mode === "dark"
                    ? "rgba(255,255,255,0.02)"
                    : "rgba(0,0,0,0.01)",
              },
            }),
      }}
    >
      <Box
        aria-hidden
        sx={{
          width: 26,
          height: 26,
          borderRadius: "6px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          mt: isTextarea ? "3px" : 0,
          fontSize: "12px",
          fontWeight: 600,
          lineHeight: 1,
          border: "1px solid",
          borderColor: isFocused ? "primary.400" : "neutral.outlinedBorder",
          color: isFocused ? "primary.plainColor" : "text.tertiary",
          bgcolor: isFocused
            ? (theme) =>
                theme.palette.mode === "dark"
                  ? "rgba(99,179,237,0.1)"
                  : "rgba(33,150,243,0.06)"
            : "transparent",
          transition: "all 120ms ease",
        }}
      >
        {index}
      </Box>

      <Typography
        sx={{
          width: { xs: 120, sm: "160px" },
          flexShrink: 0,
          mt: isTextarea ? "4px" : 0,
          fontSize: "14px",
          fontWeight: isFocused ? 500 : 400,
          color: isFocused ? "text.primary" : "text.secondary",
          userSelect: "none",
          transition: "color 120ms ease, font-weight 120ms ease",
        }}
      >
        {field.label}
        {field.required ? (
          <Box
            component="span"
            sx={{ color: "danger.500", ml: "3px", fontSize: "13px" }}
          >
            *
          </Box>
        ) : null}
      </Typography>

      <Box
        sx={{
          flex: 1,
          minWidth: 0,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
        }}
      >
        {control}
        {error ? (
          <Typography level="body-xs" color="danger" sx={{ mt: "2px" }}>
            {error}
          </Typography>
        ) : null}
      </Box>
    </Box>
  );
}

function BloomDynamicFormSection({
  form,
  onSubmit,
  onCancel,
  onTypeInstead,
  onValuesChange,
}: {
  form: ResourceFormSchema;
  onSubmit: (values: Record<string, string>) => void;
  onCancel: (values: Record<string, string>) => void;
  onTypeInstead: (values: Record<string, string>) => void;
  onValuesChange?: (values: Record<string, string>) => void;
}) {
  const [values, setValues] = React.useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const field of form.fields) {
      if (field.defaultValue) {
        initial[field.name] = field.defaultValue;
      }
    }
    return initial;
  });
  // Mirror of `values` so handlers always read the latest edits synchronously.
  const valuesRef = React.useRef(values);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [focusedField, setFocusedField] = React.useState<string | null>(null);
  const blurTimerRef = React.useRef<number | undefined>(undefined);

  const updateField = (name: string, value: string) => {
    const next = { ...valuesRef.current, [name]: value };
    valuesRef.current = next;
    setValues(next);
    onValuesChange?.(next);
    setErrors((previous) => {
      if (!previous[name]) {
        return previous;
      }
      const nextErrors = { ...previous };
      delete nextErrors[name];
      return nextErrors;
    });
  };

  const handleSubmit = React.useCallback(() => {
    const nextErrors: Record<string, string> = {};
    for (const field of form.fields) {
      const current = values[field.name]?.trim() ?? "";
      if (field.required && !current) {
        nextErrors[field.name] = `${field.label} is required`;
        continue;
      }
      if (field.type === "email" && current && !/\S+@\S+\.\S+/.test(current)) {
        nextErrors[field.name] = "Invalid email address";
      }
    }

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    setIsSubmitting(true);
    onSubmit(values);
  }, [form.fields, onSubmit, values]);

  const handleFieldFocus = React.useCallback((name: string) => {
    if (blurTimerRef.current) {
      window.clearTimeout(blurTimerRef.current);
    }
    setFocusedField(name);
  }, []);

  // Delay clearing focus so a click on another row resolves before the accent
  // is removed.
  const handleFieldBlur = React.useCallback(() => {
    blurTimerRef.current = window.setTimeout(() => setFocusedField(null), 100);
  }, []);

  React.useEffect(
    () => () => {
      if (blurTimerRef.current) {
        window.clearTimeout(blurTimerRef.current);
      }
    },
    [],
  );

  // Keyboard navigation: arrows move between rows, number keys jump to a row,
  // Enter submits unless the caret is in a textarea or an open select listbox.
  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        // Only navigate between rows when a form field already has focus, so
        // arrow keys keep working normally while typing in the composer below.
        if (!focusedField) {
          return;
        }
        event.preventDefault();
        const currentIndex = form.fields.findIndex(
          (field) => field.name === focusedField,
        );
        const nextIndex =
          event.key === "ArrowDown"
            ? Math.min(currentIndex + 1, form.fields.length - 1)
            : Math.max(currentIndex - 1, 0);
        const nextField = form.fields[nextIndex];
        if (nextField) {
          document
            .querySelector<HTMLElement>(`[data-field-id="${nextField.name}"]`)
            ?.focus();
        }
        return;
      }

      if (event.key === "Enter" && !event.shiftKey) {
        const target = event.target as HTMLElement;
        if (
          target.tagName !== "TEXTAREA" &&
          !target.closest('[role="listbox"]')
        ) {
          event.preventDefault();
          handleSubmit();
        }
        return;
      }

      if (!focusedField) {
        // Don't hijack number keys while the user is typing elsewhere (e.g.
        // the composer below the card).
        const active = document.activeElement;
        const isEditable =
          active instanceof HTMLElement &&
          (active.tagName === "INPUT" ||
            active.tagName === "TEXTAREA" ||
            active.isContentEditable);
        if (isEditable) {
          return;
        }
        const num = Number.parseInt(event.key, 10);
        if (!Number.isNaN(num) && num >= 1 && num <= form.fields.length) {
          event.preventDefault();
          const targetField = form.fields[num - 1];
          document
            .querySelector<HTMLElement>(`[data-field-id="${targetField.name}"]`)
            ?.focus();
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [focusedField, form.fields, handleSubmit]);

  return (
    <Box sx={{ display: "flex", flexDirection: "column" }}>
      {/* Header — single line, no icon, no subtitle */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          px: "20px",
          pt: "18px",
          pb: "14px",
        }}
      >
        <Typography
          level="body-sm"
          sx={{
            flex: 1,
            fontWeight: 500,
            color: "text.primary",
            fontSize: "14px",
            lineHeight: 1.4,
          }}
        >
          Create a new {form.resourceType} — provide the details below.
        </Typography>
        <Typography
          level="body-xs"
          sx={{
            color: "text.tertiary",
            fontSize: "12px",
            mx: "12px",
            flexShrink: 0,
            userSelect: "none",
          }}
        >
          1 of 1
        </Typography>
        <IconButton
          size="sm"
          variant="plain"
          color="neutral"
          onClick={() => onCancel(values)}
          aria-label="Dismiss form"
          sx={{
            "--IconButton-size": "28px",
            borderRadius: "sm",
            opacity: 0.4,
            "&:hover": { opacity: 0.8, bgcolor: "background.level2" },
            transition: "opacity 120ms ease",
          }}
        >
          <X size={16} aria-hidden />
        </IconButton>
      </Box>

      {/* Field rows — Claude-style numbered list */}
      <Box
        sx={{
          mx: "12px",
          mb: "12px",
          border: "1px solid",
          borderColor: "neutral.outlinedBorder",
          borderRadius: "12px",
          overflow: "hidden",
          maxHeight: 380,
          overflowY: "auto",
          overflowX: "hidden",
          scrollbarWidth: "thin",
          scrollbarColor: (theme) =>
            theme.palette.mode === "dark"
              ? "rgba(255,255,255,0.15) transparent"
              : "rgba(0,0,0,0.12) transparent",
          "&::-webkit-scrollbar": { width: 5 },
          "&::-webkit-scrollbar-thumb": {
            backgroundColor: "var(--joy-palette-neutral-300)",
            borderRadius: 999,
          },
          "&::-webkit-scrollbar-track": { backgroundColor: "transparent" },
        }}
      >
        {form.fields.map((field, index) => (
          <FieldRow
            key={field.name}
            field={field}
            index={index + 1}
            value={values[field.name] ?? ""}
            error={errors[field.name]}
            isFocused={focusedField === field.name}
            onChange={(next) => updateField(field.name, next)}
            onFocus={() => handleFieldFocus(field.name)}
            onBlur={handleFieldBlur}
            isLast={index === form.fields.length - 1}
          />
        ))}

        {/* Escape row — type the details as a normal message instead */}
        <Box
          role="button"
          tabIndex={0}
          onClick={() => onTypeInstead(values)}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              onTypeInstead(values);
            }
          }}
          sx={{
            display: "flex",
            alignItems: "center",
            minHeight: 48,
            px: "14px",
            py: "6px",
            gap: "12px",
            borderTop: "1px solid",
            borderColor: "neutral.outlinedBorder",
            borderLeft: "3px solid transparent",
            cursor: "pointer",
            transition: "background-color 120ms ease",
            "&:hover": {
              bgcolor: (theme) =>
                theme.palette.mode === "dark"
                  ? "rgba(255,255,255,0.02)"
                  : "rgba(0,0,0,0.01)",
            },
          }}
        >
          <Box
            aria-hidden
            sx={{
              width: 26,
              height: 26,
              borderRadius: "6px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              color: "text.tertiary",
            }}
          >
            <Pencil size={14} aria-hidden />
          </Box>
          <Typography
            sx={{ flex: 1, fontSize: "14px", color: "text.tertiary" }}
          >
            Type it out instead
          </Typography>
          <JoyButton
            size="sm"
            variant="plain"
            color="neutral"
            onClick={(event) => {
              event.stopPropagation();
              onCancel(values);
            }}
            sx={{
              fontSize: "13px",
              fontWeight: 500,
              px: "12px",
              minHeight: 30,
              borderRadius: "8px",
              color: "text.secondary",
              "&:hover": { bgcolor: "background.level2" },
            }}
          >
            Skip
          </JoyButton>
        </Box>
      </Box>

      {/* Action row */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          px: "20px",
          pb: "16px",
        }}
      >
        <JoyButton
          size="sm"
          variant="solid"
          color="primary"
          loading={isSubmitting}
          startDecorator={<Check size={14} aria-hidden />}
          onClick={handleSubmit}
          sx={{
            fontWeight: 600,
            borderRadius: "8px",
            px: "16px",
            minHeight: 34,
            fontSize: "13px",
          }}
        >
          {form.submitLabel}
        </JoyButton>
        <JoyButton
          size="sm"
          variant="plain"
          color="neutral"
          onClick={() => onCancel(values)}
          disabled={isSubmitting}
          sx={{
            borderRadius: "8px",
            px: "12px",
            minHeight: 34,
            fontSize: "13px",
            color: "text.secondary",
          }}
        >
          Cancel
        </JoyButton>
      </Box>
    </Box>
  );
}

function TaskPlanApprovalSection({ plan }: { plan: BloomTaskPlan }) {
  const {
    approveTaskPlan,
    cancelTaskPlan,
    dismissPendingTaskPlan,
    isTaskPlanExecuting,
    sendMessage,
    streamingBlocks,
  } = useBloom();

  const isExecuting = isTaskPlanExecuting(plan.planId);

  const resolvedByTask = React.useMemo(() => {
    const map = new Map<string, ResolvedApproval>();
    for (const task of plan.tasks) {
      map.set(
        task.taskId,
        resolveApproval(
          { toolName: task.toolName, params: task.toolParams },
          streamingBlocks,
        ),
      );
    }
    return map;
  }, [plan, streamingBlocks]);

  const [selectedTaskIds, setSelectedTaskIds] = React.useState<Set<string>>(
    () =>
      new Set(
        plan.tasks
          .filter((task) => !taskHasBlockingError(task))
          .map((task) => task.taskId),
      ),
  );

  React.useEffect(() => {
    setSelectedTaskIds(
      new Set(
        plan.tasks
          .filter((task) => !taskHasBlockingError(task))
          .map((task) => task.taskId),
      ),
    );
  }, [plan]);

  const totalSelectable = plan.tasks.filter(
    (task) => !taskHasBlockingError(task),
  ).length;
  const selectedCount = selectedTaskIds.size;
  const approveAll = selectedCount === totalSelectable && totalSelectable > 0;
  const approveDisabled = isExecuting || selectedCount === 0;

  const isSingleTask = plan.tasks.length === 1;
  const singleResolved = isSingleTask
    ? resolvedByTask.get(plan.tasks[0].taskId)
    : undefined;

  const headerLabel = singleResolved
    ? singleResolved.title
    : `Bloom prepared ${plan.tasks.length} actions for your approval`;

  const approveLabel = singleResolved
    ? singleResolved.buttonLabel
    : approveAll
      ? "Approve All"
      : `Approve Selected (${selectedCount})`;

  const ApproveIcon =
    singleResolved && !singleResolved.isReversible
      ? singleResolved.buttonLabel.toLowerCase().includes("send")
        ? Send
        : Trash2
      : Check;

  const toggleSelected = (taskId: string) => {
    setSelectedTaskIds((previous) => {
      const next = new Set(previous);
      if (next.has(taskId)) {
        next.delete(taskId);
      } else {
        next.add(taskId);
      }
      return next;
    });
  };

  const handleApprove = () => {
    if (approveDisabled) {
      return;
    }

    const approvedTaskIds = plan.tasks
      .map((task) => task.taskId)
      .filter((taskId) => selectedTaskIds.has(taskId));

    void approveTaskPlan(plan, approvedTaskIds, {}).catch(() => undefined);
    dismissPendingTaskPlan();
  };

  const handleCancel = () => {
    cancelTaskPlan(plan.planId);
    dismissPendingTaskPlan();
  };

  const handleDiscuss = () => {
    void sendMessage(DISCUSS_PROMPT).catch(() => undefined);
    dismissPendingTaskPlan();
  };

  return (
    <>
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.25 }}>
        <Typography
          level="title-sm"
          sx={{ flex: 1, minWidth: 0, fontWeight: 700 }}
        >
          {headerLabel}
        </Typography>
        <IconButton
          size="sm"
          variant="plain"
          color="neutral"
          aria-label="Dismiss approval"
          onClick={handleCancel}
          sx={{ "--IconButton-size": "28px" }}
        >
          <X size={16} aria-hidden />
        </IconButton>
      </Stack>

      <Stack spacing={0.75}>
        {plan.tasks.map((task) => {
          const resolved = resolvedByTask.get(task.taskId);
          if (!resolved) {
            return null;
          }
          return (
            <ApprovalTaskRow
              key={task.taskId}
              task={task}
              resolved={resolved}
              selected={selectedTaskIds.has(task.taskId)}
              disabled={isExecuting || taskHasBlockingError(task)}
              onToggleSelected={() => toggleSelected(task.taskId)}
            />
          );
        })}
      </Stack>

      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={1}
        alignItems={{ xs: "stretch", sm: "center" }}
        sx={{ mt: 1.5 }}
      >
        <JoyButton
          size="sm"
          variant="solid"
          color={
            singleResolved && !singleResolved.isReversible
              ? "danger"
              : "primary"
          }
          startDecorator={<ApproveIcon size={15} aria-hidden />}
          disabled={approveDisabled}
          onClick={handleApprove}
        >
          {approveLabel}
        </JoyButton>
        <JoyButton
          size="sm"
          variant="outlined"
          color="neutral"
          startDecorator={<X size={15} aria-hidden />}
          disabled={isExecuting}
          onClick={handleCancel}
        >
          Cancel
        </JoyButton>
        <Box sx={{ flex: 1 }} />
        <JoyButton
          size="sm"
          variant="plain"
          color="neutral"
          startDecorator={<MessageCircle size={15} aria-hidden />}
          disabled={isExecuting}
          onClick={handleDiscuss}
        >
          Discuss
        </JoyButton>
      </Stack>
    </>
  );
}

const buildResourceMessage = (
  form: ResourceFormSchema,
  values: Record<string, string>,
): string => {
  const typedPayload = {
    tool_name: form.toolName,
    params: transformFormValues(values, form.fields),
  };
  const summary = form.fields
    .map((field) => {
      const raw = values[field.name]?.trim() ?? "";
      if (!raw) {
        return null;
      }
      if (field.type === "boolean") {
        return `${field.label}: ${raw === "true" || raw === "yes" ? "Yes" : "No"}`;
      }
      return `${field.label}: ${raw}`;
    })
    .filter((line): line is string => line !== null)
    .join("\n");

  return `Create the ${form.resourceType} with these details:\n${summary}\n\nUse the ${form.toolName} tool with these typed parameters:\n${JSON.stringify(typedPayload, null, 2)}`;
};

// Lines for whichever fields the user managed to fill before bailing out, so
// the assistant can pick up the thread instead of starting from scratch.
const summarizePartialFields = (
  form: ResourceFormSchema,
  values: Record<string, string>,
): string[] =>
  form.fields
    .map((field) => {
      const raw = values[field.name]?.trim() ?? "";
      if (!raw) {
        return null;
      }
      if (field.type === "boolean") {
        return `${field.label}: ${raw === "true" || raw === "yes" ? "Yes" : "No"}`;
      }
      return `${field.label}: ${raw}`;
    })
    .filter((line): line is string => line !== null);

const buildCancellationMessage = (
  form: ResourceFormSchema,
  _values: Record<string, string>,
): string => `I've cancelled the ${form.resourceType} creation process.`;

const buildTypeInsteadMessage = (
  form: ResourceFormSchema,
  values: Record<string, string>,
): string => {
  const filled = summarizePartialFields(form, values);
  const base = `I'll type out the ${form.resourceType} details instead of using the form.`;
  if (filled.length === 0) {
    return base;
  }
  return `${base} Here's what I'd started with:\n${filled.join("\n")}`;
};

export function BloomApprovalBar() {
  const {
    pendingTaskPlan,
    pendingResourceForm,
    dismissResourceForm,
    persistResourceFormState,
    sendMessage,
  } = useBloom();
  const reducedMotion = useBloomReducedMotion();
  const overlayRef = React.useRef<HTMLDivElement>(null);

  const resourceForm = React.useMemo(
    () =>
      pendingResourceForm
        ? getFormSchema(
            pendingResourceForm.resourceType,
            pendingResourceForm.fields,
            pendingResourceForm.prefilledValues,
          )
        : null,
    [pendingResourceForm],
  );

  // Escape blurs the focused field rather than dismissing. The creation form is
  // persistent: only an explicit Cancel, Skip, or "type it out" closes it, and
  // each of those sends the assistant a message about what happened.
  React.useEffect(() => {
    if (!pendingResourceForm) {
      return;
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") {
        return;
      }
      const active = document.activeElement;
      if (
        active instanceof HTMLElement &&
        overlayRef.current?.contains(active)
      ) {
        event.preventDefault();
        active.blur();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [pendingResourceForm]);

  if (!pendingTaskPlan && !resourceForm) {
    return null;
  }

  const handleFormSubmit = (values: Record<string, string>) => {
    if (!resourceForm) {
      return;
    }
    dismissResourceForm();
    void sendMessage(buildResourceMessage(resourceForm, values)).catch(
      () => undefined,
    );
  };

  const handleFormCancel = (values: Record<string, string>) => {
    if (!resourceForm) {
      return;
    }
    dismissResourceForm();
    void sendMessage(buildCancellationMessage(resourceForm, values)).catch(
      () => undefined,
    );
  };

  const handleTypeInstead = (values: Record<string, string>) => {
    if (!resourceForm) {
      return;
    }
    dismissResourceForm();
    void sendMessage(buildTypeInsteadMessage(resourceForm, values)).catch(
      () => undefined,
    );
  };

  // Task plans render as a self-contained rounded card floating just above the
  // composer — the same sleek treatment as the resource-creation form so both
  // permission surfaces look identical.
  if (pendingTaskPlan) {
    return (
      <Box
        ref={overlayRef}
        role="region"
        aria-label="Bloom approval"
        sx={{
          width: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          px: { xs: 1.25, sm: 2.5 },
          pt: { xs: 1, sm: 1.5 },
          pointerEvents: "none",
          "@keyframes approvalBarSlideUp": {
            from: { opacity: 0, transform: "translateY(8px)" },
            to: { opacity: 1, transform: "translateY(0)" },
          },
          animation: reducedMotion
            ? "none"
            : "approvalBarSlideUp 260ms cubic-bezier(0.16, 1, 0.3, 1)",
        }}
      >
        <Box
          sx={{
            width: { xs: "100%", sm: "min(100%, 52rem)" },
            pointerEvents: "auto",
            backgroundColor: "background.surface",
            border: "1px solid",
            borderColor: "neutral.outlinedBorder",
            borderRadius: "16px",
            boxShadow: (theme) =>
              theme.palette.mode === "dark"
                ? "0 12px 32px rgba(0, 0, 0, 0.45), 0 2px 8px rgba(0, 0, 0, 0.3)"
                : "0 12px 32px rgba(0, 0, 0, 0.10), 0 2px 8px rgba(0, 0, 0, 0.05)",
            px: { xs: 2, sm: 2.5 },
            py: 2,
            maxHeight: "60vh",
            overflowY: "auto",
            overflowX: "hidden",
            scrollbarWidth: "thin",
            scrollbarColor: "var(--joy-palette-neutral-300) transparent",
            "&::-webkit-scrollbar": { width: 5 },
            "&::-webkit-scrollbar-thumb": {
              backgroundColor: "var(--joy-palette-neutral-300)",
              borderRadius: 999,
            },
            "&::-webkit-scrollbar-track": { backgroundColor: "transparent" },
          }}
        >
          <TaskPlanApprovalSection plan={pendingTaskPlan} />
        </Box>
      </Box>
    );
  }

  if (!resourceForm) {
    return null;
  }

  // Resource creation renders as a self-contained rounded card floating just
  // above the composer (Claude permission-popup style). It is constrained to
  // the composer width and carries its own surface, border, and shadow. The
  // outer wrapper is click-through so the dotted grid stays interactive around
  // the card.
  return (
    <Box
      ref={overlayRef}
      role="region"
      aria-label="Create resource"
      sx={{
        width: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        px: { xs: 1.25, sm: 2.5 },
        pt: { xs: 1, sm: 1.5 },
        pointerEvents: "none",
        "@keyframes formExpand": {
          from: { opacity: 0, transform: "translateY(8px)" },
          to: { opacity: 1, transform: "translateY(0)" },
        },
        animation: reducedMotion
          ? "none"
          : "formExpand 260ms cubic-bezier(0.16, 1, 0.3, 1)",
      }}
    >
      <Box
        sx={{
          width: { xs: "100%", sm: "min(100%, 52rem)" },
          pointerEvents: "auto",
          backgroundColor: "background.surface",
          border: "1px solid",
          borderColor: "neutral.outlinedBorder",
          borderRadius: "16px",
          overflow: "hidden",
          boxShadow: (theme) =>
            theme.palette.mode === "dark"
              ? "0 12px 32px rgba(0, 0, 0, 0.45), 0 2px 8px rgba(0, 0, 0, 0.3)"
              : "0 12px 32px rgba(0, 0, 0, 0.10), 0 2px 8px rgba(0, 0, 0, 0.05)",
        }}
      >
        <BloomDynamicFormSection
          key={pendingResourceForm?.messageId ?? resourceForm.resourceType}
          form={resourceForm}
          onSubmit={handleFormSubmit}
          onCancel={handleFormCancel}
          onTypeInstead={handleTypeInstead}
          onValuesChange={persistResourceFormState}
        />
      </Box>

      {/* Navigation hint — sits in the gap between the card and the composer */}
      <Box
        sx={{
          display: "flex",
          justifyContent: "center",
          gap: "6px",
          pt: "8px",
          pb: "6px",
          userSelect: "none",
        }}
      >
        <Typography
          sx={{
            fontSize: "11px",
            color: "text.tertiary",
            letterSpacing: "0.01em",
          }}
        >
          ↑↓ to navigate
        </Typography>
        <Typography sx={{ fontSize: "11px", color: "text.tertiary" }}>
          ·
        </Typography>
        <Typography
          sx={{
            fontSize: "11px",
            color: "text.tertiary",
            letterSpacing: "0.01em",
          }}
        >
          Enter to submit
        </Typography>
        <Typography sx={{ fontSize: "11px", color: "text.tertiary" }}>
          ·
        </Typography>
        <Typography
          sx={{
            fontSize: "11px",
            color: "text.tertiary",
            letterSpacing: "0.01em",
          }}
        >
          or type below
        </Typography>
      </Box>
    </Box>
  );
}
