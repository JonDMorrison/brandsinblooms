import React, { useMemo, useState } from "react";
import Sheet from "@mui/joy/Sheet";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { Clock3 } from "lucide-react";
import { JoyButton } from "@/components/joy/JoyButton";
import { JoyInput } from "@/components/joy/JoyInput";
import { JoySelect } from "@/components/joy/JoySelect";

interface DelayNodeData {
  delayValue: number;
  delayUnit: "minutes" | "hours" | "days" | "weeks";
}

interface DelayNodeEditorProps {
  data: DelayNodeData;
  onSave: (data: DelayNodeData) => void;
  onCancel: () => void;
}

const delayUnits = [
  { value: "minutes", label: "Minutes" },
  { value: "hours", label: "Hours" },
  { value: "days", label: "Days" },
  { value: "weeks", label: "Weeks" },
];

export const DelayNodeEditor: React.FC<DelayNodeEditorProps> = ({
  data,
  onSave,
  onCancel,
}) => {
  const [delayValue, setDelayValue] = useState(data.delayValue || 1);
  const [delayUnit, setDelayUnit] = useState<
    "minutes" | "hours" | "days" | "weeks"
  >(data.delayUnit || "hours");

  const error = useMemo(() => {
    if (delayValue <= 0) {
      return "Delay value must be greater than 0";
    }

    if (delayValue > 52 && delayUnit === "weeks") {
      return "Maximum delay is 52 weeks";
    }

    if (delayValue > 365 && delayUnit === "days") {
      return "Maximum delay is 365 days";
    }

    if (delayValue > 8760 && delayUnit === "hours") {
      return "Maximum delay is 8760 hours (1 year)";
    }

    if (delayValue > 525600 && delayUnit === "minutes") {
      return "Maximum delay is 525600 minutes (1 year)";
    }

    return "";
  }, [delayUnit, delayValue]);

  const validateAndSave = () => {
    if (error) {
      return;
    }

    onSave({ ...data, delayValue, delayUnit });
  };

  const getDelayPreview = () => {
    if (delayValue === 1) {
      return `Wait 1 ${delayUnit.slice(0, -1)}`;
    }
    return `Wait ${delayValue} ${delayUnit}`;
  };

  return (
    <Stack spacing={2} sx={{ p: 2 }}>
      <Sheet variant="soft" color="neutral" sx={{ p: 1.5, borderRadius: "lg" }}>
        <Stack direction="row" spacing={1.25} alignItems="flex-start">
          <Clock3 size={16} />
          <Stack spacing={0.5}>
            <Typography level="title-sm">Delay window</Typography>
            <Typography level="body-sm" sx={{ color: "neutral.600" }}>
              Choose how long a customer waits before the next step. Weeks are
              supported for longer nurture gaps.
            </Typography>
          </Stack>
        </Stack>
      </Sheet>

      <Stack direction="row" spacing={1}>
        <JoyInput
          label="Delay"
          type="number"
          value={String(delayValue)}
          onChange={(event) =>
            setDelayValue(Number.parseInt(event.target.value || "1", 10) || 1)
          }
          error={Boolean(error)}
          errorMessage={error || undefined}
        />
        <JoySelect
          label="Unit"
          value={delayUnit}
          onChange={(_event, value) => {
            if (value) {
              setDelayUnit(value as "minutes" | "hours" | "days" | "weeks");
            }
          }}
          options={delayUnits}
        />
      </Stack>

      <Sheet variant="outlined" sx={{ p: 1.5, borderRadius: "lg" }}>
        <Typography level="title-sm">Preview</Typography>
        <Typography level="body-sm" sx={{ mt: 0.5, color: "neutral.600" }}>
          {getDelayPreview()} before the next step runs.
        </Typography>
      </Sheet>

      <Stack direction="row" spacing={1} justifyContent="flex-end">
        <JoyButton variant="outlined" color="neutral" onClick={onCancel}>
          Cancel
        </JoyButton>
        <JoyButton onClick={validateAndSave} disabled={Boolean(error)}>
          Save changes
        </JoyButton>
      </Stack>
    </Stack>
  );
};
