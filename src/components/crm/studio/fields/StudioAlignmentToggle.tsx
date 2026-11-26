import * as React from "react";
import { AlignCenter, AlignLeft, AlignRight } from "lucide-react";
import StudioSegmentedField from "./StudioSegmentedField";

type AlignmentValue = "left" | "center" | "right";

type StudioAlignmentToggleProps = {
  label: string;
  defaultValue?: AlignmentValue;
  value?: AlignmentValue;
  onChange?: (value: AlignmentValue) => void;
};

const OPTIONS = [
  { value: "left", label: "left align", icon: AlignLeft },
  { value: "center", label: "center align", icon: AlignCenter },
  { value: "right", label: "right align", icon: AlignRight },
] as const;

/** Left / Centre / Right. Shared by every text and logo alignment control. */
export default function StudioAlignmentToggle({
  label,
  defaultValue = "left",
  value,
  onChange,
}: StudioAlignmentToggleProps) {
  const [internalValue, setInternalValue] =
    React.useState<AlignmentValue>(defaultValue);
  const resolvedValue = value ?? internalValue;

  const commitValue = React.useCallback(
    (nextValue: AlignmentValue) => {
      if (value === undefined) {
        setInternalValue(nextValue);
      }

      onChange?.(nextValue);
    },
    [onChange, value],
  );

  return (
    <StudioSegmentedField
      label={label}
      value={resolvedValue}
      options={OPTIONS}
      onChange={commitValue}
    />
  );
}
