// Form colours: one resolver for the editor, the hosted form page and the
// public form config (which every embed script reads).
//
// Order: a colour chosen on the form -> the tenant's brand colour -> the
// BloomSuite neutral palette. The stock Tailwind values below were seeded as
// defaults (forms, and the company_profiles column defaults), so they count
// as "nobody chose this" at every step and are never rendered.
//
// Pure TypeScript with no imports, so Deno edge functions and the Vite app
// share it.

export interface FormBrandColors {
  primary?: string | null;
  secondary?: string | null;
  text?: string | null;
}

export interface ResolvedFormColors {
  primary_color: string;
  secondary_color: string;
  text_color: string;
}

type ColorRole = "primary" | "secondary" | "text";

/** Seeded defaults that nobody chose (Tailwind green-500, blue-800, gray-800). */
export const STOCK_FORM_COLORS: Readonly<Record<ColorRole, string>> = {
  primary: "#22c55e",
  secondary: "#1e40af",
  text: "#1f2937",
};

/** BloomSuite neutral palette, used when neither the form nor the brand sets a colour. */
export const NEUTRAL_FORM_COLORS: Readonly<Record<ColorRole, string>> = {
  primary: "#30506E",
  secondary: "#203C4E",
  text: "#1F2937",
};

const HEX_COLOR = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

/**
 * The colour as a chosen value, or undefined when it is missing, invalid or
 * a stock default for that role.
 */
export function chosenFormColor(
  value: unknown,
  role: ColorRole,
): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!HEX_COLOR.test(trimmed)) return undefined;
  if (trimmed.toLowerCase() === STOCK_FORM_COLORS[role]) return undefined;
  return trimmed.toUpperCase();
}

/** Final colours to render: form choice, then brand, then neutral. */
export function resolveFormColors(
  theme: { primary_color?: unknown; secondary_color?: unknown; text_color?: unknown } | null | undefined,
  brand?: FormBrandColors | null,
): ResolvedFormColors {
  const pick = (formValue: unknown, brandValue: unknown, role: ColorRole) =>
    chosenFormColor(formValue, role) ??
    chosenFormColor(brandValue, role) ??
    NEUTRAL_FORM_COLORS[role];

  return {
    primary_color: pick(theme?.primary_color, brand?.primary, "primary"),
    secondary_color: pick(theme?.secondary_color, brand?.secondary, "secondary"),
    text_color: pick(theme?.text_color, brand?.text, "text"),
  };
}
