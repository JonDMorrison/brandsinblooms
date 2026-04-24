import type { ColorPaletteProp } from "@mui/joy/styles";
import type { IntegrationDetailTone } from "@/components/integrations/integrationDetailModel";

export type IntegrationToneClasses = {
  badge: string;
  icon: string;
  iconWrap: string;
  dot: string;
  joyColor: ColorPaletteProp;
  chipColor: ColorPaletteProp;
  chipVariant: "soft" | "outlined";
  alertColor: ColorPaletteProp;
  dotColor: string;
  textColor: string;
  softBg: string;
  outlinedBorder: string;
};

export function getIntegrationToneClasses(
  tone: IntegrationDetailTone,
): IntegrationToneClasses {
  switch (tone) {
    case "success":
      return {
        badge: "border-emerald-200 bg-emerald-50 text-emerald-700",
        icon: "text-emerald-700",
        iconWrap: "border-emerald-200 bg-emerald-50/80",
        dot: "bg-emerald-500",
        joyColor: "success",
        chipColor: "success",
        chipVariant: "soft",
        alertColor: "success",
        dotColor: "success.500",
        textColor: "success.700",
        softBg: "success.softBg",
        outlinedBorder: "success.outlinedBorder",
      };
    case "warning":
      return {
        badge: "border-amber-200 bg-amber-50 text-amber-700",
        icon: "text-amber-700",
        iconWrap: "border-amber-200 bg-amber-50/80",
        dot: "bg-amber-500",
        joyColor: "warning",
        chipColor: "warning",
        chipVariant: "soft",
        alertColor: "warning",
        dotColor: "warning.500",
        textColor: "warning.700",
        softBg: "warning.softBg",
        outlinedBorder: "warning.outlinedBorder",
      };
    case "danger":
      return {
        badge: "border-rose-200 bg-rose-50 text-rose-700",
        icon: "text-rose-700",
        iconWrap: "border-rose-200 bg-rose-50/80",
        dot: "bg-rose-500",
        joyColor: "danger",
        chipColor: "danger",
        chipVariant: "soft",
        alertColor: "danger",
        dotColor: "danger.500",
        textColor: "danger.700",
        softBg: "danger.softBg",
        outlinedBorder: "danger.outlinedBorder",
      };
    default:
      return {
        badge: "border-slate-200 bg-slate-50 text-slate-700",
        icon: "text-slate-700",
        iconWrap: "border-slate-200 bg-slate-50/90",
        dot: "bg-slate-400",
        joyColor: "neutral",
        chipColor: "neutral",
        chipVariant: "outlined",
        alertColor: "neutral",
        dotColor: "neutral.400",
        textColor: "text.primary",
        softBg: "neutral.softBg",
        outlinedBorder: "neutral.outlinedBorder",
      };
  }
}
