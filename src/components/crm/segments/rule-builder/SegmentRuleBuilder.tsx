import { useMemo } from "react";
import Box from "@mui/joy/Box";
import Chip from "@mui/joy/Chip";
import Divider from "@mui/joy/Divider";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { Braces, GitBranch, Plus, Trash2 } from "lucide-react";
import { JoyAutocomplete } from "@/components/joy/JoyAutocomplete";
import { JoyButton } from "@/components/joy/JoyButton";
import {
  JoyCard,
  JoyCardContent,
  JoyCardHeader,
} from "@/components/joy/JoyCard";
import { JoyInput } from "@/components/joy/JoyInput";
import { JoySelect } from "@/components/joy/JoySelect";
import {
  canAddNestedGroup,
  createEmptyGroup,
  createEmptyRule,
  createsCircularSegmentReference,
  getFieldById,
  getOperatorsForField,
  isRuleGroup,
  SEGMENT_OPERATORS,
  type SegmentBetweenValue,
  type SegmentDependencySource,
  type SegmentField,
  type SegmentOperatorId,
  type SegmentRelativeDateValue,
  type SegmentRuleCondition,
  type SegmentRuleGroup,
  type SegmentRuleNode,
  type SegmentRuleValue,
} from "@/lib/segmentFields";

interface RelationOption {
  id: string;
  label: string;
}

interface BuilderOption {
  id: string;
  label: string;
  category?: string;
}

export interface SegmentRuleBuilderProps {
  value: SegmentRuleGroup;
  fields: SegmentField[];
  segmentOptions: RelationOption[];
  personaOptions: RelationOption[];
  tagOptions: string[];
  currentSegmentId?: string | null;
  dependencySource?: SegmentDependencySource[];
  onChange: (nextValue: SegmentRuleGroup) => void;
}

function normalizeArrayValue(value: SegmentRuleValue) {
  return Array.isArray(value)
    ? value.map((entry) => String(entry))
    : typeof value === "string" && value
      ? [value]
      : [];
}

function normalizeStringValue(value: SegmentRuleValue) {
  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "number") {
    return String(value);
  }

  return "";
}

function updateNode(
  group: SegmentRuleGroup,
  targetId: string,
  updater: (node: SegmentRuleNode) => SegmentRuleNode,
): SegmentRuleGroup {
  if (group.id === targetId) {
    return updater(group) as SegmentRuleGroup;
  }

  return {
    ...group,
    children: group.children.map((child) => {
      if (child.id === targetId) {
        return updater(child);
      }

      if (isRuleGroup(child)) {
        return updateNode(child, targetId, updater);
      }

      return child;
    }),
  };
}

function removeNode(
  group: SegmentRuleGroup,
  targetId: string,
): SegmentRuleGroup {
  const nextChildren = group.children
    .filter((child) => child.id !== targetId)
    .map((child) => (isRuleGroup(child) ? removeNode(child, targetId) : child));

  return {
    ...group,
    children: nextChildren.length ? nextChildren : [createEmptyRule()],
  };
}

function buildRelationOptions(
  field: SegmentField,
  segmentOptions: RelationOption[],
  personaOptions: RelationOption[],
  tagOptions: string[],
  currentSegmentId?: string | null,
  dependencySource?: SegmentDependencySource[],
) {
  if (field.relationType === "persona") {
    return personaOptions;
  }

  if (field.relationType === "tag") {
    return tagOptions.map((tag) => ({ id: tag, label: tag }));
  }

  return segmentOptions.filter((option) => {
    if (!currentSegmentId) {
      return true;
    }

    return !createsCircularSegmentReference(
      currentSegmentId,
      option.id,
      dependencySource ?? [],
    );
  });
}

