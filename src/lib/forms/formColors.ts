import type { FormSettings } from "@/types/formBuilder";
import {
  type FormBrandColors,
  resolveFormColors,
} from "../../../supabase/functions/_shared/formColors";

export {
  chosenFormColor,
  NEUTRAL_FORM_COLORS,
  resolveFormColors,
  STOCK_FORM_COLORS,
} from "../../../supabase/functions/_shared/formColors";
export type {
  FormBrandColors,
  ResolvedFormColors,
} from "../../../supabase/functions/_shared/formColors";

/**
 * Settings ready to render: theme colours resolved from the form's own
 * choice, then the tenant brand, then the neutral palette. Render with the
 * result only. Never save it, or the form stops following the brand.
 */
export function applyFormBrandColors(
  settings: FormSettings,
  brand?: FormBrandColors | null,
): FormSettings {
  return {
    ...settings,
    theme: {
      ...settings.theme,
      ...resolveFormColors(settings.theme, brand),
    },
  };
}
