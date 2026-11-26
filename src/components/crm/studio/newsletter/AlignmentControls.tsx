import {
  AlignCenter,
  AlignCenterHorizontal,
  AlignEndHorizontal,
  AlignLeft,
  AlignRight,
  AlignStartHorizontal,
  StretchHorizontal,
} from "lucide-react";
import type { BlockAppearance } from "@/types/newsletterDesign";
import type { StudioBlock, StudioTextAlign } from "@/types/studioBlocks";
import StudioAlignmentToggle from "../fields/StudioAlignmentToggle";
import StudioSegmentedField from "../fields/StudioSegmentedField";

/**
 * Shared alignment controls for every newsletter block.
 *
 * - Text alignment moves words only: Left, Centre, Right.
 * - Element alignment moves a button, line or logo: Left, Centre, Right and,
 *   where it means something, Full width. Full width replaces the other three.
 * - Vertical alignment lines words up beside a photo: Top, Middle, Bottom.
 *
 * The three never write to each other's fields.
 */

export function TextAlignField({
  value,
  fallback = "left",
  label = "Text alignment",
  onChange,
}: {
  value?: StudioTextAlign;
  /** What the block shows when nothing has been picked yet. */
  fallback?: StudioTextAlign;
  label?: string;
  onChange: (value: StudioTextAlign) => void;
}) {
  return (
    <StudioAlignmentToggle label={label} value={value ?? fallback} onChange={onChange} />
  );
}

export type ElementAlignValue = StudioTextAlign | "full";

const ELEMENT_OPTIONS = [
  { value: "left", label: "Left", icon: AlignLeft },
  { value: "center", label: "Centre", icon: AlignCenter },
  { value: "right", label: "Right", icon: AlignRight },
  { value: "full", label: "Full width", icon: StretchHorizontal },
] as const;

export function ElementAlignField({
  label,
  align,
  fullWidth = false,
  fallback = "left",
  allowFullWidth = true,
  onChange,
}: {
  label: string;
  align?: StudioTextAlign;
  fullWidth?: boolean;
  fallback?: StudioTextAlign;
  allowFullWidth?: boolean;
  onChange: (next: { align: StudioTextAlign | undefined; fullWidth: boolean }) => void;
}) {
  const options = allowFullWidth ? ELEMENT_OPTIONS : ELEMENT_OPTIONS.slice(0, 3);
  const value: ElementAlignValue = allowFullWidth && fullWidth ? "full" : (align ?? fallback);
  return (
    <StudioSegmentedField<ElementAlignValue>
      label={label}
      value={value}
      options={options}
      onChange={(next) =>
        next === "full"
          // The saved side is kept, so turning Full width off restores it.
          ? onChange({ align, fullWidth: true })
          : onChange({ align: next, fullWidth: false })
      }
    />
  );
}

/** Button alignment for any block. Writes `buttonAlign` and `fullWidthButton` only. */
export function ButtonAlignField({
  block,
  fallback = "left",
  onChange,
}: {
  block: Pick<StudioBlock, "buttonAlign" | "fullWidthButton">;
  fallback?: StudioTextAlign;
  onChange: (fields: Pick<StudioBlock, "buttonAlign" | "fullWidthButton">) => void;
}) {
  return (
    <ElementAlignField
      label="Button alignment"
      align={block.buttonAlign}
      fullWidth={Boolean(block.fullWidthButton)}
      fallback={fallback}
      onChange={({ align, fullWidth }) =>
        onChange({ buttonAlign: align, fullWidthButton: fullWidth })
      }
    />
  );
}

type VerticalAlign = NonNullable<BlockAppearance["verticalAlign"]>;

const VERTICAL_OPTIONS = [
  { value: "top", label: "Top", icon: AlignStartHorizontal },
  { value: "middle", label: "Middle", icon: AlignCenterHorizontal },
  { value: "bottom", label: "Bottom", icon: AlignEndHorizontal },
] as const;

/** Only show this where words sit beside a photo. It does nothing elsewhere. */
export function VerticalAlignField({
  value,
  fallback = "middle",
  label = "Line up the words beside the photo",
  onChange,
}: {
  value?: VerticalAlign;
  fallback?: VerticalAlign;
  label?: string;
  onChange: (value: VerticalAlign) => void;
}) {
  return (
    <StudioSegmentedField<VerticalAlign>
      label={label}
      value={value ?? fallback}
      options={VERTICAL_OPTIONS}
      onChange={onChange}
    />
  );
}