function RuleValueEditor({
  field,
  rule,
  segmentOptions,
  personaOptions,
  tagOptions,
  currentSegmentId,
  dependencySource,
  onChange,
}: {
  field: SegmentField;
  rule: SegmentRuleCondition;
  segmentOptions: RelationOption[];
  personaOptions: RelationOption[];
  tagOptions: string[];
  currentSegmentId?: string | null;
  dependencySource?: SegmentDependencySource[];
  onChange: (value: SegmentRuleValue) => void;
}) {
  const operator = rule.operatorId ? SEGMENT_OPERATORS[rule.operatorId] : null;

  if (!operator || !operator.requiresValue) {
    return null;
  }

  if (field.dataType === "boolean") {
    return (
      <JoySelect
        onValueChange={(nextValue) => onChange(nextValue === "true")}
        options={[
          { value: "true", label: "Yes" },
          { value: "false", label: "No" },
        ]}
        placeholder="Value"
        sx={{ minWidth: 128 }}
        value={String(Boolean(rule.value))}
      />
    );
  }

  if (field.dataType === "relation" || field.dataType === "enum") {
    const rawOptions =
      field.dataType === "relation"
        ? buildRelationOptions(
            field,
            segmentOptions,
            personaOptions,
            tagOptions,
            currentSegmentId,
            dependencySource,
          )
        : (field.enumOptions ?? []).map((option) => ({
            id: option,
            label: option,
          }));

    if (operator.allowsMultiple) {
      const selected = rawOptions.filter((option) =>
        normalizeArrayValue(rule.value).includes(option.id),
      );

      return (
        <JoyAutocomplete<RelationOption, true, false, false>
          getOptionLabel={(option) => option.label}
          isOptionEqualToValue={(option, current) => option.id === current.id}
          multiple
          onValueChange={(nextValue) =>
            onChange((nextValue ?? []).map((option) => option.id))
          }
          options={rawOptions}
          placeholder="Select values"
          value={selected}
        />
      );
    }

    const selected =
      rawOptions.find((option) => option.id === String(rule.value ?? "")) ??
      null;
    return (
      <JoyAutocomplete<RelationOption, false, false, false>
        getOptionLabel={(option) => option.label}
        isOptionEqualToValue={(option, current) => option.id === current.id}
        onValueChange={(nextValue) => onChange(nextValue?.id ?? null)}
        options={rawOptions}
        placeholder="Select value"
        value={selected}
      />
    );
  }

  if (field.dataType === "number") {
    if (rule.operatorId === "between") {
      const range = (rule.value ?? {}) as SegmentBetweenValue;
      return (
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={1}
          sx={{ flex: 1 }}
        >
          <JoyInput
            onValueChange={(nextValue) =>
              onChange({
                ...range,
                min: nextValue === "" ? null : Number(nextValue),
              })
            }
            placeholder="Min"
            type="number"
            value={range.min ?? ""}
          />
          <JoyInput
            onValueChange={(nextValue) =>
              onChange({
                ...range,
                max: nextValue === "" ? null : Number(nextValue),
              })
            }
            placeholder="Max"
            type="number"
            value={range.max ?? ""}
          />
        </Stack>
      );
    }

    return (
      <JoyInput
        onValueChange={(nextValue) =>
          onChange(nextValue === "" ? null : Number(nextValue))
        }
        placeholder="Value"
        type="number"
        value={normalizeStringValue(rule.value)}
      />
    );
  }

  if (field.dataType === "date") {
    if (operator.relativeDate) {
      const relative = (rule.value as SegmentRelativeDateValue | null) ?? {
        amount: 30,
        unit: "days",
      };

      return (
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={1}
          sx={{ flex: 1 }}
        >
          <JoyInput
            onValueChange={(nextValue) =>
              onChange({ ...relative, amount: Number(nextValue || 0) })
            }
            placeholder="Amount"
            type="number"
            value={relative.amount}
          />
          <JoySelect
            onValueChange={(nextValue) =>
              onChange({
                ...relative,
                unit: (nextValue || "days") as SegmentRelativeDateValue["unit"],
              })
            }
            options={[
              { value: "days", label: "Days" },
              { value: "weeks", label: "Weeks" },
              { value: "months", label: "Months" },
            ]}
            value={relative.unit}
          />
        </Stack>
      );
    }

    if (rule.operatorId === "between") {
      const range = (rule.value ?? {}) as SegmentBetweenValue;
      return (
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={1}
          sx={{ flex: 1 }}
        >
          <JoyInput
            onValueChange={(nextValue) =>
              onChange({ ...range, min: nextValue || null })
            }
            type="date"
            value={String(range.min ?? "")}
          />
          <JoyInput
            onValueChange={(nextValue) =>
              onChange({ ...range, max: nextValue || null })
            }
            type="date"
            value={String(range.max ?? "")}
          />
        </Stack>
      );
    }

    return (
      <JoyInput
        onValueChange={(nextValue) => onChange(nextValue || null)}
        type="date"
        value={normalizeStringValue(rule.value)}
      />
    );
  }

  return (
    <JoyInput
      onValueChange={(nextValue) => onChange(nextValue)}
      placeholder="Value"
      value={normalizeStringValue(rule.value)}
    />
  );
}

