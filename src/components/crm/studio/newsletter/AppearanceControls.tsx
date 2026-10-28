import * as React from "react";
import type {
  BlockAppearance,
  EdgeSpacing,
  TextAppearance,
  TextRole,
} from "@/types/newsletterDesign";
import { EMAIL_FONTS, HEADING_SIZES } from "@/lib/studio/newsletter/settings";
import "./newsletterControls.css";

export function Field({
  label,
  value,
  onChange,
  multiline = false,
  placeholder,
  type = "text",
}: {
  label: string;
  value?: string;
  onChange: (value: string) => void;
  multiline?: boolean;
  placeholder?: string;
  type?: string;
}) {
  const id = React.useId();
  return (
    <label className="nl-field" htmlFor={id}>
      <span>{label}</span>
      {multiline ? (
        <textarea
          id={id}
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          rows={3}
          placeholder={placeholder}
        />
      ) : (
        <input
          id={id}
          type={type}
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
        />
      )}
    </label>
  );
}
export function NumericField({
  label,
  value,
  onChange,
  min = 0,
  max = 160,
  step = 1,
  placeholder = "Inherit",
}: {
  label: string;
  value?: number;
  onChange: (value: number | undefined) => void;
  min?: number;
  max?: number;
  step?: number;
  placeholder?: string;
}) {
  const id = React.useId();
  return (
    <label className="nl-field" htmlFor={id}>
      <span>{label}</span>
      <input
        id={id}
        type="number"
        value={value ?? ""}
        min={min}
        max={max}
        step={step}
        placeholder={placeholder}
        onChange={(e) => {
          const n = e.target.valueAsNumber;
          onChange(
            Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : undefined,
          );
        }}
      />
    </label>
  );
}
export function Choice({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value?: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
}) {
  const id = React.useId();
  return (
    <label className="nl-field" htmlFor={id}>
      <span>{label}</span>
      <select
        id={id}
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
export function ColorField({
  label,
  value,
  onChange,
  transparent = false,
}: {
  label: string;
  value?: string;
  onChange: (value: string | undefined) => void;
  transparent?: boolean;
}) {
  const id = React.useId();
  return (
    <div className="nl-field">
      <label htmlFor={id}>{label}</label>
      <div className="nl-inline">
        <input
          aria-label={`${label} colour picker`}
          type="color"
          value={/^#[0-9a-f]{6}$/i.test(value || "") ? value : "#ffffff"}
          onChange={(e) => onChange(e.target.value)}
        />
        <input
          id={id}
          value={value || ""}
          placeholder={
            transparent ? "Inherit / transparent / #HEX" : "Inherit / #HEX"
          }
          onChange={(e) => onChange(e.target.value || undefined)}
        />
        <button
          type="button"
          className="nl-quiet"
          onClick={() => onChange(transparent ? "transparent" : undefined)}
        >
          {transparent ? "None" : "Reset"}
        </button>
      </div>
    </div>
  );
}
function Edges({
  title,
  value,
  onChange,
}: {
  title: string;
  value?: EdgeSpacing;
  onChange: (next: EdgeSpacing) => void;
}) {
  return (
    <fieldset className="nl-fieldset">
      <legend>{title} (px)</legend>
      <div className="nl-grid-2">
        {(["top", "right", "bottom", "left"] as const).map((edge) => (
          <NumericField
            key={edge}
            label={`${title} ${edge}`}
            value={value?.[edge]}
            onChange={(next) => onChange({ ...value, [edge]: next })}
          />
        ))}
      </div>
    </fieldset>
  );
}
export default function AppearanceControls({
  value = {},
  onChange,
  master = false,
  allowedFonts,
}: {
  value?: BlockAppearance;
  onChange: (next: BlockAppearance) => void;
  master?: boolean;
  allowedFonts?: string[];
}) {
  const [role, setRole] = React.useState<TextRole>("body");
  const appearance = value.text?.[role] || {};
  const updateText = (patch: Partial<TextAppearance>) =>
    onChange({
      ...value,
      text: { ...value.text, [role]: { ...appearance, ...patch } },
    });
  const fonts = Array.from(
    new Set(allowedFonts?.length ? allowedFonts : [...EMAIL_FONTS]),
  );
  return (
    <div className="nl-controls">
      <details>
        <summary>Spacing</summary>
        <Edges
          title="Margin"
          value={value.margin}
          onChange={(next) => onChange({ ...value, margin: next })}
        />
        <Edges
          title="Padding"
          value={value.padding}
          onChange={(next) => onChange({ ...value, padding: next })}
        />
      </details>
      <details>
        <summary>Typography & colours</summary>
        <Choice
          label="Text element"
          value={role}
          onChange={(next) => setRole(next as TextRole)}
          options={[
            ...Object.keys(HEADING_SIZES),
            ...(!master ? ["heading", "subheading"] : []),
            "body",
            "price",
            "smallPrint",
            "button",
            "label",
          ].map((key) => ({
            value: key,
            label:
              (
                {
                  heading: "Heading text",
                  subheading: "Subtitle",
                  smallPrint: "Conditions / small print",
                  body: "Body",
                  price: "Offer / price",
                  button: "Button",
                  label: "Introduction / label",
                } as Record<string, string>
              )[key] || key.toUpperCase(),
          }))}
        />
        <div className="nl-grid-2">
          <NumericField
            label="Size (px)"
            value={appearance.size}
            min={8}
            max={96}
            onChange={(size) => updateText({ size })}
          />
          <NumericField
            label="Line height"
            value={appearance.lineHeight}
            min={1}
            max={3}
            step={0.05}
            onChange={(lineHeight) => updateText({ lineHeight })}
          />
        </div>
        <Choice
          label="Weight"
          value={appearance.weight?.toString() || ""}
          onChange={(next) =>
            updateText({ weight: next ? Number(next) : undefined })
          }
          options={[
            { value: "", label: "Inherit" },
            ...[300, 400, 500, 600, 700, 800, 900].map((n) => ({
              value: String(n),
              label: String(n),
            })),
          ]}
        />
        <Choice
          label="Font"
          value={appearance.fontFamily || ""}
          onChange={(fontFamily) =>
            updateText({ fontFamily: fontFamily || undefined })
          }
          options={[
            { value: "", label: "Inherit newsletter font" },
            ...fonts.map((font) => ({
              value: font,
              label: font.split(",")[0],
            })),
          ]}
        />
        <ColorField
          label="Text colour"
          value={appearance.color}
          onChange={(color) => updateText({ color })}
        />
        <ColorField
          label="Block background"
          transparent
          value={value.background}
          onChange={(background) => onChange({ ...value, background })}
        />
        <ColorField
          label="Text link colour"
          value={value.linkColor}
          onChange={(linkColor) => onChange({ ...value, linkColor })}
        />
        <Choice
          label="Text link decoration"
          value={value.linkDecoration || ""}
          onChange={(next) =>
            onChange({
              ...value,
              linkDecoration:
                next === "none"
                  ? "none"
                  : next === "underline"
                    ? "underline"
                    : undefined,
            })
          }
          options={[
            { value: "", label: "Inherit" },
            { value: "underline", label: "Underlined" },
            { value: "none", label: "No underline" },
          ]}
        />
      </details>
      <details>
        <summary>Border & label</summary>
        <Choice
          label="Border style"
          value={value.border?.style || "none"}
          onChange={(style) =>
            onChange({
              ...value,
              border: {
                ...value.border,
                style: style as NonNullable<BlockAppearance["border"]>["style"],
              },
            })
          }
          options={["none", "solid", "dashed", "dotted", "double"].map(
            (style) => ({
              value: style,
              label: style.charAt(0).toUpperCase() + style.slice(1),
            }),
          )}
        />
        <div className="nl-grid-2">
          <NumericField
            label="Border width (px)"
            value={value.border?.width}
            max={12}
            onChange={(width) =>
              onChange({ ...value, border: { ...value.border, width } })
            }
          />
          <NumericField
            label="Corner radius (px)"
            value={value.border?.radius}
            max={48}
            onChange={(radius) =>
              onChange({ ...value, border: { ...value.border, radius } })
            }
          />
        </div>
        <ColorField
          label="Border colour"
          value={value.border?.color}
          onChange={(color) =>
            onChange({ ...value, border: { ...value.border, color } })
          }
        />
        <Field
          label="Border legend (optional)"
          value={value.border?.legend}
          onChange={(legend) =>
            onChange({ ...value, border: { ...value.border, legend } })
          }
          placeholder="e.g. This week's offers"
        />
      </details>
      {!master && (
        <details>
          <summary>Image & button spacing</summary>
          <Edges
            title="Image padding"
            value={value.imagePadding}
            onChange={(next) => onChange({ ...value, imagePadding: next })}
          />
          <Edges
            title="Image margin"
            value={value.imageMargin}
            onChange={(next) => onChange({ ...value, imageMargin: next })}
          />
          <Choice
            label="Text vertical alignment"
            value={value.verticalAlign || "middle"}
            onChange={(next) =>
              onChange({
                ...value,
                verticalAlign: next as BlockAppearance["verticalAlign"],
              })
            }
            options={["top", "middle", "bottom"].map((value) => ({
              value,
              label: value,
            }))}
          />
          <div className="nl-grid-2">
            <NumericField
              label="Button horizontal padding"
              max={96}
              value={value.buttonPaddingX}
              onChange={(buttonPaddingX) =>
                onChange({ ...value, buttonPaddingX })
              }
            />
            <NumericField
              label="Button vertical padding"
              max={48}
              value={value.buttonPaddingY}
              onChange={(buttonPaddingY) =>
                onChange({ ...value, buttonPaddingY })
              }
            />
          </div>
        </details>
      )}
    </div>
  );
}
