import type { IntegrationDetailTone } from "@/components/integrations/integrationDetailModel";

export type IntegrationToneClasses = {
  badge: string;
  icon: string;
  iconWrap: string;
  dot: string;
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
      };
    case "warning":
      return {
        badge: "border-amber-200 bg-amber-50 text-amber-700",
        icon: "text-amber-700",
        iconWrap: "border-amber-200 bg-amber-50/80",
        dot: "bg-amber-500",
      };
    case "danger":
      return {
        badge: "border-rose-200 bg-rose-50 text-rose-700",
        icon: "text-rose-700",
        iconWrap: "border-rose-200 bg-rose-50/80",
        dot: "bg-rose-500",
      };
    default:
      return {
        badge: "border-slate-200 bg-slate-50 text-slate-700",
        icon: "text-slate-700",
        iconWrap: "border-slate-200 bg-slate-50/90",
        dot: "bg-slate-400",
      };
  }
}