function GroupEditor({
  group,
  depth,
  fields,
  segmentOptions,
  personaOptions,
  tagOptions,
  currentSegmentId,
  dependencySource,
  onGroupChange,
  onRemove,
}: {
  group: SegmentRuleGroup;
  depth: number;
  fields: SegmentField[];
  segmentOptions: RelationOption[];
  personaOptions: RelationOption[];
  tagOptions: string[];
  currentSegmentId?: string | null;
  dependencySource?: SegmentDependencySource[];
  onGroupChange: (group: SegmentRuleGroup) => void;
  onRemove?: () => void;
}) {
  const fieldOptions = useMemo<BuilderOption[]>(() => {
    return fields.map((field) => ({
      id: field.id,
      label: field.label,
      category: field.category,
    }));
  }, [fields]);

  return (
    <Stack
      spacing={1.5}
      sx={{
        p: 2,
        borderRadius: "var(--joy-radius-lg)",
        border: "1px solid",
        borderColor: depth === 0 ? "neutral.200" : "neutral.100",
        backgroundColor: depth === 0 ? "background.surface" : "neutral.50",
      }}
    >
      <Stack
        direction={{ xs: "column", md: "row" }}
        justifyContent="space-between"
        spacing={1}
      >
        <Stack
          direction="row"
          spacing={1}
          alignItems="center"
          useFlexGap
          flexWrap="wrap"
        >
          <Chip
            color="primary"
            size="sm"
            startDecorator={<GitBranch size={14} />}
            variant="soft"
          >
            Group {depth + 1}
          </Chip>
          <JoySelect
            onValueChange={(nextValue) =>
              onGroupChange({
                ...group,
                operator: (nextValue || "AND") as SegmentRuleGroup["operator"],
              })
            }
            options={[
              { value: "AND", label: "Match all rules" },
              { value: "OR", label: "Match any rule" },
            ]}
            sx={{ minWidth: 180 }}
            value={group.operator}
          />
        </Stack>
        <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
          <JoyButton
            bloomVariant="outline"
            onClick={() =>
              onGroupChange({
                ...group,
                children: [...group.children, createEmptyRule()],
              })
            }
            size="sm"
            startDecorator={<Plus size={16} />}
          >
            Add rule
          </JoyButton>
          <JoyButton
            bloomVariant="ghost"
            disabled={!canAddNestedGroup(depth)}
            onClick={() =>
              onGroupChange({
                ...group,
                children: [...group.children, createEmptyGroup(depth + 1)],
              })
            }
            size="sm"
            startDecorator={<Braces size={16} />}
          >
            Add group
          </JoyButton>
          {onRemove ? (
            <JoyButton
              bloomVariant="ghost"
              color="danger"
              onClick={onRemove}
              size="sm"
              startDecorator={<Trash2 size={16} />}
            >
              Remove group
            </JoyButton>
          ) : null}
        </Stack>
      </Stack>

      {group.children.map((child) => {
        if (isRuleGroup(child)) {
          return (
            <GroupEditor
              currentSegmentId={currentSegmentId}
              dependencySource={dependencySource}
              depth={depth + 1}
              fields={fields}
              group={child}
              key={child.id}
              onGroupChange={(nextChild) =>
                onGroupChange(updateNode(group, child.id, () => nextChild))
              }
              onRemove={() => onGroupChange(removeNode(group, child.id))}
              personaOptions={personaOptions}
              segmentOptions={segmentOptions}
              tagOptions={tagOptions}
            />
          );
        }

        const field = getFieldById(fields, child.fieldId);
        const operatorOptions = getOperatorsForField(field).map((operator) => ({
          value: operator.id,
          label: operator.label,
        }));

        return (
          <Stack
            direction={{ xs: "column", lg: "row" }}
            key={child.id}
            spacing={1}
            sx={{
              p: 1.5,
              borderRadius: "var(--joy-radius-md)",
              backgroundColor: "background.surface",
              border: "1px solid",
              borderColor: "neutral.200",
            }}
          >
            <JoyAutocomplete<BuilderOption, false, false, false>
              getOptionLabel={(option) => option.label}
              groupBy={(option) => option.category ?? "Other"}
              isOptionEqualToValue={(option, current) =>
                option.id === current.id
              }
              onValueChange={(nextValue) =>
                onGroupChange(
                  updateNode(group, child.id, () => ({
                    ...child,
                    fieldId: nextValue?.id ?? null,
                    operatorId: null,
                    value: null,
                  })),
                )
              }
              options={fieldOptions}
              placeholder="Field"
              renderOption={(props, option) => (
                <li {...props} key={option.id}>
                  {option.label}
                </li>
              )}
              value={
                fieldOptions.find((option) => option.id === child.fieldId) ??
                null
              }
            />

            <JoySelect
              onValueChange={(nextValue) =>
                onGroupChange(
                  updateNode(group, child.id, () => ({
                    ...child,
                    operatorId: (nextValue || null) as SegmentOperatorId | null,
                    value: SEGMENT_OPERATORS[nextValue as SegmentOperatorId]
                      ?.allowsMultiple
                      ? []
                      : null,
                  })),
                )
              }
              options={operatorOptions}
              placeholder="Operator"
              sx={{ minWidth: 180 }}
              value={child.operatorId ?? ""}
            />

            <Box sx={{ flex: 1, minWidth: { lg: 260 } }}>
              {field && child.operatorId ? (
                <RuleValueEditor
                  currentSegmentId={currentSegmentId}
                  dependencySource={dependencySource}
                  field={field}
                  onChange={(nextValue) =>
                    onGroupChange(
                      updateNode(group, child.id, () => ({
                        ...child,
                        value: nextValue,
                      })),
                    )
                  }
                  personaOptions={personaOptions}
                  rule={child}
                  segmentOptions={segmentOptions}
                  tagOptions={tagOptions}
                />
              ) : (
                <Typography level="body-sm" color="neutral" sx={{ py: 1 }}>
                  Select a field and operator to define this rule.
                </Typography>
              )}
            </Box>

            <JoyButton
              bloomVariant="ghost"
              color="danger"
              onClick={() => onGroupChange(removeNode(group, child.id))}
              size="sm"
              sx={{ alignSelf: { xs: "flex-start", lg: "center" } }}
            >
              <Trash2 size={16} />
            </JoyButton>
          </Stack>
        );
      })}
    </Stack>
  );
}

export function SegmentRuleBuilder({
  value,
  fields,
  segmentOptions,
  personaOptions,
  tagOptions,
  currentSegmentId,
  dependencySource,
  onChange,
}: SegmentRuleBuilderProps) {
  return (
    <JoyCard>
      <JoyCardHeader
        description="Build dynamic audiences with nested AND/OR groups up to three levels deep."
        title="Rules"
      />
      <JoyCardContent
        sx={{ display: "flex", flexDirection: "column", gap: 2.5, pt: 3 }}
      >
        <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
          <Chip color="primary" size="sm" variant="soft">
            Nested groups enabled
          </Chip>
          <Chip color="neutral" size="sm" variant="outlined">
            Max depth: 3
          </Chip>
        </Stack>

        <Divider />

        <GroupEditor
          currentSegmentId={currentSegmentId}
          dependencySource={dependencySource}
          depth={0}
          fields={fields}
          group={value}
          onGroupChange={onChange}
          personaOptions={personaOptions}
          segmentOptions={segmentOptions}
          tagOptions={tagOptions}
        />
      </JoyCardContent>
    </JoyCard>
  );
}
