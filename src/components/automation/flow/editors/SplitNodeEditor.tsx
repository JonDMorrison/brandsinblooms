import React, { useState } from "react";
import Chip from "@mui/joy/Chip";
import Sheet from "@mui/joy/Sheet";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { GitBranch } from "lucide-react";
import { JoyButton } from "@/components/joy/JoyButton";
import { JoyInput } from "@/components/joy/JoyInput";
import { JoySelect } from "@/components/joy/JoySelect";
import { JoyTextarea } from "@/components/joy/JoyTextarea";

interface SplitNodeData {
  splitType: "conditional" | "ab_test" | "random";
  conditions?: any[];
  percentage?: number;
  description?: string;
  conditionField?: string;
  conditionOperator?: string;
  conditionValue?: string;
  disclaimerAcknowledged?: boolean;
}

interface SplitNodeEditorProps {
  data: SplitNodeData;
  onSave: (data: SplitNodeData) => void;
  onCancel: () => void;
}

const fieldOptions = [
  { value: "total_spent", label: "Total spent" },
  { value: "last_purchase_date", label: "Last purchase date" },
  { value: "loyalty_status", label: "Loyalty status" },
  { value: "tag", label: "Customer tag" },
];

const operatorOptions = [
  { value: "equals", label: "Equals" },
  { value: "contains", label: "Contains" },
  { value: "greater_than", label: "Greater than" },
  { value: "less_than", label: "Less than" },
];

export const SplitNodeEditor: React.FC<SplitNodeEditorProps> = ({
  data,
  onSave,
  onCancel,
}) => {
  const [conditionField, setConditionField] = useState(
    data.conditionField || "total_spent",
  );
  const [conditionOperator, setConditionOperator] = useState(
    data.conditionOperator || "greater_than",
  );
  const [conditionValue, setConditionValue] = useState(
    data.conditionValue || "100",
  );
  const [description, setDescription] = useState(data.description || "");

  const handleSave = () => {
    onSave({
      ...data,
      splitType: "conditional",
      conditionField,
      conditionOperator,
      conditionValue,
      description,
      conditions: [
        {
          field: conditionField,
          operator: conditionOperator,
          value: conditionValue,
        },
      ],
      disclaimerAcknowledged: true,
    });
  };

  return (
    <Stack spacing={2} sx={{ p: 2 }}>
      <Sheet variant="soft" color="warning" sx={{ p: 1.5, borderRadius: "lg" }}>
        <Stack direction="row" spacing={1.25} alignItems="flex-start">
          <GitBranch size={16} />
          <Stack spacing={0.75}>
            <Typography level="title-sm">Condition branch</Typography>
            <Typography level="body-sm" sx={{ color: "neutral.700" }}>
              Branching is currently advisory in the compiler. Operators should
              treat this as a clearly labeled condition note until full runtime
              branching ships.
            </Typography>
            <Chip
              variant="soft"
              color="warning"
              size="sm"
              sx={{ alignSelf: "flex-start" }}
            >
              Advisory only in current executor
            </Chip>
          </Stack>
        </Stack>
      </Sheet>

      <JoySelect
        label="Field"
        value={conditionField}
        options={fieldOptions}
        onChange={(_event, value) => {
          if (value) {
            setConditionField(value);
          }
        }}
      />
      <JoySelect
        label="Operator"
        value={conditionOperator}
        options={operatorOptions}
        onChange={(_event, value) => {
          if (value) {
            setConditionOperator(value);
          }
        }}
      />
      <JoyInput
        label="Value"
        value={conditionValue}
        onChange={(event) => setConditionValue(event.target.value)}
        placeholder="100"
      />
      <JoyTextarea
        label="Operator note"
        value={description}
        onChange={(event) => setDescription(event.target.value)}
        minRows={4}
        placeholder="Example: High-value customers go down the yes branch."
      />

      <Stack direction="row" spacing={1} justifyContent="flex-end">
        <JoyButton variant="outlined" color="neutral" onClick={onCancel}>
          Cancel
        </JoyButton>
        <JoyButton onClick={handleSave}>Save changes</JoyButton>
      </Stack>
    </Stack>
  );
};
