import * as React from "react";
import type {
  BlockAppearance,
  EdgeSpacing,
  TextAppearance,
  TextRole,
} from "@/types/newsletterDesign";
import { EMAIL_FONTS, HEADING_SIZES } from "@/lib/studio/newsletter/settings";
import type { StudioBlock } from "@/types/studioBlocks";
import { useNewsletterDesign } from "./NewsletterDesignContext";
import StudioColorPicker from "../fields/StudioColorPicker";
import { VerticalAlignField } from "./AlignmentControls";
import "./newsletterControls.css";

/** Local placeholder copy. No AI and no network call. */
export const SAMPLE_TEXT =
  "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.";

export function Field({
  label,
  value,
  onChange,
  multiline = false,
  placeholder,
  type = "text",
  captureTab = false,
  sampleText = multiline,
}: {
  label: string;
  value?: string;
  onChange: (value: string) => void;
  multiline?: boolean;
  placeholder?: string;
  type?: string;
  captureTab?: boolean;
  /** Offer "Insert lorem ipsum" under an empty box. On for multi-line boxes. */
  sampleText?: boolean;
}) {
  const id = React.useId();
  const clearable = type === "text" || type === "url" || type === "email";
  const hasValue = Boolean(value);
  return (
    <div className="nl-field">
      <label htmlFor={id}>{label}</label>
      {multiline ? (
        <>
          <textarea
            id={id}
            value={value || ""}
            onChange={(e) => onChange(e.target.value)}
            rows={3}
            placeholder={placeholder}
            onKeyDown={(event) => {
              if (!captureTab || event.key !== "Tab" || event.shiftKey || event.ctrlKey || event.metaKey) return;
              event.preventDefault();
              const field = event.currentTarget;
              const start = field.selectionStart;
              const end = field.selectionEnd;
              onChange(`${field.value.slice(0, start)}\t${field.value.slice(end)}`);
              requestAnimationFrame(() => { field.setSelectionRange(start + 1, start + 1); });
            }}
          />
          {(hasValue || sampleText) && (
            <div className="nl-field-actions">
              {sampleText && !hasValue && (
                <button type="button" className="nl-text-action" onClick={() => onChange(SAMPLE_TEXT)}>
                  Insert lorem ipsum
                </button>
              )}
              {hasValue && (
                <button type="button" className="nl-text-action" aria-label={`Clear ${label}`} onClick={() => onChange("")}>
                  Clear text
                </button>
              )}
            </div>
          )}
        </>
      ) : (
        <div className="nl-input-wrap">
          <input
            id={id}
            type={type}
            value={value || ""}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
          />
          {clearable && hasValue && (
            <button
              type="button"
              className="nl-input-clear"
              aria-label={`Clear ${label}`}
              title="Clear"
              onClick={() => onChange("")}
            >
              <span aria-hidden="true">&times;</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
export function NumericField({
  label,
  value,
  onChange,
  min = 0,
  max = 160,
  step = 1,
  placeholder = "Auto",
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
  // Keep incomplete input visible while typing (e.g. "1" before "12" or
  // "8" before "800"). Clamping every keystroke changes what the user entered.
  const [draft, setDraft] = React.useState<string | null>(null);
  const commit = (raw: string) => {
    const parsed = Number(raw);
    onChange(raw.trim() === "" || !Number.isFinite(parsed)
      ? undefined
      : Math.max(min, Math.min(max, parsed)));
    setDraft(null);
  };
  return (
    <label className="nl-field" htmlFor={id}>
      <span>{label}</span>
      <input
        id={id}
        type="number"
        value={draft ?? value ?? ""}
        min={min}
        max={max}
        step={step}
        placeholder={placeholder}
        onChange={(e) => {
          const next = e.target.value;
          setDraft(next);
          const number = e.target.valueAsNumber;
          if (!next) onChange(undefined);
          else if (Number.isFinite(number) && number >= min && number <= max) {
            onChange(number);
          }
        }}
        onBlur={() => { if (draft !== null) commit(draft); }}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            event.currentTarget.blur();
          }
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
            {option.label.charAt(0).toUpperCase() + option.label.slice(1)}
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
  return (
    <div className="nl-field">
      <StudioColorPicker
        label={label}
        value={value ?? "transparent"}
        onChange={(next) =>
          onChange(
            !next.trim() || (next === "transparent" && !transparent)
              ? undefined
              : next,
          )
        }
      />
    </div>
  );
}
/**
 * One spacing row: a short visible label ("Top"), a slider and a number box
 * on one line. The number box keeps the full accessible name
 * ("Image padding top") so it still reads clearly to screen readers.
 */
export function SliderNumberRow({
  label,
  accessibleName,
  value,
  onChange,
  min = 0,
  max = 160,
  placeholder = "Auto",
}: {
  label: string;
  accessibleName: string;
  value?: number;
  onChange: (value: number | undefined) => void;
  min?: number;
  max?: number;
  placeholder?: string;
}) {
  // Same typing rule as NumericField: keep partial input ("1" on the way to
  // "12") on screen instead of clamping each keystroke.
  const [draft, setDraft] = React.useState<string | null>(null);
  const fallback = Number(placeholder);
  const sliderValue = value ?? (Number.isFinite(fallback) ? fallback : min);
  const commit = (raw: string) => {
    const parsed = Number(raw);
    onChange(raw.trim() === "" || !Number.isFinite(parsed)
      ? undefined
      : Math.max(min, Math.min(max, parsed)));
    setDraft(null);
  };
  return (
    <div className="nl-slider-row">
      <span aria-hidden="true">{label}</span>
      <input
        type="range"
        aria-label={`${accessibleName} slider`}
        min={min}
        max={max}
        step={1}
        value={Math.max(min, Math.min(max, sliderValue))}
        onChange={(e) => {
          setDraft(null);
          onChange(e.target.valueAsNumber);
        }}
      />
      <input
        type="number"
        aria-label={accessibleName}
        min={min}
        max={max}
        step={1}
        value={draft ?? value ?? ""}
        placeholder={placeholder}
        onChange={(e) => {
          const next = e.target.value;
          setDraft(next);
          const number = e.target.valueAsNumber;
          if (!next) onChange(undefined);
          else if (Number.isFinite(number) && number >= min && number <= max) onChange(number);
        }}
        onBlur={() => { if (draft !== null) commit(draft); }}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            event.currentTarget.blur();
          }
        }}
      />
    </div>
  );
}
const EDGE_LABELS = { top: "Top", right: "Right", bottom: "Bottom", left: "Left" } as const;
function Edges({
  title,
  value,
  fallback,
  initial,
  onChange,
}: {
  title: string;
  value?: EdgeSpacing;
  fallback?: EdgeSpacing;
  initial?: EdgeSpacing;
  onChange: (next: EdgeSpacing) => void;
}) {
  return (
    <fieldset className="nl-fieldset">
      <legend>{title} (px)</legend>
      {(["top", "right", "bottom", "left"] as const).map((edge) => (
        <SliderNumberRow
          key={edge}
          label={EDGE_LABELS[edge]}
          accessibleName={`${title} ${edge}`}
          value={value?.[edge]}
          placeholder={String(fallback?.[edge] ?? "Auto")}
          onChange={(next) => onChange({ ...initial, ...value, [edge]: next })}
        />
      ))}
    </fieldset>
  );
}
type AppearanceFieldsProps = {
  value?: BlockAppearance;
  onChange: (next: BlockAppearance) => void;
};

export function ImageSpacingFields({
  value = {},
  onChange,
  collapsible = true,
}: AppearanceFieldsProps & { collapsible?: boolean }) {
  const fields = (
    <div className="nl-controls">
      <Edges
          title="Image padding"
          value={value.imagePadding}
          onChange={(imagePadding) => onChange({ ...value, imagePadding })}
        />
        <Edges
          title="Image margin"
          value={value.imageMargin}
          onChange={(imageMargin) => onChange({ ...value, imageMargin })}
        />
    </div>
  );
  // Most people never need these eight number boxes, so they stay folded
  // away until someone asks for them.
  return collapsible ? (
    <details className="nl-controls">
      <summary>Adjust the space around the photo</summary>
      {fields}
    </details>
  ) : (
    fields
  );
}

export function ButtonPaddingFields({
  value = {},
  onChange,
  collapsible = true,
}: AppearanceFieldsProps & { collapsible?: boolean }) {
  const fields = (
    <fieldset className="nl-fieldset">
      <legend>Button padding (px)</legend>
      <SliderNumberRow
        label="Sides"
        accessibleName="Button horizontal padding"
        max={96}
        placeholder="22"
        value={value.buttonPaddingX}
        onChange={(buttonPaddingX) => onChange({ ...value, buttonPaddingX })}
      />
      <SliderNumberRow
        label="Top / bottom"
        accessibleName="Button vertical padding"
        max={48}
        placeholder="12"
        value={value.buttonPaddingY}
        onChange={(buttonPaddingY) => onChange({ ...value, buttonPaddingY })}
      />
    </fieldset>
  );
  return collapsible ? (
    <details className="nl-controls">
      <summary>Button padding</summary>
      {fields}
    </details>
  ) : (
    fields
  );
}

export function VerticalAlignmentField({ value = {}, onChange }: AppearanceFieldsProps) {
  return (
    <VerticalAlignField
      value={value.verticalAlign}
      onChange={(verticalAlign) => onChange({ ...value, verticalAlign })}
    />
  );
}

// Blocks with dedicated appearance sections get only the text roles they display.
function textRolesForBlock(block: StudioBlock): TextRole[] | undefined {
  switch (block.type) {
    case "plain-text":
    case "text-columns":
      return ["body"];
    case "full-width-image":
    case "divider":
    case "spacer":
    case "footer":
      return [];
    case "newsletter-header":
      return ["heading", "subheading"];
    case "social-follow":
      return [];
    case "image-gallery":
      return ["smallPrint"]; // Gallery captions, without unrelated button controls.
    case "product-gallery":
    case "product-card":
      return ["heading", "subheading", "body", "price", "button"];
    case "image-text":
      return ["body", "heading", "subheading", "button"];
    case "email-safe-hero":
      return ["body", "heading", "subheading", "label", "button"];
    case "graphic-hero": {
      const roles: TextRole[] = [];
      if (block.showTextOverlay || block.showCaptionBar) roles.push("heading", "subheading");
      if (block.showButton) roles.push("button");
      return roles;
    }
    case "navigation":
      return ["button", "heading", "subheading"];
    case "button-group":
    case "call-to-action": {
      const roles: TextRole[] = ["button"];
      if (block.headline) roles.push("heading");
      if (block.subheading) roles.push("subheading");
      if (block.body && block.type === "call-to-action") roles.push("body");
      return roles;
    }
    case "headline":
      return ["heading"];
    default:
      return undefined;
  }
}

export default function AppearanceControls({
  value = {},
  onChange,
  block,
  master = false,
  allowedFonts,
  borderLead,
}: AppearanceFieldsProps & {
  block?: StudioBlock;
  master?: boolean;
  allowedFonts?: string[];
  /** Block-specific border controls shown first under "Border & label". */
  borderLead?: React.ReactNode;
}) {
  const { settings } = useNewsletterDesign();
  const [selectedRole, setRole] = React.useState<TextRole>("body");
  const blockRoles = block && textRolesForBlock(block);
  // Dedicated gallery, product, social, event and coupon editors place image/button
  // spacing with the content it affects. Never render the generic copies below.
  const hasDedicatedSpacing = Boolean(block && [
    "image-gallery", "product-gallery", "product-card", "social-follow",
    "event", "blog", "announcement", "coupon",
  ].includes(block.type));
  const roles: TextRole[] = blockRoles ?? [
    ...(Object.keys(HEADING_SIZES) as TextRole[]),
    ...(!master ? ["heading", "subheading"] as const : []),
    "body", "price", "smallPrint", "button", "label",
  ];
  const role = roles.includes(selectedRole) ? selectedRole : roles[0] ?? "body";
  const appearance = value.text?.[role] || {};
  const updateText = (patch: Partial<TextAppearance>) =>
    onChange({
      ...value,
      text: { ...value.text, [role]: { ...appearance, ...patch } },
    });
  const plain = block?.type === "plain-text" ? block : undefined;
  const cta = block?.type === "call-to-action" ? block : undefined;
  const inherited = (plain || cta) ? settings?.defaults : undefined;
  const verticalPadding = plain ? plain.contentPadding ?? 28 : cta?.verticalPadding ?? 32;
  const legacyPadding = (plain || cta) && !inherited?.padding && !value.padding
    ? { top: verticalPadding, right: 24, bottom: verticalPadding, left: 24 }
    : undefined;
  const legacySize = plain && ({ sm: 14, md: 16, lg: 18 }[plain.fontSize ?? "md"]);
  const inheritedWeight = inherited?.text?.body?.weight ?? (plain?.fontWeightPreset === "medium" ? 500 : 400);
  const type = block?.type;
  const showBlockBackground = !blockRoles || type === "plain-text" || type === "text-columns" ||
    type === "navigation" || type === "button-group";
  const showLinkFields = !blockRoles || type === "plain-text" || type === "text-columns" ||
    type === "image-text" || type === "email-safe-hero";
  const fonts = Array.from(
    new Set(allowedFonts?.length ? allowedFonts : [...EMAIL_FONTS]),
  );
  if (block?.type === "footer") return null;
  return (
    <div className="nl-controls">
      <details>
        <summary>{master ? "Spacing: padding & margins" : "Block Spacing and Margins"}</summary>
        <Edges
          title="Margin"
          value={value.margin}
          onChange={(next) => onChange({ ...value, margin: next })}
        />
        <Edges
          title="Padding"
          value={value.padding}
          fallback={inherited?.padding ?? legacyPadding}
          initial={legacyPadding}
          onChange={(next) => onChange({ ...value, padding: next })}
        />
      </details>
      {roles.length > 0 && (
        <details>
          <summary>Typography & colours</summary>
          {roles.length > 1 && (
            <Choice
              label="Text element"
              value={role}
              onChange={(next) => setRole(next as TextRole)}
              options={roles.map((key) => ({
                value: key,
                label:
                  (
                    {
                      heading: "Heading",
                      subheading: "Subheading",
                      smallPrint: "Conditions / small print",
                      body: "Body",
                      price: "Offer / price",
                      button: "Button",
                      label: "Introduction / label",
                    } as Record<string, string>
                  )[key] || key.toUpperCase(),
              }))}
            />
          )}
          <div className="nl-grid-2">
            <NumericField
              label="Size (px)"
              value={appearance.size}
              placeholder={String(inherited?.text?.body?.size ?? legacySize ?? "Auto")}
              min={8}
              max={96}
              onChange={(size) => updateText({ size })}
            />
            <NumericField
              label="Line height"
              value={appearance.lineHeight}
              placeholder={String(inherited?.text?.body?.lineHeight ?? plain?.lineHeight ?? "Auto")}
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
              { value: "", label: plain ? `Auto (${inheritedWeight})` : "Auto" },
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
              { value: "", label: "Same as the rest of the email" },
              ...fonts.map((font) => ({
                value: font,
                label: font.split(",")[0],
              })),
            ]}
          />
          {(!blockRoles || role !== "button") && (
            <ColorField
              label="Text colour"
              value={appearance.color ?? inherited?.text?.body?.color ?? plain?.textColor}
              onChange={(color) => updateText({ color })}
            />
          )}
          {showBlockBackground && (
            <ColorField
              label="Block background"
              transparent
              value={value.background ?? inherited?.background ?? plain?.backgroundColor}
              onChange={(background) => onChange({ ...value, background })}
            />
          )}
          {showLinkFields && (
            <>
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
                  { value: "", label: "Auto" },
                  { value: "underline", label: "Underlined" },
                  { value: "none", label: "No underline" },
                ]}
              />
            </>
          )}
        </details>
      )}
      {block?.type !== "divider" && block?.type !== "spacer" && (
        <details>
          <summary>Border & label</summary>
          {borderLead}
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
      )}
      {!master && !blockRoles && !hasDedicatedSpacing && (
        <>
          <details>
            <summary>Image Spacing</summary>
            <ImageSpacingFields value={value} onChange={onChange} collapsible={false} />
            <VerticalAlignmentField value={value} onChange={onChange} />
          </details>
          <details>
            <summary>Button Spacing</summary>
            <ButtonPaddingFields value={value} onChange={onChange} collapsible={false} />
          </details>
        </>
      )}
    </div>
  );
}
